# 🎓 ECNU Literature Quick Access

> 🚀 Access academic databases off-campus · Let your AI assistant download papers automatically

[中文](./README.md) · [FAQ (skill)](./get-paper/FAQ.md)

**Choose your entry point:**

| I use… | Go to | What it does |
|---------|-------|--------------|
| 🌐 **A browser** (reading papers) | [Userscript →](#userscript) | Auto-redirect academic sites to the ECNU proxy + auto SSO login, invisible after install |
| 🤖 **An AI assistant** (ZCode / Claude Code / …) | [get-paper skill →](#get-paper-skill) | Say one sentence; the AI resolves and downloads the paper PDF (open access + paywalled databases) |

The two parts are independent — install either one. The userscript's database mapping table also feeds the skill.

---

## Contents

- [Userscript](#userscript) — install in 3 steps · supported databases · FAQ
- [get-paper skill](#get-paper-skill) — install · examples · privacy · tests
- [Adapting to other universities](#adapting-to-other-universities)
- [Documentation index](#documentation-index)

---

## Userscript

An auto-redirect + auto-SSO-login userscript for browser users.

### Install in 3 steps

1. **Install Tampermonkey**: [Chrome](https://chrome.google.com/webstore/detail/tampermonkey/dhdgffkkebhmkfjojejmpbldmpobfkfo) / [Edge](https://microsoftedge.microsoft.com/addons/detail/tampermonkey/iikmkjmpaadaobahmlepeloendndfphd)
   ⚠️ Chrome/Edge 138+ requires **Allow User Scripts** enabled on the extension page, otherwise the script won't run.
2. **Install the script**: open [`ecnu-literature-quick-access.user.js`](./ecnu-literature-quick-access.user.js) → Raw → Tampermonkey prompt. (Need dynamic subdomain detection? Use the [auto version](./ecnu-literature-quick-access-auto.user.js) — don't install both.)
3. **Configure credentials**: open the [library database list](https://lib.ecnu.edu.cn/sjk/list.htm) → Tampermonkey icon → **ECNU Literature Quick Access - Settings** → enter your student ID and password (stored obfuscated in the sandbox).

Then just browse normally: visiting IEEE/ACM/ScienceDirect etc. auto-redirects to the proxy URL, and the first SSO login is filled in automatically.

### Features

| Feature | Notes |
|---------|-------|
| 🔄 Auto-redirect | 90+ database mappings (CNKI/Wanfang/WoS/Scopus/IEEE/ACM/ScienceDirect/Springer/Nature/ACS/RSC…); new library databases can be synced from the list page |
| 🔐 Auto SSO login | Fills student ID + password (native setters, Angular-compatible) |
| 🖱️ Manual mode | Switchable to a floating confirm button |
| 🌐 Bilingual UI | Chinese / English |

### Userscript FAQ

<details>
<summary>Expand</summary>

- **Installed but not working** → check the "Allow User Scripts" switch (most common)
- **A site doesn't redirect** → update the mapping → switch to the auto version → or add the domain manually in settings
- **Wiley doesn't open** → Wiley's auth rejects the proxy domain (upstream issue, see [PROXY_CHECK.md](./PROXY_CHECK.md))

</details>

---

## get-paper skill

A paper-download skill for AI assistants. Tell your assistant "download this paper" and it automatically: **resolves the DOI (5-source cross-validation) → prefers open-access copies (arXiv/ACL/AAAI/repositories) → falls back to paywalled databases via the ECNU WebVPN proxy → verifies PDF integrity**.

### Verified routes (all tested)

| Source | Route | Status |
|--------|-------|--------|
| arXiv / OA repositories / ACL Anthology / AAAI / MDPI | direct open download | ✅ |
| ACM Digital Library (incl. VLDB/PACMMOD) | curl + WebVPN session | ✅ |
| IEEE Xplore (3 steps: article page → stamp warm-up → getPDF) | curl + WebVPN session | ✅ |
| Wiley (OA articles, `pdfdirect` endpoint) | in-page browser extraction | ✅ |
| ScienceDirect | ⚠️ Cloudflare challenge — see [FAQ](./get-paper/FAQ.md) |

Batch field test: 10 papers from a scholar's profile — **10/10 fully automatic** (6 open + 2 ACM + 2 IEEE), zero manual intervention.

### Install (~1 minute)

```bash
git clone https://github.com/morningD/ECNU-literature-quick-access.git
cd ECNU-literature-quick-access
bash get-paper/setup.sh
```

> ⚠️ **The cloned directory IS the installation**: the skill is a symlink to this location — don't delete or move it (re-run setup.sh after moving).
> Requirements: node ≥ 18, curl, pdftotext (PDF verification); session renewal also needs playwright (see the [FAQ](./get-paper/FAQ.md)).

Setup walks you through 3 steps (GUI dialogs or terminal): **① install the skill** (symlink, auto-discovered by AI assistants) → **② configure ECNU SSO credentials** (Keychain / secret-tool / 600-perm file) → **③ API keys (optional)**.

```bash
bash get-paper/setup.sh --check               # configuration status
bash get-paper/setup.sh --reset               # reconfigure
bash get-paper/setup.sh --remove-credentials  # remove credentials
```

Stuck? Check **[get-paper/FAQ.md](./get-paper/FAQ.md)** first (organized by symptom: setup, download failures, rate limits, known limitations).

### Usage examples

**Conversational** (say this to an AI assistant with the skill installed):

```text
Use get-paper to download this paper: 10.1145/3589334.3645520
Download the last 5 years of papers from https://scholar.google.com/citations?user=xxxx
Download "HugNLP: A unified and comprehensive library for natural language processing"
```

**Command line** (scripts standalone):

```bash
node get-paper/scripts/resolve.mjs title "ModelGo: A Practical Tool for ..."        # title → DOI (5-source)
node get-paper/scripts/resolve.mjs doi "10.18653/v1/2025.findings-acl.259"          # DOI → metadata + OA link
node get-paper/scripts/resolve.mjs author "Bingsheng He" --since 2015               # author → papers
node get-paper/scripts/proxy-url.js "https://ieeexplore.ieee.org/document/9644782"  # → proxy URL
bash get-paper/scripts/fetch-paper.sh "https://arxiv.org/pdf/2508.04586" paper.pdf  # download + verify
node get-paper/scripts/renew-session.mjs                                           # renew WebVPN session
```

**Batch dispatch**: the skill manual passed subagent self-sufficiency tests — batch download tasks can be dispatched to multiple AI subagents in parallel (see [DEVLOG.md](./get-paper/DEVLOG.md)).

### Privacy & security

- SSO credentials stay on your machine (Keychain / secret-tool / 600-perm file); login requests go directly to the university SSO — **never through any third party**
- Session cookies and API keys live in `~/.config/get-paper/` (600 permissions)
- This repository contains no personal credentials; PDFs are downloaded from publishers / the official university WebVPN proxy

### Tests & maintenance

```bash
bash get-paper/scripts/test-suite.sh      # download-route regression
node get-paper/scripts/test-resolve.mjs   # resolver red/green/yellow tests
node get-paper/scripts/update-mapping.mjs # sync mapping from the userscript
```

Test suites live in `get-paper/data/`; all expectations are verified against authoritative APIs. PRs adding new publisher cases are welcome.

---

## Adapting to other universities

Both the userscript and the skill target the ECNU WebVPN. Most university WebVPN systems are similar — see [PLAN.md](./PLAN.md) to have an AI generate an adapted version (change the proxy domain suffix, SSO URL, and form selectors).

## Documentation index

| Doc | Contents |
|-----|----------|
| [get-paper/SKILL.md](./get-paper/SKILL.md) | Full skill manual (the AI assistant's execution basis) |
| [get-paper/FAQ.md](./get-paper/FAQ.md) | Troubleshooting by symptom |
| [get-paper/references/databases.md](./get-paper/references/databases.md) | Per-database tested download patterns & pitfalls |
| [get-paper/DEVLOG.md](./get-paper/DEVLOG.md) | Development log (rate-limit map, anti-bot lessons, architecture decisions) |
| [PROXY_CHECK.md](./PROXY_CHECK.md) | Proxy domain compatibility audit (userscript) |
| [PLAN.md](./PLAN.md) | Plan for adapting to other universities |

---

## License

[Apache-2.0](./LICENSE)

---

**Found it useful? Leave a Star ⭐~**
