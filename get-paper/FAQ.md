# get-paper 常见问题排查

按"症状 → 原因 → 处理"组织。找不到答案时看 [DEVLOG.md](./DEVLOG.md)（含完整的踩坑时间线）或提 Issue。

## 目录

- [安装与配置](#安装与配置)
- [识别与凭据](#识别与凭据)
- [下载失败](#下载失败)
- [解析（DOI）失败](#解析doi失败)
- [限流与反爬](#限流与反爬)
- [已知限制](#已知限制)

---

## 安装与配置

**Q: `bash setup.sh` 没有弹 GUI 对话框？**
A: GUI 依赖 macOS 的 osascript 或 Linux 的 zenity/kdialog，都没有时自动降级为终端交互——这是正常行为，不是 bug。想强制终端模式加 `--no-gui`。

**Q: 怎么确认安装成功？**
A: `bash setup.sh --check`。四项全 ✓ 即就绪（symlink ×2、SSO 凭据、可选 API key）。

**Q: SSO 凭据存在哪里？安全吗？**
A: 按你配置时的选择：macOS 钥匙串（`get-paper` 条目，磁盘无明文）、Linux secret-tool、或 600 权限的明文 JSON（`~/.config/get-paper/credentials.json`）。凭据只用于向学校 SSO 登录，不经过任何第三方服务器。删除用 `--remove-credentials`。

**Q: OpenAlex / Semantic Scholar key 从哪申请？去哪配？**
A: OpenAlex 在 [openalex.org](https://openalex.org) 申请 premium key（免费额度每日 1 万 credits/key，可申请多个）；S2 在 [semanticscholar.org/product/api](https://www.semanticscholar.org/product/api) 申请（个人免费）。配置：重跑 `bash setup.sh --reset` 或直接把 key 写入 `~/.config/get-paper/openalex_keys.txt`（每行一个）和 `s2_api_key.txt`（单个）。

**Q: 为什么不用环境变量存 key？**
A: AI 助手（如 ZCode）是 GUI 应用，它的 shell 不加载 `~/.zshrc`——环境变量在主力场景读不到。文件是更可靠的通道，所以统一走 `~/.config/get-paper/`。

**Q: setup.ps1（Windows）能用吗？**
A: 可用。凭据以 DPAPI（按当前用户加密）保存到 `~/.config/get-paper/credentials.json.bin`，读取端 `sso-login.mjs` 调系统 PowerShell 解密，密码不落明文；skill 通过目录联接登记到 `~/.agents/skills` 与 `~/.zcode/skills`。运行 `powershell -ExecutionPolicy Bypass -File get-paper\setup.ps1`。

## 识别与凭据

**Q: AI 助手没识别到 skill？**
A: 检查 `~/.agents/skills/get-paper` 是否存在（`setup.sh --check`）。ZCode 用户还需 `~/.zcode/skills/get-paper`。配置后需要重启 AI 助手会话。Claude Code 用户把仓库路径加进其 skill 搜索路径或做 symlink 均可。

**Q: renew-session 报 "no credentials"？但 setup.sh 显示已配置？**
A: 两个可能：① Linux 上用了明文文件之外的方式但工具链读取分支未覆盖（旧版本 bug，请更新）；② 凭据文件 JSON 格式坏了（密码含 `"` 或 `\` 且用旧版 setup 写入会损坏 JSON——升级后已修复）。重跑 `bash setup.sh --reset`。

**Q: 首次用钥匙串时弹了系统授权框？**
A: 正常。点「总是允许」后静默。如果点了「拒绝」，后续读取会一直失败——去钥匙串访问里对该条目右键 → 显示简介 → 访问控制，添加对应应用。

## 下载失败

**Q: fetch-paper.sh 退出码 3（SESSION_EXPIRED）？**
A: WebVPN 会话过期。一条命令续命（无头浏览器自动登录，凭据来自钥匙串）：
```bash
node get-paper/scripts/renew-session.mjs
```
需要 playwright：`npm i -g playwright && npx playwright install chromium`，或用 `PLAYWRIGHT_MODULE` 指向已有安装。

**Q: IEEE 下载 418？**
A: IEEE 的 `stamp/stampPDF` 端点要求三步缺一不可（详见 references/databases.md）：论文页（建 JSESSIONID）→ `stamp.jsp` 预热（种许可 cookie）→ `getPDF.jsp`（带 stamp.jsp 作 Referer）。418 响应体以 `MEMBER_PROFILE_...` 开头即是此症状。skill 的 IEEE 流程已内置三步，手动复刻时容易漏第二步。

**Q: ACM 直连 403？**
A: ACM 的 `dl.acm.org/doi/pdf/...` 直连被 Cloudflare 拦，必须走代理两步（论文页 → `?download=true`）。这是预期行为。

**Q: 下载到的是 HTML 不是 PDF（退出码 2）？**
A: URL 模式不对。查 [references/databases.md](./references/databases.md) 对应库的已验证模式——特别注意 Wiley：页面上的 PDF 按钮链接（`/doi/pdf/`）对非真实点击一律返回 HTML，真端点是 `/doi/pdfdirect/`。

**Q: fetch-paper.sh 报 SAVE FAILED（退出码 4）？**
A: 输出目录无写权限或磁盘满。旧版本此场景会假成功，已修复为显式报错。

**Q: 内置浏览器（IAB）下载弹了保存位置对话框？**
A: IAB 的 `downloadMedia()`/点击下载按钮会走浏览器 UI。规避方式：优先用页面内 fetch（SKILL.md 方案 D，零弹窗）；或改用无头 Chromium（`scripts/iab/headless-download.mjs`，同样零弹窗）。

## 解析（DOI）失败

**Q: resolve.mjs title 返回 null？**
A: 这是"宁缺毋滥"设计——单源弱相似结果会被拒绝（防 Crossref 式错配）。null 时会打印各源最佳候选，人工确认后用 `resolve.mjs doi <DOI>` 直查。常见原因：标题版本漂移（预印本与正式版标题不同）、论文太新（S2/OpenAlex 尚未收录）、所有源都在限流。

**Q: 解析到的 arXiv 版本和正式发表版本不是同一篇内容？**
A: 同一工作的预印本和出版版是两个标识（arXiv id 与 DOI）。默认下载正式版（有 DOI 用 DOI），需要预印本时明确说。

**Q: 作者查询返回的篇数明显不对/混入别人的论文？**
A: 重名问题。优先用 DBLP（消歧编号），网络不通时 OpenAlex 按 works_count 选档案可能选错同名者。检查方式：`resolve.mjs author "姓名"` 看返回的 source 字段；重名严重的名字建议加机构限定人工确认。

## 限流与反爬

**Q: Semantic Scholar 频繁 429？**
A: 无 key 限 100 次/5 分钟。批量任务前配置 S2 key（见上文）；或脚本自动退避重试，等 5 分钟窗口。

**Q: arXiv 搜索返回空结果页？**
A: arXiv 的限流伪装成"无结果"而非 429——**不要误判为论文不存在**。等几分钟再试。另注意 arXiv 搜索对长标题/标点解析差，查询词需精简到 ≤8 个关键词（脚本已自动处理）。

**Q: ScienceDirect 一直进不去？**
A: SD 有 Cloudflare 挑战 + IP 封锁机制：连续自动化请求会先触发 "Request Verification"，继续尝试会升级为对代理出口 IP 的封锁（页面显示 "There was a problem providing the content"），持续数小时到一天。**唯一正确动作：停止尝试，次日再用 `headless-download.mjs` 重试**。绝不连续重试。

**Q: Google Scholar 页面抓不到论文列表？**
A: Scholar 的 citations 主页是服务端渲染，curl 可直接抓（`a.gsc_a_at` 链接），不一定要浏览器。Scholar 本身对高频访问敏感，批量任务注意间隔。

## 已知限制

| 限制 | 状态 | 说明 |
|------|------|------|
| ScienceDirect 自动下载 | ⚠️ 受 Cloudflare 限制 | 工具已备（headless-download），被封锁时只能等冷却 |
| Wiley 付费（非 OA）文章 | ❌ | Wiley 认证拒绝代理域名（上游问题），找 OA 副本或手动 |
| IAB 单次 evaluate 的隔离上下文 | 已适配 | localStorage 中转方案（SKILL.md 方案 D） |
| 大 PDF（>3.5MB）经 localStorage | ⚠️ | base64 膨胀可能超 5MB 配额，报 lsErr 时改用 headless-download |
| Windows 全功能支持 | ✅ | DPAPI 加密凭据 + PowerShell 解密读取；skill 以目录联接登记 |
| DBLP 源在部分网络不可达 | 已适配 | 8s 快速超时后自动跳过，不影响其他源 |
