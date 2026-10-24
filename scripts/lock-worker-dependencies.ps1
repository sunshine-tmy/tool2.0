# 中文模块说明：工程与 Worker 脚本，负责 本地 AI/翻译/配音 Worker 协议和进程服务
param(
  [ValidateSet("3.12")][string]$PythonVersion = "3.12",
  [string]$PythonPlatform = "x86_64-pc-windows-msvc",
  [string]$Python = "",
  [string]$Uv = "uv",
  [switch]$PreserveVersions,
  [string]$OutputDirectory = $PSScriptRoot
)

# Public entry: keep named parameters and native exit status.
& (Join-Path $PSScriptRoot "..\tooling\components\lock-worker-dependencies.ps1") @PSBoundParameters @args
exit $LASTEXITCODE
