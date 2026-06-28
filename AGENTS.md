# ECNU Literature Quick Access - Agent Instructions

## Project overview

This repository contains Tampermonkey userscripts that redirect academic database URLs to ECNU WebVPN proxy URLs and optionally automate ECNU SSO login.

There is no build system and no dependency manager. Keep the project as plain JavaScript unless the maintainer explicitly asks otherwise.

Main files:

- `ecnu-literature-quick-access.user.js`: lite version, explicit `@match` domains.
- `ecnu-literature-quick-access-auto.user.js`: auto version, `@match *://*/*` with dynamic recognition.
- `README.md`: Chinese README; keep it simple, student-friendly, lightly humorous, and emoji-friendly.
- `README_EN.md`: English README.
- `PLAN.md`: implementation notes for other schools.
- `PROXY_CHECK.md`: audit record for proxy behavior and domain mappings.

## Validation commands

Run these before finalizing JavaScript changes:

```bash
node --check ecnu-literature-quick-access.user.js
node --check ecnu-literature-quick-access-auto.user.js
```

If GitHub Actions are available, ensure the `check` workflow passes.

## URL conversion rules

- Original `-` in a domain becomes `--`.
- `.` in a domain becomes `-`.
- HTTP databases use `domain-hyphens.proxy.ecnu.edu.cn`.
- HTTPS databases use `domain-hyphens-443.proxy.ecnu.edu.cn`.
- Preserve path, query string, and hash exactly.

## Domain mapping maintenance

When changing domain mappings:

- Keep the lite version `@match` entries and its hardcoded mapping consistent.
- Keep the auto version `DEFAULT_MAPPING` consistent where the same domain should be supported.
- Prefer the HTTPS `-443` proxy suffix for HTTPS sites.
- Do not add redirect-target domains that are known to cause proxy loops.
- If a proxy-domain behavior claim depends on real ECNU WebVPN access, mark it as needing manual verification unless actually tested.
- Check `PROXY_CHECK.md` for known redirect pitfalls before adding or removing domains.

## SSO auto-login constraints

- ECNU SSO page: `sso.ecnu.edu.cn`.
- Username selector: `#nameInput`.
- Password selector: `input[type="password"]`.
- Submit selector: `#submitBtn`.
- The submit button may start disabled; code may need to remove `disabled` attribute and `disabled` class before clicking.
- Use the native `HTMLInputElement.prototype.value` setter for framework compatibility.
- Keep the guard flag that prevents double-submit races.
- Never log or expose user credentials.

## Userscript constraints

- Keep both scripts as single-file IIFEs.
- Do not add npm dependencies, bundlers, transpilers, or generated files unless explicitly requested.
- `GM_registerMenuCommand` must be registered before early returns, otherwise menus can disappear on pages such as SSO.
- If no credentials are configured, show the settings panel instead of redirecting.
- All UI text must support zh/en via the existing i18n object.
- Credentials must remain stored with `GM_setValue` plus Base64/XOR obfuscation.

## GitHub issue triage rules

When triaging issues:

- Do not claim that ECNU WebVPN, SSO, or a database access problem is reproduced unless it was actually tested in a real browser environment.
- Use careful wording such as "initial analysis suggests" or "this appears to be" for static analysis results.
- For missing-domain reports, check both userscript files:
  - lite version `@match` entries and mapping
  - auto version `DEFAULT_MAPPING`
- Ask for the original URL, final redirected URL, browser, Tampermonkey version, userscript version, and whether the user uses lite or auto version.
- Do not close issues automatically.
- Do not publish releases automatically.
- For clear documentation or mapping fixes, propose or create a PR instead of making unsupported claims.
- If an issue requires real ECNU account, WebVPN, SSO, or browser-extension behavior, label or describe it as requiring maintainer/manual verification.

Recommended labels for triage:

- `needs-info`: missing required reproduction details.
- `domain-mapping`: add, remove, or adjust a database domain.
- `redirect-loop`: suspected proxy redirect loop or break-out.
- `sso`: ECNU SSO auto-login behavior.
- `webvpn`: ECNU WebVPN behavior requiring manual verification.
- `documentation`: README, PLAN, or instructions.
- `cannot-reproduce-cloud`: cannot be confirmed from a cloud/container environment.

## Safe automated issue reply style

Automated replies should be preliminary and should not sound like final maintainer confirmation.

Preferred wording:

```markdown
感谢反馈！这是一次自动初步排查，不代表已经在真实 ECNU WebVPN/SSO 环境中复现。

初步判断：...
还需要补充：...
维护者后续会结合真实环境确认。
```

Avoid wording like:

- "已确认是 bug" unless the evidence is purely static and conclusive.
- "已复现" unless actually reproduced in a real browser environment.
- "这是学校代理的问题" unless verified by the maintainer.

## Release rules

GitHub Release assets should only include:

- `ecnu-literature-quick-access.user.js`
- `ecnu-literature-quick-access-auto.user.js`

Do not upload source archives manually. Do not create tags or releases unless explicitly asked by the maintainer.
