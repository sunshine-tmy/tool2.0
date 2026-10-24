# 中文模块说明：工程与 Worker 脚本，负责 开发、清理、构建或发布自动化
param(
  [string]$Python = "python",
  [string]$VenvPath = ".venv-image-ai",
  [switch]$SkipModels
)

# Resolve the public entry location; runtime/data paths remain unchanged.
$EntryScriptRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot "..\..\scripts"))

$ErrorActionPreference = "Stop"
$Root = Resolve-Path (Join-Path $EntryScriptRoot "..")
$Venv = Join-Path $Root $VenvPath
$Models = Join-Path $Root "models\image-ai"
$LamaModel = Join-Path $Models "torch\hub\checkpoints\big-lama.pt"

$PythonCommand = Get-Command $Python -ErrorAction SilentlyContinue
if (-not $PythonCommand) {
  throw "Python 3.12 was not found. Install it, then pass its python.exe path with -Python."
}
$PythonVersion = & $PythonCommand.Source -c "import sys; print(f'{sys.version_info.major}.{sys.version_info.minor}')"
if ($PythonVersion -ne "3.12") {
  throw "Image AI requires Python 3.12 for the pinned CPU dependencies; found Python $PythonVersion. Pass a Python 3.12 python.exe path with -Python."
}

Write-Host "Creating isolated Python 3.12 environment..." -ForegroundColor Cyan
$VenvPython = Join-Path $Venv "Scripts\python.exe"
if (Test-Path -LiteralPath $Venv) {
  & $VenvPython -I -c "import sys; assert sys.version_info[:2] == (3, 12), 'Existing environment is not Python 3.12; use a new -VenvPath instead of overwriting it'"
  if ($LASTEXITCODE -ne 0) { throw "保留已有环境；请通过 -VenvPath 指定新的 Python 3.12 环境目录。" }
} else {
  & $PythonCommand.Source -m venv $Venv
  if ($LASTEXITCODE -ne 0) { throw "Unable to create $Venv" }
}
& $VenvPython -m pip install --upgrade pip wheel setuptools

Write-Host "Installing hash-locked CPU and inference dependencies..." -ForegroundColor Cyan
& $VenvPython -m pip install --require-hashes --extra-index-url https://download.pytorch.org/whl/cpu -r (Join-Path $EntryScriptRoot "image-ai.lock.txt")
if ($LASTEXITCODE -ne 0) { throw "Unable to install Image AI dependencies" }

New-Item -ItemType Directory -Path $Models -Force | Out-Null
$env:TORCH_HOME = Join-Path $Models "torch"
$env:U2NET_HOME = Join-Path $Models "rembg"
if (-not $SkipModels) {
  Write-Host "Downloading official Real-ESRGAN weights..." -ForegroundColor Cyan
  Invoke-WebRequest -Uri "https://github.com/xinntao/Real-ESRGAN/releases/download/v0.2.1/RealESRGAN_x2plus.pth" -OutFile (Join-Path $Models "RealESRGAN_x2plus.pth")
  Invoke-WebRequest -Uri "https://github.com/xinntao/Real-ESRGAN/releases/download/v0.1.0/RealESRGAN_x4plus.pth" -OutFile (Join-Path $Models "RealESRGAN_x4plus.pth")

  Write-Host "Downloading and verifying Big-LaMa weights..." -ForegroundColor Cyan
  & (Join-Path $EntryScriptRoot "download-fixed-model-file.ps1") `
    -Url "https://github.com/enesmsahin/simple-lama-inpainting/releases/download/v0.1.0/big-lama.pt" `
    -Destination $LamaModel `
    -ExpectedSha256 "7ba7aa7ac37a4d41fdbbeba3a2af7ead18058552997e3a3cd1a3b2210c9e6b4c"

  Write-Host "Preloading BiRefNet through rembg..." -ForegroundColor Cyan
  & $VenvPython -c "from rembg import new_session; new_session('birefnet-general'); print('BiRefNet ready')"

  Write-Host "Preloading PaddleOCR PP-OCRv5 detection models..." -ForegroundColor Cyan
  & $VenvPython -c "from paddleocr import PaddleOCR; PaddleOCR(lang='ch', device='cpu', use_doc_orientation_classify=False, use_doc_unwarping=False, use_textline_orientation=False); print('PaddleOCR ready')"
}

Write-Host "Image AI runtime is ready." -ForegroundColor Green
Write-Host "Worker command: $VenvPython $EntryScriptRoot\image-ai-worker.py"
Write-Host "Optional BRIA RMBG 2.0 weights are not included by this setup script. Set IMAGE_AI_BRIA_MODEL_DIR to a local model directory to enable the provider; otherwise the worker uses BiRefNet." -ForegroundColor Yellow
