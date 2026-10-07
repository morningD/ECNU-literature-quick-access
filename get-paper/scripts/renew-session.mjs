#!/usr/bin/env node
/** WebVPN session 续命：完全不依赖 Edge MCP / IAB。
 *
 *  默认模式（--browser，推荐）：无头 Chromium 完成 SSO 表单登录（表单由 JS 渲染、
 *    含 CAS _eventId token，纯 curl 无法复刻），context.cookies() 导出写入 jar。
 *    依赖 playwright（NODE_PATH/全局，或 PLAYWRIGHT_MODULE 指向其绝对路径）。
 *
 *  --curl 模式：纯 HTTP 复刻 OAuth 链。注意：SSO 登录表单带 JS 渲染的 CAS token
 *    （_eventId 等），该模式目前无法成功登录，仅保留用于排查链路。
 *
 *  用法: node scripts/renew-session.mjs [--browser|--curl] [--dry-run]
 */
import { execFileSync } from 'node:child_process';
import { copyFileSync, existsSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const SKILL_DIR = join(dirname(fileURLToPath(import.meta.url)), '..');
const { loadCredentials } = await import(pathToFileURL(join(SKILL_DIR, 'scripts/iab/sso-login.mjs')).href);
const JAR = join(process.env.HOME, '.config/get-paper/cookies.txt');
const PROXY_HOME = 'https://dl-acm-org-443.proxy.ecnu.edu.cn/';

const log = (...a) => console.error(...a);
const creds = loadCredentials();
if (!creds) { console.error('no credentials (keychain/file). run setup.sh first'); process.exit(2); }
log('credentials:', creds.source);

const mode = process.argv.includes('--curl') ? 'curl' : 'browser';
const dryRun = process.argv.includes('--dry-run');

function writeJar(cookies) {
  // cookies: playwright cookie 对象数组；proxy 域写为 .proxy.ecnu.edu.cn 含子域
  const EXPIRY = '2000000000';
  const lines = ['# Netscape HTTP Cookie File (renewed by get-paper renew-session at ' + new Date().toISOString() + ')'];
  for (const c of cookies) {
    const d = (c.domain || '').replace(/^\./, '');
    const domain = d.includes('proxy.ecnu') ? '.proxy.ecnu.edu.cn' : (c.domain.startsWith('.') ? c.domain : '.' + d);
    const includeSub = domain.startsWith('.') ? 'TRUE' : 'FALSE';
    lines.push(`${domain.replace(/^\./, '')}\t${includeSub}\t${c.path || '/'}\t${c.secure ? 'TRUE' : 'FALSE'}\t${EXPIRY}\t${c.name}\t${c.value}`);
  }
  mkdirSync(dirname(JAR), { recursive: true });
  if (existsSync(JAR)) copyFileSync(JAR, JAR + '.bak');
  writeFileSync(JAR, lines.join('\n') + '\n');
  return lines.length - 1;
}

async function renewViaBrowser() {
  let chromium;
  try {
    const mod = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
    chromium = mod.chromium;
  } catch {
    console.error([
      '未找到 playwright。安装任一方式：',
      '  npm i -g playwright && npx playwright install chromium',
      '或指定已有安装: PLAYWRIGHT_MODULE=/path/to/node_modules/playwright node scripts/renew-session.mjs',
    ].join('\n'));
    process.exit(2);
  }
  const browser = await chromium.launch({ headless: true });
  try {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    await page.goto(PROXY_HOME, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForTimeout(5000);
    if (!page.url().includes('sso.ecnu.edu.cn')) {
      log('proxy 页未跳 SSO（可能无需登录），仍导出当前 cookie');
    } else {
      if (dryRun) { log('dry-run: SSO 页可达，表单可渲染'); await browser.close(); return; }
      await page.fill('#nameInput', creds.username);
      await page.fill('input[type=password]', creds.password);
      await page.click('#submitBtn, #login_submit, button[type=submit]');
      await page.waitForTimeout(9000);
      const url = page.url();
      if (url.includes('sso.ecnu.edu.cn')) throw new Error('登录后仍在 SSO 页（凭据错误或表单变化）');
      log('logged in, landed:', url.slice(0, 80));
    }
    const cookies = await ctx.cookies();
    if (!cookies.some(c => c.name === '_webvpn_key')) throw new Error('cookie 中无 _webvpn_key');
    const n = writeJar(cookies);
    console.log(`✓ session renewed: ${n} cookies -> ${JAR}`);
  } finally {
    await browser.close();
  }
}

async function renewViaCurl() {
  // 保留的链路排查模式：SSO 表单含 JS 渲染的 CAS token，此模式登录会失败
  const cookieStore = new Map();
  const absorb = res => {
    for (const line of (res.headers.getSetCookie?.() || [])) {
      const [pair, ...attrs] = line.split(';');
      const eq = pair.indexOf('='); if (eq < 1) continue;
      const name = pair.slice(0, eq).trim(), value = pair.slice(eq + 1).trim();
      let domain = new URL(res.url).hostname;
      for (const a of attrs) { const [k, v] = a.split('='); if (k.trim().toLowerCase() === 'domain') domain = (v || '').trim().replace(/^\./, '') || domain; }
      if (!cookieStore.has(domain)) cookieStore.set(domain, new Map());
      value ? cookieStore.get(domain).set(name, value) : cookieStore.get(domain).delete(name);
    }
  };
  const header = url => {
    const host = new URL(url).hostname; const parts = [];
    for (const [d, jar] of cookieStore) if (host === d || host.endsWith('.' + d)) for (const [n, v] of jar) parts.push(`${n}=${v}`);
    return parts.join('; ');
  };
  const hop = async (url, opts = {}) => {
    const headers = { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/126 Safari/537.36' };
    const ck = header(url); if (ck) headers.Cookie = ck;
    const res = await fetch(url, { ...opts, headers, redirect: 'manual' });
    absorb(res); return res;
  };
  let res = await hop(PROXY_HOME), n = 0;
  while ([301, 302, 303, 307].includes(res.status) && n++ < 8) {
    const loc = res.headers.get('location'); if (!loc) break;
    const next = new URL(loc, res.url || PROXY_HOME).href;
    if (next.includes('sso.ecnu.edu.cn/login')) { log('reached SSO login:', next.slice(0, 90)); log('--curl 模式无法提交（CAS token 由 JS 渲染）。改用默认 browser 模式。'); return; }
    res = await hop(next);
  }
  log('session 看起来仍有效（未跳 SSO）');
}

if (mode === 'curl') await renewViaCurl();
else await renewViaBrowser().catch(e => { console.error('FAILED:', e.message); process.exit(1); });
