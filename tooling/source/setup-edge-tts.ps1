# 中文模块说明：工程与 Worker 脚本，负责 开发、清理、构建或发布自动化
param(
  [string]$Python = "python",
  [string]$VenvPath = ".venv-edge-tts"
)

# Resolve the public entry location; runtime/data paths remain unchanged.
$EntryScriptRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot "..\..\scripts"))

$ErrorActionPreference = "Stop"
$Root = Resolve-Path (Join-Path $EntryScriptRoot "..")
$Venv = Join-Path $Root $VenvPath
$Requirements = Join-Path $EntryScriptRoot "edge-tts.lock.txt"

Set-Location -LiteralPath $Root
& $Python -c "import sys; assert sys.version_info[:2] == (3, 12), 'Python 3.12 is required'"
if ($LASTEXITCODE -ne 0) { throw "Python 3.12 is required" }

if (-not (Test-Path $Venv)) {
  & $Python -m venv $Venv
  if ($LASTEXITCODE -ne 0) { throw "Unable to create $Venv" }
}

$VenvPython = Join-Path $Venv "Scripts\python.exe"
& $VenvPython -I -c "import sys; assert sys.version_info[:2] == (3, 12), 'Existing environment is not Python 3.12; use a new -VenvPath instead of overwriting it'"
if ($LASTEXITCODE -ne 0) { throw "保留已有环境；请通过 -VenvPath 指定新的 Python 3.12 环境目录。" }
& $VenvPython -m pip install --disable-pip-version-check --require-hashes -r $Requirements
if ($LASTEXITCODE -ne 0) { throw "Unable to install Edge-TTS dependencies" }

& $VenvPython (Join-Path $EntryScriptRoot "edge-tts-generate.py") check
if ($LASTEXITCODE -ne 0) { throw "Edge-TTS runtime check failed" }

Write-Host "Edge-TTS environment ready: $VenvPython" -ForegroundColor Green
