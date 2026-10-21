# One-command Windows source bootstrap. No elevation or persistent PATH changes.
param(
  [switch]$PlanOnly,
  [switch]$ListResources,
  [switch]$NoBrowser,
  [switch]$PrepareOnly,
  [switch]$BuildDesktop,
  [switch]$WithCuda
)

$ErrorActionPreference = 'Stop'
$Root = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$BootstrapRoot = Join-Path $Root '.runtime\bootstrap'
$OfflineRoot = Join-Path $Root 'offline-resources'
$NodeVersion = '24.22.1'
$NodeHash = 'd2046d28c2c3dcd211ac5145c0bf30e2047ef9dfb306693c8c6e2eccd8b95fa5'
$PnpmVersion = '11.7.0'
$PnpmHash = 'GcyFLBIMcSV2DyRD7mvgyltA+fUFmN4aCaHxd1A+AQ5Xwjx3ZG4B52HeWb+HT7IqM5jDOrlpH8E+uUa28PTWIA=='

function Invoke-Checked {
  param([string]$Executable, [string[]]$Arguments)
  & $Executable @Arguments
  if ($LASTEXITCODE -ne 0) { throw "Command failed (exit $LASTEXITCODE). Review the output above; rerun start.bat after resolving it." }
}

function Test-ArchiveHash {
  param([string]$Path, [string]$Algorithm, [string]$Expected)
  if (-not (Test-Path -LiteralPath $Path -PathType Leaf)) { return $false }
  $hasher = [Security.Cryptography.HashAlgorithm]::Create($Algorithm)
  $stream = [IO.File]::OpenRead($Path)
  try {
    $bytes = $hasher.ComputeHash($stream)
    if ($Algorithm -eq 'SHA256') { return ([BitConverter]::ToString($bytes).Replace('-', '').ToLowerInvariant()) -eq $Expected }
    return [Convert]::ToBase64String($bytes) -ceq $Expected
  } finally { $stream.Dispose(); $hasher.Dispose() }
}

function Get-PinnedArchive {
  param([string]$Url, [string]$Name, [string]$Algorithm, [string]$Expected, [string]$OfflineName = '')
  $destination = Join-Path $BootstrapRoot $Name
  if (Test-ArchiveHash $destination $Algorithm $Expected) { return $destination }
  if (-not $OfflineName) { $OfflineName = $Name }
  $localArchive = if ($OfflineRoot) { Join-Path $OfflineRoot (Join-Path 'bootstrap' $OfflineName) } else { $null }
  if ($localArchive -and (Test-Path -LiteralPath $localArchive)) {
    if (-not (Test-ArchiveHash $localArchive $Algorithm $Expected)) { throw "Local runtime digest mismatch: $localArchive. Replace this file with the exact documented version; no network fallback was attempted." }
    [IO.File]::Copy($localArchive, $destination, $true)
    Write-Host "Using verified local runtime: $OfflineName"
    return $destination
  }
  $partial = "$destination.partial"
  $client = New-Object Net.WebClient
  $timer = [Diagnostics.Stopwatch]::StartNew()
  $lastBytes = 0
  $lastProgress = 0
  try {
    Write-Host "Downloading $Name (fixed HTTPS source; digest verification required)"
    $download = $client.DownloadFileTaskAsync([Uri]$Url, $partial)
    while (-not $download.IsCompleted) {
      $length = if (Test-Path -LiteralPath $partial) { (Get-Item -LiteralPath $partial).Length } else { 0 }
      if ($length -gt $lastBytes) { $lastBytes = $length; $lastProgress = $timer.Elapsed.TotalSeconds }
      if ($length -gt 256MB -or ($timer.Elapsed.TotalSeconds - $lastProgress) -gt 120 -or $timer.Elapsed.TotalMinutes -gt 30) {
        $client.CancelAsync()
        throw 'Runtime download exceeded its size/time limit or made no progress for 120 seconds. Check your network and retry.'
      }
      Write-Progress -Activity "Downloading $Name" -Status ("{0:N1} MiB received; {1:N0}s elapsed" -f ($length / 1MB), $timer.Elapsed.TotalSeconds)
      Start-Sleep -Milliseconds 500
    }
    # Windows PowerShell 5.1 can emit the Task's empty result into the success pipeline.
    # Suppress it, otherwise callers receive an array and tar gets a leading-space path.
    [void]$download.GetAwaiter().GetResult()
    if (-not (Test-ArchiveHash $partial $Algorithm $Expected)) { throw "Digest mismatch for $Name; refusing to extract or execute." }
    Move-Item -LiteralPath $partial -Destination $destination -Force
    return $destination
  } catch {
    throw "Runtime preparation failed for $OfflineName. Download $Url in a browser and place the unchanged archive in offline-resources\bootstrap\$OfflineName, then rerun start.bat. The existing cache and business data are retained."
  } finally {
    $client.Dispose()
    Write-Progress -Activity "Downloading $Name" -Completed
  }
}

