# 中文模块说明：工程与 Worker 脚本，负责 本地 AI/翻译/配音 Worker 协议和进程服务
param(
  [ValidateSet("3.12")][string]$PythonVersion = "3.12",
  [string]$PythonPlatform = "x86_64-pc-windows-msvc",
  [string]$Python = "",
  [string]$Uv = "uv",
  [switch]$PreserveVersions,
  [string]$OutputDirectory = $PSScriptRoot
)

$ErrorActionPreference = "Stop"
$Root = Resolve-Path (Join-Path $PSScriptRoot "..")
$env:UV_CACHE_DIR = Join-Path $Root ".package\uv-lock-cache"
$PythonCandidates = @(
  $Python,
  (Join-Path $Root ".package\stage\python-312\python\python.exe")
)
$PythonExecutable = $null
foreach ($Candidate in $PythonCandidates) {
  if ($Candidate -and (Test-Path -LiteralPath $Candidate -PathType Leaf)) {
    $CandidateVersion = & $Candidate -I -c "import sys; print(f'{sys.version_info.major}.{sys.version_info.minor}')"
    if ($LASTEXITCODE -eq 0 -and $CandidateVersion.Trim() -eq $PythonVersion) {
      $PythonExecutable = $Candidate
      break
    }
    if ($Python) { throw "指定的 Python 版本不匹配：需要 $PythonVersion" }
  }
}
if ($Python -and -not $PythonExecutable) { throw "指定的 Python 不存在：$Python" }
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
  throw "锁定 Worker 依赖需要 Python 3.12；先准备 .package\stage\python-312 或通过 -Python 指定路径。"
}

if (-not (Get-Command $Uv -ErrorAction SilentlyContinue)) {
  throw "uv is required to regenerate Worker locks: https://docs.astral.sh/uv/"
}

$Locks = @(
  @{ Input = "edge-tts-requirements.txt"; Output = "edge-tts.lock.txt"; Torch = $null },
  # Stage 5 ships CPU packages first. CUDA variants are separate capabilities and
  # must not leak into the baseline lock or inflate the default installer.
  @{ Input = "chatterbox-requirements.txt"; Output = "chatterbox.lock.txt"; Torch = "cpu" },
  @{ Input = "chatterbox-cuda-requirements.txt"; Output = "chatterbox-cuda.lock.txt"; Torch = "cu124" },
  @{ Input = "image-ai-requirements.txt"; Output = "image-ai.lock.txt"; Torch = "cpu" }
)

$OutputDirectory = [System.IO.Path]::GetFullPath($OutputDirectory)
New-Item -ItemType Directory -Path $OutputDirectory -Force | Out-Null
foreach ($Lock in $Locks) {
  $Arguments = @(
    "pip", "compile",
    (Join-Path $PSScriptRoot $Lock.Input),
    "--python", $PythonExecutable,
    "--python-version", $PythonVersion,
    "--python-platform", $PythonPlatform,
    "--generate-hashes",
    "--custom-compile-command", "pnpm lock:python",
    "--output-file", (Join-Path $OutputDirectory $Lock.Output),
    "--quiet"
  )
  # Interpreter-only migrations keep reviewed versions. Normal dependency
  # maintenance may change direct pins without conflicting with the old lock.
  if ($PreserveVersions) {
    $Arguments += @("--constraint", (Join-Path $PSScriptRoot $Lock.Output))
  }
  if ($Lock.Torch) {
    $Arguments += @("--torch-backend", $Lock.Torch)
  }

  Write-Host "Locking $($Lock.Input) for Python $PythonVersion / $PythonPlatform..." -ForegroundColor Cyan
  & $Uv @Arguments
  if ($LASTEXITCODE -ne 0) { throw "Unable to generate $($Lock.Output)" }
}

Write-Host "Worker dependency locks are up to date." -ForegroundColor Green
