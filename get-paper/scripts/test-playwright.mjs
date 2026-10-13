#!/usr/bin/env node
/** 依赖加载红绿灯测试：lib/ensure-playwright.mjs 的解析顺序与边界行为。
 *  方法：子进程 + 隔离 XDG_CONFIG_HOME + stub playwright 包（launch 返回标记串），
 *  断言"加载确实来自指定来源"而非环境里的真 playwright（防假绿）。
 *  纯本地确定性：无网络、无真实 npm install、不触碰真实共享目录。
 *  green 必须符合预期；red = 断言失败需修复；yellow = 本机未安装共享包，跳过（非代码问题）。
 *  用法: node scripts/test-playwright.mjs [--id <case-id>]
 */
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, existsSync } from 'node:fs';
import { tmpdir, homedir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { spawnSync } from 'node:child_process';

const SKILL_DIR = join(dirname(fileURLToPath(import.meta.url)), '..');
const MOD_PATH = join(SKILL_DIR, 'scripts/lib/ensure-playwright.mjs');
const MOD_URL = pathToFileURL(MOD_PATH).href;

// stub playwright 包（CJS：package.json main → index.js）。launch 返回固定标记串，
// 断言命中来源时校验标记，防止意外命中机器上的真 playwright 造成假绿
function writeStub(dir) {
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, 'package.json'), JSON.stringify({ name: 'playwright', version: '0.0.0-stub', main: 'index.js' }));
  writeFileSync(join(dir, 'index.js'), "module.exports = { chromium: { launch: async () => 'STUB-LAUNCHED' } };");
}

// 隔离环境：XDG_CONFIG_HOME 指向临时目录，剥掉 PLAYWRIGHT_MODULE；
// sharedStub 布置共享目录位置的 stub，extraStubs 布置任意额外路径的 stub
const tmpRoots = [];
function makeStubEnv({ sharedStub = false, extraStubs = [] } = {}) {
  const root = mkdtempSync(join(tmpdir(), 'get-paper-pwtest-'));
  tmpRoots.push(root);
  if (sharedStub) writeStub(join(root, 'get-paper/node_modules/playwright'));
  for (const d of extraStubs) writeStub(join(root, d));
  const env = { ...process.env, XDG_CONFIG_HOME: root };
  delete env.PLAYWRIGHT_MODULE;
  return { root, env };
}

// 子进程 driver：加载被测模块，autoInstall:false 调用（测试永不触发真实安装）
const DRIVER = `
  const m = await import(${JSON.stringify(MOD_URL)});
  try {
    const mod = await m.loadPlaywright({ autoInstall: false });
    const tag = await mod.chromium.launch({});
    console.log('LOADED:' + tag);
  } catch (e) { console.log('ERR:' + String(e.message).split('\\n')[0]); process.exit(1); }
`;

// 断言一次子进程运行的退出码与输出标记，返回 GREEN/RED verdict
function checkRun(r, id, { expectExit, expectOut }) {
  const out = (r.stdout || '') + (r.stderr || '');
  if (r.status !== expectExit) return `RED（${id}: 期望 exit ${expectExit} 实得 ${r.status}；输出 ${out.trim().slice(0, 120)}）`;
  if (!out.includes(expectOut)) return `RED（${id}: 输出缺少 "${expectOut}"；实得 ${out.trim().slice(0, 120)}）`;
  return `GREEN（${out.trim().split('\n')[0]}）`;
}

function runDriver(env) {
  return spawnSync(process.execPath, ['--input-type=module', '-e', DRIVER], { env, encoding: 'utf8' });
}

function runCli(env) {
  return spawnSync(process.execPath, [MOD_PATH, '--status'], { env, encoding: 'utf8' });
}

const REAL_SHARED = join(process.env.XDG_CONFIG_HOME || join(homedir(), '.config'), 'get-paper/node_modules/playwright');

const cases = [
  {
    id: 'module-env-bad-path',
    about: 'PLAYWRIGHT_MODULE 坏路径必须显式报错（共享目录存在也不许静默降级）',
    run() {
      const { root, env } = makeStubEnv({ sharedStub: true });
      env.PLAYWRIGHT_MODULE = join(root, 'no-such-pw');
      return checkRun(runDriver(env), this.id, { expectExit: 1, expectOut: '无法加载' });
    },
  },
  {
    id: 'module-env-beats-shared',
    about: 'PLAYWRIGHT_MODULE 优先于共享目录，且加载的就是指定包',
    run() {
      const { root, env } = makeStubEnv({ sharedStub: true, extraStubs: ['explicit-pw'] });
      env.PLAYWRIGHT_MODULE = join(root, 'explicit-pw');
      return checkRun(runDriver(env), this.id, { expectExit: 0, expectOut: 'LOADED:STUB-LAUNCHED' });
    },
  },
  {
    id: 'shared-dir-hit',
    about: '无环境变量时命中共享目录的 playwright',
    run() {
      const { env } = makeStubEnv({ sharedStub: true });
      return checkRun(runDriver(env), this.id, { expectExit: 0, expectOut: 'LOADED:STUB-LAUNCHED' });
    },
  },
  {
    id: 'no-source-rejects',
    about: '所有来源皆缺时（autoInstall:false）必须拒绝并给手动指引',
    run() {
      const { env } = makeStubEnv({});
      return checkRun(runDriver(env), this.id, { expectExit: 1, expectOut: '不可用' });
    },
  },
  {
    id: 'cli-status-installed',
    about: '--status 在已装共享包时 exit 0 并报告来源',
    run() {
      const { env } = makeStubEnv({ sharedStub: true });
      return checkRun(runCli(env), this.id, { expectExit: 0, expectOut: '✓ 共享目录' });
    },
  },
  {
    id: 'cli-status-missing',
    about: '--status 在未装时 exit 1（不触发安装）',
    run() {
      const { env } = makeStubEnv({});
      return checkRun(runCli(env), this.id, { expectExit: 1, expectOut: '未安装' });
    },
  },
  {
    id: 'smoke-current-env',
    about: '本机真实环境冒烟：继承当前 env 跑 --status',
    run() {
      if (!existsSync(REAL_SHARED) && !process.env.PLAYWRIGHT_MODULE) {
        return 'YELLOW（本机无共享安装，跳过——首次使用时自动装）';
      }
      return checkRun(runCli(process.env), this.id, { expectExit: 0, expectOut: '✓' });
    },
  },
];

const onlyId = process.argv.includes('--id') ? process.argv[process.argv.indexOf('--id') + 1] : '';
const results = [];
for (const c of cases) {
  if (onlyId && onlyId !== c.id) continue;
  let verdict;
  try {
    verdict = c.run();
  } catch (e) {
    verdict = `RED（${c.id}: 异常 ${String(e).slice(0, 120)}）`;
  }
  results.push({ id: c.id, verdict });
  console.log(verdict.startsWith('GREEN') ? '\x1b[32m● GREEN\x1b[0m' : verdict.startsWith('RED') ? '\x1b[31m● RED\x1b[0m' : '\x1b[33m● YELLOW\x1b[0m', c.id.padEnd(22), c.about);
}
for (const root of tmpRoots) rmSync(root, { recursive: true, force: true });

const g = results.filter(r => r.verdict.startsWith('GREEN')).length;
const rd = results.filter(r => r.verdict.startsWith('RED')).length;
const y = results.filter(r => r.verdict.startsWith('YELLOW')).length;
console.log(`\n汇总: ${g} green, ${rd} red, ${y} yellow（red=需修复; yellow=本机未装共享包,非代码问题）`);
process.exit(rd > 0 ? 1 : 0);
