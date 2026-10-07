# get-paper 开发日志

论文 PDF 下载 skill（公开源 + ECNU WebVPN 电子数据库），从本仓库（ecnu-literature-quick-access）演进而来。
全局入口：`~/.agents/skills/get-paper` → 本目录（symlink）。

---

## 2026-10-05 v0：首次端到端打通

### 验证矩阵

| 目标 | 渠道 | 结果 | 关键路径 |
|---|---|---|---|
| arXiv:2508.04586 | 公开直下 | ✅ | curl `arxiv.org/pdf/{id}` + pdftotext 验证 |
| 10.1145/3770855.3818130 (ACM) | proxy + curl | ✅ | cookie jar 两步：`--page-only` 论文页 → `/doi/pdf/{DOI}?download=true` |
| 10.1111/con4.70065 (Wiley, OA) | IAB 页面内 fetch | ✅ | **`/doi/pdfdirect/{DOI}`** 端点 + localStorage 中转（详见下） |
| 10.1016/j.sysarc.2026.103932 (Elsevier) | — | ❌ 待解决 | Cloudflare "Request Verification" 被触发，需冷却或人工 |

### 环境链路（前提）

1. **Edge + Playwright 扩展**（官方 `mmlmfjhmonkocbjadbfplnigmagldckm`，Default profile）
2. **ZCode MCP 配置**：`~/.zcode/cli/config.json` → `mcp.servers.playwright`，`--browser msedge --extension` + 环境变量 `PLAYWRIGHT_MCP_EXTENSION_TOKEN`（token 来自扩展首次连接弹窗；扩展重装后会变）
3. **macOS 完全磁盘访问**：必须授予宿主应用，否则 server 读不了 `~/Library/Application Support/Microsoft Edge`，所有浏览器工具报 `Playwright Extension not found`（这是最容易误诊的报错——不是扩展没装，是权限被拒）
4. 注意：Chromium M136+ 默认 profile 禁用 CDP 端口，**不要试图用 `--remote-debugging-port` 直连日常浏览器**；扩展回连是唯一途径
5. 同一时间只能有一个 MCP server 实例占用扩展连接（Claude Code 与 ZCode 不同时开 playwright MCP）

### 关键发现（按数据库）

#### ACM DL —— 完全自动化 ✅
纯 curl 可下，无需浏览器。`fetch-paper.sh` 两步（先论文页建立 JSESSIONID，再带 Referer 下 PDF）。

#### Wiley —— 页面内 fetch pdfdirect ✅（仅 OA 验证）
- `onlinelibrary.wiley.com` 会 302 到 **`conbio.onlinelibrary.wiley.com`**（按期刊分子域），proxy 形式失效掉出代理——油猴脚本对 Wiley 也是放弃状态（PROXY_CHECK 记录一致）
- **OA 文章直连原始域即可，不需要 proxy**
- 端点真相：
  - `/doi/pdf/{DOI}` → 对非"真实点击"的请求（curl/fetch/goto）一律返回**文章页 HTML**
  - `/doi/epdf/{DOI}` → 在线查看器（HTML 壳）
  - **`/doi/pdfdirect/{DOI}` → 真 PDF**（浏览器里由 iframe 加载，`performance.getEntriesByType('resource')` 里能看到）
- 云防护：curl 直连 403；**IAB（或浏览器）页面内同源 fetch pdfdirect 直接 200 application/pdf**

#### ScienceDirect (Elsevier) —— ❌ 待解决
- `pdfft` 端点需要点击时 JS 生成的一次性签名（`md5=`、`crtasolve=1&token=`），**token 与浏览器环境绑定，curl 复用 403**（1.2MB 错误页）
- 页面内 fetch 同样返回 SPA 壳；`browser_run_code_unsafe` 里 `page.context().cookies()` 可用（权限授予后）
- **教训：连续探测（多次导航/fetch/curl）会触发 Cloudflare "Request Verification"**，触发后应立即停止该库的自动化（换库或换渠道），等冷却
- 已验证 ECNU 订阅有权限（论文页正文可渲染、DOM 里有签名下载链接）
- 待办路径：a) 人工在 Edge 点一次下载（10 秒）；b) 冷却后用 Edge 模拟点击 + `waitForEvent('download')`

