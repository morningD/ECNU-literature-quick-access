# Codex Cloud Maintenance Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add safe Codex Cloud maintenance support for this Tampermonkey userscript project, including agent instructions, issue templates, lightweight CI, and explicit boundaries for automated GitHub issue triage.

**Architecture:** Keep the repository dependency-free and plain JavaScript. Add repo-level guidance files and GitHub metadata so Codex can understand maintenance rules, users provide enough bug-report context, and CI validates script syntax. Issue triage automation should be documented as a controlled workflow: classify and request info automatically, but do not claim real ECNU WebVPN/SSO reproduction or close issues without human review.

**Tech Stack:** Plain JavaScript userscripts, GitHub metadata files, GitHub Actions, Markdown/YAML.

## Global Constraints

- Do not add runtime dependencies or a build system.
- Keep `ecnu-literature-quick-access.user.js` and `ecnu-literature-quick-access-auto.user.js` as plain JavaScript single-file userscripts.
- GitHub Release assets should only include `ecnu-literature-quick-access.user.js` and `ecnu-literature-quick-access-auto.user.js`.
- UI text in userscripts must support zh/en via the existing i18n object.
- Credentials must remain stored with `GM_setValue` plus Base64/XOR obfuscation.
- Codex or other agents must not claim ECNU WebVPN, SSO, or database access behavior was reproduced unless it was actually tested in a real browser environment.
- Automated issue handling must not close issues, publish releases, or make final factual claims about campus-network-only behavior without maintainer review.
- Validate JavaScript changes with:
  - `node --check ecnu-literature-quick-access.user.js`
  - `node --check ecnu-literature-quick-access-auto.user.js`

---

## File Structure

Create or modify these files:

- Create: `AGENTS.md`
  - Purpose: Project instructions for Codex Cloud and other coding agents.
  - Responsibility: Explain project structure, validation commands, URL conversion rules, SSO constraints, issue triage boundaries, and release rules.

- Create: `.github/ISSUE_TEMPLATE/bug_report.yml`
  - Purpose: Structured bug report form for redirect, SSO, WebVPN, and install issues.
  - Responsibility: Collect original URL, final URL, browser, Tampermonkey version, userscript version, lite/auto variant, and screenshots/logs.

- Create: `.github/ISSUE_TEMPLATE/domain_request.yml`
  - Purpose: Structured request form for adding or fixing academic database domains.
  - Responsibility: Collect database name, original URL, expected proxy behavior, whether the URL works through ECNU WebVPN, and whether this is a redirect target.

- Create: `.github/ISSUE_TEMPLATE/config.yml`
  - Purpose: Configure issue template picker and contact links.
  - Responsibility: Disable blank issues only if templates cover enough cases; include README links.

- Create: `.github/workflows/check.yml`
  - Purpose: Lightweight CI syntax check.
  - Responsibility: Run `node --check` for both userscripts on pushes and pull requests.

- Modify: `README.md`
  - Purpose: Add short Chinese maintainer note explaining that issues should use templates and AI triage is preliminary.
  - Responsibility: Keep existing README style: simple, student-friendly, light humor, emoji.

- Modify: `README_EN.md`
  - Purpose: Add matching English maintainer note.
  - Responsibility: Keep meaning aligned with Chinese README.

No changes are required to the two `.user.js` files for this plan.

---

### Task 1: Add Codex/Agent Instructions

**Files:**
- Create: `AGENTS.md`

**Interfaces:**
- Consumes: Existing project conventions from `CLAUDE.md`, `README.md`, `README_EN.md`, `PLAN.md`, `PROXY_CHECK.md`.
- Produces: Repository-level instructions that Codex Cloud can read before making maintenance changes.

- [ ] **Step 1: Create `AGENTS.md` with project guidance**

Create `AGENTS.md` with this exact content:

```markdown
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
```

- [ ] **Step 2: Inspect formatting**

Run:

```bash
sed -n '1,260p' AGENTS.md
```

Expected: The file renders as Markdown, nested code fences are readable, and all paths match the current repository.

- [ ] **Step 3: Commit Task 1**

```bash
git add AGENTS.md
git commit -m "docs: add agent maintenance instructions"
```

---

### Task 2: Add Structured GitHub Issue Templates

