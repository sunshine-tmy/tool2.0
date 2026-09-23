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

  [string]$InstallBaseRoot = (Join-Path $env:LOCALAPPDATA 'EcommerceToolboxAcceptance\EcommerceToolbox'),

  [ValidateRange(15, 180)]
  [int]$TimeoutSeconds = 90,

  [switch]$KeepInstalled
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$installer = (Resolve-Path -LiteralPath $InstallerPath).Path
$installBaseRoot = [IO.Path]::GetFullPath($InstallBaseRoot)
$installRoot = Join-Path $installBaseRoot 'Ecommerce Toolbox'
$dataRoot = Join-Path $installRoot 'data'
if (Test-Path -LiteralPath $installBaseRoot) {
  throw "Clean VM acceptance requires no existing NSIS install base: $installBaseRoot"
}
if (Test-Path -LiteralPath (Join-Path $env:LOCALAPPDATA 'EcommerceToolboxData')) {
  throw 'Clean VM acceptance requires no legacy EcommerceToolboxData folder so the first-run migration choice is deterministic.'
}

try {
  $install = Start-Process -FilePath $installer -ArgumentList @('/S', "/D=$installBaseRoot") -Wait -PassThru
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
  & node (Join-Path $PSScriptRoot '..\apps\desktop\scripts\smoke-installed-desktop.mjs') --exe $application --report $reportPath --timeout-seconds $TimeoutSeconds
  if ($LASTEXITCODE -ne 0) { throw "Installed desktop smoke failed with exit code $LASTEXITCODE" }
  if (-not (Test-Path -LiteralPath $reportPath -PathType Leaf)) { throw 'Installed desktop smoke did not write a report' }

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
  Write-Host "Clean VM desktop acceptance passed: $signatureMode install, launch, health checks, program-only uninstall, and install-root data preservation."
} finally {
  if (-not $KeepInstalled -and (Test-Path -LiteralPath $installRoot)) {
    $remainingUninstaller = Get-ChildItem -LiteralPath $installRoot -Filter 'Uninstall*.exe' -File | Select-Object -First 1
    if ($remainingUninstaller) {
      Start-Process -FilePath $remainingUninstaller.FullName -ArgumentList @('/S') -Wait -ErrorAction SilentlyContinue | Out-Null
    }
  }
}
