# 🎓 ECNU 文献快速获取

> 🚀 校外轻松访问学术数据库

[English](./README_EN.md)

---

## 😩 痛点

你是不是也经历过这样的场景：

1. Google Scholar 搜到一篇论文，点进去发现要付费 💸
2. 想起来学校买了数据库，于是打开图书馆主页找数据库入口……
3. 在一堆数据库列表里翻啊翻，找到对应的 WebVPN 链接，点进去
4. 跳到 SSO 登录页，输入学号密码
5. 终于看到全文了……下次又得重来一遍 😭

**人生苦短，何必每次都这么折腾？**

这个油猴脚本帮你搞定一切 ✨

## ✨ 功能一览

| 功能 | 描述 |
|------|------|
| 🔄 **自动跳转** | 访问学术网站时自动跳转到 ECNU 代理 URL |
| 🖱️ **手动模式** | 不喜欢自动跳转？可以切换为点击浮动按钮确认 |
| 🔐 **SSO 自动登录** | 自动填写学号密码，一步到位 |
| 🗃️ **智能映射** | 内置 100+ 数据库映射，还能自动更新 |
| 🌐 **双语界面** | 中文 / English 随心切换 |
| 🛡️ **凭据安全** | 密码混淆存储在 Tampermonkey 沙盒中，不会明文泄露 |

## 📦 安装教程

整个安装分两步：先装油猴扩展，再装咱们的脚本。别慌，五分钟搞定 ☕

### 第一步：安装 Tampermonkey（油猴）🐒

Tampermonkey 是一个浏览器扩展，可以运行用户脚本。选择你的浏览器：