**Files:**
- Create: `.github/ISSUE_TEMPLATE/bug_report.yml`
- Create: `.github/ISSUE_TEMPLATE/domain_request.yml`
- Create: `.github/ISSUE_TEMPLATE/config.yml`

**Interfaces:**
- Consumes: Triage requirements from `AGENTS.md`.
- Produces: Structured issue metadata and required fields that humans/Codex can use for triage.

- [ ] **Step 1: Create `.github/ISSUE_TEMPLATE/bug_report.yml`**

Create `.github/ISSUE_TEMPLATE/bug_report.yml` with this exact content:

```yaml
name: Bug report / 问题反馈
description: Report redirect, SSO, installation, or WebVPN behavior issues / 反馈重定向、SSO、安装或 WebVPN 问题
title: "[Bug]: "
labels: ["needs-triage"]
body:
  - type: markdown
    attributes:
      value: |
        感谢反馈！为了避免维护者和机器人一起猜谜，请尽量填完整 😄

        Please provide enough details so maintainers can distinguish script bugs from browser, Tampermonkey, account, or ECNU WebVPN behavior.

  - type: dropdown
    id: script_variant
    attributes:
      label: Script variant / 脚本版本类型
      description: Which script are you using? / 你使用的是哪个脚本？
      options:
        - Lite / 精简版 ecnu-literature-quick-access.user.js
        - Auto / 自动版 ecnu-literature-quick-access-auto.user.js
        - Not sure / 不确定
    validations:
      required: true

  - type: input
    id: script_version
    attributes:
      label: Userscript version / 用户脚本版本
      description: Find it in Tampermonkey or the userscript header. / 可在 Tampermonkey 或脚本头部查看。
      placeholder: "v1.3.0"
    validations:
      required: true

  - type: dropdown
    id: issue_type
    attributes:
      label: Issue type / 问题类型
      options:
        - Redirect does not happen / 没有自动重定向
        - Redirect loop or wrong final page / 重定向循环或最终页面错误
        - SSO auto-login issue / SSO 自动登录问题
        - Installation or permission issue / 安装或权限问题
        - Settings panel issue / 设置面板问题
        - Other / 其他
    validations:
      required: true

  - type: input
    id: original_url
    attributes:
      label: Original URL / 原始网址
      description: The URL you opened before the script redirected. / 脚本重定向前你打开的网址。
      placeholder: "https://www.example-database.com/article/123"
    validations:
      required: false

  - type: input
    id: final_url
    attributes:
      label: Final URL / 最终网址
      description: The URL shown after redirect or failure. / 重定向后或失败时浏览器地址栏显示的网址。
      placeholder: "https://www-example-database-com-443.proxy.ecnu.edu.cn/article/123"
    validations:
      required: false

  - type: textarea
    id: expected
    attributes:
      label: Expected behavior / 期望行为
      description: What did you expect to happen? / 你原本期望发生什么？
      placeholder: "The page should open through ECNU WebVPN proxy."
    validations:
      required: true

  - type: textarea
    id: actual
    attributes:
      label: Actual behavior / 实际行为
      description: What actually happened? Include error messages if any. / 实际发生了什么？如有错误信息请贴出。
      placeholder: "The page redirected to proxy.ecnu.edu.cn and stopped."
    validations:
      required: true

  - type: textarea
    id: steps
    attributes:
      label: Steps to reproduce / 复现步骤
      description: List exact steps. / 请列出具体步骤。
      placeholder: |
        1. Install the lite script
        2. Open ...
        3. See ...
    validations:
      required: true

  - type: dropdown
    id: browser
    attributes:
      label: Browser / 浏览器
      options:
        - Edge
        - Chrome
        - Firefox
        - Safari
        - Other / 其他
    validations:
      required: true

  - type: input
    id: browser_version
    attributes:
      label: Browser version / 浏览器版本
      placeholder: "Edge 126.0.0.0"
    validations:
      required: false

  - type: input
    id: tampermonkey_version
    attributes:
      label: Tampermonkey version / Tampermonkey 版本
      placeholder: "5.3.0"
    validations:
      required: true

  - type: dropdown
    id: allow_user_scripts
    attributes:
      label: Allow User Scripts enabled? / 是否已启用 Allow User Scripts？
      description: Required by Chrome/Edge with newer Tampermonkey versions. / 新版 Chrome/Edge + Tampermonkey 通常需要。
      options:
        - Yes / 是
        - No / 否
        - Not sure / 不确定
        - Not applicable / 不适用
    validations:
      required: true

  - type: textarea
    id: screenshots_logs
    attributes:
      label: Screenshots or logs / 截图或日志
      description: Optional, but useful. Please remove private information. / 可选，但很有帮助。请删除隐私信息。
      placeholder: "Paste screenshots, console messages, or Tampermonkey logs here."
    validations:
      required: false

  - type: checkboxes
    id: confirmation
    attributes:
      label: Confirmation / 确认
      options:
        - label: I have removed account, password, cookie, and other private information. / 我已删除账号、密码、Cookie 等隐私信息。
          required: true
        - label: I understand that ECNU WebVPN/SSO issues may require maintainer manual verification. / 我理解 ECNU WebVPN/SSO 问题可能需要维护者手动验证。
          required: true
```

