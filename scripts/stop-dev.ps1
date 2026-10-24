# 中文模块说明：工程与 Worker 脚本，负责 开发、清理、构建或发布自动化
param(
  [switch]$CheckOnly
)

# Public entry: keep named parameters and native exit status.
& (Join-Path $PSScriptRoot "..\tooling\source\stop-dev.ps1") @PSBoundParameters @args
exit $LASTEXITCODE