function Initialize-Node {
  $existing = Get-Command node.exe -ErrorAction SilentlyContinue
  if ($existing) {
    $version = & $existing.Source --version
    if ($LASTEXITCODE -eq 0 -and $version -match '^v24\.') {
      $architecture = & $existing.Source -p 'process.arch'
      if ($LASTEXITCODE -eq 0 -and $architecture -eq 'x64') { return $existing.Source }
    }
  }
  $folder = Join-Path $BootstrapRoot "node-v$NodeVersion-win-x64"
  $executable = Join-Path $folder 'node.exe'
  if (-not (Test-Path -LiteralPath $executable -PathType Leaf)) {
    $archive = Get-PinnedArchive "https://nodejs.org/dist/v$NodeVersion/node-v$NodeVersion-win-x64.zip" "node-$NodeVersion.zip" 'SHA256' $NodeHash "node-v$NodeVersion-win-x64.zip"
    # The entire archive is digest-pinned before extraction; no user-supplied URL or archive is accepted.
    Invoke-Checked 'tar.exe' @('-xf', $archive, '-C', $BootstrapRoot)
  }
  $version = & $executable --version
  if ($LASTEXITCODE -ne 0 -or $version -ne "v$NodeVersion") { throw 'The isolated Node runtime did not pass its version check.' }
  return $executable
}

function Initialize-Pnpm {
  $target = Join-Path $BootstrapRoot "pnpm-$PnpmVersion"
  $entry = Join-Path $target 'package\bin\pnpm.cjs'
  if (-not (Test-Path -LiteralPath $entry -PathType Leaf)) {
    $archive = Get-PinnedArchive "https://registry.npmjs.org/pnpm/-/pnpm-$PnpmVersion.tgz" "pnpm-$PnpmVersion.tgz" 'SHA512' $PnpmHash
    [IO.Directory]::CreateDirectory($target) | Out-Null
    Invoke-Checked 'tar.exe' @('-xzf', $archive, '-C', $target)
  }
  return $entry
}

function Assert-ServicesStopped {
  # This conservative early check requires no Node dependencies and performs no process termination.
  $values = @{}
  foreach ($line in (Get-Content -LiteralPath (Join-Path $Root '.env'))) {
    if ($line -match '^\s*(API_PORT|VITE_DEV_PORT)\s*=\s*(.*?)\s*$') { $values[$matches[1]] = $matches[2].Trim('"').Trim("'") }
  }
  foreach ($setting in @(@('API_PORT', 3100), @('VITE_DEV_PORT', 5173))) {
    $configured = [Environment]::GetEnvironmentVariable($setting[0])
    if (-not $configured) { $configured = $values[$setting[0]] }
    $port = if ($configured) { [int]$configured } else { $setting[1] }
    if ($port -lt 1 -or $port -gt 65535) { throw "Invalid $($setting[0]); correct .env before continuing." }
    $probe = New-Object Net.Sockets.TcpListener([Net.IPAddress]::Loopback, $port)
    try { $probe.Start() }
    catch { throw "Port $port is already in use. Stop the service normally before initialization; unknown processes will not be terminated." }
    finally { $probe.Stop() }
  }
}

function Get-SourceResourcePlan {
  return ([IO.File]::ReadAllText((Join-Path $PSScriptRoot 'source-resources.generated.json'), [Text.Encoding]::UTF8) | ConvertFrom-Json)
}

