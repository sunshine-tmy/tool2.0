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

  [switch]$KeepInstalled
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$installer = (Resolve-Path -LiteralPath $InstallerPath).Path
$installRoot = [IO.Path]::GetFullPath($InstallDirectory)
$dataRoot = Join-Path $installRoot 'data'
$legacyRoot = Join-Path $env:LOCALAPPDATA 'EcommerceToolboxData'
$reportDirectory = if ($env:RUNNER_TEMP) { $env:RUNNER_TEMP } else { [IO.Path]::GetTempPath() }
$smokeReportPath = Join-Path $reportDirectory 'desktop-installed-smoke.json'
$acceptanceReportPath = Join-Path $reportDirectory 'desktop-install-acceptance-report.json'
$signatureMode = if ($AllowUnsignedTestArtifact) { 'unsigned-test' } else { 'signed' }
$acceptanceResults = [ordered]@{}
$failureMessage = $null

if (Test-Path -LiteralPath $installRoot) {
  throw "Clean VM acceptance requires no existing NSIS install directory: $installRoot"
}
if (Test-Path -LiteralPath $legacyRoot) {
  throw 'Clean VM acceptance requires no pre-existing legacy EcommerceToolboxData folder so the first-run migration choice is deterministic.'
}
if (($null -eq $PreviousInstallerPath) -ne ($null -eq $PreviousExpectedVersion)) {
  throw 'PreviousInstallerPath and PreviousExpectedVersion must be provided together.'
}
if ($TestLegacyMigration -and $PreviousInstallerPath) {
  throw 'Legacy-root migration and previous-version upgrade are separate acceptance scenarios.'
}
if ($TestExplicitDataDeletion) {
  $acceptanceTempRoot = [IO.Path]::GetFullPath($(if ($env:RUNNER_TEMP) { $env:RUNNER_TEMP } else { [IO.Path]::GetTempPath() }))
  $acceptanceTempPrefix = $acceptanceTempRoot.TrimEnd([IO.Path]::DirectorySeparatorChar, [IO.Path]::AltDirectorySeparatorChar) + [IO.Path]::DirectorySeparatorChar
  if (-not $installRoot.StartsWith($acceptanceTempPrefix, [StringComparison]::OrdinalIgnoreCase)) {
    throw "Explicit data deletion testing is allowed only under the isolated acceptance temp directory: $acceptanceTempRoot"
  }
}

$legacySentinelPath = Join-Path $legacyRoot 'data\acceptance-legacy-migration-sentinel.txt'
$legacySentinel = [Guid]::NewGuid().ToString('N')
$dataSentinelPath = Join-Path $dataRoot 'acceptance-user-data-sentinel.txt'
$dataSentinel = [Guid]::NewGuid().ToString('N')

function Set-AcceptanceResult {
  param([string]$Name, [object]$Value)
  $script:acceptanceResults[$Name] = $Value
}

function Save-AcceptanceReport {
  param([string]$Status)
  $report = [ordered]@{
    status = $Status
    signatureMode = $script:signatureMode
    expectedVersion = $ExpectedVersion
    previousVersion = $PreviousExpectedVersion
    installRoot = $installRoot
    dataRoot = $dataRoot
    legacyMigrationTested = [bool]$TestLegacyMigration
    explicitDataDeletionTested = [bool]$TestExplicitDataDeletion
    componentLifecycleTested = [bool]$TestComponentLifecycle
    completedAt = [DateTime]::UtcNow.ToString('o')
    failure = $script:failureMessage
    checks = $script:acceptanceResults
  }
  [IO.File]::WriteAllText(
    $script:acceptanceReportPath,
    (ConvertTo-Json -InputObject $report -Depth 8) + "`n",
    [Text.UTF8Encoding]::new($false)
  )
}

function Invoke-Installer {
  param([string]$Path)
  # NSIS reads everything after /D= as the target directory. Keep /D last and
  # unquoted; the clean-VM path deliberately contains spaces to exercise it.
  $arguments = "/S /D=$installRoot"
  $process = Start-Process -FilePath $Path -ArgumentList $arguments -Wait -PassThru
  if ($process.ExitCode -ne 0) { throw "NSIS installer failed with exit code $($process.ExitCode): $Path" }
}