### 通用机制发现

1. **ZCode IAB（内置浏览器）可以接力干活**：完全受控的 Playwright 环境，无扩展模式的限制
   - 但 IAB 的 `evaluate` **每次调用在隔离上下文执行，`window` 不跨调用共享** → 用 `localStorage` 中转（按 origin 共享）
   - IAB 的 Cloudflare 通行度高：conbio 页面直接加载（curl 403 的同一 URL）
   - IAB 指纹会被部分库（SD）降权，Edge 仍是最终的真实环境
2. **IAB 下载弹窗问题（未完全解决）**：`locator.downloadMedia()` / 点击下载按钮会弹"保存位置"对话框，自动化被卡（用户取消 → `download cancelled`）。**规避方式：页面内 fetch + localStorage base64 分块传出**（每块 200k 字符），全程零弹窗
3. **playwright MCP `browser_network_request` 的请求头里看不到 Cookie**（被过滤），提取 cookie 要用 `browser_run_code_unsafe` 的 `page.context().cookies()`
4. `browser_run_code_unsafe` 返回值经 MCP 传输会**多一层转义**，用哨兵字符串（`@@@...@@@`）包裹 + 检测 `\"` 反转义
5. 扩展模式 CDP 被封：`newCDPSession` 报 `Target.attachToBrowserTarget: Not allowed`，不能用它设下载行为
6. Edge 油猴脚本（本仓库的 userscript）与 skill 的分工：**skill 可以导航原始 `doi.org` URL 让油猴自动跳 proxy + SSO**——Wiley 除外（油猴映射里已移除）

### 脚本清单

| 脚本 | 用途 | 状态 |
|---|---|---|
| `scripts/proxy-url.js` | 原始 URL → ECNU proxy 形式（`-`→`--`、`.`→`-`、HTTPS 加 `-443`） | ✅ 已对照 PROXY_CHECK 验证 |
| `scripts/fetch-paper.sh` | curl 封装：cookie jar + UA + `%PDF-` 头 + pdftotext 验证；退出码 3=WebVPN session 过期、2=NOT_PDF、5=损坏 | ✅ |
| `scripts/init-session.sh` | 浏览器复制的 Cookie 头 → Netscape jar（`.proxy.ecnu.edu.cn` 域，含子域） | ✅ |

已修 bug：macOS bash 3.2 空数组 + `set -u` 冲突；登录页检测需先于 `--page-only` 分支；文档里 `node fetch-paper.sh` 的错误调用。

### 待优化（TODO）

- [ ] **ZeroMSA 下载**（Cloudflare 冷却后重试 Edge 点击方案 / 人工一次）
- [ ] IAB 下载弹窗的根治（查 ZCode 是否有 acceptDownloads 配置）
- [ ] 把"IAB + localStorage 中转"固化成脚本（`scripts/iab-fetch-pdf.mjs`），当前是临时代码
- [ ] Edge cookie 提取固化成脚本（当前是临时的 `cookies-direct` 模式）
- [ ] Wiley 付费（非 OA）文章路径验证（需要 proxy 但 Wiley 掉出代理——可能无解，标注清楚）
- [ ] 更多库验证：IEEE（databases.md 已有手动流程）、Springer、Nature
- [ ] cookie 过期的自动检测 + 自动刷新（fetch-paper 报 3 后自动走 Edge 提取）
- [ ] 批量模式（citeme pending.md → 自动逐篇下载）

---

## 2026-10-05（下午）v0.1：IAB 独立化 + Keychain 凭据 + 跨平台配置

### 核心成果：摆脱 Edge MCP 依赖 ✅

IAB（ZCode 内置浏览器）独立闭环全部打通，Edge 退居备用：

```
钥匙串凭据（零配置，复用用户已有条目）
  → IAB goto proxy URL → 被 302 到 SSO
  → ensureSsoLogin()：油猴同款填表逻辑自动登录
  → 回到 proxy 页（订阅身份）
  → 页面内同源 fetch PDF → localStorage(base64) 分块导出
```

实测：ACM 付费论文 10.1145/3770855.3818130 在 IAB 里独立下载成功，1911072 字节与 Edge+curl 路线完全一致。

### 关键发现与踩坑

