#!/usr/bin/env bash
# init-session.sh — seed the cookie jar from a Cookie header copied out of the user's browser.
# Usage: init-session.sh "_webvpn_key=xxx; ECNU=yyy; ..."
#   (a leading "Cookie:" prefix is tolerated; only _webvpn_key / ECNU are required)
set -eu

JAR="${COOKIE_JAR:-$HOME/.config/get-paper/cookies.txt}"
[ $# -ge 1 ] && [ -n "$1" ] || { echo "usage: init-session.sh \"<cookie header>\"" >&2; exit 2; }

HEADER="$*"
HEADER="${HEADER#Cookie: }"
HEADER="${HEADER#cookie: }"

mkdir -p "$(dirname "$JAR")"
[ -f "$JAR" ] && cp "$JAR" "$JAR.bak"

EXPIRY=2000000000  # ~2033; server-side expiry is what actually matters
{
  echo "# Netscape HTTP Cookie File (seeded by get-paper init-session at $(date -Iseconds))"
  IFS=';' read -ra PARTS <<<"$HEADER"
  for part in "${PARTS[@]}"; do
    part="${part#"${part%%[![:space:]]*}"}"   # ltrim
    [ -n "$part" ] || continue
    name="${part%%=*}"; value="${part#*=}"
    [ "$name" != "$part" ] || continue        # skip attributes without '='
    case "$name" in
      Path|Domain|Expires|Max-Age|Secure|HttpOnly|SameSite) continue ;;
    esac
    # scope to all proxy subdomains so every *.proxy.ecnu.edu.cn DB sees it
    printf '.proxy.ecnu.edu.cn\tTRUE\t/\tTRUE\t%s\t%s\t%s\n' "$EXPIRY" "$name" "$value"
  done
} > "$JAR"
chmod 600 "$JAR"

COUNT=$(grep -vc '^#' "$JAR" || true)
HAS_KEY=$(grep -c $'^.proxy.ecnu.edu.cn\t[^\t]*\t[^\t]*\t[^\t]*\t[^\t]*\t_webvpn_key\t' "$JAR" || true)
echo "wrote $COUNT cookies to $JAR (backup: $JAR.bak)"
if [ "$HAS_KEY" = "0" ]; then
  echo "warning: _webvpn_key not found in input — WebVPN auth will likely fail" >&2
  exit 1
fi
echo "test: \"$(dirname "$0")\"/fetch-paper.sh <any proxy page URL> /dev/null --page-only"
