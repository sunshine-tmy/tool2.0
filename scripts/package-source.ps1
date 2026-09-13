param(
  [switch]$Preview
)

$ErrorActionPreference = "Stop"
$Root = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$OutputRoot = Join-Path $Root ".package"
$PackagePath = Join-Path $OutputRoot "ecommerce-toolbox-source.zip"
$TemporaryPackagePath = Join-Path $OutputRoot "ecommerce-toolbox-source.tmp.zip"

function Test-PathInsideRoot {
  param(
    [string]$Path,
    [string]$ExpectedRoot
  )

  $fullPath = [System.IO.Path]::GetFullPath($Path).TrimEnd("\", "/")
  $fullRoot = [System.IO.Path]::GetFullPath($ExpectedRoot).TrimEnd("\", "/")
  return $fullPath.StartsWith("$fullRoot\", [System.StringComparison]::OrdinalIgnoreCase)
}

if (-not (Get-Command git -ErrorAction SilentlyContinue)) {
  throw "Git was not found. Install Git before creating a source-only package."
}
if (-not (Test-PathInsideRoot $OutputRoot $Root)) {
  throw "Unsafe package output path: $OutputRoot"
}

$commit = (& git -C $Root rev-parse HEAD).Trim()
if ($LASTEXITCODE -ne 0) { throw "Git could not resolve HEAD." }
$trackedFiles = @(& git -C $Root -c core.quotepath=false ls-tree -r --name-only HEAD)
if ($LASTEXITCODE -ne 0) { throw "Git could not enumerate committed files." }

Write-Host "Ecommerce Toolbox committed-source packager" -ForegroundColor Green
Write-Host "Project root: $Root"
Write-Host "Commit: $commit"
Write-Host "Committed files: $($trackedFiles.Count)"
Write-Host "Untracked and uncommitted files are never included."

if ($Preview) {
  Write-Host "Preview completed; no files were changed." -ForegroundColor Cyan
  exit 0
}

New-Item -ItemType Directory -Path $OutputRoot -Force | Out-Null
if (Test-Path -LiteralPath $TemporaryPackagePath) { Remove-Item -LiteralPath $TemporaryPackagePath -Force }

& git -C $Root archive --format=zip "--output=$TemporaryPackagePath" HEAD
if ($LASTEXITCODE -ne 0) {
  if (Test-Path -LiteralPath $TemporaryPackagePath) { Remove-Item -LiteralPath $TemporaryPackagePath -Force }
  throw "git archive failed."
}

if (Test-Path -LiteralPath $PackagePath) { Remove-Item -LiteralPath $PackagePath -Force }
Move-Item -LiteralPath $TemporaryPackagePath -Destination $PackagePath

$package = Get-Item -LiteralPath $PackagePath
$digest = (Get-FileHash -LiteralPath $PackagePath -Algorithm SHA256).Hash.ToLowerInvariant()
Write-Host "Package: $PackagePath" -ForegroundColor Green
Write-Host "Compressed size: $($package.Length) bytes" -ForegroundColor Green
Write-Host "SHA-256: $digest" -ForegroundColor Green