function Get-InstalledApplication {
  $applicationPath = Join-Path $installRoot 'EcommerceToolbox.exe'
  if (-not (Test-Path -LiteralPath $applicationPath -PathType Leaf)) {
    throw "Installed application is missing: $applicationPath"
  }
  $uninstallerFile = Get-ChildItem -LiteralPath $installRoot -Filter 'Uninstall*.exe' -File | Select-Object -First 1
  if (-not $uninstallerFile) { throw "NSIS uninstaller is missing from: $installRoot" }
  return [pscustomobject]@{ Application = $applicationPath; Uninstaller = $uninstallerFile.FullName }
}

function Assert-InstalledVersion {
  param([string]$ApplicationPath, [string]$Version)
  $productVersion = [Diagnostics.FileVersionInfo]::GetVersionInfo($ApplicationPath).ProductVersion
  if ([string]::IsNullOrWhiteSpace($productVersion) -or
      $productVersion -notmatch ('^' + [regex]::Escape($Version) + '(?:\.0)?(?:\+.*)?$')) {
    throw "Installed executable version '$productVersion' does not match expected '$Version'."
  }
}

function Invoke-InstalledSmoke {
  param([string]$ApplicationPath, [switch]$ChooseMigration, [switch]$TestComponents)
  $smokeArguments = @(
    (Join-Path $PSScriptRoot '..\apps\desktop\scripts\smoke-installed-desktop.mjs'),
    '--exe', $ApplicationPath,
    '--report', $smokeReportPath,
    '--timeout-seconds', $TimeoutSeconds.ToString()
  )
  if ($ChooseMigration) { $smokeArguments += @('--startup-migration', 'migrate') }
  if ($TestComponents) { $smokeArguments += @('--component-id', 'edge-tts', '--component-timeout-seconds', '1200') }
  & node @smokeArguments
  if ($LASTEXITCODE -ne 0) { throw "Installed desktop smoke failed with exit code $LASTEXITCODE" }
  if (-not (Test-Path -LiteralPath $smokeReportPath -PathType Leaf)) {
    throw 'Installed desktop smoke did not write a report'
  }
}

function Assert-DataSentinel {
  param([string]$Path, [string]$Expected, [string]$Context)
  if (-not (Test-Path -LiteralPath $Path -PathType Leaf)) { throw "$Context removed user data sentinel: $Path" }
  $actual = [IO.File]::ReadAllText($Path, [Text.UTF8Encoding]::new($false))
  if ($actual -ne $Expected) { throw "$Context changed user data sentinel: $Path" }
}

function Invoke-SilentUninstall {
  param([string]$UninstallerPath)
  $process = Start-Process -FilePath $UninstallerPath -ArgumentList '/S' -Wait -PassThru
  if ($process.ExitCode -ne 0) { throw "NSIS silent uninstaller failed with exit code $($process.ExitCode)" }
}

