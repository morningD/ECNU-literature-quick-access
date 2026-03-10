# 🎓 ECNU Literature Quick Access

> 🚀 Access academic databases off-campus with ease

[中文](./README.md)

---

## 😩 The Problem

If you're an ECNU student, you know the drill:

1. Find a paper on Google Scholar, click through — paywall 💸
2. Remember the university has database subscriptions, open the library homepage…
3. Dig through the database list to find the WebVPN link, click it
4. Get redirected to SSO login, type in credentials
5. Finally see the full text... and do it all over again next time 😭

**Life's too short for this.**

This Tampermonkey userscript does it all for you ✨

## ✨ Features

| Feature | Description |
|---------|-------------|
| 🔄 **Auto Redirect** | Automatically redirects academic websites to ECNU proxy URLs |
| 🖱️ **Manual Mode** | Prefer control? Switch to a floating button for manual confirmation |
| 🔐 **SSO Auto Login** | Automatically fills in your credentials on the SSO page |
| 🗃️ **Smart Mapping** | 100+ built-in database mappings, with auto-update capability |
| 🌐 **Bilingual UI** | Chinese / English interface |
| 🛡️ **Secure Storage** | Credentials are obfuscated and stored in Tampermonkey's sandboxed storage |

## 📦 Installation

Two steps: install the Tampermonkey extension, then install our script. Easy peasy ☕

### Step 1: Install Tampermonkey 🐒

Tampermonkey is a browser extension that runs userscripts. Pick your browser:

