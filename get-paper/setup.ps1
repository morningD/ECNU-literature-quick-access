# get-paper Windows 配置脚本（实验性）
# 用法: powershell -ExecutionPolicy Bypass -File setup.ps1 [-Check] [-Reset] [-RemoveCredentials]
param(
  [switch]$Check,
  [switch]$Reset,
  [switch]$RemoveCredentials
)

$ErrorActionPreference = "Stop"
$SkillDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$ConfDir = Join-Path $env:APPDATA "get-paper"
$CredFile = Join-Path $ConfDir "credentials.json"
$SourceFile = Join-Path $ConfDir "source.json"

function Say($msg)  { Write-Host "▸ $msg" -ForegroundColor Green }
function Warn($msg) { Write-Host "▸ $msg" -ForegroundColor Yellow }
function Die($msg)  { Write-Host "✗ $msg" -ForegroundColor Red; exit 1 }

function Test-Credentials {
  (Test-Path $SourceFile) -or (Test-Path $CredFile)
}

function Configure-Credentials {
  Say "配置 ECNU SSO 凭据（Windows 版存为本地加密文件；凭据管理器集成待后续版本）"
  $user = Read-Host "学号/工号"
  if (-not $user) { Die "学号为空" }
  $pass = Read-Host "SSO 密码" -AsSecureString
  $passPlain = [Runtime.InteropServices.Marshal]::PtrToStringAuto([Runtime.InteropServices.Marshal]::SecureStringToBSTR($pass))
  New-Item -ItemType Directory -Force -Path $ConfDir | Out-Null
  @{ username = $user; password = $passPlain } | ConvertTo-Json | Set-Content -Path $CredFile
  @{ backend = "file" } | ConvertTo-Json | Set-Content -Path $SourceFile
  # DPAPI 按当前用户加密（同一用户下自动解密，跨用户不可读）
  $bytes = [IO.File]::ReadAllBytes($CredFile)
  $encrypted = [Security.Cryptography.ProtectedData]::Protect($bytes, $null, [Security.Cryptography.DataProtectionScope]::CurrentUser)
  [IO.File]::WriteAllBytes("$CredFile.bin", $encrypted)
  Remove-Item $CredFile
  Say "凭据已加密保存到 $CredFile.bin（仅当前 Windows 用户可解密）"
}

function Remove-All {
  Remove-Item $CredFile, "$CredFile.bin", $SourceFile -ErrorAction SilentlyContinue
  Say "已清除凭据"
}

function Check-All {
  Say "运行环境: Windows"
  Say "凭据: $(if (Test-Credentials) { '✓' } else { '未配置' })"
}

if ($RemoveCredentials) { Remove-All; exit 0 }
if ($Check) { Check-All; exit 0 }
if ($Reset) { Remove-All; Configure-Credentials; Check-All; exit 0 }

Say "[1/2] skill 已位于 $SkillDir（Windows 下暂无全局 symlink 机制，请让 AI 助手直接使用该路径）"
Say "[2/2] 配置凭据"
if (Test-Credentials) { Say "凭据已配置（重置请加 -Reset）" } else { Configure-Credentials }
Check-All
Write-Host ""
Say "完成！以后对 AI 助手说「用 get-paper 下载 <论文 DOI/标题>」即可。"