- [ ] **Step 2: Create `.github/ISSUE_TEMPLATE/domain_request.yml`**

Create `.github/ISSUE_TEMPLATE/domain_request.yml` with this exact content:

```yaml
name: Domain request / 数据库域名请求
description: Request adding, removing, or fixing an academic database domain / 请求新增、移除或修复数据库域名
title: "[Domain]: "
labels: ["needs-triage", "domain-mapping"]
body:
  - type: markdown
    attributes:
      value: |
        用于请求新增或修复学术数据库域名映射。请尽量提供原始网址和数据库名称。

        This form is for adding or fixing academic database domain mappings.

  - type: input
    id: database_name
    attributes:
      label: Database or publisher name / 数据库或出版社名称
      placeholder: "Web of Science / JSTOR / ScienceDirect / ..."
    validations:
      required: true

  - type: input
    id: original_url
    attributes:
      label: Original URL / 原始网址
      description: The URL users normally open. / 用户通常打开的网址。
      placeholder: "https://www.example-database.com/"
    validations:
      required: true

  - type: input
    id: current_proxy_url
    attributes:
      label: Current proxy URL if known / 当前代理网址（如已知）
      description: If you already tried an ECNU WebVPN proxy URL, paste it here. / 如果你已经试过 ECNU WebVPN 代理网址，请贴在这里。
      placeholder: "https://www-example-database-com-443.proxy.ecnu.edu.cn/"
    validations:
      required: false

  - type: dropdown
    id: request_type
    attributes:
      label: Request type / 请求类型
      options:
        - Add missing domain / 新增缺失域名
        - Fix existing domain / 修复已有域名
        - Remove broken domain / 移除失效域名
        - Redirect loop or redirect target issue / 重定向循环或跳转目标问题
        - Not sure / 不确定
    validations:
      required: true

  - type: textarea
    id: evidence
    attributes:
      label: Evidence or explanation / 证据或说明
      description: Explain what works or fails. / 说明哪里可用或不可用。
      placeholder: |
        - Direct URL opens normally / 原始网址可正常打开
        - Proxy URL stays inside *.proxy.ecnu.edu.cn / 代理网址保持在 *.proxy.ecnu.edu.cn 内
        - Or: proxy redirects outside and breaks / 或：代理跳出后失败
    validations:
      required: true

  - type: dropdown
    id: manual_verified
    attributes:
      label: Have you tested through ECNU WebVPN? / 是否已通过 ECNU WebVPN 测试？
      options:
        - Yes, proxy works / 是，代理可用
        - Yes, proxy fails / 是，代理失败
        - No / 否
        - Not sure / 不确定
    validations:
      required: true

  - type: checkboxes
    id: confirmation
    attributes:
      label: Confirmation / 确认
      options:
        - label: I have checked that the URL does not contain private account, token, cookie, or session information. / 我已确认网址不包含账号、token、Cookie 或 session 等隐私信息。
          required: true
```

- [ ] **Step 3: Create `.github/ISSUE_TEMPLATE/config.yml`**

Create `.github/ISSUE_TEMPLATE/config.yml` with this exact content:

