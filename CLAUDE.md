# ECNU 文献快速获取

## Project Overview
Tampermonkey userscript that auto-redirects academic website URLs to ECNU WebVPN proxy URLs and supports SSO auto-login. Targeted at ECNU students for off-campus academic database access.

- **Repo**: https://github.com/morningD/ECNU-literature-quick-access
- **License**: Apache-2.0

## Structure
```
├── CLAUDE.md
├── LICENSE
├── README.md          # 中文，简单幽默风格，加 emoji
├── README_EN.md       # English version
├── .gitignore
└── ecnu-literature-quick-access.user.js  # 单文件 Tampermonkey 脚本
```

- No build system — plain JavaScript, single IIFE
- No dependencies

## URL Conversion Rules
- Original `-` in domain → `--`
- `.` in domain → `-`
- HTTP databases: `domain-hyphens.proxy.ecnu.edu.cn`
- HTTPS databases: `domain-hyphens-443.proxy.ecnu.edu.cn`
- Path, query, hash preserved as-is

## Key Architecture
- `@match *://*/*` + `@run-at document-start`: checks domain immediately, returns if no match (zero overhead)
- `GM_registerMenuCommand` must be placed before early returns, otherwise menu won't show on some pages (e.g. SSO)
- Domain mapping: hardcoded DEFAULT_MAPPING (~100 entries) + user-updatable via GM_setValue
- Mapping update: iframe crawling on `lib.ecnu.edu.cn/sjk/list.htm` (same-origin, no CORS issues)
  - Must click "查看更多" buttons first to load all 288 databases
  - Detail page URLs must be converted from http to https to avoid Mixed Content blocking

## SSO Auto-Login
- Page: `sso.ecnu.edu.cn`
- Selectors: `#nameInput` (username), `input[type="password"]` (password), `#submitBtn` (submit)
- Submit button starts disabled — must remove `disabled` attribute and `disabled` class before clicking
- Uses native `HTMLInputElement.prototype.value` setter for Angular/React/Vue compatibility
- Guard flag (`submitted`) prevents double-submit from MutationObserver + setTimeout race

## Conventions
- All UI text must support zh/en via i18n object
- Credentials stored with GM_setValue + Base64/XOR obfuscation
- Default language: Chinese, user can switch to English
- README style: 简单幽默，加 emoji，面向学生
- Chrome/Edge users need "Allow User Scripts" enabled (Tampermonkey 5.3+)
