param(
  [string]$Python = "",
  [string]$VenvPath = ".venv-chatterbox",
  [switch]$DownloadModel
)

$ErrorActionPreference = "Stop"
$Root = Resolve-Path (Join-Path $PSScriptRoot "..")
$Venv = Join-Path $Root $VenvPath
$Requirements = Join-Path $PSScriptRoot "chatterbox-requirements.txt"
$Worker = Join-Path $PSScriptRoot "chatterbox-worker.py"

Set-Location -LiteralPath $Root

if (-not $Python) {
  try {
    $Python = (& py -3.11 -c "import sys; print(sys.executable)").Trim()
  } catch {
    throw "Python 3.11 is required. Install it or pass -Python with its python.exe path."
  }
}

& $Python -c "import sys; assert sys.version_info[:2] == (3, 11), 'Chatterbox requires Python 3.11 for the supported runtime'"
if ($LASTEXITCODE -ne 0) { throw "Python 3.11 is required" }

if (-not (Test-Path $Venv)) {
  & $Python -m venv $Venv
  if ($LASTEXITCODE -ne 0) { throw "Unable to create $Venv" }
}

$VenvPython = Join-Path $Venv "Scripts\python.exe"
& $VenvPython -m pip install --disable-pip-version-check --upgrade pip
if ($LASTEXITCODE -ne 0) { throw "Unable to upgrade pip" }

# The official package pins Torch 2.6. Install the matching CUDA 12.4 wheels
# explicitly so Windows does not silently end up with a CPU-only runtime.
& $VenvPython -m pip install torch==2.6.0 torchaudio==2.6.0 --index-url https://download.pytorch.org/whl/cu124
if ($LASTEXITCODE -ne 0) { throw "Unable to install the Chatterbox PyTorch runtime" }

& $VenvPython -m pip install -r $Requirements
if ($LASTEXITCODE -ne 0) { throw "Unable to install Chatterbox dependencies" }

# The current 0.1.7 PyPI wheel predates the V3 loader argument. Install the
# official V3 source at a pinned commit without resolving its optional UI
# dependencies again (the compatible runtime was installed above).
$ChatterboxV3Source = "git+https://github.com/resemble-ai/chatterbox.git@65b18437192794391a0308a8f705b1e33e633948"
& $VenvPython -m pip install --no-deps --force-reinstall $ChatterboxV3Source
if ($LASTEXITCODE -ne 0) { throw "Unable to install the official Chatterbox V3 source" }

& $VenvPython $Worker --check
if ($LASTEXITCODE -ne 0) { throw "Chatterbox runtime check failed" }

if ($DownloadModel) {
  Write-Host "Downloading and loading Chatterbox Multilingual V3 model..." -ForegroundColor Cyan
  & $VenvPython $Worker --preload
  if ($LASTEXITCODE -ne 0) { throw "Chatterbox V3 model download failed" }
}

Write-Host "Chatterbox environment ready: $VenvPython" -ForegroundColor Green