```yaml
blank_issues_enabled: true
contact_links:
  - name: README / 使用说明
    url: https://github.com/morningD/ECNU-literature-quick-access#readme
    about: Read installation and usage instructions first. / 先看看安装和使用说明。
  - name: English README
    url: https://github.com/morningD/ECNU-literature-quick-access/blob/master/README_EN.md
    about: English installation and usage instructions.
```

Reason for `blank_issues_enabled: true`: keep the project friendly to students who may not know which template to choose. Codex/humans can still ask follow-up questions.

- [ ] **Step 4: Inspect YAML files**

Run:

```bash
find .github/ISSUE_TEMPLATE -maxdepth 1 -type f -print -exec sed -n '1,220p' {} \;
```

Expected: Three template files exist; YAML indentation is two spaces; no tab characters are present.

- [ ] **Step 5: Commit Task 2**

```bash
git add .github/ISSUE_TEMPLATE/bug_report.yml .github/ISSUE_TEMPLATE/domain_request.yml .github/ISSUE_TEMPLATE/config.yml
git commit -m "docs: add structured issue templates"
```

---

### Task 3: Add Lightweight GitHub Actions Syntax Check

**Files:**
- Create: `.github/workflows/check.yml`

**Interfaces:**
- Consumes: Existing userscript files.
- Produces: A `check` workflow that Codex PRs and maintainer pushes can rely on.

- [ ] **Step 1: Create `.github/workflows/check.yml`**

Create `.github/workflows/check.yml` with this exact content:

```yaml
name: check

on:
  pull_request:
  push:
    branches:
      - master

permissions:
  contents: read

jobs:
  syntax:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Set up Node.js
        uses: actions/setup-node@v4
        with:
          node-version: 22

      - name: Check lite userscript syntax
        run: node --check ecnu-literature-quick-access.user.js

      - name: Check auto userscript syntax
        run: node --check ecnu-literature-quick-access-auto.user.js
```

- [ ] **Step 2: Run the same checks locally**

Run:

```bash
node --check ecnu-literature-quick-access.user.js
node --check ecnu-literature-quick-access-auto.user.js
```

Expected: Both commands exit with status 0 and print no syntax errors.

- [ ] **Step 3: Inspect workflow file**

Run:

```bash
sed -n '1,120p' .github/workflows/check.yml
```

Expected: Workflow name is `check`, trigger includes `pull_request` and pushes to `master`, permissions are read-only, and both userscripts are checked.

- [ ] **Step 4: Commit Task 3**

```bash
git add .github/workflows/check.yml
git commit -m "ci: check userscript syntax"
```

---

### Task 4: Document Issue Triage Boundaries in READMEs

**Files:**
- Modify: `README.md`
- Modify: `README_EN.md`

**Interfaces:**
- Consumes: Issue template names and triage boundaries from Tasks 1-2.
- Produces: User-facing documentation that sets expectations for issue reports and automated preliminary triage.

- [ ] **Step 1: Read current README section layout**

Run:

```bash
grep -n "Issue\|问题\|反馈\|贡献\|Contributing\|贡献" README.md README_EN.md || true
```

Expected: Identify the best section to insert a short issue-reporting note. If no suitable section exists, insert near the end before license/release/changelog sections.

- [ ] **Step 2: Add Chinese README note**

Add this section to `README.md` near existing feedback/contribution/help content. If no such section exists, insert it above the license/footer section:

```markdown
## 反馈问题 🐛

遇到打不开、跳错、SSO 不听话？欢迎提 Issue！为了少一点玄学、多一点定位，请优先选择对应模板：

- **Bug report / 问题反馈**：重定向、安装、SSO、设置面板等问题
- **Domain request / 数据库域名请求**：新增或修复数据库域名

如果看到机器人或 AI 的初步排查回复，请把它当成“先帮你分拣快递”——它可以做静态检查、提醒补信息，但真实 ECNU WebVPN / SSO / 数据库访问问题仍需要维护者结合实际环境确认。
```

- [ ] **Step 3: Add English README note**

Add this section to `README_EN.md` near existing feedback/contribution/help content. If no such section exists, insert it above the license/footer section:

```markdown
## Reporting Issues 🐛

If redirects, installation, SSO, or settings do not work as expected, please open an issue with the matching template:

- **Bug report**: redirect, installation, SSO, or settings panel issues
- **Domain request**: add or fix an academic database domain

Automated or AI-assisted triage comments are only preliminary. They can run static checks and ask for missing details, but real ECNU WebVPN / SSO / database access behavior still needs maintainer verification in an actual browser environment.
```

