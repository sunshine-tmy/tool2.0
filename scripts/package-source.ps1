param(
  [switch]$Preview
)

$ErrorActionPreference = "Stop"
$Root = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$OutputRoot = Join-Path $Root ".package"
$StagingRoot = Join-Path $OutputRoot "toolbox-source"
$PackagePath = Join-Path $OutputRoot "ecommerce-toolbox-source.zip"
$TemporaryPackagePath = Join-Path $OutputRoot "ecommerce-toolbox-source.tmp.zip"

function Write-Step {
  param([string]$Message)
  Write-Host ""
  Write-Host "==> $Message" -ForegroundColor Cyan
}

function Test-PathInsideRoot {
  param(
    [string]$Path,
    [string]$ExpectedRoot
  )

  $fullPath = [System.IO.Path]::GetFullPath($Path).TrimEnd("\", "/")
  $fullRoot = [System.IO.Path]::GetFullPath($ExpectedRoot).TrimEnd("\", "/")
  return $fullPath.StartsWith("$fullRoot\", [System.StringComparison]::OrdinalIgnoreCase)
}

function Test-IsLocalSecret {
  param([string]$RelativePath)

  $normalized = $RelativePath.Replace("\", "/")
  $name = [System.IO.Path]::GetFileName($normalized)
  if ($name -eq ".env.example") {
    return $false
  }

  return $name -eq ".env" -or $name.StartsWith(".env.", [System.StringComparison]::OrdinalIgnoreCase)
}

function Format-ByteSize {
  param([long]$Bytes)

  if ($Bytes -ge 1GB) { return "{0:N2} GB" -f ($Bytes / 1GB) }
  if ($Bytes -ge 1MB) { return "{0:N2} MB" -f ($Bytes / 1MB) }
  if ($Bytes -ge 1KB) { return "{0:N2} KB" -f ($Bytes / 1KB) }
  return "$Bytes bytes"
}

if (-not (Get-Command git -ErrorAction SilentlyContinue)) {
  throw "Git was not found. Install Git before creating a source-only package."
}

if (-not (Test-PathInsideRoot $OutputRoot $Root)) {
  throw "Unsafe package output path: $OutputRoot"
}
if (-not (Test-PathInsideRoot $StagingRoot $Root)) {
  throw "Unsafe staging path: $StagingRoot"
}

Write-Host "Ecommerce Toolbox source packager" -ForegroundColor Green
Write-Host "Project root: $Root"

Write-Step "Collecting project files"
$gitFiles = @(& git -C $Root ls-files --cached --others --exclude-standard)
if ($LASTEXITCODE -ne 0) {
  throw "Git could not enumerate project files."
}

$files = [System.Collections.Generic.List[object]]::new()
$skippedSecrets = [System.Collections.Generic.List[string]]::new()
$totalBytes = [long]0

foreach ($relativePath in @($gitFiles | Sort-Object -Unique)) {
  if (-not $relativePath) {
    continue
  }

  $normalized = $relativePath.Replace("\", "/")
  if ($normalized.StartsWith(".package/", [System.StringComparison]::OrdinalIgnoreCase)) {
    continue
  }
  if (Test-IsLocalSecret $normalized) {
    $skippedSecrets.Add($normalized) | Out-Null
    continue
  }
  if ([System.IO.Path]::IsPathRooted($normalized) -or $normalized.Split("/") -contains "..") {
    throw "Unsafe project path returned by Git: $relativePath"
  }

  $sourcePath = [System.IO.Path]::GetFullPath((Join-Path $Root $relativePath))
  if (-not (Test-PathInsideRoot $sourcePath $Root)) {
    throw "Project file resolves outside the project root: $relativePath"
  }
  if (-not (Test-Path -LiteralPath $sourcePath -PathType Leaf)) {
    continue
  }

  $file = Get-Item -LiteralPath $sourcePath
  $files.Add([PSCustomObject]@{
    RelativePath = $normalized
    SourcePath = $sourcePath
    Length = [long]$file.Length
  }) | Out-Null
  $totalBytes += [long]$file.Length
}

Write-Host "Project files: $($files.Count)" -ForegroundColor Green
Write-Host "Uncompressed size: $(Format-ByteSize $totalBytes)"
if ($skippedSecrets.Count -gt 0) {
  Write-Host "Local environment files excluded: $($skippedSecrets.Count)" -ForegroundColor Yellow
}
Write-Host "Excluded by project rules: dependencies, virtual environments, models, build output, logs, caches and runtime storage."

if ($Preview) {
  Write-Step "Preview completed; no files were changed"
  exit 0
}

Write-Step "Building clean source package"
New-Item -ItemType Directory -Path $OutputRoot -Force | Out-Null
if (Test-Path -LiteralPath $StagingRoot) {
  Remove-Item -LiteralPath $StagingRoot -Recurse -Force
}
New-Item -ItemType Directory -Path $StagingRoot -Force | Out-Null

try {
  foreach ($file in $files) {
    $destinationPath = Join-Path $StagingRoot $file.RelativePath
    $destinationDirectory = Split-Path -Parent $destinationPath
    if (-not (Test-Path -LiteralPath $destinationDirectory)) {
      New-Item -ItemType Directory -Path $destinationDirectory -Force | Out-Null
    }
    Copy-Item -LiteralPath $file.SourcePath -Destination $destinationPath -Force
  }

  if (Test-Path -LiteralPath $TemporaryPackagePath) {
    Remove-Item -LiteralPath $TemporaryPackagePath -Force
  }

  Add-Type -AssemblyName System.IO.Compression.FileSystem
  [System.IO.Compression.ZipFile]::CreateFromDirectory(
    $StagingRoot,
    $TemporaryPackagePath,
    [System.IO.Compression.CompressionLevel]::Optimal,
    $false
  )

  if (Test-Path -LiteralPath $PackagePath) {
    Remove-Item -LiteralPath $PackagePath -Force
  }
  Move-Item -LiteralPath $TemporaryPackagePath -Destination $PackagePath
} finally {
  if (Test-Path -LiteralPath $StagingRoot) {
    Remove-Item -LiteralPath $StagingRoot -Recurse -Force
  }
  if (Test-Path -LiteralPath $TemporaryPackagePath) {
    Remove-Item -LiteralPath $TemporaryPackagePath -Force
  }
}

$package = Get-Item -LiteralPath $PackagePath
Write-Step "Source package ready"
Write-Host "Package: $PackagePath" -ForegroundColor Green
Write-Host "Compressed size: $(Format-ByteSize $package.Length)" -ForegroundColor Green

