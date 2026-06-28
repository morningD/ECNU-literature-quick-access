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
