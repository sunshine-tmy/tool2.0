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

  [string]$InstallDirectory = (Join-Path $env:LOCALAPPDATA 'EcommerceToolboxAcceptance\EcommerceToolbox'),

  [ValidateRange(15, 180)]
  [int]$TimeoutSeconds = 90,

  [switch]$KeepInstalled
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$installer = (Resolve-Path -LiteralPath $InstallerPath).Path
$installRoot = [IO.Path]::GetFullPath($InstallDirectory)
$dataRoot = Join-Path $installRoot 'data'
if (Test-Path -LiteralPath $installRoot) {
  throw "Clean VM acceptance requires no existing NSIS install directory: $installRoot"
}
if (Test-Path -LiteralPath (Join-Path $env:LOCALAPPDATA 'EcommerceToolboxData')) {
  throw 'Clean VM acceptance requires no legacy EcommerceToolboxData folder so the first-run migration choice is deterministic.'
}

$legacyRoot = Join-Path $env:LOCALAPPDATA 'EcommerceToolboxData'
$legacySentinelPath = Join-Path $legacyRoot 'data\acceptance-legacy-migration-sentinel.txt'
$legacySentinel = [Guid]::NewGuid().ToString('N')
if ($TestLegacyMigration) {
  New-Item -ItemType Directory -Path (Split-Path -Parent $legacySentinelPath) -Force | Out-Null
  [IO.File]::WriteAllText($legacySentinelPath, $legacySentinel, [Text.UTF8Encoding]::new($false))
}

try {
  $install = Start-Process -FilePath $installer -ArgumentList @('/S', "/D=$installRoot") -Wait -PassThru
  if ($install.ExitCode -ne 0) { throw "NSIS installer failed with exit code $($install.ExitCode)" }

  $application = Join-Path $installRoot 'EcommerceToolbox.exe'
  $uninstaller = Get-ChildItem -LiteralPath $installRoot -Filter 'Uninstall*.exe' -File | Select-Object -First 1
  if (-not (Test-Path -LiteralPath $application -PathType Leaf)) { throw "Installed application is missing: $application" }
  if (-not $uninstaller) { throw "NSIS uninstaller is missing from: $installRoot" }

  if (-not $AllowUnsignedTestArtifact) {
    & (Join-Path $PSScriptRoot 'verify-windows-signatures.ps1') -Directory $installRoot -ExpectedSubject $ExpectedSubject
  }
  # Setup.exe may launch the first-run application. Stop it so the smoke process
  # owns the singleton lock and its remote-debugging endpoint deterministically.
  @(Get-Process -Name 'EcommerceToolbox' -ErrorAction SilentlyContinue) | Stop-Process -Force
  Start-Sleep -Milliseconds 500
  $reportDirectory = if ($env:RUNNER_TEMP) { $env:RUNNER_TEMP } else { [IO.Path]::GetTempPath() }
  $reportPath = Join-Path $reportDirectory 'desktop-installed-smoke.json'
  $smokeArguments = @('--exe', $application, '--report', $reportPath, '--timeout-seconds', $TimeoutSeconds.ToString())
  if ($TestLegacyMigration) { $smokeArguments += @('--startup-migration', 'migrate') }
  & node (Join-Path $PSScriptRoot '..\apps\desktop\scripts\smoke-installed-desktop.mjs') @smokeArguments
  if ($LASTEXITCODE -ne 0) { throw "Installed desktop smoke failed with exit code $LASTEXITCODE" }
  if (-not (Test-Path -LiteralPath $reportPath -PathType Leaf)) { throw 'Installed desktop smoke did not write a report' }

  if ($TestLegacyMigration) {
    $migratedSentinelPath = Join-Path $dataRoot 'data\acceptance-legacy-migration-sentinel.txt'
    if (-not (Test-Path -LiteralPath $migratedSentinelPath -PathType Leaf)) { throw 'Legacy migration did not copy the data sentinel into the selected install root' }
    if ([IO.File]::ReadAllText($migratedSentinelPath, [Text.UTF8Encoding]::new($false)) -ne $legacySentinel) {
      throw 'Legacy migration changed the data sentinel'
    }
    if (-not (Test-Path -LiteralPath $legacySentinelPath -PathType Leaf)) { throw 'Legacy migration removed the source sentinel' }
    if ([IO.File]::ReadAllText($legacySentinelPath, [Text.UTF8Encoding]::new($false)) -ne $legacySentinel) {
      throw 'Legacy migration changed the source sentinel'
    }
  }

  $sentinelPath = Join-Path $dataRoot 'acceptance-user-data-sentinel.txt'
  $sentinel = [Guid]::NewGuid().ToString('N')
  [IO.File]::WriteAllText($sentinelPath, $sentinel, [Text.UTF8Encoding]::new($false))

  if ($KeepInstalled) {
    Write-Host "Clean VM install acceptance passed; installation retained at $installRoot"
    return
  }

  $uninstall = Start-Process -FilePath $uninstaller.FullName -ArgumentList @('/S') -Wait -PassThru
  if ($uninstall.ExitCode -ne 0) { throw "NSIS uninstaller failed with exit code $($uninstall.ExitCode)" }
  if (-not (Test-Path -LiteralPath $installRoot -PathType Container)) { throw "Installation root should remain to preserve data: $installRoot" }
  if (Test-Path -LiteralPath $application) { throw "Program files were not removed from: $installRoot" }
  if (Test-Path -LiteralPath $uninstaller.FullName) { throw 'Uninstaller executable remains after uninstall' }
  if (-not (Test-Path -LiteralPath $sentinelPath -PathType Leaf)) { throw 'Uninstall deleted user data sentinel' }
  if ([IO.File]::ReadAllText($sentinelPath, [Text.UTF8Encoding]::new($false)) -ne $sentinel) {
    throw 'Uninstall changed user data sentinel'
  }
  $signatureMode = if ($AllowUnsignedTestArtifact) { 'unsigned test' } else { 'signed' }
  $migrationMode = if ($TestLegacyMigration) { 'legacy migration with source preservation, ' } else { '' }
  Write-Host "Clean VM desktop acceptance passed: $signatureMode install, ${migrationMode}launch, health checks, program-only uninstall, and install-root data preservation."
} finally {
  if (-not $KeepInstalled -and (Test-Path -LiteralPath $installRoot)) {
    $remainingUninstaller = Get-ChildItem -LiteralPath $installRoot -Filter 'Uninstall*.exe' -File | Select-Object -First 1
    if ($remainingUninstaller) {
      Start-Process -FilePath $remainingUninstaller.FullName -ArgumentList @('/S') -Wait -ErrorAction SilentlyContinue | Out-Null
    }
  }
}