1. **playwright `evaluate(fn, arg)` 只传单个 arg**：给 `(u,p)=>` 双参函数传数组 `[user, pass]`，收到的是 `u=[数组], p=undefined`——用户名填成 "学号,密码" 拼接串（24 字符）、密码空。这个 bug 曾误判"钥匙串条目内容错误"。正确做法：对象封装 `({u,p})=>{...}`
2. **用户钥匙串里已有可用的 SSO 凭据**（"ECNU SSO Login"/"ECNU SSO Password" 条目），读取即可用，无需任何配置——setup 工具应该识别而非强迫新建
3. **IAB 的登录态（cookie）进程内持续**：登录一次后本会话所有 proxy 访问免登录；跨 ZCode 重启的持久性待观察（TODO）
4. WebVPN 对 proxy 域全局拦截（favicon/根路径全 302 到 SSO）→ 无法在 proxy 域种 cookie，cookie 桥接不可行；IAB 也无 addCookies API——登录是唯一途径
5. 用户 Edge 其实**没装 Tampermonkey**（"自动认证"实为 SSO session 未过期）——油猴脚本在本机从未运行，IAB 移植版才是第一个真正落地的自动登录实现

### 新增组件

| 文件 | 说明 |
|---|---|
| `scripts/iab/sso-login.mjs` | IAB SSO 自动登录模块（loadCredentials 钥匙串读取链 + ensureSsoLogin 填表登录 + gotoWithLogin 完整入口），node_repl import 使用 |
| `setup.sh` | 跨平台配置脚本（macOS/Linux）：识别已有钥匙串条目让用户选择（GUI: osascript/zenity/kdialog，终端兜底）、新建专属条目、明文文件三选一；--check/--reset/--remove-credentials |
| `setup.ps1` | Windows 实验版（DPAPI 加密文件存储） |

### 凭据来源优先级（loadCredentials）

source.json（setup.sh 选择结果）→ get-paper 钥匙串条目 → 已有 ECNU SSO 条目 → credentials.json 明文文件

### TODO（更新）

- [ ] ZeroMSA（ScienceDirect）下载：等 Cloudflare 冷却后用 IAB 路线重试（现在 IAB 有登录态了，成功概率上升）
- [ ] IAB cookie 跨 ZCode 重启持久性观察
- [ ] 把"fetch PDF + localStorage 分块导出"固化为 `scripts/iab/fetch-pdf.mjs`（当前是内联代码）
- [ ] IEEE / Springer / Nature 的 IAB 路线验证
- [ ] setup.ps1 的 Windows Credential Manager 集成

---

## 2026-10-05（晚）v0.2：模块化 + 映射表集成 + 三路线批量实测

### 模块化架构（最终形态）

```
get-paper/
├── SKILL.md / DEVLOG.md          # 手册 / 日志
├── setup.sh / setup.ps1          # 跨平台配置（GUI/终端，识别已有钥匙串条目）
├── data/proxy-mapping.json       # 数据库映射表（90 条，与油猴脚本同源）
├── scripts/
│   ├── proxy-url.js              # 查表优先（--explain 显示来源），公式兜底
│   ├── update-mapping.mjs        # 从油猴脚本同步映射表（保留手动新增条目）
│   ├── fetch-paper.sh            # curl 下载 + 验证（退出码语义）
│   ├── init-session.sh           # cookie jar 种子
│   └── iab/
│       ├── sso-login.mjs         # 钥匙串凭据 + SSO 自动登录 + gotoWithLogin
│       └── fetch-pdf.mjs         # 页面内 fetch + localStorage 分块导出（支持 referrer 参数）
└── references/databases.md       # 各库实测模式（本次更新 IEEE 三步流程）
```

### Scholar 批量实测（用户的论文，三路线全通）

| 论文 | 路线 | 结果 |
|---|---|---|
| Position: AI Conference Unsustainable (arXiv:2508.04586) | 公开 curl | ✅ 2.95MB |
| ModelGo (10.1145/3589334.3645520, ACM) | IAB: gotoWithLogin + fetchPdfViaPage | ✅ 1.66MB |
| FedGroup (10.1109/...52081.2021.00042, IEEE) | curl 三步 | ✅ 1.49MB |

流程：IAB 打开 Scholar 主页抓论文列表（`a.gsc_a_at`）→ Crossref 标题查 DOI（Scholar 详情页结构不配合，Crossref 更稳）→ 按库分流。

