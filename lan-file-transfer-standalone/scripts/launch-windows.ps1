$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $PSScriptRoot
$runtimeDir = Join-Path $root ".runtime"
$transcriptPath = Join-Path $runtimeDir "launcher.log"
$errorPath = Join-Path $runtimeDir "launcher-error.log"
$startScript = Join-Path $PSScriptRoot "start.ps1"

New-Item -ItemType Directory -Force -Path $runtimeDir | Out-Null
Remove-Item -LiteralPath $errorPath -Force -ErrorAction SilentlyContinue

$transcriptStarted = $false
try {
  Start-Transcript -LiteralPath $transcriptPath -Force | Out-Null
  $transcriptStarted = $true
} catch {
  Write-Host "警告：无法创建启动日志，但仍会继续启动。" -ForegroundColor Yellow
}

$exitCode = 0
try {
  & $startScript
} catch {
  $exitCode = 1
  $errorText = $_ | Out-String
  $errorText | Out-File -LiteralPath $errorPath -Encoding UTF8
  Write-Host ""
  Write-Host "启动失败：" -ForegroundColor Red
  Write-Host $_.Exception.Message -ForegroundColor Red
  Write-Host "详细错误：$errorPath" -ForegroundColor Yellow
} finally {
  if ($transcriptStarted) {
    try {
      Stop-Transcript | Out-Null
    } catch {
      $null = $_
    }
  }
}

exit $exitCode
