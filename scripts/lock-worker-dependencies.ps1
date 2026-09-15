# 中文模块说明：工程与 Worker 脚本，负责 本地 AI/翻译/配音 Worker 协议和进程服务
param(
  [string]$PythonVersion = "3.11",
  [string]$PythonPlatform = "x86_64-pc-windows-msvc"
)

$ErrorActionPreference = "Stop"
$Root = Resolve-Path (Join-Path $PSScriptRoot "..")
$env:UV_CACHE_DIR = Join-Path $Root ".package\uv-lock-cache"

if (-not (Get-Command uv -ErrorAction SilentlyContinue)) {
  throw "uv is required to regenerate Worker locks: https://docs.astral.sh/uv/"
}

$Locks = @(
  @{ Input = "edge-tts-requirements.txt"; Output = "edge-tts.lock.txt"; Torch = $null },
  @{ Input = "video-transcribe-requirements.txt"; Output = "video-transcribe.lock.txt"; Torch = $null },
  @{ Input = "chatterbox-requirements.txt"; Output = "chatterbox.lock.txt"; Torch = "cu124" },
  @{ Input = "image-ai-requirements.txt"; Output = "image-ai.lock.txt"; Torch = "cu124" }
)

foreach ($Lock in $Locks) {
  $Arguments = @(
    "pip", "compile",
    (Join-Path $PSScriptRoot $Lock.Input),
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
