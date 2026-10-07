#!/usr/bin/env bash
# fetch-paper.sh — download a paper PDF with session cookies and validate it.
#
# Usage: fetch-paper.sh <url> <output.pdf> [--referer URL] [--page-only] [--cookie-jar PATH] [--no-verify]
#   --page-only   the target is an HTML page (visit it to build DB session cookies); exit 0 on HTML
#   --no-verify   skip pdftotext integrity check (still checks %PDF- header)
# Exit codes:
#   0 ok | 2 got HTML instead of PDF | 3 WebVPN session expired/redirected to login
#   4 curl/network error | 5 corrupted PDF | 6 bad usage / missing tooling
set -u

JAR_DEFAULT="$HOME/.config/get-paper/cookies.txt"
UA="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36 Edg/126.0.0.0"

URL=""; OUT=""; REFERER=""; PAGE_ONLY=0; NO_VERIFY=0; JAR="$JAR_DEFAULT"
while [ $# -gt 0 ]; do
  case "$1" in
    --referer) REFERER="$2"; shift 2 ;;
    --page-only) PAGE_ONLY=1; shift ;;
    --no-verify) NO_VERIFY=1; shift ;;
    --cookie-jar) JAR="$2"; shift 2 ;;
    -h|--help) grep '^#' "$0" | sed 's/^# \{0,1\}//'; exit 0 ;;
    *) if [ -z "$URL" ]; then URL="$1"; elif [ -z "$OUT" ]; then OUT="$1"; else echo "unknown arg: $1" >&2; exit 6; fi; shift ;;
  esac
done
[ -n "$URL" ] && [ -n "$OUT" ] || { echo "usage: fetch-paper.sh <url> <output.pdf> [options]" >&2; exit 6; }

command -v curl >/dev/null || { echo "curl is required" >&2; exit 6; }
mkdir -p "$(dirname "$JAR")" "$(dirname "$OUT")"
TMP="$(mktemp "${TMPDIR:-/tmp}/fetch-paper.XXXXXX")"
META="$(mktemp "${TMPDIR:-/tmp}/fetch-paper-meta.XXXXXX")"
trap 'rm -f "$TMP" "$META"' EXIT

REF_ARGS=()
[ -n "$REFERER" ] && REF_ARGS=(-H "Referer: $REFERER")

CODE=$(curl -sL --max-time 120 --connect-timeout 20 \
  -A "$UA" ${REF_ARGS[@]+"${REF_ARGS[@]}"} \
  -b "$JAR" -c "$JAR" \
  -o "$TMP" \
  -w '%{http_code}\t%{content_type}\t%{url_effective}\t%{size_download}' \
  "$URL" 2>"$META") || { echo "curl error: $(cat "$META")" >&2; exit 4; }

IFS=$'\t' read -r HTTP_CODE CONTENT_TYPE FINAL_URL SIZE <<<"$CODE"

log() { echo "[$HTTP_CODE] type=${CONTENT_TYPE:-?} bytes=$SIZE url=$FINAL_URL" >&2; }

is_pdf() { head -c 5 "$1" 2>/dev/null | grep -q '%PDF-'; }
login_page() {
  printf '%s' "$FINAL_URL" | grep -Eiq 'login|ids\.ecnu|passport|sso|/auth' && return 0
  grep -Eiq 'webvpn|wengine|统一身份认证|请登录|sign in to your account' "$1" 2>/dev/null
}

if is_pdf "$TMP"; then
  if [ "$OUT" = "/dev/null" ]; then
    log; echo "unexpected PDF for page-only target (fine, discarded)" >&2; exit 0
  fi
  if [ "$NO_VERIFY" = 0 ] && command -v pdftotext >/dev/null; then
    if ! pdftotext "$TMP" - >/dev/null 2>&1; then
      cp "$TMP" "$OUT.corrupted"; log
      echo "CORRUPTED PDF (xref broken): saved to $OUT.corrupted" >&2; exit 5
    fi
  fi
  mv "$TMP" "$OUT" || { log; echo "SAVE FAILED: cannot write $OUT" >&2; exit 4; }
  trap - EXIT
  log; echo "✓ $OUT ($SIZE bytes)" >&2; exit 0
fi

# HTML / error payload
if login_page "$TMP"; then
  log; echo "SESSION_EXPIRED: redirected to WebVPN/SSO login. Refresh cookies (see SKILL.md) then retry." >&2; exit 3
fi
if [ "$PAGE_ONLY" = 1 ]; then
  if [ "$OUT" = "/dev/null" ]; then log; echo "page fetched (session cookies updated in $JAR)" >&2; exit 0; fi
  mv "$TMP" "$OUT" || { log; echo "SAVE FAILED: cannot write $OUT" >&2; exit 4; }
  trap - EXIT; log; exit 0
fi
log
echo "NOT_PDF: got ${CONTENT_TYPE:-unknown}. Check URL pattern in references/databases.md" >&2
exit 2
