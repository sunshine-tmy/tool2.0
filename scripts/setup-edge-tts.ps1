# 中文模块说明：工程与 Worker 脚本，负责 开发、清理、构建或发布自动化
param(
  [string]$Python = "python",
  [string]$VenvPath = ".venv-edge-tts"
)

# Public entry: keep named parameters and native exit status.
& (Join-Path $PSScriptRoot "..\tooling\source\setup-edge-tts.ps1") @PSBoundParameters @args
exit $LASTEXITCODE
