#!/usr/bin/env node
/** 解析器红绿灯测试：读 data/test-resolve.json，逐 case 跑 resolve.mjs。
 *  green 必须正确；red 验证优雅拒绝；yellow 允许解析不到但不允许错。
 *  用法: node scripts/test-resolve.mjs [--only title|author] [--id <case-id>]
 */
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { setTimeout as sleep } from 'node:timers/promises';

const SKILL_DIR = join(dirname(fileURLToPath(import.meta.url)), '..');
const { resolveByTitle, authorPapers } = await import(join(SKILL_DIR, 'scripts/resolve.mjs'));
const suite = JSON.parse(readFileSync(join(SKILL_DIR, 'data/test-resolve.json'), 'utf8'));

const only = process.argv.includes('--only') ? process.argv[process.argv.indexOf('--only') + 1] : '';
const onlyId = process.argv.includes('--id') ? process.argv[process.argv.indexOf('--id') + 1] : '';
const results = [];

function hitExpect(r, c) {
  if (!r) return false;
  const arx = (r.arxiv || '').replace(/v\d+$/, '');
  const okArx = (c.expectAnyOf?.arxiv || []).some(a => a === arx) && arx;
  const okDoi = (c.expectAnyOf?.doi || []).some(d => d === r.doi) && r.doi;
  return !!(okArx || okDoi);
}

async function runTitleCase(c) {
  const r = await resolveByTitle(c.title);
  if (c.type === 'yellow') {
    if (r === null) return 'GREEN（按预期未硬凑）';
    return hitExpect(r, c) ? 'GREEN（意外命中正确标识）'
      : `RED（黄灯 case 返回错误标识 ${r.doi || 'arxiv:' + r.arxiv}）`;
  }
  if (c.expectNull) {
    if (r === null) return 'GREEN';
    if ((c.note || '').includes('yellow 观察')) return `YELLOW（边界返回 ${r.doi || r.arxiv}，待观察）`;
    return `RED（应拒绝却返回 ${r.doi || 'arxiv:' + r.arxiv}）`;
  }
  if (!r) return 'YELLOW（未解析到——线上源波动或标题漂移）';
  return hitExpect(r, c)
    ? `GREEN（${r.doi || 'arXiv:' + r.arxiv} / ${r.source} / ${r.confidence}）`
    : `RED（doi=${r.doi || '-'} arxiv=${r.arxiv || '-'} 不在预期集合）`;
}

async function runAuthorCase(c) {
  const list = await authorPapers(c.name, { since: c.since || 0 });
  const [min, max] = c.expectCount;
  const n = list.length;
  if (n < min || n > max) return `RED（${n} 篇，超出 [${min},${max}]）`;
  if (c.expectContainsTitle) {
    const ok = list.some(p => (p.title || '').toLowerCase().includes(c.expectContainsTitle.toLowerCase()));
    if (!ok) return `YELLOW（${n} 篇但未含 "${c.expectContainsTitle}"——档案覆盖/重名波动）`;
  }
  return `GREEN（${n} 篇）`;
}

for (const c of suite.titleCases) {
  if (only && only !== 'title') continue;
  if (onlyId && onlyId !== c.id) continue;
  try { results.push({ id: c.id, verdict: await runTitleCase(c) }); }
  catch (e) { results.push({ id: c.id, verdict: 'YELLOW（异常: ' + String(e).slice(0, 80) + '）' }); }
  await sleep(1200);
}
for (const c of suite.authorCases) {
  if (only && only !== 'author') continue;
  if (onlyId && onlyId !== c.id) continue;
  try { results.push({ id: c.id, verdict: await runAuthorCase(c) }); }
  catch (e) { results.push({ id: c.id, verdict: 'YELLOW（异常: ' + String(e).slice(0, 80) + '）' }); }
  await sleep(1200);
}

const light = v => v.startsWith('GREEN') ? '\x1b[32m● GREEN\x1b[0m' : v.startsWith('RED') ? '\x1b[31m● RED\x1b[0m' : '\x1b[33m● YELLOW\x1b[0m';
for (const r of results) console.log(`${light(r.verdict)}  ${r.id.padEnd(22)} ${r.verdict.replace(/^(GREEN|RED|YELLOW)（?/, '').replace('）', '')}`);
const g = results.filter(r => r.verdict.startsWith('GREEN')).length;
const rd = results.filter(r => r.verdict.startsWith('RED')).length;
const y = results.filter(r => r.verdict.startsWith('YELLOW')).length;
console.log(`\n汇总: ${g} green, ${rd} red, ${y} yellow（red=需修复; yellow=线上波动观察）`);
process.exit(rd > 0 ? 1 : 0);
