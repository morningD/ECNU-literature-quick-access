#!/usr/bin/env node
/** 共享 playwright 加载器 —— 所有需要本地 playwright 包的脚本统一从这里拿。
 *
 *  背景：renew-session / headless-download 依赖 playwright，但用户机器上往往没装。
 *  安装目标是用户级共享目录 {CONF_DIR}/node_modules（CONF_DIR = ~/.config/get-paper，
 *  XDG_CONFIG_HOME 可重定位；Windows 为 %USERPROFILE%\.config\get-paper）——与 cookie jar
 *  同目录，和 skill 安装实例解耦：zcode / opencode 等多个 AI 客户端（无论软链还是复制安装）
 *  共用同一份 playwright，只装一次、只配置一次。
 *
 *  解析顺序（先到先得）：
 *    1. PLAYWRIGHT_MODULE 环境变量 —— 显式指定即用户意图，加载失败直接报错，不静默降级
 *    2. {CONF_DIR}/node_modules/playwright —— 共享安装（本模块自动装的就在这里）
 *    3. 当前可解析的 playwright（NODE_PATH / 同目录依赖）
 *    4. 都没有 → npm install 到共享目录。跳过浏览器二进制下载
 *       （PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1）：launch 失败时调用方回退系统 Edge（PR #5 约定），
 *       浏览器二进制即使要装也走 playwright 自身的 ~/.cache/ms-playwright 全局缓存，不会重复。
 *
 *  CLI（setup.sh / setup.ps1 与排障用，幂等）：
 *    node ensure-playwright.mjs           # 确保可用，缺则自动安装
 *    node ensure-playwright.mjs --status  # 只报告来源，不安装；exit 1 表示未安装
 */
import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { createRequire } from 'node:module';

const CONF_DIR = join(process.env.XDG_CONFIG_HOME || join(homedir(), '.config'), 'get-paper');
const SHARED_PW = join(CONF_DIR, 'node_modules', 'playwright');
const INSTALL_HINT = [
  `手动安装（装到共享目录，多客户端共用）:`,
  `  PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1 npm install --prefix "${CONF_DIR}" playwright --no-save`,
  `或临时使用已有安装:`,
  `  PLAYWRIGHT_MODULE=/path/to/node_modules/playwright node <脚本>`,
].join('\n');

const requireFrom = createRequire(import.meta.url);

// CJS require：目录、包入口、绝对路径都吃得下，且天然兼容 Windows 反斜杠（PR #5 约定）
function tryRequire(spec) {
  try {
    const mod = requireFrom(spec);
    if (mod && mod.chromium) return mod;
  } catch { /* 不可解析或不是 playwright */ }
  return null;
}

// 返回 { mod, from } 描述来源；未找到返回 null；PLAYWRIGHT_MODULE 指定但坏掉时 throw
function probe() {
  if (process.env.PLAYWRIGHT_MODULE) {
    const mod = tryRequire(process.env.PLAYWRIGHT_MODULE);
    if (!mod) throw new Error(`PLAYWRIGHT_MODULE 指定的 playwright 无法加载: ${process.env.PLAYWRIGHT_MODULE}`);
    return { mod, from: `PLAYWRIGHT_MODULE (${process.env.PLAYWRIGHT_MODULE})` };
  }
  if (existsSync(SHARED_PW)) {
    const mod = tryRequire(SHARED_PW);
    if (mod) return { mod, from: `共享目录 ${SHARED_PW}` };
  }
  const mod = tryRequire('playwright');
  if (mod) return { mod, from: '环境可解析（NODE_PATH/全局）' };
  return null;
}

function npmInstallShared() {
  const args = ['install', '--prefix', CONF_DIR, 'playwright', '--no-save', '--loglevel=error'];
  const opts = { stdio: 'inherit', timeout: 180_000, env: { ...process.env, PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD: '1' } };
  if (process.platform === 'win32') {
    // npm 实为 npm.cmd，Node 对 .cmd 的 spawn 需要 shell；参数固定、仅 CONF_DIR 来自 homedir，
    // 清洗引号后手工加引号防空格（PR #5 的注入防护约定）
    const q = s => (/[ ]/.test(s) ? `"${s.replace(/"/g, '')}"` : s.replace(/"/g, ''));
    execFileSync('npm', args.map(q).join(' '), { ...opts, shell: true });
  } else {
    execFileSync('npm', args, opts);
  }
}

export async function loadPlaywright({ autoInstall = true, log = () => {} } = {}) {
  const found = probe();
  if (found) { log(`playwright: ${found.from}`); return found.mod; }
  if (!autoInstall) throw new Error(`playwright 不可用。\n${INSTALL_HINT}`);
  log(`playwright 未安装，自动装到共享目录 ${CONF_DIR}（一次安装，所有 AI 客户端共用）`);
  npmInstallShared();
  const installed = tryRequire(SHARED_PW);
  if (!installed) throw new Error(`npm install 结束但仍无法从 ${SHARED_PW} 加载。\n${INSTALL_HINT}`);
  return installed;
}

// 兼容 Windows 反斜杠与 POSIX 正斜杠两种 argv[1] 路径
const IS_CLI = process.argv[1] && /[\\/]ensure-playwright\.mjs$/i.test(process.argv[1]);
if (IS_CLI) {
  if (process.argv.includes('--status')) {
    const found = probe();
    if (found) console.log(`✓ ${found.from}`);
    else { console.log('未安装（下次 renew-session / headless-download 运行时自动安装）'); process.exit(1); }
  } else {
    try {
      await loadPlaywright({ log: m => console.log(m) });
      console.log('✓ playwright 可用');
    } catch (e) { console.error(`✗ ${e.message}`); process.exit(1); }
  }
}
