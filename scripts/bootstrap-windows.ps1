# One-command Windows source bootstrap. No elevation or persistent PATH changes.
param(
  [switch]$PlanOnly,
  [switch]$ListResources,
  [switch]$NoBrowser,
  [switch]$PrepareOnly,
  [switch]$BuildDesktop,
  [switch]$WithCuda
)

# Public entry: keep named parameters and native exit status.
& (Join-Path $PSScriptRoot "..\tooling\source\bootstrap-windows.ps1") @PSBoundParameters @args
exit $LASTEXITCODE
