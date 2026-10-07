#!/usr/bin/env bash
# get-paper 回归测试（curl 路线全自动；IAB 路线见 data/test-dois.json 的 iab-* 条目，
# 需在 ZCode node_repl 中按 SKILL.md 方案 D 手动执行）。
# 用法: test-suite.sh [--route curl-open|curl-acm|curl-ieee|...] [--keep]
set -u

SKILL_DIR="$(cd "$(dirname "$0")/.." && pwd)"
DATA="$SKILL_DIR/data/test-dois.json"
OUT_DIR="$(mktemp -d "${TMPDIR:-/tmp}/get-paper-test.XXXXXX")"
FILTER=""; KEEP=0
while [ $# -gt 0 ]; do
  case "$1" in
    --route) FILTER="$2"; shift 2 ;;
    --keep) KEEP=1; shift ;;
    *) echo "unknown: $1" >&2; exit 2 ;;
  esac
done

pass=0; fail=0; skip=0

run_case() { # id route url referer min max
  local id="$1" route="$2" url="$3" referer="$4" min="$5" max="$6"
  local out="$OUT_DIR/$id.pdf"
  local ref=()
  [ -n "$referer" ] && ref=(--referer "$referer")
  if "$SKILL_DIR/scripts/fetch-paper.sh" "$url" "$out" ${ref[@]+"${ref[@]}"} >/dev/null 2>&1; then
    local size
    size=$(wc -c < "$out" | tr -d ' ')
    if [ "$size" -ge "$min" ] && [ "$size" -le "$max" ]; then
      printf '✓ PASS %-28s %s bytes\n' "$id" "$size"; pass=$((pass+1))
    else
      printf '✗ FAIL %-28s 大小 %s 超出预期 [%s,%s]\n' "$id" "$size" "$min" "$max"; fail=$((fail+1))
    fi
  else
    printf '✗ FAIL %-28s 下载失败（cookie 过期？route=%s）\n' "$id" "$route"; fail=$((fail+1))
  fi
}

# iterate cases via node (jq-free)
while IFS=$'\x1f' read -r id route url referer minmax; do
  [ -n "$id" ] || continue
  if [ -n "$FILTER" ] && [ "$route" != "$FILTER" ]; then continue; fi
  case "$route" in
    curl-open|curl-acm)
      run_case "$id" "$route" "$url" "$referer" "${minmax%,*}" "${minmax#*,}"
      ;;
    curl-ieee)
      # IEEE 三步：论文页 → stamp.jsp 预热 → getPDF
      arnumber=$(node -e "const c=require('$DATA').cases.find(c=>c.id==='$id');console.log(c.arnumber)" 2>/dev/null)
      base="https://ieeexplore-ieee-org-443.proxy.ecnu.edu.cn"
      "$SKILL_DIR/scripts/fetch-paper.sh" "$base/document/$arnumber" /dev/null --page-only >/dev/null 2>&1
      "$SKILL_DIR/scripts/fetch-paper.sh" "$base/stamp/stamp.jsp?tp=&arnumber=$arnumber" /dev/null --page-only >/dev/null 2>&1
      run_case "$id" "$route" "$base/stampPDF/getPDF.jsp?tp=&arnumber=$arnumber&ref=" \
        "$base/stamp/stamp.jsp?tp=&arnumber=$arnumber" "${minmax%,*}" "${minmax#*,}"
      ;;
    iab-*)
      [ -n "$FILTER" ] || printf '– SKIP %-28s（IAB 路线，需 node_repl 手动跑，见 SKILL.md）\n' "$id"
      skip=$((skip+1))
      ;;
    *)
      [ -n "$FILTER" ] || printf '– SKIP %-28s（%s）\n' "$id" "$route"
      skip=$((skip+1))
      ;;
  esac
done < <(node -e "
const cases = require('$DATA').cases;
for (const c of cases) {
  const mm = c.expectBytes ? c.expectBytes.join(',') : ',';
  console.log([c.id, c.route, c.url || '', c.referer || '', mm].join('\x1f'));
}
")

printf '\n汇总: %d pass, %d fail, %d skip\n' "$pass" "$fail" "$skip"
if [ "$KEEP" = 1 ]; then echo "产物目录: $OUT_DIR"; else rm -rf "$OUT_DIR"; fi
[ "$fail" = 0 ] || exit 1
