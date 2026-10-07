// IAB SSO 自动登录 + 登录态检测（移植自 ecnu-literature-quick-access 油猴脚本 §SSO Auto Login）。
// 在 ZCode node_repl（browser-use 环境）中 import 使用：
//   import { ensureSsoLogin } from '<skill>/scripts/iab/sso-login.mjs';
//   await ensureSsoLogin(tab, { credentialsPath });
import { homedir } from 'node:os';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';

const CONF_DIR = join(process.env.XDG_CONFIG_HOME || join(homedir(), '.config'), 'get-paper');
const DEFAULT_CRED_PATH = join(CONF_DIR, 'credentials.json');

// setup.sh "使用已有条目" 选项会写 source.json 指定任意钥匙串条目对。
function loadFromSourceConfig() {
  try {
    const cfgPath = join(CONF_DIR, 'source.json');
    if (!existsSync(cfgPath)) return null;
    const cfg = JSON.parse(readFileSync(cfgPath, 'utf8'));
    if (cfg.backend !== 'keychain' || !cfg.serviceUser) return null;
    const read = (s, a) => {
      try {
        const args = ['find-generic-password', '-s', s, '-w'];
        if (a) args.push('-a', a);
        return execFileSync('security', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
      } catch { return ''; }
    };
    const svcU = cfg.serviceUser;
    const svcP = cfg.servicePass || svcU.replace(/Login/i, 'Password');
    const u = read(svcU, cfg.accountUser || '');
    const p = read(svcP, cfg.accountPass || '');
    if (u && p) return { username: u, password: p, source: `keychain:${svcU}` };
  } catch {}
  return null;
}

// macOS 钥匙串读取。来源优先级：
// 1. source.json 指定的条目（setup.sh 配置）
// 2. get-paper 专属条目（setup.sh "新建" 或 security add-generic-password）
// 3. 用户已有的 "ECNU SSO Login"/"ECNU SSO Password" 条目（Safari/手动存的）
// 4. ~/.config/get-paper/credentials.json（600 权限明文文件）
// 首次读取每条会弹一次系统授权框（点"总是允许"后静默）。
function loadFromKeychain() {
  const read = (service, account) => {
    try {
      if (process.platform === 'darwin') {
        return execFileSync('security', ['find-generic-password', '-s', service, '-a', account, '-w'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
      }
      if (process.platform === 'linux') {
        return execFileSync('secret-tool', ['lookup', 'service', service, 'account', account], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
      }
    } catch { return ''; }
    return '';
  };
  let u = read('get-paper', 'username');
  let p = read('get-paper', 'password');
  if (u && p) return { username: u, password: p, source: 'keychain:get-paper' };
  u = read('ECNU SSO Login', 'ecnu_sso');
  p = read('ECNU SSO Password', 'ecnu_sso_pwd');
  if (u && p) return { username: u, password: p, source: 'keychain:ECNU SSO' };
  return null;
}

// Windows：setup.ps1 以 DPAPI（按当前用户加密）保存的凭据
// 解密走系统自带 Windows PowerShell，输出 Base64 避免控制台编码干扰
function loadFromDpapi(credentialsPath) {
  if (process.platform !== 'win32') return null;
  const binPath = credentialsPath + '.bin';
  if (!existsSync(binPath)) return null;
  try {
    const ps = [
      'Add-Type -AssemblyName System.Security',
      `$b = [IO.File]::ReadAllBytes('${binPath.replaceAll("'", "''")}')`,
      '$d = [Security.Cryptography.ProtectedData]::Unprotect($b, $null, [Security.Cryptography.DataProtectionScope]::CurrentUser)',
      '[Convert]::ToBase64String($d)',
    ].join('; ');
    const b64 = execFileSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', ps], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
    const c = JSON.parse(Buffer.from(b64, 'base64').toString('utf8'));
    if (c.username && c.password) return { username: c.username, password: c.password, source: 'dpapi-file' };
  } catch {}
  return null;
}

// 优先级：source.json → 系统钥匙串（macOS/Linux）→ DPAPI 加密文件（Windows）→ 明文文件
export function loadCredentials(credentialsPath = DEFAULT_CRED_PATH) {
  const fromSource = loadFromSourceConfig();
  if (fromSource) return fromSource;
  const fromKeychain = loadFromKeychain();
  if (fromKeychain) return fromKeychain;
  const fromDpapi = loadFromDpapi(credentialsPath);
  if (fromDpapi) return fromDpapi;
  if (existsSync(credentialsPath)) {
    try {
      const c = JSON.parse(readFileSync(credentialsPath, 'utf8'));
      if (c.username && c.password) return c;
    } catch {}
  }
  return null;
}

const isSsoPage = (url = '') => /sso\.ecnu\.edu\.cn\/login/.test(url);
const isProxyDomain = (url = '') => /proxy\.ecnu\.edu\.cn/.test(url);

// 等待 URL 离开 SSO 登录页（登录成功后 CAS 会带 ticket 跳回 proxy）。
async function waitLeaveSso(tab, timeoutMs = 20000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    await new Promise(r => setTimeout(r, 1500));
    const url = (await tab.url()) || '';
    if (!isSsoPage(url)) return url;
  }
  return null;
}

// 油猴同款填表：native setter 触发框架变更事件，随后点击提交。
// 注意：playwright evaluate 只传单个 arg，这里用对象封装。
const FILL_SUBMIT = ({ u, p }) => {
  const q = s => document.querySelector(s);
  const usernameInput = q('#nameInput') || q('#username') || q('input[name="username"][type="text"]');
  const passwordInput = q('input[type="password"]') || q('#password') || q('input[name="password"]');
  const submitBtn = q('#submitBtn') || q('#login_submit') || q('button[type="submit"]');
  if (!usernameInput || !passwordInput || !submitBtn) return 'FORM_NOT_FOUND';
  const setNativeValue = (el, value) => {
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
    setter.call(el, value);
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
  };
  setNativeValue(usernameInput, u);
  setNativeValue(passwordInput, p);
  setTimeout(() => {
    submitBtn.disabled = false;
    submitBtn.classList.remove('disabled');
    submitBtn.click();
  }, 500);
  return 'SUBMITTED';
};

/**
 * 确保 tab 处于可用登录态。
 * - 已登录（不在 SSO 页）→ 直接返回 ok
 * - 在 SSO 页且有凭据 → 自动填表登录，等待跳回
 * - 在 SSO 页且无凭据 → 返回 need_credentials
 */
export async function ensureSsoLogin(tab, { credentialsPath } = {}) {
  const url = (await tab.url()) || '';
  if (!isSsoPage(url)) return { ok: true, state: 'already_authenticated', url };
  const creds = loadCredentials(credentialsPath);
  if (!creds) {
    return {
      ok: false,
      state: 'need_credentials',
      hint: 'run: printf ... > ~/.config/get-paper/credentials.json (chmod 600)',
    };
  }
  // 等表单渲染（SSO 页为框架渲染，油猴脚本也用 MutationObserver 等待）
  for (let i = 0; i < 10; i++) {
    const r = await tab.playwright.evaluate(FILL_SUBMIT, { u: creds.username, p: creds.password });
    if (r === 'SUBMITTED') break;
    if (i === 9) return { ok: false, state: 'form_not_found' };
    await new Promise(res => setTimeout(res, 1000));
  }
  const finalUrl = await waitLeaveSso(tab);
  if (!finalUrl) return { ok: false, state: 'login_timeout' };
  return { ok: true, state: 'logged_in', url: finalUrl, proxy: isProxyDomain(finalUrl) };
}

/**
 * 完整入口：导航到 proxy URL；被踢到 SSO 时自动登录并重试导航一次。
 */
export async function gotoWithLogin(tab, proxyUrl, opts = {}) {
  await tab.goto(proxyUrl);
  await tab.playwright.waitForLoadState({ state: 'domcontentloaded' });
  await tab.playwright.waitForTimeout(4000);
  const url = (await tab.url()) || '';
  if (!isSsoPage(url)) return { ok: true, url, neededLogin: false };
  const login = await ensureSsoLogin(tab, opts);
  if (!login.ok) return login;
  await tab.goto(proxyUrl); // 登录成功后回到原目标
  await tab.playwright.waitForLoadState({ state: 'domcontentloaded' });
  await tab.playwright.waitForTimeout(4000);
  const finalUrl = (await tab.url()) || '';
  if (isSsoPage(finalUrl)) return { ok: false, state: 'still_on_sso', url: finalUrl };
  return { ok: true, url: finalUrl, neededLogin: true };
}
