#!/usr/bin/env node
/** 同步油猴脚本的数据库映射表 → data/proxy-mapping.json
 *  用法: node scripts/update-mapping.mjs [userscript.js 路径]
 *  默认源: 仓库根目录的 ecnu-literature-quick-access.user.js（本 skill 所属仓库）
 *  也支持自动版脚本（同一 DEFAULT_MAPPING 结构）。
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { basename, dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const SKILL_DIR = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const REPO_ROOT = resolve(SKILL_DIR, '..');
const OUTPUT = join(SKILL_DIR, 'data', 'proxy-mapping.json');

const candidates = process.argv[2]
  ? [resolve(process.argv[2])]
  : [
      join(REPO_ROOT, 'ecnu-literature-quick-access.user.js'),
      join(REPO_ROOT, 'ecnu-literature-quick-access-auto.user.js'),
    ];

const source = candidates.find(f => existsSync(f));
if (!source) {
  console.error(`未找到油猴脚本源（尝试过: ${candidates.join(', ')}）`);
  console.error('用法: node update-mapping.mjs <path-to-userscript.js>');
  process.exit(2);
}

const code = readFileSync(source, 'utf8');
// DEFAULT_MAPPING = { 'host': 'proxy-prefix', ... }
const blockMatch = code.match(/DEFAULT_MAPPING\s*=\s*\{([\s\S]*?)\}/);
if (!blockMatch) {
  console.error('脚本中未找到 DEFAULT_MAPPING 块（油猴脚本结构可能已变）');
  process.exit(2);
}
const entries = new Map();
const re = /'([^']+)'\s*:\s*'([^']+)'/g;
let m;
while ((m = re.exec(blockMatch[1]))) entries.set(m[1], m[2]);

if (entries.size < 10) {
  console.error(`仅解析到 ${entries.size} 条映射，疑似解析错误，已中止`);
  process.exit(2);
}

mkdirSync(dirname(OUTPUT), { recursive: true });
const previous = existsSync(OUTPUT)
  ? JSON.parse(readFileSync(OUTPUT, 'utf8')).mapping || {}
  : {};
const merged = { ...previous, ...Object.fromEntries(entries) }; // 保留手动新增条目
const payload = {
  source: basename(source),
  updatedAt: new Date().toISOString(),
  count: Object.keys(merged).length,
  mapping: merged,
};
writeFileSync(OUTPUT, JSON.stringify(payload, null, 2) + '\n');
console.log(`✓ ${entries.size} 条（合并后共 ${Object.keys(merged).length} 条）→ ${OUTPUT}`);
