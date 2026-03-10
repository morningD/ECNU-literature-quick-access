# 高校文献快速获取 - 实现计划

> 这是一个用 Claude Code vibe coding 完成的项目的实现计划。
> 你可以把这个计划喂给 AI（如 Claude Code），让它帮你实现一个类似的脚本，适配你自己学校的 WebVPN。
>
> 成品参考：https://github.com/morningD/ECNU-literature-quick-access

---

## Context

大学生在校外访问学术文献时，需要通过学校的 WebVPN 代理才能免费使用数据库。但每次都要去图书馆主页找入口、登录 SSO，非常繁琐。本项目开发 Tampermonkey 用户脚本，实现：
1. 访问学术网站时自动/手动跳转到学校代理 URL
2. SSO 登录页面自动填写凭据登录
3. 凭据用 GM_setValue + 混淆存储，不硬编码

### 适配其他学校

这个计划是为华东师范大学（ECNU）写的，但**大部分国内高校的 WebVPN 系统都类似**（很多学校用的是同一套 WebVPN 方案）。如果你想给自己学校做一个类似的脚本，主要需要改这些地方：

| 需要修改的部分 | ECNU 的值 | 你需要改成 |
|--------------|----------|-----------|
| 代理域名后缀 | `.proxy.ecnu.edu.cn` | 你学校的代理后缀，如 `.webvpn.cqu.edu.cn`（重庆大学） |
| SSO 登录页 | `sso.ecnu.edu.cn` | 你学校的 SSO 地址 |
| SSO 表单选择器 | `#nameInput`, `input[type="password"]`, `#submitBtn` | 用浏览器 F12 检查你学校 SSO 页面的表单元素 |
| 图书馆列表页 | `lib.ecnu.edu.cn/sjk/list.htm` | 你学校图书馆的数据库列表页 |
| URL 转换规则 | `.` → `-`，HTTPS 加 `-443` | **先验证你学校的规则！** 不同学校可能不同 |
| 默认映射表 | ECNU 的 100+ 映射 | 通过爬取你学校图书馆页面获取 |

**最关键的一步**：先手动验证你学校的 URL 转换规则。去图书馆数据库列表页，点几个 WebVPN 链接，对比原始域名和代理域名，总结出规则。

### 关键发现（ECNU）

**URL 转换规则**（经爬取验证）：
- 域名中原有的 `-` 替换为 `--`
- 域名中的 `.` 替换为 `-`
- 图书馆登记为 HTTP 的 → `域名-hyphens.proxy.ecnu.edu.cn`（无端口后缀）
- 图书馆登记为 HTTPS 的 → `域名-hyphens-443.proxy.ecnu.edu.cn`（有 `-443`）
- 路径、query、hash 保持不变

**已验证的映射示例**：

| 原始域名 | 代理域名 | 规则 |
|---------|---------|------|
| `ieeexplore.ieee.org` | `ieeexplore-ieee-org.proxy.ecnu.edu.cn` | HTTP |
| `www.sciencedirect.com` | `www-sciencedirect-com.proxy.ecnu.edu.cn` | HTTP |
| `link.springer.com` | `link-springer-com.proxy.ecnu.edu.cn` | HTTP |
| `www.webofscience.com` | `www-webofscience-com-443.proxy.ecnu.edu.cn` | HTTPS |
| `www.proquest.com` | `www-proquest-com-443.proxy.ecnu.edu.cn` | HTTPS |

**图书馆页面特点**：
- 列表页动态加载，默认只显示部分，需点击"查看更多"加载全部
- 每个条目有"校外访问与使用说明"链接指向详情页
- 详情页也是动态渲染的，fetch/XHR 无法获取内容
- iframe 加载详情页可以（同域无跨域问题），能获取完整渲染内容

## 项目结构