- [ ] **Step 4: Inspect the inserted README sections**

Run:

```bash
grep -n -A12 "反馈问题\|Reporting Issues" README.md README_EN.md
```

Expected: Both READMEs contain matching issue-reporting guidance; Chinese copy keeps the project's light, student-friendly tone.

- [ ] **Step 5: Commit Task 4**

```bash
git add README.md README_EN.md
git commit -m "docs: explain issue reporting and triage boundaries"
```

---

### Task 5: Add Optional Codex Automation Operating Note

**Files:**
- Create: `docs/codex-issue-triage.md`

**Interfaces:**
- Consumes: Triage rules from `AGENTS.md` and user-facing expectations from README files.
- Produces: Maintainer-only operating guide for setting up Codex Automations or any future bot/GitHub Action.

- [ ] **Step 1: Create `docs/codex-issue-triage.md`**

Create `docs/codex-issue-triage.md` with this exact content:

```markdown
# Codex Issue Triage Operating Guide

This document describes a safe operating model for Codex Cloud, Codex Automations, or any future AI-assisted GitHub issue triage workflow for this repository.

## Recommended maturity levels

### Level 1: Report only

Codex scans new issues and produces a private/maintainer-facing summary. It does not comment, label, close, or edit issues.

Use this level first.

### Level 2: Safe public comments

Codex may post preliminary comments only when the issue lacks required information or clearly matches a static repository fact.

Allowed examples:

- Ask for original URL, final URL, browser, Tampermonkey version, userscript version, and lite/auto variant.
- Point out that a domain is not currently present in either userscript.
- Point to README instructions for enabling browser user-script permissions.

Not allowed:

- Claim real WebVPN/SSO reproduction.
- Close issues.
- Publish releases.
- Blame ECNU WebVPN or a third-party database without maintainer verification.

### Level 3: PR preparation

Codex may create a branch or PR for clear static fixes:

- Documentation typo or mismatch.
- Missing `@match` entry when mapping is already present.
- Missing mapping when the issue provides a clearly valid domain and maintainer requested the change.
- i18n key mismatch.
- JavaScript syntax failure.

The maintainer still reviews and manually verifies browser/WebVPN behavior before release.

## Suggested automation prompt

Use a prompt like this for a scheduled Codex Automation or equivalent workflow:

```text
Check new open issues in morningD/ECNU-literature-quick-access that do not have a triage label.

For each issue:
1. Classify it as one of: needs-info, domain-mapping, redirect-loop, sso, webvpn, documentation, cannot-reproduce-cloud.
2. Read AGENTS.md and follow its issue triage rules.
3. Do not claim real ECNU WebVPN, SSO, or database behavior was reproduced.
4. Do not close issues.
5. Do not publish releases.
6. If information is missing, draft a polite Chinese-first reply asking for the missing fields.
7. If the issue is a clear static repository problem, summarize the evidence and suggest a PR.
8. If the issue requires real browser/WebVPN verification, say it requires maintainer manual verification.
9. Produce a concise maintainer summary with recommended labels and an optional draft comment.
```

## Safe draft comment for missing information

```markdown
感谢反馈！这是一次自动初步排查，还没有在真实 ECNU WebVPN/SSO 环境中复现。

为了继续定位，麻烦补充：

1. 原始访问 URL
2. 最终跳转 URL 或错误页面 URL
3. 使用的是精简版还是自动版
4. 用户脚本版本
5. 浏览器和版本
6. Tampermonkey 版本
7. Chrome/Edge 是否已开启 Allow User Scripts

请不要贴账号、密码、Cookie 或其他隐私信息。
```

## Safe wording rules

Prefer:

- "初步判断"
- "静态检查显示"
- "看起来可能是"
- "需要维护者在真实环境确认"

Avoid unless actually verified:

- "已复现"
- "已确认"
- "这是学校代理的问题"
- "这是数据库网站的问题"

## Manual verification checklist

Before a maintainer confirms or closes WebVPN-related issues:

- Disable or isolate other redirect extensions.
- Confirm which userscript variant is installed.
- Confirm browser user-script permission is enabled if using Chrome/Edge with newer Tampermonkey.
- Test the original URL.
- Test the expected `*.proxy.ecnu.edu.cn` URL with Tampermonkey disabled when checking proxy behavior.
- Verify whether the final URL stays inside `*.proxy.ecnu.edu.cn`.
- Check whether the domain appears in `PROXY_CHECK.md` as a known redirect pitfall.
```

