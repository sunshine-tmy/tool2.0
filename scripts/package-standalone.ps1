# 中文模块说明：工程与 Worker 脚本，负责 可复现 standalone 归档、清单、许可证和摘要生成
param(
  [ValidateSet("windows", "macos")]
  [string]$Platform = "windows",
  [switch]$Preview,
  [switch]$SkipPythonInstaller
)

# Public entry: keep named parameters and native exit status.
& (Join-Path $PSScriptRoot "..\tooling\build\package-standalone.ps1") @PSBoundParameters @args
exit $LASTEXITCODE
