param(
  [switch]$NoInstall,
  [switch]$NoBrowser,
  [switch]$CheckOnly,
  [switch]$ForceRestart,
  [string]$LanHost = ""
)

$ErrorActionPreference = "Stop"
$Root = Resolve-Path (Join-Path $PSScriptRoot "..")

function Write-Step {
  param([string]$Message)
  Write-Host ""
  Write-Host "==> $Message" -ForegroundColor Cyan
}

function Test-CommandExists {
  param([string]$Command)
  return $null -ne (Get-Command $Command -ErrorAction SilentlyContinue)
}

function Get-RootEnvValue {
  param([string]$Name)

  $processValue = [Environment]::GetEnvironmentVariable($Name)
  if ($null -ne $processValue) {
    return $processValue.Trim()
  }

  $envPath = Join-Path $Root ".env"
  if (-not (Test-Path -LiteralPath $envPath)) {
    return ""
  }
  $escapedName = [Regex]::Escape($Name)
  $line = Get-Content -LiteralPath $envPath |
    Where-Object { $_ -match "^\s*$escapedName\s*=" } |
    Select-Object -Last 1
  if (-not $line) {
    return ""
  }
  return (($line -split "=", 2)[1]).Trim().Trim('"').Trim("'")
}

function Find-LanHost {
  if ($LanHost) {
    return $LanHost
  }
  try {
    $address = Get-NetIPAddress -AddressFamily IPv4 -ErrorAction Stop |
      Where-Object {
        $_.IPAddress -ne "127.0.0.1" -and
        -not $_.IPAddress.StartsWith("169.254.") -and
        $_.AddressState -eq "Preferred"
      } |
      ForEach-Object {
        $networkInterface = Get-NetIPInterface `
          -InterfaceIndex $_.InterfaceIndex `
          -AddressFamily IPv4 `
          -ErrorAction SilentlyContinue |
          Select-Object -First 1
        [PSCustomObject]@{
          IPAddress = $_.IPAddress
          InterfaceMetric = if ($networkInterface) { $networkInterface.InterfaceMetric } else { [int]::MaxValue }
          SkipAsSource = $_.SkipAsSource
          VirtualPenalty = if ($_.InterfaceAlias -match "VMware|VirtualBox|vEthernet|Hyper-V|WSL|Loopback") { 1 } else { 0 }
        }
      } |
      Sort-Object -Property VirtualPenalty, InterfaceMetric, SkipAsSource |
      Select-Object -First 1 -ExpandProperty IPAddress
    if ($address) {
      return $address
    }
  } catch {
    Write-Host "LAN address detection failed; using loopback." -ForegroundColor Yellow
  }
  return "127.0.0.1"
}

function Test-PortBusy {
  param([int]$Port)
  return $null -ne (Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1)
}

function Get-PortListenerProcessIds {
  param([int]$Port)

  return @(
    Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue |
      Select-Object -ExpandProperty OwningProcess -Unique |
      Where-Object { $_ -and $_ -ne $PID }
  )
}

function Get-ProcessSnapshot {
  return @(Get-CimInstance Win32_Process -ErrorAction SilentlyContinue)
}

function ConvertTo-NormalizedCommandLine {
  param([string]$CommandLine)

  if (-not $CommandLine) {
    return ""
  }

  try {
    $CommandLine = [Uri]::UnescapeDataString($CommandLine)
  } catch {
    # Keep the original command line if it contains malformed escape sequences.
  }

  return $CommandLine.Replace("\", "/").ToLowerInvariant()
}

function Test-ProjectProcess {
  param(
    [int]$ProcessId,
    [object[]]$Processes = $(Get-ProcessSnapshot)
  )

  $process = $Processes | Where-Object { $_.ProcessId -eq $ProcessId } | Select-Object -First 1
  if (-not $process) {
    return $false
  }

  $rootText = ("$Root").Replace("\", "/").ToLowerInvariant()
  $commandText = ConvertTo-NormalizedCommandLine $process.CommandLine
  return $commandText.Contains($rootText)
}

function Get-ProjectTreeRootProcessId {
  param(
    [int]$ProcessId,
    [object[]]$Processes
  )

  $candidateId = $null
  $currentId = $ProcessId
  $visited = @{}

  while ($currentId -and -not $visited.ContainsKey($currentId)) {
    $visited[$currentId] = $true
    $process = $Processes | Where-Object { $_.ProcessId -eq $currentId } | Select-Object -First 1
    if (-not $process) {
      break
    }

    if (Test-ProjectProcess $currentId $Processes) {
      $candidateId = $currentId
    }

    $currentId = $process.ParentProcessId
  }

  return $candidateId
}

function Stop-ProcessTree {
  param(
    [int]$RootProcessId,
    [object[]]$Processes = $(Get-ProcessSnapshot)
  )

  $processIds = [System.Collections.Generic.List[int]]::new()

  function Add-ProcessTreeChild {
    param([int]$ParentId)

    foreach ($child in @($Processes | Where-Object { $_.ParentProcessId -eq $ParentId })) {
      Add-ProcessTreeChild $child.ProcessId
    }
    if ($ParentId -ne $PID) {
      $processIds.Add($ParentId) | Out-Null
    }
  }

  Add-ProcessTreeChild $RootProcessId
  foreach ($processId in $processIds) {
    Stop-Process -Id $processId -Force -ErrorAction SilentlyContinue
  }
}

function Write-PortOwner {
  param([int]$Port)

  $processes = Get-ProcessSnapshot
  foreach ($processId in @(Get-PortListenerProcessIds $Port)) {
    $process = $processes | Where-Object { $_.ProcessId -eq $processId } | Select-Object -First 1
    if ($process) {
      Write-Host "  PID $processId ($($process.Name)): $($process.CommandLine)" -ForegroundColor Yellow
    } else {
      Write-Host "  PID $processId" -ForegroundColor Yellow
    }
  }
}

function Wait-PortFree {
  param(
    [int]$Port,
    [int]$TimeoutSeconds = 10
  )

  $deadline = (Get-Date).AddSeconds($TimeoutSeconds)
  while ((Get-Date) -lt $deadline) {
    if (-not (Test-PortBusy $Port)) {
      return $true
    }
    Start-Sleep -Milliseconds 500
  }

  return -not (Test-PortBusy $Port)
}

function Restart-Port {
  param(
    [int]$Port,
    [string]$ServiceName
  )

  $processIds = Get-PortListenerProcessIds $Port
  if ($processIds.Count -eq 0) {
    return $true
  }

  Write-Host "Port $Port is already in use; restarting $ServiceName port." -ForegroundColor Yellow
  foreach ($processId in $processIds) {
    try {
      $process = Get-Process -Id $processId -ErrorAction Stop
      Write-Host "Stopping PID $processId ($($process.ProcessName)) on port $Port"
      Stop-Process -Id $processId -Force -ErrorAction Stop
    } catch {
      Write-Host "Could not stop PID $processId on port ${Port}: $($_.Exception.Message)" -ForegroundColor Yellow
    }
  }

  if (Wait-PortFree $Port) {
    Write-Host "Port $Port is free." -ForegroundColor Green
    return $true
  }

  Write-Host "Port $Port is still in use; $ServiceName startup skipped." -ForegroundColor Red
  return $false
}

function Clear-PortForStartup {
  param(
    [int]$Port,
    [string]$ServiceName
  )

  if (-not (Test-PortBusy $Port)) {
    return
  }

  $processes = Get-ProcessSnapshot
  $listenerIds = @(Get-PortListenerProcessIds $Port)
  $projectOwned = $listenerIds.Count -gt 0
  foreach ($processId in $listenerIds) {
    if (-not (Test-ProjectProcess $processId $processes)) {
      $projectOwned = $false
      break
    }
  }

  if ($projectOwned) {
    Write-Host "Found a previous Ecommerce Toolbox $ServiceName process on port $Port; stopping it automatically." -ForegroundColor Yellow
    $treeRoots = @(
      $listenerIds |
        ForEach-Object { Get-ProjectTreeRootProcessId $_ $processes } |
        Where-Object { $_ } |
        Select-Object -Unique
    )
    foreach ($treeRoot in $treeRoots) {
      Stop-ProcessTree $treeRoot $processes
    }
  } elseif ($ForceRestart) {
    Restart-Port $Port $ServiceName | Out-Null
  } else {
    Write-Host "Port $Port is occupied by another program:" -ForegroundColor Red
    Write-PortOwner $Port
    throw "Cannot start $ServiceName safely. Close the program above, or rerun with -ForceRestart if you intend to stop it."
  }

  if (-not (Wait-PortFree $Port 10)) {
    throw "Port $Port did not become available after stopping the previous $ServiceName process."
  }

  Write-Host "Port $Port is ready." -ForegroundColor Green
}

function Test-HttpOk {
  param([string]$Url)
  try {
    $response = Invoke-WebRequest -UseBasicParsing -Uri $Url -TimeoutSec 3
    return $response.StatusCode -ge 200 -and $response.StatusCode -lt 500
  } catch {
    return $false
  }
}

function Wait-HttpOk {
  param(
    [string]$Url,
    [int]$TimeoutSeconds = 30
  )

  $deadline = (Get-Date).AddSeconds($TimeoutSeconds)
  while ((Get-Date) -lt $deadline) {
    if (Test-HttpOk $Url) {
      return $true
    }
    Start-Sleep -Seconds 1
  }

  return Test-HttpOk $Url
}

Set-Location -LiteralPath $Root
$LanHost = Find-LanHost
$ConfiguredDeploymentMode = (Get-RootEnvValue "DEPLOYMENT_MODE").ToLowerInvariant()
$ConfiguredApiHost = (Get-RootEnvValue "API_HOST").ToLowerInvariant()
$FrontendBindHost = if (
  $ConfiguredDeploymentMode -eq "lan" -or
  (-not $ConfiguredDeploymentMode -and $ConfiguredApiHost -in @("0.0.0.0", "::"))
) { "0.0.0.0" } else { "127.0.0.1" }
$env:VITE_DEV_HOST = $FrontendBindHost
$FrontendDisplayHost = if ($FrontendBindHost -eq "0.0.0.0") { $LanHost } else { "127.0.0.1" }
$FrontendUrl = "http://${FrontendDisplayHost}:5173"
$FrontendHealthUrl = "http://127.0.0.1:5173"
$BackendUrl = "http://127.0.0.1:3100/api/v1/health"
$ImageAiHealthUrl = "http://127.0.0.1:3210/health"
$ChatterboxHealthUrl = "http://127.0.0.1:3220/health"
$ChatterboxPython = Join-Path $Root ".venv-chatterbox\Scripts\python.exe"
$ChatterboxScript = Join-Path $Root "scripts\chatterbox-worker.py"

Write-Host "Ecommerce Toolbox launcher" -ForegroundColor Green
Write-Host "Project root: $Root"

if (-not (Test-CommandExists "pnpm")) {
  Write-Host ""
  Write-Host "pnpm was not found. Install pnpm first, or run: corepack enable" -ForegroundColor Red
  exit 1
}

if ($CheckOnly) {
  Write-Step "Script check passed"
  Write-Host "pnpm: $(pnpm -v)"
  exit 0
}

Write-Step "Checking for an existing Ecommerce Toolbox instance"
$processes = Get-ProcessSnapshot
$backendListeners = @(Get-PortListenerProcessIds 3100)
$frontendListeners = @(Get-PortListenerProcessIds 5173)
$existingInstanceIsOwned =
  $backendListeners.Count -gt 0 -and
  $frontendListeners.Count -gt 0 -and
  @($backendListeners | Where-Object { -not (Test-ProjectProcess $_ $processes) }).Count -eq 0 -and
  @($frontendListeners | Where-Object { -not (Test-ProjectProcess $_ $processes) }).Count -eq 0

$ChatterboxInstalled = (Test-Path $ChatterboxPython) -and (Test-Path $ChatterboxScript)
if (
  $existingInstanceIsOwned -and
  (Test-HttpOk $BackendUrl) -and
  (Test-HttpOk $FrontendHealthUrl) -and
  ((-not $ChatterboxInstalled) -or (Test-HttpOk $ChatterboxHealthUrl))
) {
  Write-Host "Ecommerce Toolbox is already running; reusing the existing instance." -ForegroundColor Green
  Write-Host "Frontend: $FrontendUrl" -ForegroundColor Green
  Write-Host "Backend health: $BackendUrl" -ForegroundColor Green
  if (Test-HttpOk $ImageAiHealthUrl) {
    Write-Host "Image AI worker: $ImageAiHealthUrl" -ForegroundColor Green
  }
  if (Test-HttpOk $ChatterboxHealthUrl) {
    Write-Host "Chatterbox V3 worker: $ChatterboxHealthUrl" -ForegroundColor Green
  }
  if (-not $NoBrowser) {
    Start-Process $FrontendUrl
  }
  exit 0
}

if (-not $NoInstall) {
  Write-Step "Verifying dependencies from the lockfile"
  pnpm install --frozen-lockfile --prefer-offline
  if ($LASTEXITCODE -ne 0) {
    throw "Dependency installation failed with exit code $LASTEXITCODE"
  }
}

$EdgeTtsPython = Join-Path $Root ".venv-edge-tts\Scripts\python.exe"
$EdgeTtsScript = Join-Path $Root "scripts\edge-tts-generate.py"
$EdgeTtsSetup = Join-Path $Root "scripts\setup-edge-tts.ps1"
$EdgeTtsReady = $false

if ((Test-Path $EdgeTtsPython) -and (Test-Path $EdgeTtsScript)) {
  & $EdgeTtsPython $EdgeTtsScript check | Out-Null
  $EdgeTtsReady = $LASTEXITCODE -eq 0
}

if (-not $EdgeTtsReady -and -not $NoInstall -and (Test-CommandExists "python")) {
  Write-Step "Installing the optional Edge-TTS runtime"
  try {
    & $EdgeTtsSetup -Python "python"
    $EdgeTtsReady = $LASTEXITCODE -eq 0
  } catch {
    Write-Host "Edge-TTS setup did not complete: $($_.Exception.Message)" -ForegroundColor Yellow
  }
}

if ($EdgeTtsReady) {
  Write-Host "Edge-TTS runtime ready: $EdgeTtsPython" -ForegroundColor Green
} else {
  Write-Host "Edge-TTS runtime is unavailable; run scripts\setup-edge-tts.ps1 to enable speech generation." -ForegroundColor Yellow
}

Write-Step "Preparing backend port"
Clear-PortForStartup 3100 "backend"

Write-Step "Preparing frontend port"
Clear-PortForStartup 5173 "frontend"

$ImageAiWorker = $null
$ImageAiPython = Join-Path $Root ".venv-image-ai\Scripts\python.exe"
$ImageAiScript = Join-Path $Root "scripts\image-ai-worker.py"
$ImageAiLogDir = Join-Path $Root ".logs"
$ImageAiOutputLog = Join-Path $ImageAiLogDir "image-ai-worker.log"
$ImageAiErrorLog = Join-Path $ImageAiLogDir "image-ai-worker.error.log"

if ((Test-Path $ImageAiPython) -and (Test-PortBusy 3210) -and -not (Test-HttpOk $ImageAiHealthUrl)) {
  if ($ForceRestart) {
    Write-Step "Preparing image AI worker port"
    Restart-Port 3210 "image AI worker" | Out-Null
  } else {
    Write-Host "Port 3210 is occupied by an unhealthy service; image AI startup is skipped." -ForegroundColor Yellow
  }
}

if ((Test-Path $ImageAiPython) -and -not (Test-PortBusy 3210)) {
  Write-Step "Starting local image AI worker"
  New-Item -ItemType Directory -Path $ImageAiLogDir -Force | Out-Null
  $ImageAiWorker = Start-Process `
    -FilePath $ImageAiPython `
    -ArgumentList @("`"$ImageAiScript`"", "--host", "127.0.0.1", "--port", "3210") `
    -WorkingDirectory $Root `
    -WindowStyle Hidden `
    -RedirectStandardOutput $ImageAiOutputLog `
    -RedirectStandardError $ImageAiErrorLog `
    -PassThru
  Write-Host "Image AI worker PID: $($ImageAiWorker.Id)" -ForegroundColor Green

  if (Wait-HttpOk $ImageAiHealthUrl 60) {
    Write-Host "Image AI worker ready: $ImageAiHealthUrl" -ForegroundColor Green
  } else {
    Write-Host "Image AI worker did not become ready. See $ImageAiErrorLog" -ForegroundColor Red
    if (-not $ImageAiWorker.HasExited) {
      Stop-Process -Id $ImageAiWorker.Id -Force -ErrorAction SilentlyContinue
    }
    $ImageAiWorker = $null
  }
} elseif (-not (Test-Path $ImageAiPython)) {
  Write-Host "Image AI runtime is not installed; run scripts\setup-image-ai.ps1 when AI tools are needed." -ForegroundColor Yellow
}

if ((Test-PortBusy 3210) -and (Test-HttpOk $ImageAiHealthUrl)) {
  Write-Host "Using the existing healthy image AI worker: $ImageAiHealthUrl" -ForegroundColor Green
}

$ChatterboxWorker = $null
$ChatterboxLogDir = Join-Path $Root ".logs"
$ChatterboxOutputLog = Join-Path $ChatterboxLogDir "chatterbox-worker.log"
$ChatterboxErrorLog = Join-Path $ChatterboxLogDir "chatterbox-worker.error.log"

if ($ChatterboxInstalled -and (Test-PortBusy 3220) -and -not (Test-HttpOk $ChatterboxHealthUrl)) {
  if ($ForceRestart) {
    Write-Step "Preparing Chatterbox worker port"
    Restart-Port 3220 "Chatterbox worker" | Out-Null
  } else {
    Write-Host "Port 3220 is occupied by an unhealthy service; Chatterbox startup is skipped." -ForegroundColor Yellow
  }
}

if ($ChatterboxInstalled -and -not (Test-PortBusy 3220)) {
  Write-Step "Starting local Chatterbox Multilingual V3 worker"
  New-Item -ItemType Directory -Path $ChatterboxLogDir -Force | Out-Null
  $ChatterboxWorker = Start-Process `
    -FilePath $ChatterboxPython `
    -ArgumentList @("`"$ChatterboxScript`"", "--host", "127.0.0.1", "--port", "3220") `
    -WorkingDirectory $Root `
    -WindowStyle Hidden `
    -RedirectStandardOutput $ChatterboxOutputLog `
    -RedirectStandardError $ChatterboxErrorLog `
    -PassThru
  Write-Host "Chatterbox worker PID: $($ChatterboxWorker.Id)" -ForegroundColor Green

  if (Wait-HttpOk $ChatterboxHealthUrl 60) {
    Write-Host "Chatterbox V3 worker ready: $ChatterboxHealthUrl" -ForegroundColor Green
  } else {
    Write-Host "Chatterbox worker did not become ready. See $ChatterboxErrorLog" -ForegroundColor Red
    if (-not $ChatterboxWorker.HasExited) {
      Stop-Process -Id $ChatterboxWorker.Id -Force -ErrorAction SilentlyContinue
    }
    $ChatterboxWorker = $null
  }
} elseif (-not $ChatterboxInstalled) {
  Write-Host "Chatterbox runtime is not installed; run scripts\setup-chatterbox.ps1 -DownloadModel to enable voice cloning." -ForegroundColor Yellow
}

if ((Test-PortBusy 3220) -and (Test-HttpOk $ChatterboxHealthUrl)) {
  Write-Host "Using the existing healthy Chatterbox worker: $ChatterboxHealthUrl" -ForegroundColor Green
}

if (-not $NoBrowser) {
  Start-Job -ArgumentList $FrontendUrl, $BackendUrl -ScriptBlock {
    param([string]$FrontendUrl, [string]$BackendUrl)

    function Test-HttpOk {
      param([string]$Url)
      try {
        $response = Invoke-WebRequest -UseBasicParsing -Uri $Url -TimeoutSec 3
        return $response.StatusCode -ge 200 -and $response.StatusCode -lt 500
      } catch {
        return $false
      }
    }

    $deadline = (Get-Date).AddSeconds(45)
    while ((Get-Date) -lt $deadline) {
      if ((Test-HttpOk $FrontendUrl) -and (Test-HttpOk $BackendUrl)) {
        Start-Process $FrontendUrl
        return
      }
      Start-Sleep -Seconds 1
    }
  } | Out-Null

  Write-Host "Browser will open when frontend and backend are ready." -ForegroundColor Green
}

Write-Host ""
Write-Step "Starting frontend and backend in this terminal"
Write-Host "Frontend: $FrontendUrl" -ForegroundColor Green
Write-Host "Backend health: $BackendUrl" -ForegroundColor Green
Write-Host "Image AI worker: $ImageAiHealthUrl" -ForegroundColor Green
Write-Host "Chatterbox V3 worker: $ChatterboxHealthUrl" -ForegroundColor Green
Write-Host "Press Ctrl+C in this terminal to stop frontend, backend, and local AI workers." -ForegroundColor Green
Write-Host ""

try {
  pnpm --parallel --filter frontend --filter backend dev
} finally {
  if ($ImageAiWorker -and -not $ImageAiWorker.HasExited) {
    Write-Step "Stopping local image AI worker"
    Stop-Process -Id $ImageAiWorker.Id -Force -ErrorAction SilentlyContinue
    Wait-PortFree 3210 10 | Out-Null
  }
  if ($ChatterboxWorker -and -not $ChatterboxWorker.HasExited) {
    Write-Step "Stopping local Chatterbox worker"
    Stop-Process -Id $ChatterboxWorker.Id -Force -ErrorAction SilentlyContinue
    Wait-PortFree 3220 10 | Out-Null
  }
}
