# ECNU 文献快速获取

## Project Overview
Tampermonkey userscript that auto-redirects academic website URLs to ECNU WebVPN proxy URLs and supports SSO auto-login.

## Structure
- Single-file userscript: `ecnu-literature-quick-access.user.js`
- No build system — plain JavaScript

## URL Conversion Rules
- Replace `.` in domain with `-`
- HTTP databases: `domain-hyphens.proxy.ecnu.edu.cn`
- HTTPS databases: `domain-hyphens-443.proxy.ecnu.edu.cn`
- Path, query, hash preserved as-is

## Conventions
- All UI text must support zh/en via i18n object
- Credentials stored with GM_setValue + Base64/XOR obfuscation
- Default Chinese, user can switch to English
