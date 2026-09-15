param(
  [string]$Python = "python",
  [string]$VenvPath = ".venv-edge-tts"
)

$ErrorActionPreference = "Stop"
$Root = Resolve-Path (Join-Path $PSScriptRoot "..")
$Venv = Join-Path $Root $VenvPath
$Requirements = Join-Path $PSScriptRoot "edge-tts.lock.txt"

Set-Location -LiteralPath $Root
& $Python -c "import sys; assert sys.version_info[:2] == (3, 11), 'Python 3.11 is required'"
if ($LASTEXITCODE -ne 0) { throw "Python 3.11 is required" }

if (-not (Test-Path $Venv)) {
  & $Python -m venv $Venv
  if ($LASTEXITCODE -ne 0) { throw "Unable to create $Venv" }
}

$VenvPython = Join-Path $Venv "Scripts\python.exe"
& $VenvPython -m pip install --disable-pip-version-check --require-hashes -r $Requirements
if ($LASTEXITCODE -ne 0) { throw "Unable to install Edge-TTS dependencies" }

& $VenvPython (Join-Path $PSScriptRoot "edge-tts-generate.py") check
if ($LASTEXITCODE -ne 0) { throw "Edge-TTS runtime check failed" }

Write-Host "Edge-TTS environment ready: $VenvPython" -ForegroundColor Green