### IEEE 新发现（修正旧手册）

- **stamp.jsp 预热是必需的**（旧手册说"不需要导航 stamp.jsp"不完整——当时 jar 里已有 ERIGHTS）：论文页 → stamp.jsp（种许可 cookie）→ getPDF 三步缺一 418
- IAB 页面内 fetch 对 stamp/stampPDF 全军覆没（即使带 Referer）——非导航请求一律 418；IEEE 是唯一必须 curl 路线的库
- arnumber 不能从 DOI 最后一段推（FedGroup DOI 尾段 00042，arnumber 是 9644782），用 `curl -sI https://doi.org/{DOI}` 的 location 拿

### fetchPdfViaPage 模块要点

- `evaluate(fn, arg)` 单参数限制（对象封装），本日两次踩坑，已固化进模块
- `fetch(url, {referrer})` 可设同源 Referer（对 ACM 之类有用），但救不了 IEEE

### 回归测试集（v0.2 新增）

- `data/test-dois.json`：全部实测通过的 DOI（含期望大小区间），新增路线验证后随手加一条
- `scripts/test-suite.sh`：curl 路线全自动回归（arXiv / ACM / IEEE 三步），`--route` 过滤，`--keep` 保留产物；IAB 路线（ModelGo、Conservation AI）标注 skip，需 node_repl 手动跑
- 当前状态：3 pass, 0 fail, 3 skip
- 踩坑：IFS 制表符是空白字符会吞空字段（改用 \\x1f 分隔）；node 没有 print（console.log）

---

## 2026-10-05（夜）v0.3：session 自动续命，Edge 依赖正式清零

### renew-session.mjs（scripts/）— 无头浏览器登录器

问题：IEEE 只能走 curl（jar），jar 里 `_webvpn_key` 过期后原先只能靠 Edge（手动/MCP）刷新。
解法：**Bash 起无头 Chromium（playwright 完整 API）从零完成 SSO 登录**：
```
launch headless → goto proxy 页 → 302 到 SSO → 表单渲染（fill nameInput/password + click）
→ 跳回 proxy → context.cookies() 导出 17 cookies → 写 jar（备份旧 jar）
```
实测：续命后回归测试 3 pass / 0 fail，全程零 Edge / 零 IAB。

### 为什么纯 curl 登录不可行（重要结论）

SSO 登录表单是 **JS 动态渲染**（curl 拿到的静态 HTML 无 input），渲染后含 **CAS `_eventId` token**（无头浏览器 dump 证实：username(name)/password/hidden type/_eventId/...）。token 绑定会话，纯 HTTP 复刻需要逆向渲染逻辑，不值得——无头浏览器 15 行代码解决。`--curl` 模式保留仅作链路排查。

另：**SSO logout 不会登出 proxy 的 WebVPN session**（单点登出无级联），proxy cookie 独立存活。

### 依赖矩阵（v0.3 后）

| 路线 | 依赖 | Edge MCP？ |
|---|---|---|
| arXiv / OA 公开 | curl | 否 |
| ACM 付费 | curl + jar（或 IAB） | 否 |
| IEEE 付费 | curl 三步 + jar | 否 |
| Wiley OA | IAB | 否 |
| jar 续命 | `node scripts/renew-session.mjs`（playwright 无头） | 否 |

playwright 依赖说明：`PLAYWRIGHT_MODULE` 环境变量或 NODE_PATH；setup.sh 的安装提示在 TODO。

### TODO 更新
- [ ] setup.sh 增加 playwright 依赖检测/安装提示
- [ ] ZeroMSA 重试（SD 冷却后）

### v0.3 补充：headless-download.mjs + SD IP 封锁确认

- 新增 `scripts/iab/headless-download.mjs`：无头 Chromium + jar 注入（addCookies）+ 真实点击 + `download` 事件 saveAs。acceptDownloads 语义下**无弹窗**——IAB 弹窗问题、Edge 断连问题的终极解法
- ZeroMSA 实测：SD 已把 proxy 出口 IP 拉黑（"There was a problem providing the content"），非验证页非无头指纹。教训：Request Verification 若继续尝试会升级为 IP 封锁。挂起次日重试
- 通用模式确立：**需要浏览器环境的下载一律可用无头 playwright**（renew-session 登录 + headless-download 下载），Bash 可直接跑，比 IAB/Edge 都干净

