$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $PSScriptRoot
$runtimeDir = Join-Path $root ".runtime"
$pidFile = Join-Path $runtimeDir "services.pid"
$aiPidFile = Join-Path $runtimeDir "image-ai.pid"
$stdoutLog = Join-Path $runtimeDir "services.log"
$stderrLog = Join-Path $runtimeDir "services-error.log"
$aiStdoutLog = Join-Path $runtimeDir "image-ai.log"
$aiStderrLog = Join-Path $runtimeDir "image-ai-error.log"
Set-Location -LiteralPath $root

function Read-EnvValue([string]$Name, [string]$Fallback) {
  $envValue = [Environment]::GetEnvironmentVariable($Name)
  if ($envValue) { return $envValue }
  $envFile = Join-Path $root ".env"
  if (Test-Path -LiteralPath $envFile) {
    $line = Get-Content -LiteralPath $envFile -Encoding UTF8 | Where-Object {
      $_ -match "^\s*$([regex]::Escape($Name))\s*="
    } | Select-Object -First 1
    if ($line) { return (($line -split "=", 2)[1]).Trim().Trim('"').Trim("'") }
  }
  return $Fallback
}

function Test-Http([string]$Url) {
  try {
    $response = Invoke-WebRequest -Uri $Url -UseBasicParsing -TimeoutSec 2
    return $response.StatusCode -ge 200 -and $response.StatusCode -lt 500
  } catch {
    return $false
  }
}

function Get-ApiName([string]$Url) {
  try {
    $response = Invoke-RestMethod -Uri $Url -TimeoutSec 2
    return [string]$response.data.name
  } catch {
    return ""
  }
}

function Test-StandaloneWeb([string]$Url) {
  try {
    $response = Invoke-WebRequest -Uri $Url -UseBasicParsing -TimeoutSec 2
    return $response.Content.Contains('content="lan-file-transfer-standalone"')
  } catch {
    return $false
  }
}

function Test-ImageAi([string]$Url) {
  try {
    $response = Invoke-RestMethod -Uri "$Url/health" -TimeoutSec 4
    return $response.success -eq $true
  } catch {
    return $false
  }
}

function Test-PortUsed([int]$Port) {
  return $null -ne (Get-NetTCPConnection -State Listen -LocalPort $Port -ErrorAction SilentlyContinue | Select-Object -First 1)
}

function Find-FreePort([int]$StartPort, [int[]]$ExcludedPorts) {
  for ($candidate = $StartPort; $candidate -le [Math]::Min($StartPort + 200, 65535); $candidate++) {
    if ($ExcludedPorts -notcontains $candidate -and -not (Test-PortUsed $candidate)) {
      return $candidate
    }
  }
  throw "No available port was found near $StartPort."
}

function Stop-ServiceTree([int]$ProcessId) {
  if (Get-Process -Id $ProcessId -ErrorAction SilentlyContinue) {
    & taskkill.exe /PID $ProcessId /T /F 2>$null | Out-Null
  }
}

try {
  $nodeCommand = Get-Command node.exe -ErrorAction Stop
} catch {
  throw "Node.js was not found. Install Node.js 20 or 22 LTS from https://nodejs.org/"
}

$nodeMajor = [int]((& $nodeCommand.Source -p "process.versions.node.split('.')[0]").Trim())
if ($nodeMajor -lt 20 -or $nodeMajor -ge 25) {
  throw "Current Node.js major version is $nodeMajor. This project requires Node.js 20, 22, or 24."
}

$npmCommand = (Get-Command npm.cmd -ErrorAction Stop).Source
$apiPort = [int](Read-EnvValue "API_PORT" "3110")
$webPort = [int](Read-EnvValue "LAN_TRANSFER_WEB_PORT" "5183")
$aiPort = [int](Read-EnvValue "IMAGE_AI_WORKER_PORT" "3210")
$localUrl = "http://127.0.0.1:$webPort/tools/lan-transfer"
$healthUrl = "http://127.0.0.1:$apiPort/api/health"
$aiUrl = "http://127.0.0.1:$aiPort"

$apiName = Get-ApiName $healthUrl
$standaloneWebRunning = Test-StandaloneWeb $localUrl
if ($apiName -eq "standalone-toolbox-api" -and $standaloneWebRunning) {
  Write-Host "Services are already running: $localUrl" -ForegroundColor Green
  if ($env:LAN_TRANSFER_NO_BROWSER -ne "1") { Start-Process $localUrl }
  return
}
if ($apiName -or (Test-Http $localUrl)) {
  throw "Port $apiPort or $webPort is already used by another application. Stop it or change API_PORT and LAN_TRANSFER_WEB_PORT in .env."
}
$venvPython = Join-Path $root ".venv-image-ai\Scripts\python.exe"
$aiReadyMarker = Join-Path $root ".venv-image-ai\.ready"
$aiRuntimeInstalled = (Test-Path -LiteralPath $venvPython) -and (Test-Path -LiteralPath $aiReadyMarker)
if (Test-PortUsed $aiPort) {
  $aiPort = Find-FreePort ($aiPort + 1) @($apiPort, $webPort)
  $aiUrl = "http://127.0.0.1:$aiPort"
  Write-Host "AI default port is in use. Switched to $aiPort." -ForegroundColor Yellow
}
$env:IMAGE_AI_WORKER_URL = $aiUrl

New-Item -ItemType Directory -Force -Path $runtimeDir | Out-Null

