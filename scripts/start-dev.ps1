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
  return $null -ne (Get-NetTCPConnection -LocalPort $Port -ErrorAction SilentlyContinue | Select-Object -First 1)
}

function Get-PowerShellPath {
  $pwsh = Get-Command pwsh -ErrorAction SilentlyContinue
  if ($pwsh) {
    return $pwsh.Source
  }

  return "powershell.exe"
}

function Start-ServiceWindow {
  param(
    [string]$Title,
    [string]$Command
  )

  $powerShellPath = Get-PowerShellPath
  $escapedRoot = $Root.Path.Replace("'", "''")
  $fullCommand = "Set-Location -LiteralPath '$escapedRoot'; `$Host.UI.RawUI.WindowTitle = '$Title'; $Command"

  Start-Process -FilePath $powerShellPath -ArgumentList @(
    "-NoExit",
    "-NoProfile",
    "-ExecutionPolicy",
    "Bypass",
    "-Command",
    $fullCommand
  )
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

Write-Step "Starting backend"
if (Test-PortBusy 3100) {
  Write-Host "Port 3100 is already in use; backend startup skipped." -ForegroundColor Yellow
} else {
  Start-ServiceWindow "Toolbox API :3100" "pnpm --filter backend dev"
}

Write-Step "Starting frontend"
if (Test-PortBusy 5173) {
  Write-Host "Port 5173 is already in use; frontend startup skipped." -ForegroundColor Yellow
} else {
  Start-ServiceWindow "Toolbox Web :5173" "pnpm --filter frontend dev"
}

Write-Step "Waiting for services"
Start-Sleep -Seconds 3

Write-Host "Frontend: $FrontendUrl" -ForegroundColor Green
Write-Host "Backend health: $BackendUrl" -ForegroundColor Green

if (-not $NoBrowser) {
  Start-Process $FrontendUrl
}

Write-Host ""
Write-Host "Startup finished. Close the frontend/backend terminal windows to stop services." -ForegroundColor Green
