# Shared read-only discovery. Startup takeover and shutdown ownership policies stay in their callers.
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

function Get-PortListenerProcessIds {
  param([int]$Port)

  return @(
    Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue |
      Select-Object -ExpandProperty OwningProcess -Unique |
      Where-Object { $_ -and $_ -ne $PID }
  )
}
