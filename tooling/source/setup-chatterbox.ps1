# 中文模块说明：工程与 Worker 脚本，负责 开发、清理、构建或发布自动化
param(
  [string]$Python = "",
  [string]$VenvPath = ".venv-chatterbox",
  [switch]$DownloadModel
)

# Resolve the public entry location; runtime/data paths remain unchanged.
$EntryScriptRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot "..\..\scripts"))

$ErrorActionPreference = "Stop"
$Root = Resolve-Path (Join-Path $EntryScriptRoot "..")
$Venv = Join-Path $Root $VenvPath
$Requirements = Join-Path $EntryScriptRoot "chatterbox.lock.txt"
$Worker = Join-Path $EntryScriptRoot "chatterbox-worker.py"

Set-Location -LiteralPath $Root

if (-not $Python) {
  try {
    $Python = (& py -3.12 -c "import sys; print(sys.executable)").Trim()
  } catch {
    throw "Python 3.12 is required. Install it or pass -Python with its python.exe path."
  }
}

& $Python -c "import sys; assert sys.version_info[:2] == (3, 12), 'Chatterbox requires Python 3.12 for the supported runtime'"
if ($LASTEXITCODE -ne 0) { throw "Python 3.12 is required" }

if (-not (Test-Path $Venv)) {
  & $Python -m venv $Venv
  if ($LASTEXITCODE -ne 0) { throw "Unable to create $Venv" }
}

$VenvPython = Join-Path $Venv "Scripts\python.exe"
& $VenvPython -I -c "import sys; assert sys.version_info[:2] == (3, 12), 'Existing environment is not Python 3.12; use a new -VenvPath instead of overwriting it'"
if ($LASTEXITCODE -ne 0) { throw "保留已有环境；请通过 -VenvPath 指定新的 Python 3.12 环境目录。" }
& $VenvPython -m pip install --disable-pip-version-check --upgrade pip
if ($LASTEXITCODE -ne 0) { throw "Unable to upgrade pip" }

& $VenvPython -m pip install --require-hashes --extra-index-url https://download.pytorch.org/whl/cpu -r $Requirements
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
