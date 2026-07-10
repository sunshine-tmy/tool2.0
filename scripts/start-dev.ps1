param(
  [switch]$NoInstall,
  [switch]$NoBrowser,
  [switch]$CheckOnly
)

$ErrorActionPreference = "Stop"
$Root = Resolve-Path (Join-Path $PSScriptRoot "..")
$LanHost = "192.168.1.241"
$FrontendUrl = "http://${LanHost}:5173"
$BackendUrl = "http://${LanHost}:3100/api/health"

function Write-Step {
  param([string]$Message)
  Write-Host ""
  Write-Host "==> $Message" -ForegroundColor Cyan
}

function Test-CommandExists {
  param([string]$Command)
  return $null -ne (Get-Command $Command -ErrorAction SilentlyContinue)
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

if (-not $NoInstall) {
  if (-not (Test-Path "node_modules")) {
    Write-Step "Installing dependencies"
    pnpm install
  } else {
    Write-Step "node_modules exists; skipping install"
  }
}

Write-Step "Preparing backend port"
if (Test-PortBusy 3100) {
  Restart-Port 3100 "backend" | Out-Null
}

Write-Step "Preparing frontend port"
if (Test-PortBusy 5173) {
  Restart-Port 5173 "frontend" | Out-Null
}

$ImageAiWorker = $null
$ImageAiPython = Join-Path $Root ".venv-image-ai\Scripts\python.exe"
$ImageAiScript = Join-Path $Root "scripts\image-ai-worker.py"
$ImageAiHealthUrl = "http://127.0.0.1:3210/health"
$ImageAiLogDir = Join-Path $Root ".logs"
$ImageAiOutputLog = Join-Path $ImageAiLogDir "image-ai-worker.log"
$ImageAiErrorLog = Join-Path $ImageAiLogDir "image-ai-worker.error.log"

if ((Test-Path $ImageAiPython) -and (Test-PortBusy 3210)) {
  Write-Step "Preparing image AI worker port"
  Restart-Port 3210 "image AI worker" | Out-Null
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
Write-Host "Press Ctrl+C in this terminal to stop frontend, backend, and the image AI worker." -ForegroundColor Green
Write-Host ""

try {
  pnpm --parallel --filter frontend --filter backend dev
} finally {
  if ($ImageAiWorker -and -not $ImageAiWorker.HasExited) {
    Write-Step "Stopping local image AI worker"
    Stop-Process -Id $ImageAiWorker.Id -Force -ErrorAction SilentlyContinue
    Wait-PortFree 3210 10 | Out-Null
  }
}
