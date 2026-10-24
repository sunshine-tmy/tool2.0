[CmdletBinding(DefaultParameterSetName = 'Signed')]
param(
  [Parameter(Mandatory = $true)]
  [ValidateScript({ Test-Path -LiteralPath $_ -PathType Leaf })]
  [string]$InstallerPath,

  [Parameter(Mandatory = $true)]
  [ValidatePattern('^\d+\.\d+\.\d+$')]
  [string]$ExpectedVersion,

  [Parameter(Mandatory = $true, ParameterSetName = 'Signed')]
  [ValidateNotNullOrEmpty()]
  [string]$ExpectedSubject,

  [Parameter(Mandatory = $true, ParameterSetName = 'UnsignedTest')]
  [switch]$AllowUnsignedTestArtifact,

  [Parameter(ParameterSetName = 'UnsignedTest')]
  [switch]$TestLegacyMigration,

  [string]$PreviousInstallerPath,

  [ValidatePattern('^\d+\.\d+\.\d+$')]
  [string]$PreviousExpectedVersion,

  [string]$InstallDirectory = $(
    $acceptanceTempRoot = if ($env:RUNNER_TEMP) { $env:RUNNER_TEMP } else { [IO.Path]::GetTempPath() }
    Join-Path $acceptanceTempRoot 'Ecommerce Toolbox Acceptance'
  ),

  [ValidateRange(15, 180)]
  [int]$TimeoutSeconds = 90,

  [switch]$TestExplicitDataDeletion,

  [switch]$TestComponentLifecycle,

  [ValidateSet('edge-tts', 'douyin-archive')]
  [string]$ComponentId = 'edge-tts',

  [switch]$KeepInstalled
)

# Public entry: keep named parameters and native exit status.
& (Join-Path $PSScriptRoot "..\tooling\testing\accept-windows-desktop-install.ps1") @PSBoundParameters @args
exit $LASTEXITCODE
