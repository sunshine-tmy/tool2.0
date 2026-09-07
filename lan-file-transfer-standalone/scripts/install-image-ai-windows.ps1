param(
  [switch]$ValidateOnly
)

Set-StrictMode -Version 2.0
$ErrorActionPreference = "Stop"
$ProgressPreference = "SilentlyContinue"

$root = Split-Path -Parent $PSScriptRoot
$runtimeDir = Join-Path $root ".runtime"
$installer = Join-Path $root "python-3.11.9-amd64.exe"
$setupScript = Join-Path $PSScriptRoot "setup-image-ai.ps1"
$readyMarker = Join-Path $root ".venv-image-ai\.ready"
$transcriptPath = Join-Path $runtimeDir "image-ai-install-transcript.log"
$progressPath = Join-Path $runtimeDir "image-ai-install-progress.json"
$transcriptStarted = $false
$exitCode = 1
$installStartedAt = [DateTime]::UtcNow.ToString("o")
$env:IMAGE_AI_INSTALL_STARTED_AT = $installStartedAt

function Write-InstallProgress {
  param(
    [string]$Stage,
    [int]$Progress,
    [string]$Message
  )

  New-Item -ItemType Directory -Path $runtimeDir -Force | Out-Null
  $value = @{
    stage = $Stage
    progress = $Progress
    message = $Message
    startedAt = $installStartedAt
    updatedAt = [DateTime]::UtcNow.ToString("o")
  } | ConvertTo-Json
  [System.IO.File]::WriteAllText($progressPath, $value, [System.Text.UTF8Encoding]::new($false))
}

function Resolve-Python311 {
  $py = Get-Command py.exe -ErrorAction SilentlyContinue
  if ($py) {
    $detected = & $py.Source -3.11 -c "import sys; print(sys.executable if sys.version_info[:2] == (3, 11) else '')" 2>$null
    if ($LASTEXITCODE -eq 0 -and $detected) {
      return ([string]$detected).Trim()
    }
  }

  $candidates = @(
    (Join-Path $env:LocalAppData "Programs\Python\Python311\python.exe"),
    "C:\Program Files\Python311\python.exe"
  )
  foreach ($candidate in $candidates) {
    if (-not (Test-Path -LiteralPath $candidate)) { continue }
    $version = & $candidate -c "import sys; print(f'{sys.version_info.major}.{sys.version_info.minor}')" 2>$null
    if ($LASTEXITCODE -eq 0 -and ([string]$version).Trim() -eq "3.11") {
      return $candidate
    }
  }
  return $null
}

try {
  New-Item -ItemType Directory -Path $runtimeDir -Force | Out-Null
  try {
    Start-Transcript -LiteralPath $transcriptPath -Append -Force | Out-Null
    $transcriptStarted = $true
  }
  catch {
    Write-Warning "无法启动安装记录文件：$($_.Exception.Message)"
  }

  Write-Output "[$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')] AI 图片处理环境安装程序已启动。"
  Write-Output "项目目录：$root"
  Write-InstallProgress "preparing" 2 "正在检查 Python 和本机安装环境"

  $pythonExecutable = Resolve-Python311
  if (-not $pythonExecutable) {
    if (-not (Test-Path -LiteralPath $installer)) {
      throw "未找到 Python 3.11，也未找到随包附带的 python-3.11.9-amd64.exe。"
    }

    Write-InstallProgress "python" 4 "等待完成 Python 3.11 安装"
    Write-Output "正在打开 Python 3.11 官方安装程序，请在窗口中完成安装……"
    $process = Start-Process -FilePath $installer -Wait -PassThru
    if ($process.ExitCode -ne 0) {
      throw "Python 安装未完成，安装程序退出码：$($process.ExitCode)"
    }

    $pythonExecutable = Resolve-Python311
    if (-not $pythonExecutable) {
      throw "安装程序已关闭，但仍未检测到 Python 3.11。请重新安装并勾选 py launcher。"
    }
  }

  Write-Output "Python 3.11 已就绪：$pythonExecutable"
  Write-InstallProgress "environment" 8 "Python 3.11 已就绪，准备创建独立环境"
  if ($ValidateOnly) {
    Write-Output "安装前置检查通过，未安装 AI 依赖和模型。"
    $exitCode = 0
  }
  else {
    Write-Output "开始安装 AI 依赖和模型，首次安装需要较长时间……"
    & $setupScript -Python $pythonExecutable -ProgressPath $progressPath
    if (-not (Test-Path -LiteralPath $readyMarker)) {
      throw "AI 环境安装脚本已经结束，但未生成就绪标记。"
    }
    Write-Output "AI 图片处理环境安装完成。"
    $exitCode = 0
  }
}
catch {
  $failureMessage = $_.Exception.Message
  $failedProgress = 0
  try {
    if (Test-Path -LiteralPath $progressPath) {
      $savedProgress = Get-Content -Raw -LiteralPath $progressPath | ConvertFrom-Json
      $failedProgress = [int]$savedProgress.progress
    }
  } catch {}
  Write-InstallProgress "failed" $failedProgress "AI 图片处理环境安装失败：$failureMessage"
  Write-Error "AI 图片处理环境安装失败：$failureMessage" -ErrorAction Continue
  $exitCode = 1
}
finally {
  if ($transcriptStarted) {
    try { Stop-Transcript | Out-Null } catch {}
  }
}

exit $exitCode
