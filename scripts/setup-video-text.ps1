param(
  [string]$Python = "python",
  [string]$VenvPath = ".venv-video-text"
)

$ErrorActionPreference = "Stop"
$Root = Resolve-Path (Join-Path $PSScriptRoot "..")
$Venv = Join-Path $Root $VenvPath
$Requirements = Join-Path $PSScriptRoot "video-transcribe.lock.txt"

Set-Location -LiteralPath $Root
& $Python -c "import sys; assert sys.version_info[:2] == (3, 11), 'Python 3.11 is required'"
if ($LASTEXITCODE -ne 0) { throw "Python 3.11 is required" }

if (-not (Test-Path $Venv)) {
  & $Python -m venv $Venv
  if ($LASTEXITCODE -ne 0) { throw "Unable to create $Venv" }
}

$VenvPython = Join-Path $Venv "Scripts\python.exe"
& $VenvPython -m pip install --upgrade pip
if ($LASTEXITCODE -ne 0) { throw "Unable to upgrade pip" }
& $VenvPython -m pip install --require-hashes -r $Requirements
if ($LASTEXITCODE -ne 0) { throw "Unable to install video transcription dependencies" }

Write-Host "Video transcription environment ready: $VenvPython" -ForegroundColor Green
Write-Host "Configure VIDEO_TEXT_TRANSCRIBE_COMMAND as documented in .env.example." -ForegroundColor Green
