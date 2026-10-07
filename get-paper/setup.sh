#!/usr/bin/env bash
# get-paper 跨平台配置脚本（macOS / Linux；Windows 用 setup.ps1）
# 功能：安装 skill symlink → 配置 ECNU SSO 凭据（识别已有钥匙串条目 / 新建 / 明文文件）→ 验证
# 用法: bash setup.sh [--check | --reset | --remove-credentials | --no-gui]
set -u

SKILL_DIR="$(cd "$(dirname "$0")" && pwd)"
AGENTS_SKILLS="$HOME/.agents/skills"
ZCODE_SKILLS="$HOME/.zcode/skills"
CONF_DIR="${XDG_CONFIG_HOME:-$HOME/.config}/get-paper"
SOURCE_FILE="$CONF_DIR/source.json"
CRED_FILE="$CONF_DIR/credentials.json"
MODE="install"
NO_GUI="${NO_GUI:-0}"
for _a in "$@"; do
  case "$_a" in
    --no-gui) NO_GUI=1 ;;   # 唯一的无值 flag
    --*) MODE="$_a" ;;      # --check/--reset 等模式
  esac
done
unset _a

say()  { printf '\033[1;32m▸\033[0m %s\n' "$*"; }
warn() { printf '\033[1;33m▸\033[0m %s\n' "$*"; }
die()  { printf '\033[1;31m✗ %s\033[0m\n' "$*"; exit 1; }

OS="$(uname -s)"
HAVE_SECURITY=0; HAVE_SECRET_TOOL=0; GUI=""
[ "$OS" = "Darwin" ] && command -v security >/dev/null 2>&1 && HAVE_SECURITY=1
command -v secret-tool >/dev/null 2>&1 && HAVE_SECRET_TOOL=1
if [ "$NO_GUI" != 1 ]; then
  if [ "$OS" = "Darwin" ]; then GUI="osascript"
  elif command -v zenity >/dev/null 2>&1; then GUI="zenity"
  elif command -v kdialog >/dev/null 2>&1; then GUI="kdialog"
  fi
fi

# ---------- 凭据后端抽象 ----------
cred_write() { # account value
  if [ "$HAVE_SECURITY" = 1 ]; then
    printf '%s' "$2" | security add-generic-password -s get-paper -a "$1" -w -U >/dev/null 2>&1
  elif [ "$HAVE_SECRET_TOOL" = 1 ]; then
    printf %s "$2" | secret-tool store --label="get-paper" service get-paper account "$1" >/dev/null 2>&1
  else
    return 1
  fi
}
cred_read() { # account
  if [ "$HAVE_SECURITY" = 1 ]; then
    security find-generic-password -s get-paper -a "$1" -w 2>/dev/null
  elif [ "$HAVE_SECRET_TOOL" = 1 ]; then
    secret-tool lookup service get-paper account "$1" 2>/dev/null
  else
    return 1
  fi
}
# 与 sso-login.mjs 的读取链一致：source.json → get-paper 条目 → 已有 ECNU SSO 条目 → 明文文件
creds_configured() {
  [ -f "$SOURCE_FILE" ] && return 0
  local u p
  u="$(cred_read username 2>/dev/null)"; p="$(cred_read password 2>/dev/null)"
  [ -n "$u" ] && [ -n "$p" ] && return 0
  if [ "$HAVE_SECURITY" = 1 ]; then
    u="$(security find-generic-password -s 'ECNU SSO Login' -a ecnu_sso -w 2>/dev/null)"
    p="$(security find-generic-password -s 'ECNU SSO Password' -a ecnu_sso_pwd -w 2>/dev/null)"
    [ -n "$u" ] && [ -n "$p" ] && return 0
  fi
  [ -f "$CRED_FILE" ] && return 0
  return 1
}

# ---------- GUI / 终端输入抽象 ----------
ask() { # title prompt [hidden]
  local title="$1" prompt="$2" hidden="${3:-}"
  if [ "$GUI" = "osascript" ]; then
    local h=""; [ "$hidden" = "hidden" ] && h="with hidden answer"
    osascript -e "display dialog \"$prompt\" with title \"$title\" default answer \"\" $h" -e 'text returned of result' 2>/dev/null && return 0
    die "已取消"
  elif [ "$GUI" = "zenity" ]; then
    local e=""; [ "$hidden" = "hidden" ] && e="--hide-text"
    zenity --entry --title "$title" --text "$prompt" $e 2>/dev/null && return 0
    die "已取消"
  elif [ "$GUI" = "kdialog" ]; then
    local e=""; [ "$hidden" = "hidden" ] && e="--password"
    kdialog --inputbox "$title — $prompt" $e 2>/dev/null && return 0
    die "已取消"
  else
    local v; [ "$hidden" = "hidden" ] && { printf '%s' "$prompt" >&2; read -rs v; printf '\n' >&2; } || { printf '%s' "$prompt" >&2; read -r v; }
    printf '%s\n' "$v"
  fi
}
choose() { # prompt item1 item2 ...
  local prompt="$1"; shift
  if [ "$GUI" = "osascript" ]; then
    local list="" item
    for item in "$@"; do list="$list\"$item\","; done
    list="${list%,}"
    osascript -e "choose from list {$list} with prompt \"$prompt\" with title \"get-paper 配置\" default items {\"$1\"}" -e 'item 1 of result as text' 2>/dev/null && return 0
    die "已取消"
  elif [ "$GUI" = "zenity" ]; then
    local item zlist=()
    for item in "$@"; do zlist+=("$item"); done
    zenity --list --title="get-paper 配置" --text="$prompt" --column="选项" --hide-header "${zlist[@]}" 2>/dev/null && return 0
    die "已取消"
  else
    local i=1 item
    printf '%s\n' "$prompt" >&2
    for item in "$@"; do printf '  %d) %s\n' "$i" "$item" >&2; i=$((i+1)); done
    local n sel="" idx=1
    printf '选择编号: ' >&2; read -r n
    for item in "$@"; do [ "$idx" = "$n" ] && sel="$item"; idx=$((idx+1)); done
    printf '%s' "$sel"
  fi
}

