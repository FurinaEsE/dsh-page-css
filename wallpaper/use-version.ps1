<#
.SYNOPSIS
  切换 dsh-any-background 正在使用的壁纸版本。

.DESCRIPTION
  版本文件在 wallpaper/versions/ 里（见同目录 MANIFEST.md）。
  切换时会先把当前 wallpaper.jpg 备份成 wallpaper-variant-<时间戳>.jpg，
  然后覆盖，最后校验服务端实际吐出的字节与目标一致。

  ⚠️ 壁纸明暗与 schemeOverride 必须成对（浅色壁纸配 auto、深色配 dark），
     否则会出现「字看不清」。详见 MANIFEST.md。

.EXAMPLE
  .\wallpaper\use-version.ps1 -List
  .\wallpaper\use-version.ps1 08
  .\wallpaper\use-version.ps1 08-dark-seamless-2560.jpg
#>
[CmdletBinding()]
param(
  [Parameter(Position = 0)]
  [string]$Version,

  [switch]$List,

  [string]$DataDir = (Join-Path $env:USERPROFILE '.dsh\.dsh-any-background-data'),

  [string]$ServeUrl = 'http://127.0.0.1:19387/dsh-any-background/wallpaper'
)

$ErrorActionPreference = 'Stop'

$versionsDir = Join-Path $PSScriptRoot 'versions'
if (-not (Test-Path $versionsDir)) { throw "找不到版本目录: $versionsDir" }

function Get-Sha([string]$Path, [int]$Len = 12) {
  return (Get-FileHash $Path -Algorithm SHA256).Hash.ToLower().Substring(0, $Len)
}

$all = Get-ChildItem $versionsDir -File | Where-Object { $_.Extension -in '.jpg', '.png' } | Sort-Object Name

if ($List -or [string]::IsNullOrWhiteSpace($Version)) {
  Write-Host "`n可用壁纸版本（$versionsDir）`n" -ForegroundColor Cyan
  $current = Join-Path $DataDir 'wallpaper.jpg'
  $curSha = if (Test-Path $current) { Get-Sha $current } else { '' }
  foreach ($f in $all) {
    $sha = Get-Sha $f.FullName
    $mark = if ($sha -eq $curSha) { ' <- 当前' } else { '' }
    Write-Host ("  {0,-32} {1,9:N0} B  sha {2}{3}" -f $f.Name, $f.Length, $sha, $mark)
  }
  Write-Host "`n用法: .\wallpaper\use-version.ps1 <编号或文件名>`n" -ForegroundColor DarkGray
  return
}

# 允许只写编号（08）或完整文件名
$target = $all | Where-Object { $_.Name -eq $Version } | Select-Object -First 1
if (-not $target) { $target = $all | Where-Object { $_.Name -like "$Version*" } | Select-Object -First 1 }
if (-not $target) { throw "找不到匹配的版本: '$Version'（用 -List 看清单）" }

$dst = Join-Path $DataDir 'wallpaper.jpg'
if (-not (Test-Path $DataDir)) { throw "数据目录不存在: $DataDir" }

# 1. 备份当前
if (Test-Path $dst) {
  $stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
  $bak = Join-Path $DataDir "wallpaper-variant-before-$stamp.jpg"
  Copy-Item -LiteralPath $dst -Destination $bak -Force
  Write-Host ("备份当前  -> {0}  (sha {1})" -f (Split-Path $bak -Leaf), (Get-Sha $dst)) -ForegroundColor DarkGray
}

# 2. 覆盖
Copy-Item -LiteralPath $target.FullName -Destination $dst -Force
$want = Get-Sha $dst
Write-Host ("已安装    -> {0}  ({1:N0} B)  sha {2}" -f $target.Name, $target.Length, $want) -ForegroundColor Green

# 3. 校验服务端
try {
  $tmp = Join-Path $env:TEMP 'use-version-check.bin'
  curl.exe -s -o $tmp --max-time 20 $ServeUrl | Out-Null
  $served = Get-Sha $tmp
  Remove-Item $tmp -Force -ErrorAction SilentlyContinue
  if ($served -eq $want) {
    Write-Host ("服务端    -> sha {0}  匹配 ✓" -f $served) -ForegroundColor Green
  } else {
    Write-Host ("服务端    -> sha {0}  不匹配！期望 {1}" -f $served, $want) -ForegroundColor Red
  }
} catch {
  Write-Host "服务端校验失败（DSH 没在跑？）: $($_.Exception.Message)" -ForegroundColor Yellow
}

Write-Host "`n提醒：浅色壁纸(07)需配 schemeOverride=auto，深色壁纸需配 dark，否则字看不清。" -ForegroundColor Yellow
Write-Host "刷新页面（F5）后生效。`n" -ForegroundColor Yellow