| Browser | Install Link |
|---------|-------------|
| Chrome | [Chrome Web Store](https://chrome.google.com/webstore/detail/tampermonkey/dhdgffkkebhmkfjojejmpbldmpobfkfo) |
| Edge | [Edge Add-ons](https://microsoftedge.microsoft.com/addons/detail/tampermonkey/iikmkjmpaadaobahmlepeloendndfphd) |
| Firefox | [Firefox Add-ons](https://addons.mozilla.org/en-US/firefox/addon/tampermonkey/) |
| Safari | [Tampermonkey Website](https://www.tampermonkey.net/?browser=safari) |

### ⚠️ Chrome / Edge Users: Read This!

Starting from Tampermonkey 5.3+, Chrome and Edge require an extra toggle — without it, userscripts simply won't run (you installed it for nothing 😅):

**Option 1: Chrome / Edge 138+ (Recommended)**

1. Right-click the Tampermonkey icon → select **Manage Extension**
2. Find and enable the **Allow User Scripts** toggle

**Option 2: Older Chrome / Edge**

1. Go to `chrome://extensions` (or `edge://extensions`)
2. Enable **Developer Mode** in the top-right corner
3. Confirm to enable the `userScripts` API

> 📖 See [Tampermonkey FAQ #Q209](https://www.tampermonkey.net/faq.php#Q209) for details

Firefox users can skip this 🎉

### Step 2: Install the Script 📜

**Option A: Install from GitHub (Recommended)**

1. Open [`ecnu-literature-quick-access.user.js`](./ecnu-literature-quick-access.user.js) in this repo
2. Click the **Raw** button in the top-right corner
3. Tampermonkey will prompt you to install — click **Install**

**Option B: Manual Install**

1. Copy the entire content of [`ecnu-literature-quick-access.user.js`](./ecnu-literature-quick-access.user.js)
2. Click the Tampermonkey icon → **Create a new script**
3. Delete the template, paste the code, and hit Ctrl+S to save

Done! 🎉

## 🔧 Configuration

After installing, spend 30 seconds setting up your SSO credentials — everything else is automatic.

### Open the Settings Panel

1. Click the **Tampermonkey icon** 🐒 in your browser toolbar
2. Find **ECNU Literature Quick Access - Settings** and click it

> 💡 You can do this on any webpage

### Enter SSO Credentials 🔑

In the settings panel, enter:
- **Student/Staff ID** — the one you use to log into [ECNU Portal](https://portal1.ecnu.edu.cn/)
- **Password** — yep, that one

Click **Save** and you're good to go.

> 🛡️ Credentials are XOR + Base64 obfuscated and stored in Tampermonkey's sandboxed storage, inaccessible to other websites or extensions. Still, avoid using this on public computers 🙃

### Other Settings

| Option | Description | Default |
|--------|-------------|---------|
| 🌐 Language | Chinese / English | Chinese |
| 🎯 Match Mode | Static / Dynamic | Static |
| 🔄 Redirect Mode | Auto / Manual | Auto |
| 🔐 SSO Auto Login | Enable / Disable | Enabled |
| 🗃️ Domain Mapping | View / Add / Delete / Reset | 100+ built-in |

## 🚀 Usage

Once configured, **just browse normally**. That's it.

### Daily Use 🏄‍♂️

1. Search for papers, click links as usual
2. When you land on a supported academic website, the script auto-redirects to the proxy
3. First time: SSO login page pops up → script auto-fills credentials and logs you in
4. You see the full text 🎉

**You won't even notice the script is working** — and that's the point 😎

### Supported Databases

100+ built-in database mappings covering major academic resources:

| Category | Databases |
|----------|-----------|
| 📚 Chinese | CNKI, Wanfang, VIP, CSMAR, CSSCI… |
| 🌍 General | Web of Science, Scopus, JCR, ProQuest, EBSCO… |
| 🔬 STEM | ScienceDirect, IEEE Xplore, SpringerLink, ACM, Nature… |
| 📗 Social Sciences | JSTOR, Taylor & Francis, Wiley, Cambridge, Oxford… |
| 🧪 Chemistry | ACS, Reaxys, SciFinder… |
| 📐 More | AIP, RSC, SIAM, AGU, EI Compendex… |

> Missing a database? See the update guide below 👇

### Match Mode: Static vs Dynamic 🎯

The script supports two matching modes, configurable in settings:

- **Static** (default): Only redirects domains that are exactly in the mapping table. Since university databases don't change often, this is sufficient for most users.
- **Dynamic**: In addition to exact matches, automatically detects subdomains under the same main domain. For example, if `kns.cnki.net` is in the mapping, visiting `new.cnki.net` will also be redirected. Dynamically matched domains are **automatically saved to the mapping table**, so they persist even after switching back to Static mode.

> 💡 **Recommended workflow**: Use Static mode daily. If a site isn't recognized, temporarily switch to Dynamic, visit that site (the new domain gets saved automatically), then switch back to Static.

### Manual Mode

If you prefer not to auto-redirect (sometimes you just want the original page), switch to **Manual Confirm** mode in settings. A blue floating button will appear when you visit a supported site — click it to redirect.

## 🔄 Updating

### Update Database Mappings

The script comes with 100+ mappings, but the library may add new databases. To update:

1. Visit the [ECNU Library Database List](https://lib.ecnu.edu.cn/sjk/list.htm)
2. A green **"Start Updating Mapping"** button appears in the bottom-right corner
3. Click it — the script will scan all database detail pages (takes ~30 seconds)
4. Done! The mapping count is shown when finished 🎉

You can also manually add individual domain mappings in the settings panel.

### Update Script Version 📦

To get the latest version:

- **GitHub**: Visit this repo and click Raw to reinstall — it overwrites the old version
- **Manual**: Copy the latest `.user.js` content and paste it into Tampermonkey's editor

> 💡 Check back occasionally for updates — bug fixes and new features drop from time to time~

## 🤔 FAQ

**Q: Installed but the script doesn't work?**

A: Chrome / Edge users — make sure you've enabled **Allow User Scripts**. See [Chrome / Edge Users: Read This!](#️-chrome--edge-users-read-this) above. This is the #1 gotcha!

**Q: Is it safe? Will my password leak?**

A: Credentials are XOR + Base64 obfuscated and stored in Tampermonkey's sandboxed storage, inaccessible to other websites or extensions. That said, avoid using this on public computers 🙃

**Q: Why does the script request "match all websites" permission?**

A: The script needs to check whether any academic website you visit should be redirected. When the domain isn't in the mapping table, the script runs just a few lines of code and exits immediately — zero performance impact, lighter than any ad tracker on the page 🪶

**Q: Why isn't a website being redirected?**

A: Try these steps in order:

1. **Update the mapping table** — visit the [ECNU Library Database List](https://lib.ecnu.edu.cn/sjk/list.htm) and click "Start Updating Mapping" — the database might have been recently added
2. **Temporarily switch to Dynamic mode** — open settings, change Match Mode to "Dynamic", then revisit that website. Dynamic mode auto-detects subdomains and saves matched domains to the mapping table automatically. You can then switch back to Static — the new domain is already remembered ✅
3. **Add it manually** — if neither works, manually add the domain and its proxy domain in settings

**Q: Can I disable auto-redirect?**

A: Yes! Switch to **Manual Confirm** mode in settings.

**Q: Can I still use this after graduation?**

A: That depends on when the university deactivates your account... Download more papers while you can 📝

## 🏗️ Technical Details

For the curious:

- **URL conversion**: `.` → `-` in domain, existing `-` → `--`, HTTPS databases get `-443` suffix
- **Zero overhead**: `@run-at document-start`, non-matching domains return immediately
- **SSO compatibility**: Uses native `HTMLInputElement.prototype.value` setter for Angular/React/Vue form support
- **Mapping updates**: Same-origin iframe crawling of library detail pages, no CORS issues

## 🎓 Adapt for Your University

Want to make one for your own university? Most Chinese universities use similar WebVPN systems, so adaptation is straightforward.

We provide a complete [implementation plan (PLAN.md)](./PLAN.md) that you can feed to [Claude Code](https://claude.com/claude-code) or other AI tools to generate a script for your university. You mainly need to change the proxy domain suffix, SSO address, and form selectors — see the plan for details.

## 📄 License

[Apache-2.0](./LICENSE)

---

**If you find this useful, give it a Star ⭐!**
