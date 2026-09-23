[CmdletBinding()]
param(
  [Parameter(Mandatory = $true)]
  [ValidateScript({ Test-Path -LiteralPath $_ -PathType Leaf })]
  [string]$InstallerPath,

  [Parameter(Mandatory = $true)]
  [ValidatePattern('^\d+\.\d+\.\d+$')]
  [string]$ExpectedVersion,

  [Parameter(Mandatory = $true)]
  [ValidateNotNullOrEmpty()]
  [string]$ExpectedSubject,

  [string]$DataRoot = (Join-Path $env:LOCALAPPDATA 'EcommerceToolboxData'),

  [string]$InstallRoot = (Join-Path $env:LOCALAPPDATA 'EcommerceToolboxAcceptance\\app'),

  [ValidateRange(15, 180)]
  [int]$TimeoutSeconds = 90,

  [switch]$KeepInstalled
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$installer = (Resolve-Path -LiteralPath $InstallerPath).Path
$installRoot = [IO.Path]::GetFullPath($InstallRoot)
$dataRoot = [IO.Path]::GetFullPath($DataRoot)
$installRootFull = [IO.Path]::GetFullPath($installRoot)
$dataPrefix = $dataRoot.TrimEnd([IO.Path]::DirectorySeparatorChar, [IO.Path]::AltDirectorySeparatorChar)
$installPrefix = $installRootFull.TrimEnd([IO.Path]::DirectorySeparatorChar, [IO.Path]::AltDirectorySeparatorChar)
if (
  $dataPrefix.Equals($installPrefix, [StringComparison]::OrdinalIgnoreCase) -or
  $dataPrefix.StartsWith("$installPrefix$([IO.Path]::DirectorySeparatorChar)", [StringComparison]::OrdinalIgnoreCase) -or
  $installPrefix.StartsWith("$dataPrefix$([IO.Path]::DirectorySeparatorChar)", [StringComparison]::OrdinalIgnoreCase)
) {
  throw "Data root must not overlap NSIS install root: $dataRoot"
}
if (Test-Path -LiteralPath $installRoot) {
  throw "Clean VM acceptance requires no existing NSIS installation: $installRoot"
}
if (Test-Path -LiteralPath $dataRoot) {
  throw "Clean VM acceptance requires no existing desktop data root: $dataRoot"
}

New-Item -ItemType Directory -Path $dataRoot -Force | Out-Null
$sentinelPath = Join-Path $dataRoot 'acceptance-user-data-sentinel.txt'
$sentinel = [Guid]::NewGuid().ToString('N')
[IO.File]::WriteAllText($sentinelPath, $sentinel, [Text.UTF8Encoding]::new($false))

try {
  $install = Start-Process -FilePath $installer -ArgumentList @('/S', "/D=$installRoot") -Wait -PassThru
  if ($install.ExitCode -ne 0) { throw "NSIS installer failed with exit code $($install.ExitCode)" }

  $application = Join-Path $installRoot 'EcommerceToolbox.exe'
  $uninstaller = Get-ChildItem -LiteralPath $installRoot -Filter 'Uninstall*.exe' -File | Select-Object -First 1
  if (-not (Test-Path -LiteralPath $application -PathType Leaf)) { throw "Installed application is missing: $application" }
  if (-not $uninstaller) { throw "NSIS uninstaller is missing from: $installRoot" }
  if ([IO.File]::ReadAllText($sentinelPath, [Text.UTF8Encoding]::new($false)) -ne $sentinel) {
    throw 'Installer changed existing user data sentinel'
  }

  & (Join-Path $PSScriptRoot 'verify-windows-signatures.ps1') -Directory $installRoot -ExpectedSubject $ExpectedSubject
  # Setup.exe may launch the first-run application. Stop it so the smoke process
  # owns the singleton lock and its remote-debugging endpoint deterministically.
  @(Get-Process -Name 'EcommerceToolbox' -ErrorAction SilentlyContinue) | Stop-Process -Force
  Start-Sleep -Milliseconds 500
  $reportDirectory = if ($env:RUNNER_TEMP) { $env:RUNNER_TEMP } else { [IO.Path]::GetTempPath() }
  $reportPath = Join-Path $reportDirectory 'desktop-installed-smoke.json'
  & node (Join-Path $PSScriptRoot '..\apps\desktop\scripts\smoke-installed-desktop.mjs') --exe $application --report $reportPath --timeout-seconds $TimeoutSeconds
  if ($LASTEXITCODE -ne 0) { throw "Installed desktop smoke failed with exit code $LASTEXITCODE" }
  if (-not (Test-Path -LiteralPath $reportPath -PathType Leaf)) { throw 'Installed desktop smoke did not write a report' }

  if ($KeepInstalled) {
    Write-Host "Clean VM install acceptance passed; installation retained at $installRoot"
    return
  }

  $uninstall = Start-Process -FilePath $uninstaller.FullName -ArgumentList @('/S') -Wait -PassThru
  if ($uninstall.ExitCode -ne 0) { throw "NSIS uninstaller failed with exit code $($uninstall.ExitCode)" }
  $deadline = [DateTime]::UtcNow.AddSeconds(30)
  while ((Test-Path -LiteralPath $installRoot) -and [DateTime]::UtcNow -lt $deadline) {
    Start-Sleep -Milliseconds 500
  }
  if (Test-Path -LiteralPath $installRoot) { throw "NSIS installation was not removed: $installRoot" }
  if (-not (Test-Path -LiteralPath $sentinelPath -PathType Leaf)) { throw 'Uninstall deleted user data sentinel' }
  if ([IO.File]::ReadAllText($sentinelPath, [Text.UTF8Encoding]::new($false)) -ne $sentinel) {
    throw 'Uninstall changed user data sentinel'
  }
  Write-Host 'Clean VM desktop acceptance passed: signed install, launch, health checks, uninstall, and user-data preservation.'
} finally {
  if (Test-Path -LiteralPath $installRoot) {
    $remainingUninstaller = Get-ChildItem -LiteralPath $installRoot -Filter 'Uninstall*.exe' -File | Select-Object -First 1
    if ($remainingUninstaller) {
      Start-Process -FilePath $remainingUninstaller.FullName -ArgumentList @('/S') -Wait -ErrorAction SilentlyContinue | Out-Null
    }
  }
}
