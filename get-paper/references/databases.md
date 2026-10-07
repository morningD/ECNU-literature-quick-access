# 数据库 PDF 下载模式参考

所有 URL 均指**原始域名**形式，用 `scripts/proxy-url.js` 转成 proxy 域名后访问。
`fetch-paper.sh` 自动带 cookie jar（`~/.config/get-paper/cookies.txt`）和浏览器 UA。

## 已验证模式（在 ECNU proxy 下实测通过）

### ACM Digital Library — `dl.acm.org`

- 论文页：`https://dl.acm.org/doi/{DOI}`
- PDF：`https://dl.acm.org/doi/pdf/{DOI}?download=true`
- Cookie：`_webvpn_key` + `ECNU` + ACM 域的 `JSESSIONID`（首次访问论文页后 cookie jar 自动带上）
- 成功特征：`200 application/pdf`

### IEEE Xplore — `ieeexplore.ieee.org` ✅（2026-10-05 curl 路线实测通过）

- 论文页：`https://ieeexplore.ieee.org/document/{arnumber}`；arnumber 从 `doi.org` 302 location 拿（`curl -sI https://doi.org/{DOI}` → `ieeexplore.ieee.org/document/{arnumber}/`）。注意 DOI 最后一段**不一定**是 arnumber
- **curl 三步流程**（缺一不可，否则 418）：
  1. `fetch-paper.sh <proxy论文页> /dev/null --page-only`（建 proxy JSESSIONID）
  2. `fetch-paper.sh <proxy>/stamp/stamp.jsp?tp=&arnumber={ID} /dev/null --page-only`（**预热：种 IEEE 许可 cookie**）
  3. `fetch-paper.sh <proxy>/stampPDF/getPDF.jsp?tp=&arnumber={ID}&ref= out.pdf --referer <stamp.jsp URL>`
- **IAB 页面内 fetch 路线对 IEEE 不可用**：stamp/stampPDF 端点对非导航请求一律 418（即使带 stamp Referer 和完整 cookie），IEEE 是目前已知唯一必须 curl 路线的库
- 418 响应体是 IEEE 会员配置 JS 页（`MEMBER_PROFILE_...` 开头），可据此识别

### ScienceDirect (Elsevier) — `www.sciencedirect.com` ⚠️ 有反爬挑战（2026-10 实测）

- 论文页：`https://www.sciencedirect.com/science/article/pii/{PII}`（PII 从 `doi.org` 解析的 location 拿：`linkinghub.elsevier.com/retrieve/pii/{PII}`）
- PDF 端点 `pdfft` **不能直接用**：需要点击时 JS 生成的一次性签名参数（`md5=`、`crtasolve=1&token=`），token 绑定浏览器环境，curl 复用 403；页面内 fetch 也返回 SPA 壳
- **自动下载路线：`scripts/iab/headless-download.mjs`**（无头 Chromium + cookie jar 注入 + 真实点击 + download 事件 saveAs，全程无弹窗）：
  ```bash
  PLAYWRIGHT_MODULE=<playwright路径> node scripts/iab/headless-download.mjs \
    "https://www-sciencedirect-com-443.proxy.ecnu.edu.cn/science/article/pii/{PII}" pdfft out.pdf
  ```
- **重要教训（2026-10-05）**：对 SD 连续探测（多次导航/fetch/curl）会触发 Cloudflare "Request Verification"，**再升级为 proxy 出口 IP 级封锁**（页面显示 "There was a problem providing the content you requested"），持续数小时至一天。被封锁后唯一正确动作：停止尝试，等冷却（次日重试 headless-download）
- ECNU 订阅权限本身无问题（页面正文可正常渲染）

### Wiley — `onlinelibrary.wiley.com` / `conbio.onlinelibrary.wiley.com`（OA 已验证 ✅ 2026-10-05）

- **proxy 对 Wiley 无效**（302 到期刊子域时掉出代理；油猴映射也已移除），但 **OA 文章直连原始域即可**
- 端点真相（以 conbio 为例）：
  - `/doi/pdf/{DOI}` → 非真实点击一律返回文章页 HTML（curl/fetch/goto 全是）
  - `/doi/epdf/{DOI}` → 在线查看器（HTML 壳）
  - **`/doi/pdfdirect/{DOI}` → 真 PDF**（浏览器里由 iframe 加载，`performance.getEntriesByType('resource')` 可见）
- **推荐路径（零弹窗）**：IAB 或 Edge 打开文章页 → 页面内同源 `fetch('/doi/pdfdirect/{DOI}')` → 200 application/pdf → base64 经 localStorage 分块传出（详见 SKILL.md 方案 D）
- curl 直连 pdfdirect 会 403（Cloudflare），必须从已加载页面内 fetch

### Springer / Nature

- Springer：`https://link.springer.com/content/pdf/{DOI}.pdf`（DOI 原样含斜杠）
- Nature：论文页 `https://www.nature.com/articles/{article-id}`，PDF 即 `https://www.nature.com/articles/{article-id}.pdf`

### arXiv（无需 proxy）

- `https://arxiv.org/pdf/{id}` 直接公开下载。

## 通用兜底（无固定模式的库）

1. `--page-only` 拿论文页 HTML
2. 在 HTML 里搜 PDF 链接特征：`href="[^"]*(pdf|pdfft|getPDF|download)[^"]*"`
3. 相对链接补全域名 → `proxy-url.js` 转换 → `fetch-paper.sh` 下载
4. 返回 HTML 而非 PDF 时，检查链接是否需要 JS 渲染——此时改用浏览器自动化在页面上定位真实 PDF 请求 URL

## 跳出代理的数据库（proxy 服务器问题，2026-03 实测）

以下域名经 proxy 访问会跳出代理域，**curl 拿不到**，需要改用其他渠道：

| 域名 | 行为 | 替代方案 |
|---|---|---|
| `onlinelibrary.wiley.com` | 302 到期刊子域（如 `conbio.`）时掉出代理 | OA 文章直连原始域 + 页面内 fetch `pdfdirect`（见上）；付费文章找 OA 副本或手动 |
| `ebookcentral.proquest.com` | 跳到 about 页 | 手动 |
| `www.degruyter.com` | 域名已改 degruyterbrill.com | 用新域名重试转换 |
| `www.pnas.org` | 504 / 跳出 | PNAS 有 OA 政策，查 OA 副本（`resolve.mjs doi`） |
| `sage.cnpereading.com` | 跳回原域名 | 手动 |

## proxy 兼容性速查（正常工作的主要库）

IEEE、ACM、ScienceDirect、Springer、CNKI、万方、Web of Science、Scopus、JSTOR（需 -443）、Taylor & Francis、ACS、RSC、Annual Reviews、Cambridge、Optica、SPIE（有 hCaptcha）、Emerald（Cloudflare）等完整清单见 `ecnu-literature-quick-access/PROXY_CHECK.md`（如该仓库在本地）。

## 验证注意

- 文件头 `%PDF-` 不够：xref 损坏的 PDF `file` 命令查不出来，必须 `pdftotext` 解析（`fetch-paper.sh` 已内置）。
- 成功响应的 content-type 应为 `application/pdf`；`text/html` 说明拿到的是页面或错误页。
