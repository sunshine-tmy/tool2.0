[CmdletBinding()]
param(
  [Parameter(Mandatory)]
  [string]$Directory,
  [Parameter(Mandatory)]
  [string]$ExpectedSubject
)

# Public entry: keep named parameters and native exit status.
& (Join-Path $PSScriptRoot "..\tooling\testing\verify-windows-signatures.ps1") @PSBoundParameters @args
exit $LASTEXITCODE