# ---------- 已有钥匙串条目扫描（仅 macOS，只读元数据） ----------
scan_existing_mac() {
  security dump-keychain "$HOME/Library/Keychains/login.keychain-db" 2>/dev/null \
    | grep -o '"svce"<blob>="[^"]*\(ecnu\|sso\)[^"]*"' \
    | sed 's/"svce"<blob>="//; s/"$//' | sort -u
}

# ---------- 流程 ----------
configure_credentials() {
  say "配置 ECNU SSO 凭据"
  local existing="" choice
  if [ "$HAVE_SECURITY" = 1 ]; then
    existing="$(scan_existing_mac)"
  fi

  local options=()
  [ -n "$existing" ] && options+=("使用已有的钥匙串条目")
  if [ "$HAVE_SECURITY" = 1 ] || [ "$HAVE_SECRET_TOOL" = 1 ]; then
    options+=("新建 get-paper 专属条目（推荐）")
  fi
  options+=("使用明文文件（跨平台兜底，600 权限）")

  choice="$(choose "选择凭据存储方式：" "${options[@]}")"

  if [ "$choice" = "使用已有的钥匙串条目" ]; then
    local svces=() s
    while IFS= read -r s; do [ -n "$s" ] && svces+=("$s"); done <<< "$existing"
    local svc; svc="$(choose "检测到以下钥匙串条目，选择存有 SSO 学号的一项：" "${svces[@]}")"
    local svc_user="$svc" svc_pass
    # 约定：学号与密码条目名配对（Login/Password 命名惯例）
    svc_pass="${svc_user/Login/Password}"
    mkdir -p "$CONF_DIR"
    printf '{"backend":"keychain","serviceUser":"%s","accountUser":"","servicePass":"%s","accountPass":""}\n' \
      "$svc_user" "$svc_pass" > "$SOURCE_FILE"
    chmod 600 "$SOURCE_FILE"
    say "已记录来源：$svc_user / ${svc_pass}（首次读取会弹授权框，请点「总是允许」）"
    return
  fi

  if [ "$choice" = "新建 get-paper 专属条目（推荐）" ]; then
    local user pass pass2
    user="$(ask "get-paper 配置" "学号/工号：")"
    while :; do
      pass="$(ask "get-paper 配置" "SSO 密码：" hidden)"
      pass2="$(ask "get-paper 配置" "再输入一次确认：" hidden)"
      [ -n "$pass" ] && [ "$pass" = "$pass2" ] && break
      warn "密码为空或不一致，请重试"
    done
    cred_write username "$user" || die "写入系统凭据存储失败"
    cred_write password "$pass" || die "写入系统凭据存储失败"
    unset pass pass2
    rm -f "$SOURCE_FILE"
    [ "$HAVE_SECURITY" = 1 ] && warn "首次读取会弹钥匙串授权框，请点「总是允许」"
    say "已写入系统凭据存储 ✓"
    return
  fi

  # 明文文件
  local user pass
  user="$(ask "get-paper 配置" "学号/工号：")"
  pass="$(ask "get-paper 配置" "SSO 密码：" hidden)"
  mkdir -p "$CONF_DIR"
  # JSON 转义反斜杠与双引号（printf %s 直写，特殊字符密码安全）
  local esc_user esc_pass
  esc_user=$(printf '%s' "$user" | sed 's/\\/\\\\/g; s/"/\\"/g')
  esc_pass=$(printf '%s' "$pass" | sed 's/\\/\\\\/g; s/"/\\"/g')
  printf '{"username":"%s","password":"%s"}\n' "$esc_user" "$esc_pass" > "$CRED_FILE"
  unset esc_user esc_pass
  chmod 600 "$CRED_FILE"
  printf '{"backend":"file"}\n' > "$SOURCE_FILE"
  chmod 600 "$SOURCE_FILE"
  unset user pass
  say "已写入 ${CRED_FILE}（600 权限）✓"
}

