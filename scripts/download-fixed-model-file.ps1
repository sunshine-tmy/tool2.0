# 中文模块说明：工程与 Worker 脚本，负责 开发、清理、构建或发布自动化
param(
  [Parameter(Mandatory = $true)]
  [string]$Url,

  [Parameter(Mandatory = $true)]
  [string]$Destination,

  [string]$ExpectedSha256 = ""
)

# Public entry: keep named parameters and native exit status.
& (Join-Path $PSScriptRoot "..\tooling\components\download-fixed-model-file.ps1") @PSBoundParameters @args
exit $LASTEXITCODE
