param(
  [string]$Python = "python",
  [string]$ProgressPath,
  [switch]$SkipModels
)

$ErrorActionPreference = "Stop"
$Root = Resolve-Path (Join-Path $PSScriptRoot "..")
$Venv = Join-Path $Root ".venv-image-ai"
$Models = Join-Path $Root "models\image-ai"
$ReadyMarker = Join-Path $Venv ".ready"
if ([string]::IsNullOrWhiteSpace($ProgressPath)) {
  $ProgressPath = Join-Path $Root ".runtime\image-ai-install-progress.json"
}
$InstallStartedAt = if ($env:IMAGE_AI_INSTALL_STARTED_AT) {
  $env:IMAGE_AI_INSTALL_STARTED_AT
} else {
  [DateTime]::UtcNow.ToString("o")
}

function Write-InstallProgress {
  param(
    [string]$Stage,
    [int]$Progress,
    [string]$Message
  )

  $directory = Split-Path -Parent $ProgressPath
  New-Item -ItemType Directory -Path $directory -Force | Out-Null
  $value = @{
    stage = $Stage
    progress = $Progress
    message = $Message
    startedAt = $InstallStartedAt
    updatedAt = [DateTime]::UtcNow.ToString("o")
  } | ConvertTo-Json
  [System.IO.File]::WriteAllText($ProgressPath, $value, [System.Text.UTF8Encoding]::new($false))
}

$PythonCommand = Get-Command $Python -ErrorAction SilentlyContinue
if ($PythonCommand) {
  $PythonExecutable = $PythonCommand.Source
} else {
  $PythonExecutable = $null
}
$PythonVersion = if ($PythonExecutable) {
  & $PythonExecutable -c "import sys; print(f'{sys.version_info.major}.{sys.version_info.minor}')"
} else { "" }
if ($PythonVersion -ne "3.11" -and (Get-Command py.exe -ErrorAction SilentlyContinue)) {
  $DetectedPython = & py.exe -3.11 -c "import sys; print(sys.executable)" 2>$null
  if ($LASTEXITCODE -eq 0 -and $DetectedPython) {
    $PythonExecutable = ([string]$DetectedPython).Trim()
    $PythonVersion = & $PythonExecutable -c "import sys; print(f'{sys.version_info.major}.{sys.version_info.minor}')"
  }
}
if ($PythonVersion -ne "3.11") {
  throw "Image AI requires Python 3.11. Run the bundled python-3.11.9-amd64.exe, then start this project again."
}

Write-InstallProgress "environment" 10 "正在创建独立 Python 运行环境"
Write-Host "Creating isolated Python 3.11 environment..." -ForegroundColor Cyan
if (Test-Path -LiteralPath $ReadyMarker) { Remove-Item -LiteralPath $ReadyMarker -Force }
& $PythonExecutable -m venv $Venv
if ($LASTEXITCODE -ne 0) { throw "Creating the Python environment failed." }
$VenvPython = Join-Path $Venv "Scripts\python.exe"
Write-InstallProgress "environment" 15 "正在更新 Python 安装工具"
& $VenvPython -m pip install --upgrade pip wheel setuptools
if ($LASTEXITCODE -ne 0) { throw "Updating pip failed." }

$HasNvidia = $false
$NvidiaSmi = Get-Command nvidia-smi.exe -ErrorAction SilentlyContinue
if ($NvidiaSmi) {
  & $NvidiaSmi.Source 2>$null | Out-Null
  $HasNvidia = $LASTEXITCODE -eq 0
}
if ($HasNvidia) {
  Write-InstallProgress "pytorch" 20 "检测到 NVIDIA 显卡，正在安装 CUDA 版 PyTorch"
  Write-Host "NVIDIA GPU detected. Installing CUDA-enabled PyTorch..." -ForegroundColor Cyan
  & $VenvPython -m pip install torch==2.6.0 torchvision==0.21.0 --index-url https://download.pytorch.org/whl/cu124
  $Requirements = Join-Path $PSScriptRoot "image-ai-requirements-windows.txt"
} else {
  Write-InstallProgress "pytorch" 20 "正在安装 CPU 版 PyTorch"
  Write-Host "No NVIDIA GPU detected. Installing CPU-compatible PyTorch..." -ForegroundColor Cyan
  & $VenvPython -m pip install torch==2.6.0 torchvision==0.21.0
  $Requirements = Join-Path $PSScriptRoot "image-ai-requirements-windows-cpu.txt"
}
if ($LASTEXITCODE -ne 0) { throw "Installing PyTorch failed." }
Write-InstallProgress "dependencies" 38 "正在安装图片 AI 推理依赖"
& $VenvPython -m pip install -r $Requirements
if ($LASTEXITCODE -ne 0) { throw "Installing AI inference dependencies failed." }

New-Item -ItemType Directory -Path $Models -Force | Out-Null
$env:TORCH_HOME = Join-Path $Models "torch"
$env:U2NET_HOME = Join-Path $Models "rembg"
if (-not $SkipModels) {
  Write-InstallProgress "model-weights" 58 "正在下载 Real-ESRGAN 清晰化模型"
  Write-Host "Downloading official Real-ESRGAN weights..." -ForegroundColor Cyan
  Invoke-WebRequest -Uri "https://github.com/xinntao/Real-ESRGAN/releases/download/v0.2.1/RealESRGAN_x2plus.pth" -OutFile (Join-Path $Models "RealESRGAN_x2plus.pth")
  Invoke-WebRequest -Uri "https://github.com/xinntao/Real-ESRGAN/releases/download/v0.1.0/RealESRGAN_x4plus.pth" -OutFile (Join-Path $Models "RealESRGAN_x4plus.pth")

  Write-InstallProgress "birefnet" 68 "正在下载并预加载 BiRefNet 抠图模型"
  Write-Host "Preloading BiRefNet through rembg..." -ForegroundColor Cyan
  & $VenvPython -c "from rembg import new_session; new_session('birefnet-general'); print('BiRefNet ready')"
  if ($LASTEXITCODE -ne 0) { throw "Preloading BiRefNet failed." }

  Write-InstallProgress "lama" 78 "正在下载并预加载 LaMa 去水印模型"
  Write-Host "Preloading the Apache-licensed LaMa weights..." -ForegroundColor Cyan
  & $VenvPython -c "from simple_lama_inpainting import SimpleLama; SimpleLama(); print('LaMa ready')"
  if ($LASTEXITCODE -ne 0) { throw "Preloading LaMa failed." }

  Write-InstallProgress "ocr" 88 "正在下载并预加载 PaddleOCR 检测模型"
  Write-Host "Preloading PaddleOCR PP-OCRv5 detection models..." -ForegroundColor Cyan
  & $VenvPython -c "from paddleocr import PaddleOCR; PaddleOCR(lang='ch', device='cpu', use_doc_orientation_classify=False, use_doc_unwarping=False, use_textline_orientation=False); print('PaddleOCR ready')"
  if ($LASTEXITCODE -ne 0) { throw "Preloading the AI models failed." }
  Write-InstallProgress "finalizing" 97 "正在完成环境校验和写入配置"
  Set-Content -LiteralPath $ReadyMarker -Value "ready" -Encoding ASCII
}

if (-not $SkipModels) {
  Write-InstallProgress "completed" 100 "AI 图片处理环境安装完成"
}
Write-Host "Image AI runtime is ready." -ForegroundColor Green
Write-Host "Worker command: $VenvPython $PSScriptRoot\image-ai-worker.py"
Write-Host "BRIA RMBG 2.0 is not downloaded automatically because its license requires explicit acceptance." -ForegroundColor Yellow