| 浏览器 | 安装链接 |
|--------|----------|
| Chrome | [Chrome 应用商店](https://chrome.google.com/webstore/detail/tampermonkey/dhdgffkkebhmkfjojejmpbldmpobfkfo) |
| Edge | [Edge 应用商店](https://microsoftedge.microsoft.com/addons/detail/tampermonkey/iikmkjmpaadaobahmlepeloendndfphd) |
| Firefox | [Firefox 附加组件](https://addons.mozilla.org/en-US/firefox/addon/tampermonkey/) |
| Safari | [Tampermonkey 官网](https://www.tampermonkey.net/?browser=safari) |

> 💡 Chrome 用户如果打不开应用商店……你懂的，想办法科学上网，或者搜一下离线安装 crx 的方法

### ⚠️ Chrome / Edge 用户必看！

Tampermonkey 5.3+ 在 Chrome 和 Edge 上需要额外开启一个开关，否则用户脚本不会运行（你装了等于没装 😅）：

**方式一：Chrome / Edge 138+（推荐）**

1. 右键点击浏览器右上角的 Tampermonkey 图标 → 选择 **管理扩展**
2. 找到 **允许用户脚本**（Allow User Scripts）开关，打开即可

**方式二：旧版 Chrome / Edge**

1. 打开 `chrome://extensions`（Edge 则是 `edge://extensions`）
2. 打开右上角的 **开发者模式**（Developer Mode）
3. 确认启用 `userScripts` API

> 📖 详情参考 [Tampermonkey 官方说明](https://www.tampermonkey.net/faq.php#Q209)

Firefox 用户不用操心这个 🎉

### 第二步：安装脚本 📜

**方式一：从 GitHub 安装（推荐）**

1. 打开本项目的 [`ecnu-literature-quick-access.user.js`](./ecnu-literature-quick-access.user.js)
2. 点击右上角的 **Raw** 按钮
3. Tampermonkey 会自动弹出安装提示，点 **安装** 就完事了

**方式二：手动安装**

1. 复制 [`ecnu-literature-quick-access.user.js`](./ecnu-literature-quick-access.user.js) 的全部内容
2. 点击浏览器里 Tampermonkey 图标 → **添加新脚本**
3. 把自带的模板全删掉，粘贴进去，Ctrl+S 保存

搞定！🎉

## 🔧 配置教程

装完脚本之后，先花 30 秒配置一下 SSO 账号，后面就全自动了。

### 打开设置面板

1. 点击浏览器右上角的 **Tampermonkey 图标** 🐒
2. 找到 **ECNU 文献快速获取 - 设置**，点击

> 💡 你也可以在任何网页上操作，不用专门打开特定页面

### 填写 SSO 凭据 🔑

在设置面板中输入你的：
- **学号 / 工号** — 就是你登录 [公共数据库](https://portal1.ecnu.edu.cn/) 那个号
- **密码** — 对，就是那个密码

点 **保存**，搞定。

> 🛡️ 密码经过混淆加密后存储在 Tampermonkey 的沙盒存储中，其他网站和扩展无法访问。不过还是建议不要在公共电脑上使用哦 🙃

### 其他设置

| 选项 | 说明 | 默认值 |
|------|------|--------|
| 🌐 语言 | 中文 / English | 中文 |
| 🔄 跳转模式 | 自动跳转 / 手动确认 | 自动跳转 |
| 🔐 SSO 自动登录 | 启用 / 禁用 | 启用 |
| 🗃️ 域名映射 | 查看 / 添加 / 删除 / 重置 | 内置 100+ |

## 🚀 使用教程

配置好之后，**不需要做任何事，正常浏览就行**。

### 日常使用 🏄‍♂️

1. 正常搜论文、点链接
2. 当你访问到支持的学术网站时，脚本自动帮你跳转到代理地址
3. 第一次会弹出 SSO 登录页 → 脚本自动帮你填好账号密码并登录
4. 然后你就看到全文了 🎉

就这么简单。**你甚至感觉不到脚本在工作** ——这才是最好的体验 😎

### 支持哪些数据库？

内置 100+ 数据库映射，覆盖主流学术资源：

| 类别 | 数据库 |
|------|--------|
| 📚 中文 | CNKI 中国知网、万方数据、维普、CSMAR、CSSCI… |
| 🌍 综合 | Web of Science、Scopus、JCR、ProQuest、EBSCO… |
| 🔬 理工 | ScienceDirect、IEEE Xplore、SpringerLink、ACM、Nature… |
| 📗 社科 | JSTOR、Taylor & Francis、Wiley、Cambridge、Oxford… |
| 🧪 化学 | ACS、Reaxys、SciFinder… |
| 📐 更多 | AIP、RSC、SIAM、AGU、EI Compendex… |

> 找不到你要的数据库？往下看更新教程 👇

### 手动确认模式

如果你不喜欢自动跳转（比如有时候就是想看原始页面），可以在设置中切换到 **手动确认** 模式。这样访问学术网站时，右下角会出现一个蓝色浮动按钮，点一下才跳转。

## 🔄 更新教程

### 更新数据库映射

脚本内置了 100+ 个数据库映射，但图书馆可能会新增数据库。你可以这样更新：

1. 打开 [华东师范大学图书馆数据库列表](https://lib.ecnu.edu.cn/sjk/list.htm)
2. 页面右下角会出现绿色的 **"开始更新映射"** 按钮
3. 点击它，脚本会自动扫描所有数据库详情页（大概要等几十秒）
4. 完成后会显示映射总数，关掉就好 🎉

你也可以在设置面板中手动添加单个域名映射。

### 更新脚本版本 📦

获取最新版脚本：

- **GitHub**：访问本项目仓库，重新点 Raw 安装即可覆盖旧版本
- **手动更新**：复制最新的 `.user.js` 内容，粘贴到 Tampermonkey 编辑器中覆盖保存

> 💡 建议偶尔回来看看有没有新版本，可能修了 bug 或者加了新功能~

## 🤔 常见问题

**Q: 安装了但是脚本没生效？**

A: Chrome / Edge 用户请检查是否开启了 **允许用户脚本**（Allow User Scripts），详见上方 [Chrome / Edge 用户必看](#️-chrome--edge-用户必看)。这是最常见的坑！

**Q: 安全吗？密码会不会泄露？**

A: 密码经过 XOR + Base64 混淆后存储在 Tampermonkey 的沙盒存储中，其他网站和扩展无法访问。当然，建议你不要在公共电脑上使用 🙃

**Q: 为什么脚本要申请「匹配所有网站」的权限？**

A: 因为脚本需要在你访问**任意学术网站**时判断是否需要跳转。实际上，当域名不在映射表里时，脚本只执行几行判断就立刻退出了，完全不会影响页面加载和性能，甚至比页面上随便一个广告脚本都轻量得多 🪶。如果改成只匹配固定域名，你通过爬取图书馆新增的数据库映射就没法自动生效了。

**Q: 为什么某个网站没有自动跳转？**

A: 可能这个数据库不在映射表里。去图书馆列表页点击更新，或者在设置中手动添加。

**Q: 可以关闭自动跳转吗？**

A: 当然可以！在设置中切换到 **手动确认** 模式，点按钮才跳转。

**Q: 毕业了还能用吗？**

A: 那得看学校什么时候注销你的账号了…… 珍惜在校时光，多下几篇论文吧 📝

## 🏗️ 技术细节

给好奇的同学：

- **URL 转换**：域名中的 `.` → `-`，原有的 `-` → `--`，HTTPS 数据库加 `-443` 后缀
- **零开销**：`@run-at document-start`，不匹配直接 return，不多执行一行代码
- **SSO 兼容**：使用原生 `HTMLInputElement.prototype.value` setter 设值，兼容 Angular/React/Vue 表单
- **映射更新**：利用同域 iframe 加载图书馆详情页提取代理链接，无跨域问题

## 📄 License

[Apache-2.0](./LICENSE)

---

**如果觉得好用，给个 Star ⭐ 呗~**