- [ ] **Step 2: Inspect operating guide**

Run:

```bash
sed -n '1,260p' docs/codex-issue-triage.md
```

Expected: The document contains three maturity levels, a suggested automation prompt, a safe draft comment, wording rules, and a manual verification checklist.

- [ ] **Step 3: Commit Task 5**

```bash
git add docs/codex-issue-triage.md
git commit -m "docs: add codex issue triage guide"
```

---

### Task 6: Final Verification and Review

**Files:**
- Verify all files created or modified in Tasks 1-5.

**Interfaces:**
- Consumes: Deliverables from Tasks 1-5.
- Produces: Verified branch ready for human review or PR.

- [ ] **Step 1: Run JavaScript syntax checks**

Run:

```bash
node --check ecnu-literature-quick-access.user.js
node --check ecnu-literature-quick-access-auto.user.js
```

Expected: Both commands exit 0 and print no syntax errors.

- [ ] **Step 2: Check YAML indentation for tabs**

Run:

```bash
python3 - <<'PY'
from pathlib import Path
paths = [
    Path('.github/ISSUE_TEMPLATE/bug_report.yml'),
    Path('.github/ISSUE_TEMPLATE/domain_request.yml'),
    Path('.github/ISSUE_TEMPLATE/config.yml'),
    Path('.github/workflows/check.yml'),
]
failed = False
for path in paths:
    text = path.read_text()
    if '\t' in text:
        print(f'TAB FOUND: {path}')
        failed = True
    else:
        print(f'OK: {path}')
raise SystemExit(1 if failed else 0)
PY
```

Expected:

```text
OK: .github/ISSUE_TEMPLATE/bug_report.yml
OK: .github/ISSUE_TEMPLATE/domain_request.yml
OK: .github/ISSUE_TEMPLATE/config.yml
OK: .github/workflows/check.yml
```

- [ ] **Step 3: Review changed file list**

Run:

```bash
git status --short
git log --oneline -6
```

Expected: Working tree is clean after the task commits; recent commits correspond to Tasks 1-5.

- [ ] **Step 4: Human review checklist**

Manually confirm:

- `AGENTS.md` does not contradict `CLAUDE.md`.
- Issue templates do not request passwords, cookies, student IDs, or other sensitive data.
- README additions are short and not too formal.
- CI remains dependency-free and read-only.
- Triage guide clearly forbids automatic issue closure and unsupported reproduction claims.

- [ ] **Step 5: Optional squash or keep commits**

If the maintainer wants a tidy history, either keep the five focused commits or squash them into one:

```bash
git reset --soft HEAD~5
git commit -m "chore: prepare codex cloud maintenance workflow"
```

Only squash if the branch contains exactly the five implementation commits from this plan.

---

## Self-Review

### Spec coverage

- Codex Cloud maintenance support: Task 1 adds `AGENTS.md`; Task 5 adds an operating guide.
- GitHub issue triage automation boundaries: Task 1 and Task 5 define safe/unsafe actions and wording rules.
- Issue templates: Task 2 adds structured bug and domain request templates.
- CI: Task 3 adds GitHub Actions syntax checks.
- Documentation: Task 4 updates both READMEs.
- No code changes: The plan does not require modifications to the two userscript files.

### Placeholder scan

No `TBD`, `TODO`, `implement later`, or unspecified code steps are present. All created files include exact content.

### Type and interface consistency

No programmatic interfaces are introduced. File paths are consistent across tasks:

- `AGENTS.md`
- `.github/ISSUE_TEMPLATE/bug_report.yml`
- `.github/ISSUE_TEMPLATE/domain_request.yml`
- `.github/ISSUE_TEMPLATE/config.yml`
- `.github/workflows/check.yml`
- `docs/codex-issue-triage.md`
- `README.md`
- `README_EN.md`