function Test-PreparedSourceComponent {
  param($Component)
  $componentRoot = Join-Path $Root ('.runtime\packages\' + $Component.id)
  $marker = Join-Path $componentRoot 'current.json'
  try {
    if (-not (Test-Path -LiteralPath $marker -PathType Leaf) -or (Get-Item -LiteralPath $marker).Length -gt 65536) { return $false }
    $current = [IO.File]::ReadAllText($marker, [Text.Encoding]::UTF8) | ConvertFrom-Json
    return $current.protocolVersion -eq 1 -and $current.id -eq $Component.id -and $current.version -eq $Component.version -and $current.manifestSha256 -ceq $Component.manifestSha256 -and $current.directory -match '^[A-Za-z0-9][A-Za-z0-9._-]*$' -and (Test-Path -LiteralPath (Join-Path $componentRoot ('versions\' + $current.directory)) -PathType Container)
  } catch { return $false }
}

function Show-SourceResources {
  $plan = Get-SourceResourcePlan
  Write-Host 'Before first startup: download the signed capability archives listed below.' -ForegroundColor Cyan
  Write-Host ("Place them in: " + (Join-Path $OfflineRoot 'components'))
  Write-Host 'Keep original filenames; do not extract. Existing installed capabilities are validated again by the manager.'
  if ($WithCuda) {
    Write-Host 'Selected: CPU baseline + NVIDIA voice cloning GPU extension (15 archives for a fresh setup).'
  } else {
    Write-Host 'Selected: CPU baseline (11 archives). GPU is NOT installed by this mode.'
    Write-Host 'For NVIDIA voice cloning, use start-gpu.bat or start.bat -WithCuda; prepare 4 additional archives.'
  }
  foreach ($component in $plan.components) {
    if (-not $component.required -and -not $WithCuda) { continue }
    Write-Host ("  " + $component.id + ' ' + $component.version)
    foreach ($archive in $component.archives) { Write-Host ("    " + $archive.filename + ' (' + $archive.bytes + ' bytes)'); Write-Host ("    " + $archive.url) }
  }
  Write-Host 'Optional Node/pnpm runtime archives: offline-resources\bootstrap\'
  foreach ($archive in $plan.bootstrap) { Write-Host ("  " + $archive.filename); Write-Host ("  " + $archive.url) }
  Write-Host 'Full preparation guide: docs\source-resources.md'
}

function Assert-LocalComponentResources {
  $plan = Get-SourceResourcePlan
  $missing = @()
  foreach ($component in $plan.components) {
    if (-not $component.required -and -not $WithCuda) { continue }
    if (Test-PreparedSourceComponent $component) { continue }
    foreach ($archive in $component.archives) {
      $flat = Join-Path $OfflineRoot ('components\' + $archive.filename)
      $nested = Join-Path $OfflineRoot ('components\' + $component.id + '\' + $component.version + '\' + $archive.filename)
      $valid = $false
      foreach ($candidate in @($flat, $nested)) {
        if (Test-Path -LiteralPath $candidate -PathType Leaf) {
          $file = Get-Item -LiteralPath $candidate
          if ($file.Length -eq $archive.bytes -and -not ($file.Attributes -band [IO.FileAttributes]::ReparsePoint)) { $valid = $true; break }
        }
      }
      if (-not $valid) { $missing += $archive }
    }
  }
  if ($missing.Count) {
    Write-Host 'Missing or wrong-sized local capability archives (all required files are listed):' -ForegroundColor Yellow
    foreach ($archive in $missing) { Write-Host ("  " + $archive.filename + ' (' + $archive.bytes + ' bytes)'); Write-Host ("  " + $archive.url) }
    Write-Host ("Place unchanged files in: " + (Join-Path $OfflineRoot 'components'))
    $listCommand = if ($WithCuda) { 'start-gpu.bat -ListResources' } else { 'start.bat -ListResources' }
    throw "Prepare the listed archives first. No model downloads or capability installs were attempted. See docs\source-resources.md or run $listCommand."
  }
}

if ($ListResources) { Show-SourceResources; exit 0 }

if ($PlanOnly) {
  Write-Host 'Plan only: no downloads, writes, installs, models or services.'
  Write-Host '1/6 Check Windows x64, local capability archives and preserve .env'
  Write-Host "2/6 Reuse Node 24 or prepare isolated Node $NodeVersion; pinned pnpm $PnpmVersion"
  Write-Host '3/6 Install frozen workspace dependencies and build shared contracts'
  if ($WithCuda) {
    Write-Host '4/6 Import signed CPU capabilities + NVIDIA voice cloning GPU extension (15 archives; no model downloads)'
  } else {
    Write-Host '4/6 Import signed CPU capabilities (11 archives; GPU excluded; use start-gpu.bat for NVIDIA voice cloning)'
  }
  Write-Host '5/6 Reuse managed Python/FFmpeg/models; no developer venv or system changes'
  Write-Host '6/6 Start API, managed Workers and frontend; platform login/online tests remain manual'
  exit 0
}

$lock = $null
$originalPath = $env:PATH
$originalManaged = $env:TOOLBOX_SOURCE_MANAGED
$originalNode = $env:TOOLBOX_BOOTSTRAP_NODE
$originalPnpm = $env:TOOLBOX_BOOTSTRAP_PNPM
try {
  if ($env:OS -ne 'Windows_NT' -or -not [Environment]::Is64BitOperatingSystem -or $env:PROCESSOR_ARCHITECTURE -eq 'ARM64' -or $env:PROCESSOR_ARCHITEW6432 -eq 'ARM64') {
    throw 'One-command bootstrap currently supports native Windows x64 only.'
  }
  if (-not (Get-Command tar.exe -ErrorAction SilentlyContinue)) { throw 'Windows tar.exe is required. Use a supported Windows installation with the built-in tar tool.' }
  Set-Location -LiteralPath $Root
  [IO.Directory]::CreateDirectory($BootstrapRoot) | Out-Null
  try { $lock = [IO.File]::Open((Join-Path $BootstrapRoot 'launcher.lock'), 'OpenOrCreate', 'ReadWrite', 'None') }
  catch { throw 'Another one-command initialization/startup is already active. Use its window; do not run two launchers.' }
  Write-Host '[1/6] Configuration (existing .env is never overwritten)' -ForegroundColor Cyan
  $envPath = Join-Path $Root '.env'
  if (-not (Test-Path -LiteralPath $envPath)) { [IO.File]::Copy((Join-Path $Root '.env.example'), $envPath, $false) }
  Assert-ServicesStopped
  if (-not $BuildDesktop) { Assert-LocalComponentResources }

  Write-Host '[2/6] Node and pnpm runtimes' -ForegroundColor Cyan
  [Net.ServicePointManager]::SecurityProtocol = [Net.ServicePointManager]::SecurityProtocol -bor [Net.SecurityProtocolType]::Tls12
  $node = Initialize-Node
  $pnpm = Initialize-Pnpm
  # Only this process and its children see these tools. No global install or persistent PATH write.
  $toolBin = Join-Path $BootstrapRoot 'bin'
  [IO.Directory]::CreateDirectory($toolBin) | Out-Null
  # ASCII shim + Unicode environment avoids CMD mis-decoding Chinese installation paths.
  $env:TOOLBOX_BOOTSTRAP_NODE = $node
  $env:TOOLBOX_BOOTSTRAP_PNPM = $pnpm
  $shim = '@echo off' + "`r`n" + '"%TOOLBOX_BOOTSTRAP_NODE%" "%TOOLBOX_BOOTSTRAP_PNPM%" %*' + "`r`n"
  [IO.File]::WriteAllText((Join-Path $toolBin 'pnpm.cmd'), $shim, [Text.Encoding]::ASCII)
  $env:PATH = "$toolBin;$([IO.Path]::GetDirectoryName($node));$originalPath"
  $pnpmActual = & $node $pnpm --version
  if ($LASTEXITCODE -ne 0 -or $pnpmActual -ne $PnpmVersion) { throw 'The isolated pnpm runtime did not pass its version check.' }
  $env:TOOLBOX_SOURCE_MANAGED = '1'

  # Effective configuration and ports are checked again by the TypeScript CLI before package mutations.
  Write-Host '[3/6] Workspace dependencies and shared contracts' -ForegroundColor Cyan
  Invoke-Checked $node @($pnpm, 'install', '--frozen-lockfile', '--prefer-offline')
  Invoke-Checked $node @((Join-Path $Root 'scripts\check-source-native.mjs'))
  Invoke-Checked $node @($pnpm, 'build:shared')
  if ($BuildDesktop) {
    Write-Host 'Explicit desktop build requested; skipping capability downloads and service startup.' -ForegroundColor Cyan
    Invoke-Checked $node @($pnpm, 'desktop:make')
    exit 0
  }

  if ($WithCuda) {
    Write-Host '[4/6] Importing signed local CPU capabilities + NVIDIA voice cloning GPU extension (no automatic model downloads)' -ForegroundColor Cyan
  } else {
    Write-Host '[4/6] Importing signed local CPU capabilities; GPU extension excluded. Use start-gpu.bat to add it.' -ForegroundColor Cyan
  }
  $componentArgs = @((Join-Path $Root 'backend\node_modules\tsx\dist\cli.mjs'), '--tsconfig', (Join-Path $Root 'backend\tsconfig.json'), (Join-Path $Root 'scripts\bootstrap-components.ts'))
  if ($WithCuda) { $componentArgs += '--with-cuda' }
  Invoke-Checked $node $componentArgs
  Write-Host '[5/6] Required packages present; installed generations reused. Runtime and online checks are not equivalent to real business acceptance.' -ForegroundColor Green
  if ($PrepareOnly) { Write-Host 'Preparation finished. Run start.bat to launch.'; exit 0 }
  Write-Host '[6/6] Starting services. Keep this window open. Platform login and real business tests may still be required.' -ForegroundColor Cyan
  & (Join-Path $PSScriptRoot 'start-dev.ps1') -NoInstall -ManagedCapabilities -NoBrowser:$NoBrowser
  if ($LASTEXITCODE -ne 0) { throw 'Service startup failed. Review the output and run diagnostics.' }
} catch {
  Write-Host ''
  Write-Host "Bootstrap stopped: $($_.Exception.Message)" -ForegroundColor Red
  Write-Host 'Completed capability installs are retained. Fix this stage, then rerun start.bat; no business data was removed.'
  exit 1
} finally {
  $env:PATH = $originalPath
  $env:TOOLBOX_SOURCE_MANAGED = $originalManaged
  $env:TOOLBOX_BOOTSTRAP_NODE = $originalNode
  $env:TOOLBOX_BOOTSTRAP_PNPM = $originalPnpm
  if ($lock) { $lock.Dispose() }
}