Write-Host "[1/4] Checking Node.js dependencies..." -ForegroundColor Cyan
if (-not (Test-Path -LiteralPath (Join-Path $root "node_modules\.package-lock.json"))) {
  Write-Host "First run: installing dependencies. This may take a few minutes..."
  & $npmCommand ci --no-audit --no-fund
  if ($LASTEXITCODE -ne 0) { throw "Dependency installation failed. Check the npm output and network connection." }
} else {
  Write-Host "Dependencies are already installed."
}

Write-Host "[2/4] Checking frontend and backend builds..." -ForegroundColor Cyan
$frontendBuild = Join-Path $root "frontend\dist\index.html"
$backendBuild = Join-Path $root "backend\dist\server.js"
if (-not (Test-Path -LiteralPath $frontendBuild) -or -not (Test-Path -LiteralPath $backendBuild)) {
  & $npmCommand run build
  if ($LASTEXITCODE -ne 0) { throw "Build failed. Check the error output above." }
} else {
  Write-Host "Build output already exists."
}

if (Test-Path -LiteralPath $stdoutLog) { Remove-Item -LiteralPath $stdoutLog -Force }
if (Test-Path -LiteralPath $stderrLog) { Remove-Item -LiteralPath $stderrLog -Force }
if (Test-Path -LiteralPath $aiStdoutLog) { Remove-Item -LiteralPath $aiStdoutLog -Force }
if (Test-Path -LiteralPath $aiStderrLog) { Remove-Item -LiteralPath $aiStderrLog -Force }

Write-Host "[3/4] Checking the optional image AI service..." -ForegroundColor Cyan
$aiService = $null
$aiReady = $false
if ($aiRuntimeInstalled) {
  $aiService = Start-Process -FilePath $venvPython `
    -ArgumentList @((Join-Path $PSScriptRoot "image-ai-worker.py"), "--host", "127.0.0.1", "--port", [string]$aiPort) `
    -WorkingDirectory $root `
    -WindowStyle Hidden `
    -RedirectStandardOutput $aiStdoutLog `
    -RedirectStandardError $aiStderrLog `
    -PassThru
  Set-Content -LiteralPath $aiPidFile -Value $aiService.Id -Encoding ASCII

  for ($attempt = 0; $attempt -lt 120; $attempt++) {
    Start-Sleep -Milliseconds 500
    if ($aiService.HasExited) { break }
    if (Test-ImageAi $aiUrl) {
      $aiReady = $true
      break
    }
  }
  if (-not $aiReady) {
    Stop-ServiceTree $aiService.Id
    Remove-Item -LiteralPath $aiPidFile -Force -ErrorAction SilentlyContinue
    $aiService = $null
    Write-Host "Image AI is installed but did not start. File transfer and image compression will continue." -ForegroundColor Yellow
  }
} else {
  Write-Host "Image AI is not installed. Skipping it; install it later from the AI page." -ForegroundColor Yellow
}

Write-Host "[4/4] Starting frontend and backend services..." -ForegroundColor Cyan
$service = Start-Process -FilePath $npmCommand `
  -ArgumentList @("run", "serve") `
  -WorkingDirectory $root `
  -WindowStyle Hidden `
  -RedirectStandardOutput $stdoutLog `
  -RedirectStandardError $stderrLog `
  -PassThru
Set-Content -LiteralPath $pidFile -Value $service.Id -Encoding ASCII

$ready = $false
for ($attempt = 0; $attempt -lt 40; $attempt++) {
  Start-Sleep -Milliseconds 500
  if ($service.HasExited) { break }
  if ((Get-ApiName $healthUrl) -eq "standalone-toolbox-api" -and (Test-StandaloneWeb $localUrl)) {
    $ready = $true
    break
  }
}

if (-not $ready) {
  Stop-ServiceTree $service.Id
  if ($aiService) {
    Stop-ServiceTree $aiService.Id
    Remove-Item -LiteralPath $aiPidFile -Force -ErrorAction SilentlyContinue
  }
  Write-Host "`nService logs:" -ForegroundColor Yellow
  if (Test-Path -LiteralPath $stdoutLog) { Get-Content -LiteralPath $stdoutLog -Tail 40 }
  if (Test-Path -LiteralPath $stderrLog) { Get-Content -LiteralPath $stderrLog -Tail 40 }
  throw "Services did not become ready in time."
}

$lanUrls = [System.Net.NetworkInformation.NetworkInterface]::GetAllNetworkInterfaces() |
  Where-Object { $_.OperationalStatus -eq "Up" } |
  ForEach-Object { $_.GetIPProperties().UnicastAddresses } |
  Where-Object {
    $_.Address.AddressFamily -eq [System.Net.Sockets.AddressFamily]::InterNetwork -and
    -not [System.Net.IPAddress]::IsLoopback($_.Address) -and
    -not $_.Address.ToString().StartsWith("169.254.")
  } |
  ForEach-Object { "http://$($_.Address):$webPort/tools/lan-transfer" } |
  Sort-Object -Unique

Write-Host "`nIndependent toolbox is ready." -ForegroundColor Green
Write-Host "Local URL: $localUrl"
foreach ($url in $lanUrls) { Write-Host "LAN URL: $url" -ForegroundColor Green }
if ($aiReady) {
  Write-Host "Image AI: ready at $aiUrl" -ForegroundColor Green
} else {
  Write-Host "Image AI: not installed or not running; install it on the AI page when needed." -ForegroundColor Yellow
}
Write-Host "Double-click Windows一键停止.bat to stop all services. Logs are in .runtime."
if ($env:LAN_TRANSFER_NO_BROWSER -ne "1") { Start-Process $localUrl }
