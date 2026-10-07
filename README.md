# 🎓 ECNU 文献快速获取

> 🚀 校外轻松访问学术数据库 · AI 助手自动下载论文全文

[English](./README_EN.md) · [常见问题（skill）](./get-paper/FAQ.md)

**按你的使用方式选择入口：**

| 我用的是… | 进入 | 它帮我做什么 |
|------------|------|--------------|
| 🌐 **浏览器**（查文献、看全文） | [油猴脚本 →](#油猴脚本) | 访问学术网站自动跳转 ECNU 代理 + SSO 自动登录，装完无感 |
| 🤖 **AI 助手**（ZCode / Claude Code 等） | [get-paper skill →](#get-paper-skill) | 说一句话，AI 自动解析并下载论文 PDF（公开源 + 付费数据库） |

两者相互独立，可只装其一；油猴脚本的数据库映射表也是 skill 的数据源。

---

## 目录

- [油猴脚本](#油猴脚本) —— 安装三步 · 支持数据库 · FAQ
- [get-paper skill](#get-paper-skill) —— 安装 · 使用示例 · 隐私 · 测试
- [适配其他学校](#适配其他学校)
- [文档索引](#文档索引)

---

## 油猴脚本

面向浏览器用户的自动跳转 + SSO 自动登录脚本。

### 安装三步

1. **装 Tampermonkey**：[Chrome](https://chrome.google.com/webstore/detail/tampermonkey/dhdgffkkebhmkfjojejmpbldmpobfkfo) / [Edge](https://microsoftedge.microsoft.com/addons/detail/tampermonkey/iikmkjmpaadaobahmlepeloendndfphd)
   ⚠️ Chrome/Edge 138+ 必须在扩展管理页打开 **允许用户脚本**，否则不运行
2. **装脚本**：打开 [`ecnu-literature-quick-access.user.js`](./ecnu-literature-quick-access.user.js) → Raw → Tampermonkey 弹窗安装（需要动态识别新子域选[自动版](./ecnu-literature-quick-access-auto.user.js)，两者勿同装）
3. **配凭据**：打开[图书馆数据库列表](https://lib.ecnu.edu.cn/sjk/list.htm) → Tampermonkey 图标 → **ECNU 文献快速获取 - 设置** → 填学号密码（混淆存储在沙盒中）

装完正常浏览即可：访问 IEEE/ACM/ScienceDirect 等学术网站自动跳转代理地址，首次自动登录 SSO。

### 功能与支持范围

| 功能 | 说明 |
|------|------|
| 🔄 自动跳转 | 100+ 数据库映射（CNKI/万方/WoS/Scopus/IEEE/ACM/ScienceDirect/Springer/Nature/ACS/RSC…），图书馆新增可在列表页一键更新 |
| 🔐 SSO 自动登录 | 自动填写学号密码（原生 setter 兼容 Angular 表单） |
| 🖱️ 手动模式 | 可切换为浮动按钮确认后跳转 |
| 🌐 双语界面 | 中文 / English |

### 油猴常见问题

<details>
<summary>展开</summary>

- **装了没生效** → 检查 Chrome/Edge 的"允许用户脚本"开关（最常见）
- **某网站不跳转** → 更新映射表 → 换自动版 → 或设置中手动添加域名
- **Wiley 打不开** → Wiley 认证拒绝代理域名（上游问题，见 [PROXY_CHECK.md](./PROXY_CHECK.md)）

</details>

---

## get-paper skill

面向 AI 助手的论文自动下载 skill。给助手一句「下载这篇论文」，它自动完成：**解析 DOI（五源交叉验证）→ 公开副本优先（arXiv/ACL/AAAI/仓库 OA）→ 付费库走 ECNU WebVPN 代理 → PDF 完整性验证**。

### 已验证路线（全部实测）

| 来源 | 路线 | 状态 |
|------|------|------|
| arXiv / OA 仓库 / ACL Anthology / AAAI / MDPI | 公开直下 | ✅ |
| ACM Digital Library（含 VLDB/PACMMOD） | curl + WebVPN 会话 | ✅ |
| IEEE Xplore（三步：论文页 → stamp 预热 → getPDF） | curl + WebVPN 会话 | ✅ |
| Wiley（OA 文章，`pdfdirect` 端点） | 浏览器页面内提取 | ✅ |
| ScienceDirect | ⚠️ Cloudflare 挑战，处置见 [FAQ](./get-paper/FAQ.md) |

批量实战记录：学者主页 10 篇 **10/10 全自动成功**（公开 6 + ACM 2 + IEEE 2），零人工干预。

### 安装（约 1 分钟）

```bash
git clone https://github.com/morningD/ECNU-literature-quick-access.git
cd ECNU-literature-quick-access
bash get-paper/setup.sh
```

setup 引导三步（GUI 对话框或终端）：**① 安装 skill**（symlink，AI 助手自动发现）→ **② 配 ECNU SSO 凭据**（钥匙串/secret-tool/600 权限文件三选一）→ **③ API key（可选）**。

```bash
bash get-paper/setup.sh --check              # 查看配置状态
bash get-paper/setup.sh --reset              # 重新配置
bash get-paper/setup.sh --remove-credentials # 清除凭据
```

排不上号的问题先看 **[get-paper/FAQ.md](./get-paper/FAQ.md)**（安装/下载失败/限流/已知限制，按症状排查）。

### 使用示例

**对话式**（对已装 skill 的 AI 助手说）：

```text
用 get-paper 下载这篇论文：10.1145/3589334.3645520
把 https://scholar.google.com/citations?user=xxxx 这位学者近 5 年的论文都下载下来
下载 "HugNLP: A unified and comprehensive library for natural language processing"
```

**命令式**（脚本单独用）：

```bash
node get-paper/scripts/resolve.mjs title "ModelGo: A Practical Tool for ..."   # 标题→DOI（五源交叉验证）
node get-paper/scripts/resolve.mjs doi "10.18653/v1/2025.findings-acl.259"     # DOI→元数据+OA直链
node get-paper/scripts/resolve.mjs author "Bingsheng He" --since 2015          # 学者→论文列表
node get-paper/scripts/proxy-url.js "https://ieeexplore.ieee.org/document/9644782"  # →代理URL
bash get-paper/scripts/fetch-paper.sh "https://arxiv.org/pdf/2508.04586" paper.pdf  # 下载+验证
node get-paper/scripts/renew-session.mjs                                      # 会话过期一键续命
```

**批量摊派**：skill 手册经过 subagent 自足性测试，可把批量下载任务摊派给多个 AI subagent 并行执行（见 [DEVLOG.md](./get-paper/DEVLOG.md) 测试记录）。

### 隐私与安全

- SSO 凭据只存本机（钥匙串 / secret-tool / 600 权限文件），登录请求直达学校 SSO，**不经过任何第三方**
- 会话 cookie 与 API key 均在 `~/.config/get-paper/`（600 权限）
- 本仓库不含任何个人凭据；PDF 从出版商/学校官方 WebVPN 代理下载

### 测试与维护

```bash
bash get-paper/scripts/test-suite.sh      # 下载路线回归
node get-paper/scripts/test-resolve.mjs   # 解析器红绿灯测试
node get-paper/scripts/update-mapping.mjs # 油猴映射表更新后同步
```

测试集在 `get-paper/data/`，预期值全部来自权威 API 实测，欢迎 PR 补充新出版商 case。

---

## 适配其他学校

油猴脚本与 skill 的 proxy 规则均按 ECNU WebVPN 定制。大部分高校 WebVPN 机制类似，参考 [PLAN.md](./PLAN.md) 让 AI 生成适配版（改代理域名后缀、SSO 地址、表单选择器即可）。

## 文档索引

| 文档 | 内容 |
|------|------|
| [get-paper/SKILL.md](./get-paper/SKILL.md) | skill 完整手册（AI 助手的执行依据） |
| [get-paper/FAQ.md](./get-paper/FAQ.md) | 常见问题排查（按症状组织） |
| [get-paper/references/databases.md](./get-paper/references/databases.md) | 各数据库实测下载模式与踩坑 |
| [get-paper/DEVLOG.md](./get-paper/DEVLOG.md) | 开发日志（限流地图、反爬教训、架构决策） |
| [PROXY_CHECK.md](./PROXY_CHECK.md) | 代理域名兼容性排查记录（油猴） |
| [PLAN.md](./PLAN.md) | 适配其他学校的实现计划 |

---

## License

[Apache-2.0](./LICENSE)

---

**如果觉得好用，给个 Star ⭐ 呗~**
