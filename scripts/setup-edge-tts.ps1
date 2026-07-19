param(
  [string]$Python = "python",
  [string]$VenvPath = ".venv-edge-tts"
)

$ErrorActionPreference = "Stop"
$Root = Resolve-Path (Join-Path $PSScriptRoot "..")
$Venv = Join-Path $Root $VenvPath
$Requirements = Join-Path $PSScriptRoot "edge-tts-requirements.txt"

Set-Location -LiteralPath $Root
& $Python -c "import sys; assert (3, 10) <= sys.version_info[:2] < (3, 14), 'Python 3.10-3.13 is required'"
if ($LASTEXITCODE -ne 0) { throw "Unsupported Python runtime" }

if (-not (Test-Path $Venv)) {
  & $Python -m venv $Venv
  if ($LASTEXITCODE -ne 0) { throw "Unable to create $Venv" }
}

$VenvPython = Join-Path $Venv "Scripts\python.exe"
& $VenvPython -m pip install --disable-pip-version-check -r $Requirements
if ($LASTEXITCODE -ne 0) { throw "Unable to install Edge-TTS dependencies" }

& $VenvPython (Join-Path $PSScriptRoot "edge-tts-generate.py") check
if ($LASTEXITCODE -ne 0) { throw "Edge-TTS runtime check failed" }

Write-Host "Edge-TTS environment ready: $VenvPython" -ForegroundColor Green