### citeme 数据源缺口补完（同日）

- Conservation AI 全管线闭环：PDF（get-paper IAB 路线）→ MinerU Markdown（280 行）→ codex 深度分析（gpt-6-luna）→ 总结 → 深度报告 → 索引。摘录审计 source_matched 30→31，零不匹配
- citeme 状态：38 篇 canonical，37 篇全处理，**唯一缺口 ZeroMSA**（SD 出口 IP 封锁，headless-download.mjs 已就绪，次日一条命令重试）
- 环境坑：codex CLI（ChatGPT.app 内置 0.160.0）不在 ZCode PATH，symlink /opt/homebrew/bin/codex 修复

---

## 2026-10-05（深夜）v0.4：多源元数据解析器 + 红绿灯测试集

### 新组件

- `scripts/resolve.mjs`：标题→DOI/arXiv 与 作者→论文列表 的多源管线
  - 源：DBLP（CS 精准，8s 快速超时）→ Semantic Scholar（含 openAccessPdf）→ OpenAlex（覆盖广）→ Crossref（兜底）
  - 置信：≥2 源同 DOI → high；严格单源（dblp≥0.85 / s2≥0.95+arXiv / openalex≥0.95 / crossref≥0.97 精确匹配）→ medium；其余拒绝（宁缺毋滥）
  - 429/5xx 退避重试；作者查询 OpenAlex 优先（按 works_count 消歧）+ S2 兜底
- `data/test-resolve.json` + `scripts/test-resolve.mjs`：红绿灯测试（green 必须对 / red 必须拒 / yellow 允许解析不到但绝不允许错）。当前 10G/0R/3Y

### 真实世界教训（含自我纠错）

1. **测试集预期值必须来自权威 API 实测**——两个"解析器红灯"实为记忆错误（JudgeLRM 真值 2504.00050 不是 2502.07562；HugNLP 真有 CIKM 正式版，Crossref 没错配）
2. **标题版本漂移**是常态（MultiFinBen 的 Scholar 旧标题 vs 正式版新标题）——解析不到是正确行为（yellow），硬凑才是错
3. **网络分域限流**：本机 DBLP（经代理）与 export.arxiv.org API 均不可达，arxiv.org 主站却正常；S2 无 key 100req/5min 极易耗尽——**多源冗余是生存必需，单源策略全部失败的场景真实存在**
4. Crossref 式错配特征是 sim 0.3~0.5 的弱相似条目；sim≥0.97 的精确匹配单源放行是安全的
5. "Deep learning" 这类泛标题精确命中经典综述是正确解析，不是错配——red case 设计要区分"精确匹配"与"硬凑"

### Nuo Chen 批量实战（进行中）

- 首轮 6/6、二轮 +2（累计 8 篇下载成功，下载率 100%）
- 未完：S2 限流窗口第三轮重试中；AAAI OJS 站点 curl/无头均未取到 download 链接（挂起）

### Nuo Chen 批量实战结果（终）

- **10/20 篇自动下载成功**（下载率 100%——解析到的全部下到）：ACL×7、arXiv×2（Apollo/JudgeLRM）、ACM 付费×1（HugNLP，curl+jar）
- 剩余 10 篇全部卡在上游源限流/不可达：S2（429）、OpenAlex（限流）、DBLP（网络不通）、arXiv 搜索（连续请求后空结果页——其限流表现为返回无结果页而非 429，勿误判为无此论文）、AAAI OJS（curl/无头均未取到 download 链接）
- 新增第五源 fromArxivWeb（arXiv 网页搜索；查询需去停用词精简至 ≤8 词，长句/标点会解析失败）；脚本幂等（已有文件跳过），源恢复后重跑同命令即可续传
- 产物：/tmp/getpaper-e2e/nuo-chen/（10 PDF + plan.json + download-report.json）

### 测试集扩充（v0.4 尾）

