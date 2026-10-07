# 🎓 ECNU 文献快速获取

> 🚀 校外轻松访问学术数据库，AI 助手自动下载论文全文

[English](./README_EN.md)

本项目包含两个可独立使用的部分：

| 组件 | 面向 | 一句话 |
|------|------|--------|
| 🐒 **油猴脚本** | 浏览器用户 | 访问学术网站自动跳转 ECNU 代理 + SSO 自动登录 |
| 📄 **get-paper skill** | AI 助手用户（ZCode/Claude Code 等） | 说一句话，AI 自动下载论文 PDF（公开源 + 付费数据库） |

---

## 一、油猴脚本（浏览器自动跳转）

### 安装

1. 安装 [Tampermonkey](https://www.tampermonkey.net/?browser=chrome)（Chrome/Edge 138+ 需在扩展详情页打开"允许用户脚本"）
2. 安装本脚本：打开 [`ecnu-literature-quick-access.user.js`](./ecnu-literature-quick-access.user.js) → Raw → Tampermonkey 弹窗安装
3. 点击 Tampermonkey 图标 → **ECNU 文献快速获取 - 设置**，填入学号密码（混淆存储在沙盒中）

之后正常浏览即可：访问 IEEE/ACM/ScienceDirect 等学术网站时自动跳转代理地址，首次自动登录 SSO。内置 100+ 数据库映射，找不到的可在图书馆数据库列表页一键更新。

详细说明与常见问题见下方[油猴脚本详细文档](#油猴脚本详细文档)。

---

## 二、get-paper skill（AI 自动下载论文）

给 AI 助手一句「下载这篇论文」，它自动完成：**解析 DOI（五源交叉验证）→ 公开副本优先（arXiv/ACL/仓库 OA）→ 付费库走 ECNU WebVPN 代理 → PDF 完整性验证**。

### 已验证路线（全部实测）

| 来源 | 路线 | 状态 |
|------|------|------|
| arXiv / OA 仓库 / ACL Anthology / AAAI / MDPI | 公开直下 | ✅ |
| ACM Digital Library（含 VLDB/PACMMOD） | curl + WebVPN 会话 | ✅ |
| IEEE Xplore（论文页 → stamp 预热 → getPDF 三步） | curl + WebVPN 会话 | ✅ |
| Wiley（OA 文章，`pdfdirect` 端点） | 浏览器页面内提取 | ✅ |
| ScienceDirect | ⚠️ 有 Cloudflare 挑战，见 [databases.md](./get-paper/references/databases.md) |

批量实战记录：学者主页 10 篇下载 **10/10 成功**（公开 6 + ACM 2 + IEEE 2），全程零人工干预。

### 安装（一次性，约 1 分钟）

```bash
git clone https://github.com/morningD/ECNU-literature-quick-access.git
cd ECNU-literature-quick-access
bash get-paper/setup.sh
```

`setup.sh` 会引导完成三步（全程 GUI 对话框，终端亦可）：

1. **安装 skill**（symlink 到 `~/.agents/skills/`，ZCode/Claude Code 等 AI 助手自动发现）
2. **配置 ECNU SSO 凭据**——三选一：复用钥匙串已有条目 / 新建专属条目 / 600 权限明文文件。macOS 存钥匙串、Linux 存 secret-tool，**磁盘不落明文**（选明文文件除外）
3. **API key（可选，回车跳过）**——OpenAlex key 池与 Semantic Scholar key，显著提高批量场景的限流上限

其他命令：`bash get-paper/setup.sh --check`（查看配置状态）、`--reset`（重配）、`--remove-credentials`（清除凭据）。Windows 见 [`get-paper/setup.ps1`](./get-paper/setup.ps1)（实验性）。

### 使用示例

**对话式**（对已安装 skill 的 AI 助手说）：

```
用 get-paper 下载这篇论文：10.1145/3589334.3645520
把 https://scholar.google.com/citations?user=xxxx 这位学者近 5 年的论文都下载下来
下载 "HugNLP: A unified and comprehensive library for natural language processing"
```

AI 会按 [SKILL.md](./get-paper/SKILL.md) 的流程执行并报告每篇的路线与结果。

**命令式**（脚本单独使用）：

```bash
# 标题 → DOI（五源交叉验证，宁缺毋滥；解析不到时列出各源候选）
node get-paper/scripts/resolve.mjs title "ModelGo: A Practical Tool for Machine Learning License Analysis"
# → {"doi":"10.1145/3589334.3645520","confidence":"high",...}

# DOI → 元数据 + OA 副本直链
node get-paper/scripts/resolve.mjs doi "10.18653/v1/2025.findings-acl.259"

# 学者 → 论文列表
node get-paper/scripts/resolve.mjs author "Bingsheng He" --since 2015

# 原始 URL → ECNU 代理 URL（90+ 数据库映射表优先，公式兜底）
node get-paper/scripts/proxy-url.js "https://ieeexplore.ieee.org/document/9644782"

# 下载 + 完整性验证（curl，自动带 WebVPN 会话）
bash get-paper/scripts/fetch-paper.sh "https://arxiv.org/pdf/2508.04586" paper.pdf

# WebVPN 会话过期后一键续命（无头浏览器自动登录，无需手动复制 cookie）
node get-paper/scripts/renew-session.mjs
```

**批量摊派**（进阶）：skill 手册自足性经过 subagent 测试——可以直接把下载任务摊派给多个 AI subagent 并行执行，详见 [DEVLOG.md](./get-paper/DEVLOG.md) 的测试记录。

### 隐私与安全

- SSO 凭据只存本机（macOS 钥匙串 / Linux secret-tool / 600 权限文件），**不经过任何第三方服务器**（登录请求直达学校 SSO）
- WebVPN 会话 cookie 存 `~/.config/get-paper/`（600 权限）
- API key 同样本地存储；本仓库不含任何个人凭据
- PDF 直接从出版商/代理下载，代理路径只有 `*.proxy.ecnu.edu.cn`（学校官方 WebVPN）

### 测试与维护

```bash
bash get-paper/scripts/test-suite.sh        # 下载路线回归（arXiv/ACM/IEEE）
node get-paper/scripts/test-resolve.mjs     # 解析器红绿灯（green/red/yellow 语义）
node get-paper/scripts/update-mapping.mjs   # 油猴脚本映射表更新后同步
```

测试集位于 `get-paper/data/`（`test-dois.json` / `test-resolve.json`），预期值全部来自权威 API 实测。欢迎通过 PR 补充新出版商的验证 case。

### 文档索引

- [get-paper/SKILL.md](./get-paper/SKILL.md) — 完整使用手册（AI 助手的执行依据）
- [get-paper/references/databases.md](./get-paper/references/databases.md) — 各数据库实测下载模式与踩坑
- [get-paper/DEVLOG.md](./get-paper/DEVLOG.md) — 开发日志（限流地图、反爬教训、架构决策）

---

## 油猴脚本详细文档

### 功能一览

| 功能 | 描述 |
|------|------|
| 🔄 **自动跳转** | 访问学术网站时自动跳转到 ECNU 代理 URL |
| 🖱️ **手动模式** | 不喜欢自动跳转？可以切换为点击浮动按钮确认 |
| 🔐 **SSO 自动登录** | 自动填写学号密码，一步到位 |
| 🗃️ **智能映射** | 内置 100+ 数据库映射，还能自动更新 |
| 🌐 **双语界面** | 中文 / English 随心切换 |
| 🛡️ **凭据安全** | 密码混淆存储在 Tampermonkey 沙盒中，不会明文泄露 |

### 安装教程

**第一步：安装 Tampermonkey** 🐒

| 浏览器 | 安装链接 |
|--------|----------|
| Chrome | [Chrome 应用商店](https://chrome.google.com/webstore/detail/tampermonkey/dhdgffkkebhmkfjojejmpbldmpobfkfo) |
| Edge | [Edge 应用商店](https://microsoftedge.microsoft.com/addons/detail/tampermonkey/iikmkjmpaadaobahmlepeloendndfphd) |

> ⚠️ Chrome/Edge 138+ 必须在扩展管理页打开 **允许用户脚本（Allow User Scripts）**，否则脚本不运行。

**第二步：安装脚本** 📜

打开 [`ecnu-literature-quick-access.user.js`](./ecnu-literature-quick-access.user.js) → 点 **Raw** → Tampermonkey 弹窗安装。需要动态识别新子域的用户可选[自动版](./ecnu-literature-quick-access-auto.user.js)（两者不要同时装）。

**第三步：配置 SSO 凭据** 🔑

打开[华东师范大学图书馆数据库列表](https://lib.ecnu.edu.cn/sjk/list.htm) → Tampermonkey 图标 → **ECNU 文献快速获取 - 设置** → 填入学号密码。

### 支持哪些数据库

内置 100+ 映射，覆盖：CNKI/万方/维普（中文）、Web of Science/Scopus/JCR（综合）、IEEE/ACM/ScienceDirect/SpringerLink/Nature（理工）、JSTOR/Taylor & Francis/Wiley/Cambridge/Oxford（社科）、ACS/RSC/SciFinder（化学）等。图书馆新增数据库可在列表页点"开始更新映射"自动同步。

### 常见问题

**Q: 安装了但没生效？**
A: 检查 Chrome/Edge 的"允许用户脚本"开关（最常见）。

**Q: 某个学术网站没有自动跳转？**
A: 更新映射表 → 换自动版 → 或在设置中手动添加该域名。

**Q: Wiley 打不开？**
A: 已知 Wiley 认证系统拒绝代理域名（详见 [PROXY_CHECK.md](./PROXY_CHECK.md)），需要学校图书馆更新配置。

### 适配其他学校

大部分高校 WebVPN 类似，参考 [PLAN.md](./PLAN.md) 让 AI 帮你生成适配版（主要改代理域名后缀、SSO 地址和表单选择器）。

---

## 📄 License

[Apache-2.0](./LICENSE)

---

**如果觉得好用，给个 Star ⭐ 呗~**
