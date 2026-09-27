# 中文模块说明：工程与 Worker 脚本，负责 本地 AI/翻译/配音 Worker 协议和进程服务
param(
  [string]$PythonVersion = "3.11",
  [string]$PythonPlatform = "x86_64-pc-windows-msvc"
)

$ErrorActionPreference = "Stop"
$Root = Resolve-Path (Join-Path $PSScriptRoot "..")
$env:UV_CACHE_DIR = Join-Path $Root ".package\uv-lock-cache"
$PythonCandidates = @(
  (Join-Path $Root ".package\stage\python-311\python\python.exe"),
  (Join-Path $Root ".venv-chatterbox\Scripts\python.exe")
)
$PythonExecutable = $PythonCandidates | Where-Object { Test-Path -LiteralPath $_ -PathType Leaf } | Select-Object -First 1
if (-not $PythonExecutable) {
  $SystemPython = Get-Command python.exe -ErrorAction SilentlyContinue
  if ($SystemPython) {
    $SystemPythonVersion = & $SystemPython.Source -c "import sys; print(f'{sys.version_info.major}.{sys.version_info.minor}')"
    if ($LASTEXITCODE -eq 0 -and $SystemPythonVersion.Trim() -eq $PythonVersion) {
      $PythonExecutable = $SystemPython.Source
    }
  }
}
if (-not $PythonExecutable) {
  throw "锁定 Worker 依赖需要 Python 3.11；先准备 .package\stage\python-311 或 .venv-chatterbox。"
}

if (-not (Get-Command uv -ErrorAction SilentlyContinue)) {
  throw "uv is required to regenerate Worker locks: https://docs.astral.sh/uv/"
}

$Locks = @(
  @{ Input = "edge-tts-requirements.txt"; Output = "edge-tts.lock.txt"; Torch = $null },
  @{ Input = "video-transcribe-requirements.txt"; Output = "video-transcribe.lock.txt"; Torch = $null },
  # Stage 5 ships CPU packages first. CUDA variants are separate capabilities and
  # must not leak into the baseline lock or inflate the default installer.
  @{ Input = "chatterbox-requirements.txt"; Output = "chatterbox.lock.txt"; Torch = "cpu" },
  @{ Input = "chatterbox-cuda-requirements.txt"; Output = "chatterbox-cuda.lock.txt"; Torch = "cu124" },
  @{ Input = "image-ai-requirements.txt"; Output = "image-ai.lock.txt"; Torch = "cpu" }
)

foreach ($Lock in $Locks) {
  $Arguments = @(
    "pip", "compile",
    (Join-Path $PSScriptRoot $Lock.Input),
    "--python", $PythonExecutable,
    "--python-version", $PythonVersion,
    "--python-platform", $PythonPlatform,
    "--generate-hashes",
    "--custom-compile-command", "pnpm lock:python",
    "--output-file", (Join-Path $PSScriptRoot $Lock.Output),
    "--quiet"
  )
  if ($Lock.Torch) {
    $Arguments += @("--torch-backend", $Lock.Torch)
  }

  Write-Host "Locking $($Lock.Input) for Python $PythonVersion / $PythonPlatform..." -ForegroundColor Cyan
  & uv @Arguments
  if ($LASTEXITCODE -ne 0) { throw "Unable to generate $($Lock.Output)" }
}

Write-Host "Worker dependency locks are up to date." -ForegroundColor Green