```
├── CLAUDE.md                                  # 项目约定，给 AI 看的
├── LICENSE                                    # Apache-2.0
├── README.md                                  # 中文 README
├── README_EN.md                               # 英文 README
├── PLAN.md                                    # 实现计划（本文件）
├── xxx-literature-quick-access.user.js        # 精简版：仅匹配已知域名
└── xxx-literature-quick-access-auto.user.js   # 自动版：匹配所有网站，支持动态识别
```

建议提供两个版本的脚本：
- **精简版**（推荐给大多数用户）：`@match` 只列出已知数据库域名，权限最小
- **自动版**：`@match *://*/*`，支持动态匹配子域名并自动记忆

## 实现方案

### 1. 创建项目骨架
- 新建文件夹、`CLAUDE.md`、`LICENSE`（Apache-2.0）、`git init`

### 2. 脚本 Header

```javascript
// ==UserScript==
// @name         XXX 文献快速获取
// @namespace    https://github.com/xxx
// @version      1.0.0
// @description  自动将学术网站 URL 跳转到 XXX 大学 WebVPN 代理，支持 SSO 自动登录
// @match        *://*/*
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_registerMenuCommand
// @grant        GM_addStyle
// @grant        GM_notification
// @run-at       document-start
// ==/UserScript==
```

- `@match *://*/*` + `document-start`：立即检查域名，不匹配则直接 return，零性能开销
- 排除代理域名避免循环跳转

### 3. 域名映射管理

**内置默认 + 可更新**：
1. 硬编码默认映射表（通过爬取图书馆页面获取）
2. 用户首次使用即可工作
3. 映射存入 `GM_setValue('domainMapping')`，优先使用用户存储的版本
4. 在图书馆列表页注入"更新映射"按钮，通过 iframe 爬取详情页更新

**域名匹配逻辑（静态/动态双模式）**：
- **静态匹配**（默认）：仅精确匹配 `location.hostname`，不在映射表中的域名直接跳过
- **动态匹配**：精确匹配 + 主域名模糊匹配（如映射表有 `kns.cnki.net`，访问 `new.cnki.net` 也能通过 `cnki.net` 匹配到）
- 动态匹配成功时，自动将新域名写入映射表，切回静态后依然生效
- 用 `GM_getValue('matchMode', 'static')` 存储当前模式

### 4. URL 跳转