test-resolve.json 新增 4 个 case（真值取自 citeme 已验证数据）：IEEE 绿灯、VLDB/10.14778 绿灯、Wiley-OA 绿灯、SSRN 黄灯。扩充后 10G/0R/4Y（黄灯均为限流期波动——Crossref ≥0.97 精确匹配单源在 S2/OpenAlex 限流期间撑住基本盘，验证了分层置信设计的价值）。测试集规模：14 title cases + 3 author cases。扩充原则：新出版商路线验证一篇就加一条绿灯；边界行为（预印本、标题漂移、重名）加黄灯；预期值一律权威 API 实测。

---

## 2026-10-05（续）v0.5：subagent 自足性测试 —— 三发三中

三个未参与开发的 general-purpose subagent 并行执行（每人只给 SKILL.md + 任务，零提示解题细节）：

| Agent | 任务 | 路线 | 结果 | 耗时/调用 |
|---|---|---|---|---|
| A | MegaAgent（仅标题） | resolve.mjs 五源 → Unpaywall → ACL Anthology OA | ✅ 1.23MB | 72s / 6 次 |
| B | ModelGo（DOI） | Unpaywall 排查 → proxy 两步 curl | ✅ 1.58MB | 55s / 8 次 |
| C | FedGroup（DOI, IEEE） | arnumber 解析 → 三步（含 stamp.jsp 预热） | ✅ 1.42MB | 187s / 19 次 |

### 观察到的超出手册字面的正确行为

- A：medium 置信（sim=1.0 精确匹配）自行判断采用，未打扰用户——手册语义的合理边界
- C：**主动核验 OA 副本内容**——发现 Unpaywall 指向的 arXiv:2010.06870 是旧版预印本（标题不同），拒绝以旧顶新，坚持下载 IEEE 定版
- 全员：未手算 proxy URL（全走 proxy-url.js）、未漏 IEEE 特殊步骤、未触发反爬

### 发现并已修复的手册 bug

SKILL.md 的 Unpaywall 示例邮箱 `getpaper@example.com` 已被 API 列入拒绝名单（422，要求真实邮箱）→ 已改为占位符并注明。scripts/ 与 references/ 无此问题（OpenAlex mailto 不校验）。

**结论：skill 手册自足性达标——可放心摊派 subagent 批量执行。**

### v0.5 补充：移除 Unpaywall 依赖，统一元数据入口

用户指出冗余：OpenAlex（OurResearch 出品）已整合 Unpaywall 全部数据，`best_oa_location.pdf_url` 与 Unpaywall `url_for_pdf` 同源——SKILL.md 里保留手工 Unpaywall curl 是 v0 时代残留。处理：resolve.mjs 新增 `doi` 子命令（OpenAlex by-DOI 优先 + S2 兜底，返回 oaPdf/isOa），Step 1 改用它，Unpaywall 从手册移除（连同邮箱 422 问题一并消灭）。注意 `isOa: true` + `oaPdf: 空` 的组合语义：有 OA 版本但无直链，需 landing 页二次定位。

### v0.5 补充 2：OpenAlex key 池接入

用户指认 lang.csconf 项目已有 8 个 OpenAlex premium key（`scripts/openalex_keys.txt`，每 key 每日 1 万 credits，UTC 午夜重置；文件式管理而非环境变量）。resolve.mjs 接入三级来源：`OPENALEX_API_KEY` 环境变量 → `~/.config/get-paper/openalex_keys.txt` → lang.csconf key 池路径，请求间轮询分流（round-robin）。同批顺带支持 `S2_API_KEY`（x-api-key 头，与 citeme 爬虫同名变量——S2 是无 key 限流的最大瓶颈，有 key 收益最大）。

注意：ZCode 的 shell 不加载 ~/.zshrc，key 类配置走文件路径探测比环境变量可靠（这是本次选择文件式 key 池的原因之一）。

### v0.5 补充 3：setup.sh 初始化询问 API key

`bash setup.sh` 流程新增第 3 步（可选，回车即跳过）：OpenAlex key 池（支持循环录入多个，存 `~/.config/get-paper/openalex_keys.txt`，600 权限）+ S2 key（单个，存 `s2_api_key.txt`）。resolve.mjs 的 S2 key 同步支持文件来源（env > 文件）。`--check` 现在显示 key 配置状态（只报数量不显值）。GUI/终端双模式复用现有 ask/choose 抽象。

### 冀置定案：API key 单一来源 = skill 自有配置文件

