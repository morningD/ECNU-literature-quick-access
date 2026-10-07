// IAB 页面内 PDF 下载模块（ZCode node_repl / browser-use 环境 import 使用）。
// 原理：在已登录的同源页面上下文里 fetch PDF 端点（自动带 cookie+Referer，
// 最不易触发反爬），经 localStorage（跨 evaluate 调用共享）base64 分块导出。
//
// 用法:
//   import { fetchPdfViaPage } from '<skill>/scripts/iab/fetch-pdf.mjs';
//   const r = await fetchPdfViaPage(tab, '/doi/pdf/10.1145/xxx?download=true', '/tmp/out.pdf');
//
// 注意: tab 当前页面必须与 PDF URL 同源（先导航到论文页），否则 fetch 拿不到凭据。
import { writeFile } from 'node:fs/promises';

const START_FETCH = opt => {
  localStorage.removeItem('__gp_pdf');
  localStorage.removeItem('__gp_meta');
  fetch(opt.url, { credentials: 'include', ...(opt.referrer ? { referrer: opt.referrer } : {}) })
    .then(async res => {
      const b = await res.arrayBuffer();
      const u = new Uint8Array(b);
      let bin = '';
      for (let i = 0; i < u.length; i += 8192) bin += String.fromCharCode.apply(null, u.subarray(i, i + 8192));
      const meta = { status: res.status, type: res.headers.get('content-type'), size: b.byteLength, head: bin.slice(0, 5) };
      if (meta.head === '%PDF-') {
        try { localStorage.setItem('__gp_pdf', btoa(bin)); }
        catch (e) { meta.lsErr = String(e); }
      }
      localStorage.setItem('__gp_meta', JSON.stringify(meta));
    })
    .catch(e => localStorage.setItem('__gp_meta', JSON.stringify({ err: String(e) })));
  return 'started';
};

const sleep = ms => new Promise(r => setTimeout(r, ms));

/**
 * 在 tab 当前页面内 fetch 一个 PDF 并保存到 outPath。
 * @returns {{size:number, path:string, status:number, contentType:string}}
 * @throws 非 PDF 响应 / 超时 / localStorage 超限
 */
export async function fetchPdfViaPage(tab, pdfUrl, outPath, { timeoutMs = 30000, chunkChars = 200000, referrer } = {}) {
  await tab.playwright.evaluate(START_FETCH, { url: pdfUrl, referrer: referrer || null });
  const deadline = Date.now() + timeoutMs;
  let meta;
  while (Date.now() < deadline) {
    await sleep(3000);
    const raw = await tab.playwright.evaluate(() => localStorage.getItem('__gp_meta'));
    if (raw) { try { meta = JSON.parse(raw); break; } catch {} }
  }
  if (!meta) throw new Error('fetch timeout: ' + pdfUrl);
  if (meta.err) throw new Error('page fetch failed: ' + meta.err);
  if (meta.head !== '%PDF-') {
    throw new Error(`not a PDF: HTTP ${meta.status} ${meta.type} (${meta.size}B, head=${JSON.stringify(meta.head)})`);
  }
  if (meta.lsErr) throw new Error('localStorage overflow: ' + meta.lsErr + '（PDF 过大，考虑分块 fetch）');

  const total = await tab.playwright.evaluate(() => (localStorage.getItem('__gp_pdf') || '').length);
  let b64 = '';
  for (let off = 0; off < total; off += chunkChars) {
    b64 += await tab.playwright.evaluate(
      a => localStorage.getItem('__gp_pdf').slice(a.o, a.o + a.l),
      { o: off, l: chunkChars }
    );
  }
  const buf = Buffer.from(b64, 'base64');
  if (buf.length !== meta.size) throw new Error(`size mismatch ${buf.length} != ${meta.size}`);
  await writeFile(outPath, buf);
  await tab.playwright.evaluate(() => { localStorage.removeItem('__gp_pdf'); localStorage.removeItem('__gp_meta'); });
  return { size: buf.length, path: outPath, status: meta.status, contentType: meta.type };
}