configure_api_keys() {
  say "API key 配置（可选，回车跳过）——OpenAlex premium 提高速率上限；Semantic Scholar 解除 100 次/5 分钟限流"
  local keys_dir="$CONF_DIR" keys_file="$CONF_DIR/openalex_keys.txt" s2_file="$CONF_DIR/s2_api_key.txt"
  # OpenAlex key 池（支持多个）
  local keys=() k more
  while :; do
    k="$(ask "OpenAlex API Key" "输入一个 key（留空跳过 OpenAlex 配置）：")"
    [ -n "$k" ] || break
    keys+=("$k")
    more="$(choose "已收 ${#keys[@]} 个 key，继续添加？" "继续添加" "够了")"
    [ "$more" = "继续添加" ] || break
  done
  if [ "${#keys[@]}" -gt 0 ]; then
    mkdir -p "$keys_dir"
    printf '%s\n' "${keys[@]}" > "$keys_file"
    chmod 600 "$keys_file"
    say "已保存 ${#keys[@]} 个 OpenAlex key → ${keys_file}（600 权限）✓"
  fi
  # S2 key（单个）
  local s2k
  s2k="$(ask "Semantic Scholar API Key" "输入 S2 key（留空跳过）：")"
  if [ -n "$s2k" ]; then
    mkdir -p "$keys_dir"
    printf '%s\n' "$s2k" > "$s2_file"
    chmod 600 "$s2_file"
    say "已保存 S2 key → ${s2_file}（600 权限）✓"
  fi
  unset k s2k keys
}

check_all() {
  local store="无"
  [ "$HAVE_SECURITY" = 1 ] && store="macOS Keychain"
  [ "$HAVE_SECRET_TOOL" = 1 ] && store="secret-tool"
  say "运行环境: $OS  GUI: ${GUI:-无(终端)}  安全存储: $store"
  [ -e "$AGENTS_SKILLS/get-paper" ] && say "~/.agents/skills/get-paper: ✓" || warn "~/.agents/skills/get-paper: 未安装"
  [ -e "$ZCODE_SKILLS/get-paper" ] && say "~/.zcode/skills/get-paper: ✓（ZCode）" || warn "~/.zcode/skills/get-paper: 未安装（仅 ZCode 用户需要）"
  creds_configured && say "SSO 凭据: ✓" || warn "SSO 凭据: 未配置"
  [ -f "$SOURCE_FILE" ] && say "凭据来源配置: $(cat "$SOURCE_FILE")"
  [ -f "$CONF_DIR/openalex_keys.txt" ] \
    && say "OpenAlex key: $(grep -c '^[^#]' "$CONF_DIR/openalex_keys.txt" 2>/dev/null || true) 个 ✓" \
    || say "OpenAlex key: 未配置（用礼貌池，速率较低）"
  [ -f "$CONF_DIR/s2_api_key.txt" ] && say "S2 key: ✓" || say "S2 key: 未配置（限流 100 次/5 分钟）"
  return 0
}

remove_credentials() {
  [ "$HAVE_SECURITY" = 1 ] && security delete-generic-password -s get-paper -a username >/dev/null 2>&1
  [ "$HAVE_SECURITY" = 1 ] && security delete-generic-password -s get-paper -a password >/dev/null 2>&1
  [ "$HAVE_SECRET_TOOL" = 1 ] && { secret-tool clear service get-paper account username 2>/dev/null; secret-tool clear service get-paper account password 2>/dev/null; }
  rm -f "$SOURCE_FILE" "$CRED_FILE"
  say "已清除 get-paper 凭据与来源配置 ✓"
}

case "$MODE" in
  --check) check_all ;;
  --remove-credentials) remove_credentials ;;
  --reset) remove_credentials; configure_credentials; check_all ;;
  install)
    say "[1/3] 安装 skill symlink"
    mkdir -p "$AGENTS_SKILLS" "$ZCODE_SKILLS"
    { [ -e "$AGENTS_SKILLS/get-paper" ] || [ -L "$AGENTS_SKILLS/get-paper" ]; } || ln -s "$SKILL_DIR" "$AGENTS_SKILLS/get-paper"
    [ -e "$ZCODE_SKILLS/get-paper" ] || ln -s ../../.agents/skills/get-paper "$ZCODE_SKILLS/get-paper" 2>/dev/null || warn "~/.zcode/skills 跳过（无 ZCode）"
    say "[2/3] 配置凭据"
    creds_configured && say "凭据已配置，跳过（更新请: bash setup.sh --reset）" || configure_credentials
    say "[3/3] API key（可选）"
    [ -f "$CONF_DIR/openalex_keys.txt" ] || [ -f "$CONF_DIR/s2_api_key.txt" ] \
      && say "API key 已配置，跳过" || configure_api_keys
    check_all
    printf '\n%s\n' "完成！以后对 AI 助手说「用 get-paper 下载 <论文 DOI/标题>」即可。"
    ;;
  *) die "未知参数: ${MODE} （可用: --check | --reset | --remove-credentials [--no-gui]）" ;;
esac
