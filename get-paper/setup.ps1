# get-paper Windows 配置脚本
# 用法: powershell -ExecutionPolicy Bypass -File setup.ps1 [-Check] [-Reset] [-RemoveCredentials]
# 凭据以 DPAPI（按当前用户加密）保存到 ~/.config/get-paper/credentials.json.bin，
# 读取端 sso-login.mjs 经 PowerShell 解密，与 setup.sh 的钥匙串方案等效
param(
  [switch]$Check,
  [switch]$Reset,
  [switch]$RemoveCredentials
)

$ErrorActionPreference = "Stop"
Add-Type -AssemblyName System.Security
$SkillDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$ConfDir = Join-Path $HOME ".config\get-paper"
$CredBin = Join-Path $ConfDir "credentials.json.bin"
$CredPlain = Join-Path $ConfDir "credentials.json"
$SkillLinks = @(
  @{ Path = Join-Path $HOME ".agents\skills\get-paper"; Label = "~/.agents/skills/get-paper" },
  @{ Path = Join-Path $HOME ".zcode\skills\get-paper";  Label = "~/.zcode/skills/get-paper" }
)

function Say($msg)  { Write-Host "▸ $msg" -ForegroundColor Green }
function Warn($msg) { Write-Host "▸ $msg" -ForegroundColor Yellow }
function Die($msg)  { Write-Host "✗ $msg" -ForegroundColor Red; exit 1 }

function Test-Credentials {
  (Test-Path $CredBin) -or (Test-Path $CredPlain)
}

function Configure-Credentials {
  Say "配置 ECNU SSO 凭据（DPAPI 按当前用户加密，仅本账户可解密）"
  $user = Read-Host "学号/工号"
  if (-not $user) { Die "学号为空" }
  $pass = Read-Host "SSO 密码" -AsSecureString
  $passPlain = [Runtime.InteropServices.Marshal]::PtrToStringAuto([Runtime.InteropServices.Marshal]::SecureStringToBSTR($pass))
  New-Item -ItemType Directory -Force -Path $ConfDir | Out-Null
  $json = @{ username = $user; password = $passPlain } | ConvertTo-Json -Compress
  $bytes = [Text.Encoding]::UTF8.GetBytes($json)
  $encrypted = [Security.Cryptography.ProtectedData]::Protect($bytes, $null, [Security.Cryptography.DataProtectionScope]::CurrentUser)
  [IO.File]::WriteAllBytes($CredBin, $encrypted)
  Remove-Variable pass, passPlain, json, bytes, encrypted
  Say "凭据已加密保存到 $CredBin"
}

# 目录联接（普通权限可建）指向 skill 目录，AI 助手按惯例到这两个位置发现 skill
function Install-SkillLink {
  foreach ($link in $SkillLinks) {
    if (Test-Path $link.Path) { Say "$($link.Label): 已存在 ✓"; continue }
    New-Item -ItemType Directory -Force -Path (Split-Path -Parent $link.Path) | Out-Null
    New-Item -ItemType Junction -Path $link.Path -Target $SkillDir | Out-Null
    Say "$($link.Label): 已建立目录联接 ✓"
  }
}

function Remove-All {
  Remove-Item $CredBin, $CredPlain -ErrorAction SilentlyContinue
  Say "已清除凭据"
}

function Check-All {
  Say "运行环境: Windows PowerShell $($PSVersionTable.PSVersion)"
  $linked = @($SkillLinks | Where-Object { Test-Path $_.Path }).Count
  Say "skill 目录联接: $linked/$($SkillLinks.Count)（ZCode 只需 .zcode 一项）"
  Say "凭据: $(if (Test-Credentials) { '✓' } else { '未配置' })"
}

if ($RemoveCredentials) { Remove-All; exit 0 }
if ($Check) { Check-All; exit 0 }
if ($Reset) { Remove-All; Install-SkillLink; Configure-Credentials; Check-All; exit 0 }

Say "[1/2] 登记 skill（目录联接）"
Install-SkillLink
Say "[2/2] 配置凭据"
if (Test-Credentials) { Say "凭据已配置（重置请加 -Reset）" } else { Configure-Credentials }
Check-All
Write-Host ""
Say "完成！以后对 AI 助手说「用 get-paper 下载 <论文 DOI/标题>」即可。"