function Invoke-ExplicitDataDeletionUninstall {
  param([string]$UninstallerPath)

  if (-not ('DesktopAcceptanceNative' -as [type])) {
    Add-Type -TypeDefinition @'
using System;
using System.Collections.Generic;
using System.Runtime.InteropServices;
using System.Text;

public static class DesktopAcceptanceNative {
    private delegate bool EnumWindowsProc(IntPtr window, IntPtr parameter);
    private delegate bool EnumChildWindowsProc(IntPtr window, IntPtr parameter);

    [DllImport("user32.dll")]
    private static extern bool EnumWindows(EnumWindowsProc callback, IntPtr parameter);
    [DllImport("user32.dll")]
    private static extern bool EnumChildWindows(IntPtr parent, EnumChildWindowsProc callback, IntPtr parameter);
    [DllImport("user32.dll", CharSet = CharSet.Unicode)]
    private static extern int GetClassName(IntPtr window, StringBuilder text, int maxCount);
    [DllImport("user32.dll", CharSet = CharSet.Unicode)]
    private static extern int GetWindowText(IntPtr window, StringBuilder text, int maxCount);
    [DllImport("user32.dll", SetLastError = true)]
    private static extern uint GetWindowThreadProcessId(IntPtr window, out int processId);
    [DllImport("user32.dll")]
    private static extern IntPtr GetDlgItem(IntPtr dialog, int itemId);
    [DllImport("user32.dll")]
    private static extern IntPtr SendMessage(IntPtr window, uint message, IntPtr wParam, IntPtr lParam);

    public static bool ClickYesForPrompt(int processId, string promptMarker) {
        bool clicked = false;
        EnumWindows((window, parameter) => {
            int ownerProcessId;
            GetWindowThreadProcessId(window, out ownerProcessId);
            if (ownerProcessId != processId) return true;

            var className = new StringBuilder(128);
            GetClassName(window, className, className.Capacity);
            if (className.ToString() != "#32770") return true;

            var dialogText = new StringBuilder();
            EnumChildWindows(window, (child, childParameter) => {
                var text = new StringBuilder(2048);
                GetWindowText(child, text, text.Capacity);
                if (text.Length > 0) dialogText.AppendLine(text.ToString());
                return true;
            }, IntPtr.Zero);

            if (dialogText.ToString().IndexOf(promptMarker, StringComparison.Ordinal) < 0) return true;
            var yesButton = GetDlgItem(window, 6); // Win32 IDYES; default button remains No.
            if (yesButton == IntPtr.Zero) return true;
            SendMessage(yesButton, 0x00F5, IntPtr.Zero, IntPtr.Zero); // BM_CLICK
            clicked = true;
            return false;
        }, IntPtr.Zero);
        return clicked;
    }
}
'@
  }

  $process = Start-Process -FilePath $UninstallerPath -PassThru
  $prompts = @(
    '是否同时删除此应用管理的全部数据',
    '再次确认：删除后无法通过重新安装恢复这些数据'
  )
  foreach ($prompt in $prompts) {
    $deadline = [DateTime]::UtcNow.AddSeconds($TimeoutSeconds)
    $clicked = $false
    while ([DateTime]::UtcNow -lt $deadline) {
      $process.Refresh()
      if ($process.HasExited) { break }
      if ([DesktopAcceptanceNative]::ClickYesForPrompt($process.Id, $prompt)) {
        $clicked = $true
        break
      }
      Start-Sleep -Milliseconds 150
    }
    if (-not $clicked) { throw "Could not find the expected explicit data-deletion confirmation dialog: $prompt" }
    Start-Sleep -Milliseconds 250
  }

  if (-not $process.WaitForExit($TimeoutSeconds * 1000)) {
    throw 'Interactive uninstaller did not finish after both explicit confirmations.'
  }
  if ($process.ExitCode -ne 0) { throw "Interactive NSIS uninstaller failed with exit code $($process.ExitCode)" }
}

