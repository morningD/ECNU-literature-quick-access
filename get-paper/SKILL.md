---
name: get-paper
description: Download academic paper PDFs by DOI / arXiv ID / URL / title. Resolves metadata via a multi-source pipeline (DBLP/Semantic Scholar/OpenAlex/Crossref/arXiv), tries open-access copies first, then paywalled publisher databases (IEEE, ACM, ScienceDirect, Springer, …) through the ECNU WebVPN proxy with a cached session cookie. Includes per-database PDF URL patterns, cookie renewal procedures, and PDF integrity validation.
trigger: Use when the user asks to download / fetch / 获取 / 下载 a paper, PDF, 论文 / 全文, or to batch-download papers from IEEE, ACM, Elsevier or any other digital library. Not for metadata-only lookups.
---

# get-paper — 论文 PDF 下载（公开源 + ECNU 电子数据库）

统一入口：给定 DOI / arXiv ID / 出版社 URL / 标题，把 PDF 下载到本地并验证完整性。
覆盖两类来源：**公开渠道**（arXiv、OA 仓库、出版社免费开放）和 **付费墙数据库**（IEEE/ACM/Elsevier 等，走 ECNU WebVPN 代理）。

本 skill 的路径约定（`SKILL_DIR` = 本 skill 所在目录）：

- 辅助脚本：`$SKILL_DIR/scripts/proxy-url.js`（查表优先）、`fetch-paper.sh`（curl+验证）、`init-session.sh`（cookie jar）
- IAB 模块（ZCode node_repl import）：`scripts/iab/sso-login.mjs`（钥匙串凭据 + SSO 自动登录 + `gotoWithLogin`）、`scripts/iab/fetch-pdf.mjs`（页面内 fetch 下载 `fetchPdfViaPage`）
- 映射表：`data/proxy-mapping.json`（与油猴脚本同源，90+ 库）；上游更新后执行 `node $SKILL_DIR/scripts/update-mapping.mjs` 同步（保留手动新增条目）
- 会话缓存：`~/.config/get-paper/cookies.txt`（Netscape cookie jar，含 WebVPN 登录态）
- 配置工具：`bash $SKILL_DIR/setup.sh`（macOS/Linux，GUI 引导；`--check` 查状态）
- 数据库细节：`references/databases.md` — **构造每个库的 PDF 下载 URL 前必读**
- 元数据解析：`node $SKILL_DIR/scripts/resolve.mjs title|author ...`（五源管线，见 Step 0）
- 无头下载（带挑战的库如 ScienceDirect）：`node $SKILL_DIR/scripts/iab/headless-download.mjs <论文页URL> <链接匹配串> <out.pdf>`（cookie jar 注入 + 真实点击 + download 事件，无弹窗）
- session 续命：`node $SKILL_DIR/scripts/renew-session.mjs`（无头 Chromium 自动登录，凭据复用钥匙串；`PLAYWRIGHT_MODULE` 指定 playwright 路径）
- 回归测试（下载路线）：`bash $SKILL_DIR/scripts/test-suite.sh`（curl 三路线；DOI 集在 `data/test-dois.json`）
- 回归测试（解析器红绿灯）：`node $SKILL_DIR/scripts/test-resolve.mjs`（green 必须对 / red 必须拒 / yellow 允许空不许错；case 集在 `data/test-resolve.json`，**预期值必须来自权威 API 实测**，新库验证后补充）

## 流程总览（严格按顺序）

```
Step 0  解析输入 → (DOI | arXiv ID | URL | 标题→DOI)
Step 1  公开渠道：arXiv 直链 → resolve.mjs doi 的 oaPdf  （无需登录，多数论文在这里结束）
Step 2  ECNU proxy：URL 转换 → 确认 WebVPN session → 数据库 PDF URL → 下载
Step 3  验证：文件头 %PDF- + pdftotext 完整性检查
Step 4  报告：每篇 成功(路径+大小) / 失败(原因+建议)
```

