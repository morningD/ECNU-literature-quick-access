#!/usr/bin/env node
/** 无头 Chromium 下载（对付带挑战的库，如 ScienceDirect）：
 *  注入 cookie jar（renew-session 续命过）→ 真实导航论文页 → 真实点击下载 →
 *  download 事件 saveAs（acceptDownloads 语义：无弹窗）。
 *  用法: node scripts/headless-download.mjs <论文页URL> <链接匹配串> <输出.pdf>
 *  环境变量: PLAYWRIGHT_MODULE 指定 playwright 路径（默认 NODE_PATH 查找）
 */
import { homedir } from 'node:os';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const SKILL_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const JAR = join(process.env.XDG_CONFIG_HOME || join(homedir(), '.config'), 'get-paper/cookies.txt');
const IS_CLI = process.argv[1] && /\/headless-download\.mjs$/.test(process.argv[1]);
const [pageUrl, linkPattern, outPath] = process.argv.slice(2);
if (IS_CLI && (!pageUrl || !linkPattern || !outPath)) {
  console.log('usage: headless-download.mjs <page-url> <link-substr> <out.pdf>');
  process.exit(2);
}

if (IS_CLI) {
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');

  // Netscape jar → playwright cookies
  const jarCookies = [];
  for (const line of readFileSync(JAR, 'utf8').split('\n')) {
    if (!line.trim() || line.startsWith('#')) continue;
    const f = line.split('\t');
    if (f.length < 7) continue;
    const [domain, includeSub, path, secure, , name, value] = f;
    jarCookies.push({
      name, value, path,
      domain: domain || (includeSub === 'TRUE' ? '.proxy.ecnu.edu.cn' : 'proxy.ecnu.edu.cn'),
      secure: secure === 'TRUE',
    });
  }

  const browser = await chromium.launch({ headless: true });
  try {
    const ctx = await browser.newContext({ acceptDownloads: true });
    await ctx.addCookies(jarCookies);
    const page = await ctx.newPage();
    console.error('goto:', pageUrl);
    await page.goto(pageUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForTimeout(8000);
    console.error('landed:', page.url().slice(0, 90));
    if (/sso\.ecnu\.edu\.cn\/login/.test(page.url())) {
      throw new Error('被跳到 SSO（jar 过期，先跑 renew-session.mjs）');
    }
    // 等下载链接出现（页面/挑战渲染），最多 60s
    let href = null;
    for (let i = 0; i < 12; i++) {
      href = await page.evaluate(p => {
        const a = [...document.querySelectorAll('a[href]')].find(x => x.href.includes(p));
        return a ? a.href : null;
      }, linkPattern);
      if (href) break;
      await page.waitForTimeout(5000);
    }
    if (!href) throw new Error(`未找到含 "${linkPattern}" 的下载链接（页面未就绪或无权限）`);
    console.error('link:', href.slice(0, 120));

    const dlPromise = page.waitForEvent('download', { timeout: 60000 });
    await page.evaluate(p => {
      const a = [...document.querySelectorAll('a[href]')].find(x => x.href.includes(p));
      a.click();
    }, linkPattern);
    const download = await dlPromise;
    console.error('download event:', download.url().slice(0, 100));
    await download.saveAs(outPath);
    console.log('✓ saved:', outPath);
  } finally {
    await browser.close();
  }

}
