$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $PSScriptRoot
$pidFile = Join-Path $root ".runtime\services.pid"
$aiPidFile = Join-Path $root ".runtime\image-ai.pid"

if (-not (Test-Path -LiteralPath $pidFile) -and -not (Test-Path -LiteralPath $aiPidFile)) {
  Write-Host "No running-service record was found." -ForegroundColor Yellow
  exit 0
} 

foreach ($record in @($pidFile, $aiPidFile)) {
  if (-not (Test-Path -LiteralPath $record)) { continue }
  $processId = [int](Get-Content -LiteralPath $record -Raw)
  if (Get-Process -Id $processId -ErrorAction SilentlyContinue) {
    & taskkill.exe /PID $processId /T /F 2>$null | Out-Null
  }
  Remove-Item -LiteralPath $record -Force -ErrorAction SilentlyContinue
}

Write-Host "Frontend, backend and image AI services have stopped." -ForegroundColor Green