## Step 0 — 解析输入

- `10.xxxx/...` → DOI。
- `arXiv:2508.06811` / `2508.06811` → arXiv ID。
- URL → 直接看 host：
  - 出版社域名（`ieeexplore.ieee.org`、`dl.acm.org`、`sciencedirect.com`、`link.springer.com`…）→ 转 DOI（ACM/IEEE 的 URL 里通常含 DOI 或 arnumber）后走 Step 2。
  - `arxiv.org` → arXiv ID，走 Step 1。
- 只有标题 → 用解析模块（**不要手写单源 curl**）：
  ```bash
  node "$SKILL_DIR/scripts/resolve.mjs" title "<标题>"
  # → { doi, arxiv, oaPdf, confidence, source } | null
  ```
  五源管线（DBLP/S2/OpenAlex/Crossref/arXiv 网页搜索）+ 交叉验证 + 宁缺毋滥：`confidence: high`（≥2 源一致）可直接用；`medium`（严格单源）建议向用户亮出标题确认；`null` 列出候选让用户选。**Crossref 单源裸查会错配（sim 0.3~0.5 的弱相似条目），禁止绕过管线。**
- 学者 → 论文列表：`node "$SKILL_DIR/scripts/resolve.mjs" author "<姓名>" --since 2021`（OpenAlex 消歧 + S2 兜底）；Google Scholar 链接场景用 IAB 打开抓 `a.gsc_a_at`（resolve 不管 Scholar 页面）。重名严重时（返回篇数异常少）按机构人工确认档案。

输出文件名约定：默认 `{doi-slug}.pdf`，doi-slug = DOI 小写后把非 `[a-z0-9-]` 字符替换为 `-`（与 KB 仓库 citeme 惯例一致）。输出目录由用户指定，未指定时用 `./papers/`。

## Step 1 — 公开渠道（优先，无需任何登录）

**arXiv**（有 arXiv ID 时直接下，跳过其余）：

```bash
"$SKILL_DIR/scripts/fetch-paper.sh" "https://arxiv.org/pdf/<ARXIV_ID>" out.pdf
```

**DOI（含出版社 DOI）** 用解析模块直查 OA 副本（OpenAlex 数据已整合 Unpaywall，单一入口即可；注意 `isOa: true` 但 `oaPdf` 为空表示有 OA 版本但无直链 PDF，需进 landing 页找）：

```bash
node "$SKILL_DIR/scripts/resolve.mjs" doi "<DOI>"
# → { title, doi, arxiv, oaPdf, isOa, ... }
```

拿到 `oaPdf` 后同样用 `fetch-paper.sh` 下载；`arxiv` 字段非空时也可构造 `https://arxiv.org/pdf/{arxiv}` 直下。

任一公开渠道成功 → 直接进 Step 3。`oaPdf`/`arxiv` 均空 → 进 Step 2。

## Step 2 — ECNU WebVPN 代理（付费数据库）

### 2.1 URL 转换

两条路线按场景选：

- **公式转换**（curl 路线用）：host 中 `-`→`--`、`.`→`-`，HTTPS 站点加 `-443` 后缀，再拼 `.proxy.ecnu.edu.cn`。例：`ieeexplore.ieee.org` → `ieeexplore-ieee-org-443.proxy.ecnu.edu.cn`。用脚本转换，不要手算：
  ```bash
  node "$SKILL_DIR/scripts/proxy-url.js" "https://ieeexplore.ieee.org/document/11181995"
  # → https://ieeexplore-ieee-org-443.proxy.ecnu.edu.cn/document/11181995
  ```
- **油猴脚本接管**（浏览器路线首选）：用户日常 Edge 装了 ECNU 油猴脚本，直接导航**原始地址** `https://doi.org/{DOI}`，脚本自动跳 proxy（含动态子域映射）并自动完成 SSO。例外：Wiley 在脚本映射中已移除（代理对 Wiley 无效），OA 文章直连原始域即可。