- 移除 OPENALEX_API_KEY/OPENALEX_KEYS_FILE/S2_API_KEY 环境变量通道与 lang.csconf 路径探测——key 只读 `~/.config/get-paper/{openalex_keys.txt,s2_api_key.txt}`（setup.sh 第 3 步写入，600 权限）
- 决策依据：① 不依赖其他项目；② ZCode GUI shell 不加载 ~/.zshrc，环境变量在主力场景不可靠；③ 多 key 池文件形式更自然

---

## 2026-10-05（终）v0.6：双 subagent 终测（code review + 10 篇自主下载）+ 修复

### 终测结果

- **Code review agent**（82.5 万 token、27 次调用、动态实测验证）：1 CRITICAL / 10 MAJOR / 18 MINOR / 6 SUGGESTION / 4 文档不一致。整体评价"架构成熟，但问题恰好都落在自我声明的防护类别内"
- **下载测试 agent**（Bingsheng He 学者 10 篇）：**10/10 成功**（公开 6：arXiv×3/ACL×2/AAAI×1；代理 4：ACM×2/IEEE 三步×2），零限流，18MB。subagent 无法用 IAB 但发现 **Scholar citations 页是服务端渲染、curl 直抓可行**——手册可补充

### 已修复（review + 终测发现）

| 级别 | 问题 | 修复 |
|---|---|---|
| C1 | fetch-paper mv 失败假成功（实测复现） | `mv \|\| exit 4`，只读目录回归验证通过 |
| M1/M2 | bash 3.2 全角括号 unbound；--no-gui 只认 $2 | ${MODE} 隔离；全参数遍历 |
| M3 | resolve CLI 无兜底静默 exit 0 | usage + exit 2；且 title 为 null 时打印各源候选（兑现手册承诺，新增 topCandidates 导出） |
| M4 | Linux secret-tool 写读链断裂 | loadCredentials 按 platform 分支（darwin security / linux secret-tool） |
| M5 | headless cookie 域名硬编码 | 尊重 jar 域列 |
| M6 | cookie jar 644 | 两处 chmod 600 |
| M8 | 密码进 argv | security -w 走 stdin |
| M9 | 投票键分裂（10.48550/arxiv.X vs 裸 id）+ 同源凑票 | key 归一化折叠；high 改判 srcs.size≥2 |
| 终测 | arxiv 字段被填成 DOI（String.replace 不匹配返回原串的经典坑） | 正则 exec 先测后取 |
| 终测 | resolve.mjs 被 import 时 CLI 块执行（exit 杀死宿主）；守卫正则又误匹配 test-resolve.mjs | IS_CLI 守卫 + `/\/resolve.mjs$/` 锚定 |

红绿灯回归：**13G/0R/4Y**（修复后反多 3 绿——限流恢复）。剩余未修：M7（setup printf JSON 转义）、M10（Windows 链）、MINOR 若干——记 TODO。

### 今日总结

get-paper 完成：五源解析（含 key 池）、三路线下载（curl/IAB/无头）、双回归测试（红绿灯+路线）、跨平台配置、subagent 摊派验证（两次三发三中/全中）、C1 级静默失败清除。终态 13G/0R/4Y、下载实测 23/23（含 citeme 2 篇 + 自有论文 10 篇 + Bingsheng He 10 篇 + 回归）。

### 测试集扩充（v0.6 尾）：+3 真值 case，又抓一真 bug

新增：AAAI 绿灯（oaPdf 直下）、Bingsheng He 作者绿灯、PVLDB 下载 case（10.14778 走 ACM 代理）。Bingsheng He case 立刻抓出 **OpenAlex 过滤语法 bug**：`publication_year:>=2015` 不被支持（静默异常 → fallback 到残缺 S2 档案），正确写法是区间 `2015-2026`。修复后 Moming Duan 悬了两轮的老黄灯转绿（26 篇）——"档案波动"误诊实为语法 bug。终态 16G/0R/3Y（Nuo Chen 黄为真·重名消歧边界）。

扩充原则再确认：只加新维度（出版商/边界/失败模式），不加同质数量——每加一批新真值就抓出真 bug 的回报率是明证（今日三连：judgelrm 预期错、arxiv 字段 bug、过滤语法 bug）。
