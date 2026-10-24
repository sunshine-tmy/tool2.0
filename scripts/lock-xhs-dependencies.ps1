# 中文模块说明：从固定源码归档的 uv.lock 与固定翻译 requirements 生成带哈希的 Windows x64 wheel 锁。
param(
  [string]$SourceArchive = "",
  [string]$PythonExecutable = "",
  [string]$PythonVersion = "3.12",
  [string]$PythonPlatform = "x86_64-pc-windows-msvc"
)

# Public entry: keep named parameters and native exit status.
& (Join-Path $PSScriptRoot "..\tooling\components\lock-xhs-dependencies.ps1") @PSBoundParameters @args
exit $LASTEXITCODE