**反爬铁律：每个库的一次下载任务最多"一次导航 + 一次点击"，禁止连续导航/fetch/curl 反复探测同一库**——会触发 Cloudflare/出版商验证（ScienceDirect 实测触发 "Request Verification"）。一旦触发，立即停止该库自动化，换渠道或等冷却，绝不连续重试。

### 2.2 确保 WebVPN session

先直接尝试下载（2.3）。`fetch-paper.sh` 检测到登录页/会话失效时会以**退出码 3** 报 `SESSION_EXPIRED`，此时才需要刷新 cookie（见「WebVPN cookie 获取与刷新」），刷新后重试一次。**不要在 session 正常时主动去开浏览器。**

### 2.3 构造数据库 PDF URL 并下载

**先读 `references/databases.md`**，里面有每个库已验证的 PDF URL 模式和 cookie 要求（如 IEEE 必须带 proxy 域 JSESSIONID 否则 418、ACM 用 `?download=true` 等）。通用模式：

```bash
PROXY_PAGE=$(node "$SKILL_DIR/scripts/proxy-url.js" "https://<论文页URL>")
PDF_URL=$(node "$SKILL_DIR/scripts/proxy-url.js" "https://<该库PDF端点>")

# 第一次访问论文页：建立数据库 session（cookie jar 自动积累）
"$SKILL_DIR/scripts/fetch-paper.sh" "$PROXY_PAGE" /dev/null --page-only
# 再下 PDF
"$SKILL_DIR/scripts/fetch-paper.sh" "$PDF_URL" out.pdf --referer "$PROXY_PAGE"
```

页面型下载（URL 模式未知的库）：**先看 DOM 和网络痕迹再动手**——很多库的 PDF 不是页面里那个链接，而是 iframe/查看器内部加载的真实端点（如 Wiley 的 `/doi/pdfdirect/`，在 iframe src 或 `performance.getEntriesByType('resource')` 里可见）。找到真实端点后优先**页面内同源 fetch**（自动带 cookie 与 Referer，最不易触发反爬）。ScienceDirect 有一次性签名挑战，curl/fetch 一律返回 HTML，详见 references 的专门说明。

## Step 3 — 验证

`fetch-paper.sh` 已内置：文件头必须是 `%PDF-`、`pdftotext` 解析成功（能检出 xref 损坏的假 PDF）。脚本失败时会保留损坏文件供排查并返回非零。

## Step 4 — 报告

每篇一行结论：`✓ <slug>.pdf <size> <来源>` 或 `✗ <slug> <原因> <建议>`。批量任务结束给成功/失败计数。失败原因分类：无公开副本且数据库无权限 / WebVPN session 过期（提示用户刷新）/ 数据库本身不提供 PDF（如纯 HTML）。

## WebVPN cookie 获取与刷新

cookie jar：`~/.config/get-paper/cookies.txt`。核心是 `.proxy.ecnu.edu.cn` 域下的 `_webvpn_key`（HttpOnly）与 `ECNU`。按环境选择（A 最优先）：

**A. Playwright MCP + Edge 扩展（首选，全自动）**。前提三项：
1. Edge 已安装 Playwright 扩展并处于 Connected 状态（用户日常浏览器，带全部登录态）；
2. MCP server 以 `--browser msedge --extension` 启动，环境变量 `PLAYWRIGHT_MCP_EXTENSION_TOKEN` 已配置（ZCode：`~/.zcode/cli/config.json` 的 `mcp.servers.playwright.environment`；token 来自扩展首次连接时弹窗，扩展重装/重置后会变）；
3. **宿主应用（ZCode/Claude Code/终端）已被 macOS 授予"完全磁盘访问"**，否则 server 读不了 Edge profile，所有浏览器工具报 `Playwright Extension not found in ~/Library/Application Support/Microsoft Edge`。

