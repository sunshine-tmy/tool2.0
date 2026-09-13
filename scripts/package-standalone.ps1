param(
  [ValidateSet("windows", "macos")]
  [string]$Platform = "windows",
  [switch]$Preview,
  [switch]$SkipPythonInstaller
)

$ErrorActionPreference = "Stop"
$repositoryRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$packageRoot = Join-Path $repositoryRoot ".package\standalone"
$stagingRoot = Join-Path $packageRoot "toolbox-$Platform"
$archivePath = if ($Platform -eq "windows") {
  Join-Path $packageRoot "toolbox-windows-x64.zip"
} else {
  Join-Path $packageRoot "toolbox-macos-arm64.tar.gz"
}

$python = if ($Platform -eq "windows") {
  @{
    File = "python-3.11.9-amd64.exe"
    Url = "https://www.python.org/ftp/python/3.11.9/python-3.11.9-amd64.exe"
    Sha256 = "5EE42C4EEE1E6B4464BB23722F90B45303F79442DF63083F05322F1785F5FDDE"
  }
} else {
  @{
    File = "python-3.11.9-macos11.pkg"
    Url = "https://www.python.org/ftp/python/3.11.9/python-3.11.9-macos11.pkg"
    Sha256 = "B6CFDEE2571CA56EE895043CA1E7110FB78A878CEE3EB0C21ACCB2DE34D24B55"
  }
}

function Assert-PathWithin([string]$Path, [string]$Root) {
  $resolvedPath = [IO.Path]::GetFullPath($Path).TrimEnd("\", "/")
  $resolvedRoot = [IO.Path]::GetFullPath($Root).TrimEnd("\", "/")
  if (-not $resolvedPath.StartsWith("$resolvedRoot\", [StringComparison]::OrdinalIgnoreCase)) {
    throw "Unsafe package path: $resolvedPath"
  }
}

Assert-PathWithin $packageRoot $repositoryRoot
Assert-PathWithin $stagingRoot $repositoryRoot

$trackedFiles = @(& git -C $repositoryRoot -c core.quotepath=false ls-tree -r --name-only HEAD | Where-Object {
  $_ -and
  -not $_.StartsWith("packaging/standalone/", [StringComparison]::OrdinalIgnoreCase) -and
  -not $_.StartsWith(".github/", [StringComparison]::OrdinalIgnoreCase) -and
  -not $_.StartsWith("docs/", [StringComparison]::OrdinalIgnoreCase)
})
if ($LASTEXITCODE -ne 0) { throw "git ls-tree failed" }

if ($Preview) {
  [pscustomobject]@{
    platform = $Platform
    files = $trackedFiles.Count
    includesPythonInstaller = -not $SkipPythonInstaller
    output = $archivePath
  } | ConvertTo-Json
  exit 0
}

New-Item -ItemType Directory -Path $packageRoot -Force | Out-Null
if (Test-Path -LiteralPath $stagingRoot) {
  Remove-Item -LiteralPath $stagingRoot -Recurse -Force
}
New-Item -ItemType Directory -Path $stagingRoot -Force | Out-Null
$sourceArchive = Join-Path $packageRoot "committed-source.zip"
if (Test-Path -LiteralPath $sourceArchive) { Remove-Item -LiteralPath $sourceArchive -Force }
& git -C $repositoryRoot archive --format=zip --output=$sourceArchive HEAD
if ($LASTEXITCODE -ne 0) { throw "git archive failed" }
Expand-Archive -LiteralPath $sourceArchive -DestinationPath $stagingRoot -Force
Remove-Item -LiteralPath $sourceArchive -Force

$templateRoot = Join-Path $stagingRoot "packaging\standalone"
Get-ChildItem -LiteralPath $templateRoot -File | Where-Object {
  $_.Name -ne "README.md" -and
  (($Platform -eq "windows" -and $_.Extension -eq ".bat") -or
   ($Platform -eq "macos" -and $_.Extension -eq ".command"))
} | Copy-Item -Destination $stagingRoot -Force

foreach ($excluded in @(".github", "docs", "packaging")) {
  $excludedPath = Join-Path $stagingRoot $excluded
  Assert-PathWithin $excludedPath $stagingRoot
  if (Test-Path -LiteralPath $excludedPath) { Remove-Item -LiteralPath $excludedPath -Recurse -Force }
}

if (-not $SkipPythonInstaller) {
  $installer = Join-Path $stagingRoot $python.File
  Invoke-WebRequest -Uri $python.Url -OutFile $installer -UseBasicParsing
  $digest = (Get-FileHash -LiteralPath $installer -Algorithm SHA256).Hash.ToUpperInvariant()
  if ($digest -ne $python.Sha256) {
    Remove-Item -LiteralPath $installer -Force
    throw "Python installer checksum mismatch"
  }
}

$manifest = [ordered]@{
  schemaVersion = 1
  platform = $Platform
  commit = (& git -C $repositoryRoot rev-parse HEAD).Trim()
  createdAt = [DateTime]::UtcNow.ToString("o")
  node = "24.x"
  pnpm = "11.7.x"
  pythonInstaller = if ($SkipPythonInstaller) { $null } else { $python }
}
$manifest | ConvertTo-Json -Depth 4 | Set-Content -LiteralPath (Join-Path $stagingRoot "build-manifest.json") -Encoding UTF8

$licenseOutput = & pnpm -C $repositoryRoot licenses list --prod --json
if ($LASTEXITCODE -ne 0) { throw "pnpm license inventory failed" }
$licenseOutput | Set-Content -LiteralPath (Join-Path $stagingRoot "third-party-licenses.json") -Encoding UTF8

if (Test-Path -LiteralPath $archivePath) { Remove-Item -LiteralPath $archivePath -Force }
if ($Platform -eq "windows") {
  Compress-Archive -Path (Join-Path $stagingRoot "*") -DestinationPath $archivePath -CompressionLevel Optimal
} else {
  & tar -czf $archivePath -C $packageRoot (Split-Path -Leaf $stagingRoot)
  if ($LASTEXITCODE -ne 0) { throw "tar failed" }
}

$archiveHash = (Get-FileHash -LiteralPath $archivePath -Algorithm SHA256).Hash.ToLowerInvariant()
"$archiveHash  $(Split-Path -Leaf $archivePath)" | Set-Content -LiteralPath "$archivePath.sha256" -Encoding ASCII
Write-Output $archivePath
