# 中文模块说明：工程与 Worker 脚本，负责 可复现 standalone 归档、清单、许可证和摘要生成
param(
  [switch]$Preview
)

# Public entry: keep named parameters and native exit status.
& (Join-Path $PSScriptRoot "..\tooling\build\package-source.ps1") @PSBoundParameters @args
exit $LASTEXITCODE