流程：`browser_navigate` 到任意 `*.proxy.ecnu.edu.cn` 页面（WebVPN session 有效时不会跳登录页）→ 提取 cookie，两种方式按环境选：
- **`browser_run_code_unsafe`**（Claude Code 环境验证可用）：
  ```js
  async (page) => {
    const cookies = await page.context().cookies();
    return cookies
      .filter(c => ['_webvpn_key','ECNU','JSESSIONID','ERIGHTS'].includes(c.name))
      .map(c => `${c.name}=${c.value}`).join('; ');
  }
  ```
- **`browser_network_requests` + `browser_network_request`**：找 `proxy.ecnu.edu.cn` 域的请求，从请求详情 headers 里复制整条 `Cookie:` 值（HttpOnly cookie 页面 JS 拿不到，但请求头里有）。

结果传给 `"$SKILL_DIR/scripts/init-session.sh" "<整段 cookie>"`。数据库域名的 JSESSIONID/ERIGHTS 之后由 2.3 的首次页面访问自动重建，这里只需 `_webvpn_key`/`ECNU` 是新的。

**B. 手动提供（无 playwright MCP 或权限受限时的兜底）**：让用户在**日常 Edge**（已装 ECNU 油猴脚本、SSO 已登录）打开任意 `*.proxy.ecnu.edu.cn` 页面 → F12 → Network 随便选一个请求 → 复制整条 `Cookie:` 请求头值，然后同样传给 `init-session.sh`。

**C. ZCode 内置浏览器（IAB）**：IAB 无用户登录态。导航 proxy 页后若跳到 SSO 登录页，请用户在可见的浏览器窗格中手动登录一次，登录完成后回到方案 B 让用户复制，或直接在 IAB 内完成当次页面定位。

**D. IAB 接力提取 PDF（Edge/扩展不可用或需要零弹窗时）**：IAB 是完全受控的 Playwright 浏览器，且 Cloudflare 通行度较高（curl 403 的页面 IAB 常能直接打开）。要点（Wiley 实测通过）：
1. IAB 打开文章页（OA 直连原始域；需订阅的库走 proxy URL）；
2. `evaluate` 侦查真实 PDF 端点（iframe src / performance resource entries）；
3. 页面内同源 fetch 该端点 → `arrayBuffer` → base64 存 **localStorage**（注意：IAB 的 `evaluate` 每次调用是隔离上下文，`window` 不跨调用共享，必须用 localStorage 按 origin 中转）；
4. 分块 `evaluate` 取出（每块约 200k 字符）在 Node 侧拼装写文件。
**不要用 IAB 的 `downloadMedia()` 或点击下载按钮**——会弹保存位置对话框，阻塞自动化（用户取消即 `download cancelled`）。

**注意**：Edge 扩展模式下不要点击 PDF 下载链接或导航到 PDF URL（触发浏览器下载导致 MCP 断连）——Edge 只用来建立/读取 session；实际下载用 curl 或 IAB 页面内 fetch。

## 常见错误对照

| 症状 | 原因 | 处理 |
|---|---|---|
| HTTP 418 | IEEE：缺 proxy 域 JSESSIONID | 先 `--page-only` 访问论文页重建 session，再带 Referer 下 PDF |
| HTTP 403 | 缺 Referer/UA，或数据库拒绝 | 加 `--referer`；仍 403 则确认机构订阅 |
| 退出码 3 SESSION_EXPIRED | WebVPN session 过期 | 运行 `node "$SKILL_DIR/scripts/renew-session.mjs"`（无头浏览器自动登录续命，无需 Edge/IAB）后重试 |
| HTTP 200 但内容是 HTML | 下载的是页面不是 PDF | URL 模式不对，查 references/databases.md |
| 302 跳出 `*.proxy.ecnu.edu.cn` | 代理不支持该库（如 Wiley） | 见 references「跳出代理的数据库」 |
