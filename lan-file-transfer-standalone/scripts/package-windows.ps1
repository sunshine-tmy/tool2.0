param(
  [string]$OutputPath
)

$ErrorActionPreference = "Stop"

Add-Type -AssemblyName System.IO.Compression
Add-Type -AssemblyName System.IO.Compression.FileSystem

$root = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$parent = Split-Path $root -Parent
$name = Split-Path $root -Leaf

if ([string]::IsNullOrWhiteSpace($OutputPath)) {
  $OutputPath = Join-Path $parent "lan-file-transfer-standalone-source.zip"
}

$output = [System.IO.Path]::GetFullPath($OutputPath)
$temporaryOutput = "$output.tmp"

function Test-ExcludedPath {
  param([string]$RelativePath)

  $path = $RelativePath.Replace("\", "/")
  $segments = $path.Split("/")

  if ($segments -contains "node_modules") { return $true }
  if ($segments -contains ".runtime") { return $true }
  if ($segments -contains ".venv-image-ai") { return $true }
  if ($segments -contains "models") { return $true }
  if ($segments -contains "storage") { return $true }
  if ($segments -contains "__pycache__") { return $true }
  if ($path -eq ".env") { return $true }
  if ($path.EndsWith(".tsbuildinfo")) { return $true }
  if ($path -eq "frontend/dist" -or $path.StartsWith("frontend/dist/")) { return $true }
  if ($path -eq "backend/dist" -or $path.StartsWith("backend/dist/")) { return $true }
  if ($path -eq "packages/shared/dist" -or $path.StartsWith("packages/shared/dist/")) { return $true }

  return $false
}

if (Test-Path -LiteralPath $temporaryOutput) {
  Remove-Item -LiteralPath $temporaryOutput -Force
}

$stream = $null
$archive = $null

try {
  $stream = [System.IO.File]::Open(
    $temporaryOutput,
    [System.IO.FileMode]::CreateNew,
    [System.IO.FileAccess]::ReadWrite,
    [System.IO.FileShare]::None
  )
  $archive = [System.IO.Compression.ZipArchive]::new(
    $stream,
    [System.IO.Compression.ZipArchiveMode]::Create,
    $true
  )

  Get-ChildItem -LiteralPath $root -Recurse -File | ForEach-Object {
    $relativePath = $_.FullName.Substring($root.Length).TrimStart("\", "/")
    if (Test-ExcludedPath $relativePath) {
      return
    }

    $entryName = "$name/$($relativePath.Replace('\', '/'))"
    [System.IO.Compression.ZipFileExtensions]::CreateEntryFromFile(
      $archive,
      $_.FullName,
      $entryName,
      [System.IO.Compression.CompressionLevel]::Optimal
    ) | Out-Null
  }
}
finally {
  if ($archive) { $archive.Dispose() }
  if ($stream) { $stream.Dispose() }
}

if (Test-Path -LiteralPath $output) {
  Remove-Item -LiteralPath $output -Force
}
Move-Item -LiteralPath $temporaryOutput -Destination $output

Write-Host "Windows package created: $output"