```javascript
const host = location.hostname;
const proxyHost = matchHost(host); // 根据匹配模式决定精确/模糊匹配
if (proxyHost && !host.endsWith('.proxy.xxx.edu.cn')) {
  if (autoRedirect) {
    window.location.replace(`https://${proxyHost}${location.pathname}${location.search}${location.hash}`);
  } else {
    showRedirectButton(proxyHost);  // 浮动按钮模式
  }
}
```

**两种跳转模式**（默认自动跳转，可在设置中切换）：
- 自动跳转：`document-start` 时立即 `location.replace`
- 手动确认：在页面右下角显示浮动按钮，点击后跳转

### 5. SSO 自动登录

- 检测学校 SSO 登录页面
- 用 MutationObserver 等待表单元素加载
- 从 `GM_getValue` 读取混淆后的凭据，解码后填入
- 自动点击提交按钮
- 如果无存储凭据，弹出提示引导用户到设置面板

**⚠️ 注意事项**：
- 用浏览器 F12 检查你学校 SSO 的表单选择器（每个学校都不一样！）
- 有些学校 SSO 用 Angular/React/Vue，直接设 `.value` 不会触发框架的数据绑定，需要用原生 setter：
  ```javascript
  var setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
  setter.call(input, value);
  input.dispatchEvent(new Event('input', { bubbles: true }));
  ```
- 提交按钮可能默认是 disabled 状态，需要先移除 disabled 属性
- 用 guard flag 防止 MutationObserver 和 setTimeout 同时触发导致重复提交

### 6. 凭据存储

- `GM_setValue('credentials', encode({username, password}))`
- 编码方式：Base64 + 简单 XOR 混淆（防止明文展示）
- Tampermonkey 存储本身有浏览器扩展级别隔离

### 7. 设置面板

通过 `GM_registerMenuCommand('设置')` 打开模态对话框：
- **语言切换**：中文 / English
- **凭据配置**：账号/密码输入框 + 保存按钮
- **匹配模式**：静态匹配 / 动态匹配 切换
- **跳转模式**：自动跳转 / 手动确认 切换
- **SSO 自动登录**：启用 / 禁用
- **映射管理**：查看当前映射、手动添加/删除域名映射、重置为默认

**⚠️ 注意**：`GM_registerMenuCommand` 必须在 `document-start` 阶段、早期 return 之前调用，否则在某些页面（如 SSO 页面）上菜单不会出现。

### 8. 辅助爬取（在图书馆列表页触发）

当用户在图书馆列表页时：
1. 注入"更新数据库映射"浮动按钮
2. 用户点击后，先点击"查看更多"按钮加载全部数据库
3. 提取页面上所有数据库条目的详情页链接
4. 逐个创建隐藏 iframe 加载详情页（同域无跨域）
5. 从 iframe DOM 提取代理链接和原始访问地址
6. 构建/更新映射表，保存到 GM_setValue
7. 显示进度和完成通知

**⚠️ 注意**：如果列表页是 HTTPS，iframe 加载 HTTP 的详情页会被浏览器拦截（Mixed Content），需要将详情页 URL 转为 HTTPS。

## 实施步骤

1. **创建项目骨架** — 文件夹、LICENSE、CLAUDE.md、git init
2. **验证你学校的 URL 转换规则** — 手动对比几个数据库的原始 URL 和代理 URL，总结规则
3. **爬取默认映射表** — 用 Playwright 或手动从图书馆页面收集所有数据库的映射关系
4. **编写脚本主体** — UserScript header、默认映射表、域名匹配（静态/动态双模式）、URL 跳转（自动/手动两种模式）
5. **实现设置面板** — 凭据管理、匹配模式切换、跳转模式切换、映射查看/编辑、i18n
6. **实现 SSO 自动登录** — 检测登录页、填写凭据、自动提交
7. **实现辅助爬取** — 在图书馆列表页 iframe 爬取更新映射
8. **创建 README** — 安装说明（含 Chrome "Allow User Scripts" 提示）、配置教程、使用方法

## 验证方式

1. 在 Tampermonkey 中安装脚本
2. 通过设置面板配置 SSO 账号密码
3. 访问某个学术网站（如 `https://ieeexplore.ieee.org`），验证自动跳转到代理地址
4. 验证手动确认模式（切换设置后访问学术网站，应显示浮动跳转按钮）
5. 验证匹配模式切换（静态模式下未映射的子域名不跳转，动态模式下可跳转且自动记忆）
6. 访问图书馆列表页，触发映射更新功能
7. 验证 SSO 自动登录（访问代理 URL 后若重定向到 SSO 页面，应自动填写凭据）

## 踩过的坑

给后来人提个醒：

1. **Chrome/Edge 用户装了 Tampermonkey 但脚本不生效** — Tampermonkey 5.3+ 需要开启 "Allow User Scripts"，参考 https://www.tampermonkey.net/faq.php#Q209
2. **SSO 表单填写后框架不识别** — 必须用原生 `HTMLInputElement.prototype.value` 的 setter，然后 dispatch `input` 事件
3. **提交按钮 disabled** — 有些 SSO 页面的提交按钮默认禁用，需要手动移除 disabled 状态
4. **MutationObserver + setTimeout 竞争** — 可能导致重复提交，用 guard flag 防止
5. **图书馆列表页只显示部分数据库** — 需要先点击"查看更多"加载全部
6. **Mixed Content 拦截** — HTTPS 页面中用 iframe 加载 HTTP 详情页会被浏览器拦截，需转为 HTTPS
7. **`GM_registerMenuCommand` 位置** — 必须在早期 return 之前调用，否则某些页面上设置菜单不显示