try {
  if ($TestLegacyMigration) {
    New-Item -ItemType Directory -Path (Split-Path -Parent $legacySentinelPath) -Force | Out-Null
    [IO.File]::WriteAllText($legacySentinelPath, $legacySentinel, [Text.UTF8Encoding]::new($false))
    Set-AcceptanceResult 'legacySourceSeeded' @{ path = $legacySentinelPath; sha256 = (Get-FileHash -LiteralPath $legacySentinelPath -Algorithm SHA256).Hash.ToLowerInvariant() }
  }

  if ($PreviousInstallerPath) {
    $previousInstaller = (Resolve-Path -LiteralPath $PreviousInstallerPath).Path
    if (-not $AllowUnsignedTestArtifact) {
      & (Join-Path $PSScriptRoot 'verify-windows-signatures.ps1') -Directory (Split-Path -Parent $previousInstaller) -ExpectedSubject $ExpectedSubject
    }
    Invoke-Installer -Path $previousInstaller
    $previousInstall = Get-InstalledApplication
    Assert-InstalledVersion -ApplicationPath $previousInstall.Application -Version $PreviousExpectedVersion
    New-Item -ItemType Directory -Path $dataRoot -Force | Out-Null
    [IO.File]::WriteAllText($dataSentinelPath, $dataSentinel, [Text.UTF8Encoding]::new($false))
    Invoke-Installer -Path $installer
    $currentInstall = Get-InstalledApplication
    Assert-InstalledVersion -ApplicationPath $currentInstall.Application -Version $ExpectedVersion
    Assert-DataSentinel -Path $dataSentinelPath -Expected $dataSentinel -Context 'Upgrade'
    Set-AcceptanceResult 'upgrade' @{ from = $PreviousExpectedVersion; to = $ExpectedVersion; userDataPreserved = $true }
  }
  else {
    Invoke-Installer -Path $installer
    $currentInstall = Get-InstalledApplication
    Assert-InstalledVersion -ApplicationPath $currentInstall.Application -Version $ExpectedVersion
  }

  if (-not $AllowUnsignedTestArtifact) {
    & (Join-Path $PSScriptRoot 'verify-windows-signatures.ps1') -Directory $installRoot -ExpectedSubject $ExpectedSubject
  }

  New-Item -ItemType Directory -Path $dataRoot -Force | Out-Null
  if (-not (Test-Path -LiteralPath $dataSentinelPath -PathType Leaf)) {
    [IO.File]::WriteAllText($dataSentinelPath, $dataSentinel, [Text.UTF8Encoding]::new($false))
  }
  Invoke-InstalledSmoke -ApplicationPath $currentInstall.Application -ChooseMigration:$TestLegacyMigration -TestComponents:$TestComponentLifecycle
  if (-not $TestLegacyMigration -and (Test-Path -LiteralPath $legacyRoot)) {
    throw "Installed application wrote to the legacy user-profile path instead of the selected install root: $legacyRoot"
  }
  Set-AcceptanceResult 'firstLaunch' (Get-Content -LiteralPath $smokeReportPath -Raw | ConvertFrom-Json)

  if ($TestLegacyMigration) {
    $migratedSentinelPath = Join-Path $dataRoot 'data\acceptance-legacy-migration-sentinel.txt'
    Assert-DataSentinel -Path $migratedSentinelPath -Expected $legacySentinel -Context 'Legacy migration'
    Assert-DataSentinel -Path $legacySentinelPath -Expected $legacySentinel -Context 'Legacy migration source'
    Set-AcceptanceResult 'legacyMigration' @{ sourcePreserved = $true; destinationPreserved = $true }
  }

  if ($TestComponentLifecycle) {
    foreach ($componentId in @('python-311', 'edge-tts')) {
      $componentDirectory = Join-Path $dataRoot "components\packages\$componentId"
      if (Test-Path -LiteralPath $componentDirectory) { throw "Capability uninstall left package files outside the expected data directory: $componentDirectory" }
    }
    Assert-DataSentinel -Path $dataSentinelPath -Expected $dataSentinel -Context 'Capability install/uninstall'
    Set-AcceptanceResult 'componentLifecycle' @{ capability = 'edge-tts'; sharedRuntime = 'python-311'; installHealthyUninstall = $true; userDataPreserved = $true }
  }

  if ($PreviousInstallerPath) {
    Assert-DataSentinel -Path $dataSentinelPath -Expected $dataSentinel -Context 'Post-upgrade startup'
  }

  if ($KeepInstalled) {
    Set-AcceptanceResult 'installRoot' @{ retained = $true; path = $installRoot }
    Save-AcceptanceReport -Status 'passed-installed-retained'
    Write-Host "Clean VM install acceptance passed; installation retained at $installRoot"
    return
  }

  Invoke-SilentUninstall -UninstallerPath $currentInstall.Uninstaller
  if (-not (Test-Path -LiteralPath $installRoot -PathType Container)) { throw "Installation root should remain to preserve data: $installRoot" }
  if (Test-Path -LiteralPath $currentInstall.Application) { throw "Program files were not removed from: $installRoot" }
  if (Test-Path -LiteralPath $currentInstall.Uninstaller) { throw 'Uninstaller executable remains after silent uninstall' }
  Assert-DataSentinel -Path $dataSentinelPath -Expected $dataSentinel -Context 'Default silent uninstall'
  Set-AcceptanceResult 'defaultUninstall' @{ programFilesRemoved = $true; userDataPreserved = $true }

  Invoke-Installer -Path $installer
  $reinstalled = Get-InstalledApplication
  Assert-InstalledVersion -ApplicationPath $reinstalled.Application -Version $ExpectedVersion
  Assert-DataSentinel -Path $dataSentinelPath -Expected $dataSentinel -Context 'Reinstall'
  Invoke-InstalledSmoke -ApplicationPath $reinstalled.Application
  Set-AcceptanceResult 'reinstall' @{ version = $ExpectedVersion; previousUserDataPreserved = $true; health = (Get-Content -LiteralPath $smokeReportPath -Raw | ConvertFrom-Json) }

  if ($TestExplicitDataDeletion) {
    Invoke-ExplicitDataDeletionUninstall -UninstallerPath $reinstalled.Uninstaller
    if (Test-Path -LiteralPath $dataRoot) { throw "Explicit double confirmation did not remove the application data root: $dataRoot" }
    if (Test-Path -LiteralPath $reinstalled.Application) { throw "Program files remain after explicit data deletion: $($reinstalled.Application)" }
    Set-AcceptanceResult 'explicitDataDeletion' @{ bothConfirmationsAccepted = $true; dataRootRemoved = $true }
  }
  else {
    Invoke-SilentUninstall -UninstallerPath $reinstalled.Uninstaller
    if (Test-Path -LiteralPath $reinstalled.Application) { throw "Program files remain after final silent uninstall: $($reinstalled.Application)" }
    Assert-DataSentinel -Path $dataSentinelPath -Expected $dataSentinel -Context 'Final silent uninstall'
    Set-AcceptanceResult 'finalUninstall' @{ programFilesRemoved = $true; userDataPreserved = $true }
  }

  $migrationMode = if ($TestLegacyMigration) { 'legacy migration, ' } else { '' }
  $upgradeMode = if ($PreviousInstallerPath) { "upgrade from $PreviousExpectedVersion, " } else { '' }
  $deletionMode = if ($TestExplicitDataDeletion) { 'explicit data deletion, ' } else { '' }
  $componentMode = if ($TestComponentLifecycle) { 'signed capability install/uninstall, ' } else { '' }
  $summary = "Clean VM desktop acceptance passed: $signatureMode install, ${migrationMode}${upgradeMode}${componentMode}launch, health checks, default uninstall, reinstall, ${deletionMode}data handling."
  Set-AcceptanceResult 'summary' $summary
  Save-AcceptanceReport -Status 'passed'
  Write-Host $summary
}
catch {
  $failureMessage = $_.Exception.Message
  throw
}
finally {
  if (-not $KeepInstalled -and (Test-Path -LiteralPath $installRoot)) {
    $remainingUninstaller = Get-ChildItem -LiteralPath $installRoot -Filter 'Uninstall*.exe' -File -ErrorAction SilentlyContinue | Select-Object -First 1
    if ($remainingUninstaller) {
      try {
        # Failure cleanup is always silent, and therefore always preserves data.
        Start-Process -FilePath $remainingUninstaller.FullName -ArgumentList '/S' -Wait -ErrorAction Stop | Out-Null
      }
      catch {
        Write-Warning "Could not clean up the test program files; acceptance data was left untouched: $($_.Exception.Message)"
      }
    }
  }
  $reportStatus = if ($failureMessage) { 'failed' } elseif ($KeepInstalled) { 'passed-installed-retained' } else { 'passed' }
  try { Save-AcceptanceReport -Status $reportStatus } catch { Write-Warning "Could not write the acceptance report: $($_.Exception.Message)" }
}
