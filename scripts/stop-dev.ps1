# 中文模块说明：工程与 Worker 脚本，负责 开发、清理、构建或发布自动化
param(
  [switch]$CheckOnly
)

$ErrorActionPreference = "Stop"
$Root = Resolve-Path (Join-Path $PSScriptRoot "..")
$KnownServices = @(
  [PSCustomObject]@{ Name = "backend"; Port = 3100 },
  [PSCustomObject]@{ Name = "frontend"; Port = 5173 },
  [PSCustomObject]@{ Name = "image AI worker"; Port = 3210 },
  [PSCustomObject]@{ Name = "Chatterbox worker"; Port = 3220 }
)

function Write-Step {
  param([string]$Message)
  Write-Host ""
  Write-Host "==> $Message" -ForegroundColor Cyan
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
    # Keep malformed command lines unchanged so process discovery can continue.
  }

  return $CommandLine.Replace("\", "/").ToLowerInvariant()
}

function Test-ProjectProcess {
  param(
    [int]$ProcessId,
    [object[]]$Processes
  )

  $process = $Processes | Where-Object { $_.ProcessId -eq $ProcessId } | Select-Object -First 1
  if (-not $process) {
    return $false
  }

  $rootText = ("$Root").Replace("\", "/").ToLowerInvariant()
  return (ConvertTo-NormalizedCommandLine $process.CommandLine).Contains($rootText)
}

function Test-ProjectServiceProcess {
  param(
    [object]$Process,
    [object[]]$Processes
  )

  if (-not $Process -or -not (Test-ProjectProcess $Process.ProcessId $Processes)) {
    return $false
  }

  $commandText = ConvertTo-NormalizedCommandLine $Process.CommandLine
  $serviceMarkers = @(
    "/scripts/start-dev.ps1",
    "/scripts/image-ai-worker.py",
    "/scripts/chatterbox-worker.py",
    "/scripts/edge-tts-generate.py",
    "vite --host 0.0.0.0 --port 5173",
    "tsx watch src/server.ts",
    "--filter frontend --filter backend dev",
    "--filter backend --filter frontend dev"
  )

  return $null -ne ($serviceMarkers | Where-Object { $commandText.Contains($_) } | Select-Object -First 1)
}

function Get-PortListenerProcessIds {
  param([int]$Port)

  return @(
    Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue |
      Select-Object -ExpandProperty OwningProcess -Unique |
      Where-Object { $_ -and $_ -ne $PID }
  )
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

function Get-CurrentProcessAncestorIds {
  param([object[]]$Processes)

  $ancestors = [System.Collections.Generic.HashSet[int]]::new()
  $currentId = $PID
  while ($currentId -and $ancestors.Add([int]$currentId)) {
    $process = $Processes | Where-Object { $_.ProcessId -eq $currentId } | Select-Object -First 1
    if (-not $process) {
      break
    }
    $currentId = $process.ParentProcessId
  }
  return ,$ancestors
}

function Stop-ProcessTree {
  param(
    [int]$RootProcessId,
    [object[]]$Processes,
    [System.Collections.Generic.HashSet[int]]$ProtectedProcessIds
  )

  $processIds = [System.Collections.Generic.List[int]]::new()
  $visited = [System.Collections.Generic.HashSet[int]]::new()

  function Add-ProcessTree {
    param([int]$ParentId)

    if (-not $visited.Add($ParentId)) {
      return
    }
    foreach ($child in @($Processes | Where-Object { $_.ParentProcessId -eq $ParentId })) {
      Add-ProcessTree $child.ProcessId
    }
    if (-not $ProtectedProcessIds.Contains($ParentId)) {
      $processIds.Add($ParentId) | Out-Null
    }
  }

  Add-ProcessTree $RootProcessId
  foreach ($processId in $processIds) {
    $process = $Processes | Where-Object { $_.ProcessId -eq $processId } | Select-Object -First 1
    if ($process) {
      Write-Host "Stopping PID $processId ($($process.Name))" -ForegroundColor Yellow
    }
    Stop-Process -Id $processId -Force -ErrorAction SilentlyContinue
  }
}

function Wait-PortFree {
  param(
    [int]$Port,
    [int]$TimeoutSeconds = 12
  )

  $deadline = (Get-Date).AddSeconds($TimeoutSeconds)
  while ((Get-Date) -lt $deadline) {
    if (@(Get-PortListenerProcessIds $Port).Count -eq 0) {
      return $true
    }
    Start-Sleep -Milliseconds 400
  }

  return @(Get-PortListenerProcessIds $Port).Count -eq 0
}

Set-Location -LiteralPath $Root
Write-Host "Ecommerce Toolbox shutdown" -ForegroundColor Green
Write-Host "Project root: $Root"

$processes = Get-ProcessSnapshot
$protectedProcessIds = Get-CurrentProcessAncestorIds $processes
$treeRoots = [System.Collections.Generic.HashSet[int]]::new()
$foreignListeners = [System.Collections.Generic.List[object]]::new()

Write-Step "Finding project services"
foreach ($service in $KnownServices) {
  $listenerIds = @(Get-PortListenerProcessIds $service.Port)
  if ($listenerIds.Count -eq 0) {
    Write-Host "  $($service.Name): not running (port $($service.Port))"
    continue
  }

  foreach ($listenerId in $listenerIds) {
    $treeRoot = Get-ProjectTreeRootProcessId $listenerId $processes
    if ($treeRoot -and -not $protectedProcessIds.Contains([int]$treeRoot)) {
      $treeRoots.Add([int]$treeRoot) | Out-Null
      Write-Host "  $($service.Name): project PID $listenerId on port $($service.Port)" -ForegroundColor Green
    } else {
      $owner = $processes | Where-Object { $_.ProcessId -eq $listenerId } | Select-Object -First 1
      $foreignListeners.Add([PSCustomObject]@{
        Name = $service.Name
        Port = $service.Port
        ProcessId = $listenerId
        ProcessName = if ($owner) { $owner.Name } else { "unknown" }
      }) | Out-Null
      Write-Host "  $($service.Name): port $($service.Port) belongs to another program; skipped" -ForegroundColor DarkYellow
    }
  }
}

foreach ($process in $processes) {
  if (
    -not $protectedProcessIds.Contains([int]$process.ProcessId) -and
    (Test-ProjectServiceProcess $process $processes)
  ) {
    $treeRoot = Get-ProjectTreeRootProcessId $process.ProcessId $processes
    if ($treeRoot -and -not $protectedProcessIds.Contains([int]$treeRoot)) {
      $treeRoots.Add([int]$treeRoot) | Out-Null
    }
  }
}

if ($CheckOnly) {
  Write-Step "Check completed"
  Write-Host "Project process trees found: $($treeRoots.Count)"
  Write-Host "Foreign occupied service ports: $($foreignListeners.Count)"
  exit 0
}

if ($treeRoots.Count -eq 0) {
  Write-Step "No running project services found"
} else {
  Write-Step "Stopping project process trees"
  foreach ($treeRoot in @($treeRoots)) {
    Stop-ProcessTree $treeRoot $processes $protectedProcessIds
  }
}

Write-Step "Verifying service ports"
$failedPorts = [System.Collections.Generic.List[int]]::new()
foreach ($service in $KnownServices) {
  $remainingIds = @(Get-PortListenerProcessIds $service.Port)
  $projectOwnedRemaining = @(
    $remainingIds | Where-Object { Get-ProjectTreeRootProcessId $_ (Get-ProcessSnapshot) }
  )

  if ($projectOwnedRemaining.Count -gt 0 -and -not (Wait-PortFree $service.Port)) {
    $failedPorts.Add([int]$service.Port) | Out-Null
    Write-Host "  Port $($service.Port) is still used by a project process." -ForegroundColor Red
  } elseif ($remainingIds.Count -gt 0) {
    Write-Host "  Port $($service.Port) remains occupied by another program; it was not changed." -ForegroundColor DarkYellow
  } else {
    Write-Host "  Port $($service.Port) is free." -ForegroundColor Green
  }
}

if ($failedPorts.Count -gt 0) {
  throw "Could not stop all project services. Remaining ports: $($failedPorts -join ', ')"
}

Write-Step "All Ecommerce Toolbox services stopped"
