param(
  [ValidateSet("windows", "macos")]
  [string]$Platform = "windows",
  [switch]$Preview,
  [switch]$SkipPythonInstaller
)

$ErrorActionPreference = "Stop"
$repositoryRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$packageRoot = Join-Path (Join-Path $repositoryRoot ".package") "standalone"
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

function Set-DeterministicTimestamps {
  param(
    [string]$Root,
    [DateTime]$Timestamp
  )

  @(
    Get-Item -LiteralPath $Root
    Get-ChildItem -LiteralPath $Root -Force -Recurse
  ) | ForEach-Object {
    $_.LastWriteTimeUtc = $Timestamp
    $_.CreationTimeUtc = $Timestamp
    $_.LastAccessTimeUtc = $Timestamp
  }
}

function Get-SortedRelativeFiles {
  param([string]$Root)

  $rootPath = [IO.Path]::GetFullPath($Root).TrimEnd("\", "/")
  $files = [System.Collections.Generic.List[string]]::new()
  foreach ($file in Get-ChildItem -LiteralPath $Root -File -Force -Recurse) {
    $relative = $file.FullName.Substring($rootPath.Length).TrimStart("\", "/").Replace("\", "/")
    $files.Add($relative)
  }
  $files.Sort([StringComparer]::Ordinal)
  return $files
}

function New-DeterministicZip {
  param(
    [string]$Root,
    [string]$Destination,
    [DateTime]$Timestamp
  )

  Add-Type -AssemblyName System.IO.Compression
  Add-Type -AssemblyName System.IO.Compression.FileSystem
  $zip = [IO.Compression.ZipFile]::Open($Destination, [IO.Compression.ZipArchiveMode]::Create)
  try {
    foreach ($relative in Get-SortedRelativeFiles -Root $Root) {
      $source = Join-Path $Root ($relative.Replace("/", [IO.Path]::DirectorySeparatorChar))
      $entry = $zip.CreateEntry($relative, [IO.Compression.CompressionLevel]::Optimal)
      $entry.LastWriteTime = [DateTimeOffset]$Timestamp
      $input = [IO.File]::OpenRead($source)
      $output = $entry.Open()
      try {
        $input.CopyTo($output)
      } finally {
        $output.Dispose()
        $input.Dispose()
      }
    }
  } finally {
    $zip.Dispose()
  }
}

function New-DeterministicTarGz {
  param(
    [string]$Root,
    [string]$PackageRoot,
    [string]$Destination,
    [DateTime]$Timestamp
  )

  $entries = @(Get-SortedRelativeFiles -Root $Root | ForEach-Object {
    "$(Split-Path -Leaf $Root)/$_"
  })
  $tarPath = Join-Path $PackageRoot "archive-content.tar"
  # Pass the sorted file names as native arguments instead of a text file. This
  # preserves Unicode paths on Windows bsdtar (notably the Chinese launcher
  # names) while keeping the archive order deterministic. The staging tree
  # already has every file and directory timestamp fixed to the commit time;
  # avoid GNU tar's --mtime because Apple's bsdtar does not support it.
  $tarArguments = @(
    "-C", $PackageRoot,
    "--uid", "0",
    "--gid", "0",
    "--uname", "root",
    "--gname", "root",
    "--no-recursion"
  ) + $entries
  try {
    & tar -cf $tarPath @tarArguments
    if ($LASTEXITCODE -ne 0) { throw "tar failed" }

    # bsdtar's built-in gzip writer records the current time in the gzip header.
    # Compress the deterministic tar bytes with .NET instead; GZipStream emits
    # a stable header and therefore the same digest for the same source commit.
    $input = [IO.File]::OpenRead($tarPath)
    $output = [IO.File]::Create($Destination)
    $gzip = [IO.Compression.GZipStream]::new($output, [IO.Compression.CompressionLevel]::Optimal, $false)
    try {
      $input.CopyTo($gzip)
    } finally {
      $gzip.Dispose()
      $output.Dispose()
      $input.Dispose()
    }
  } finally {
    Remove-Item -LiteralPath $tarPath -Force -ErrorAction SilentlyContinue
  }
}

function Assert-PathWithin([string]$Path, [string]$Root) {
  $resolvedPath = [IO.Path]::GetFullPath($Path).TrimEnd("\", "/")
  $resolvedRoot = [IO.Path]::GetFullPath($Root).TrimEnd("\", "/")
  $rootPrefix = $resolvedRoot + [IO.Path]::DirectorySeparatorChar
  if (-not $resolvedPath.StartsWith($rootPrefix, [StringComparison]::OrdinalIgnoreCase)) {
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
$commit = (& git -C $repositoryRoot rev-parse HEAD).Trim()
if ($LASTEXITCODE -ne 0) { throw "git rev-parse failed" }
$commitTimestamp = (& git -C $repositoryRoot show -s --format=%cI HEAD).Trim()
if ($LASTEXITCODE -ne 0 -or -not $commitTimestamp) { throw "git could not resolve the HEAD timestamp" }
$commitDate = [DateTimeOffset]::Parse($commitTimestamp).UtcDateTime
$sourceDate = $commitDate.ToString("yyyy-MM-ddTHH:mm:ss.fffZ", [Globalization.CultureInfo]::InvariantCulture)

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

$templateRoot = Join-Path (Join-Path $stagingRoot "packaging") "standalone"
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
  commit = $commit
  createdAt = $sourceDate
  node = "24.x"
  pnpm = "11.7.x"
  pythonInstaller = if ($SkipPythonInstaller) { $null } else { $python }
}
$manifestPath = Join-Path $stagingRoot "build-manifest.json"
$manifest | ConvertTo-Json -Depth 4 | Set-Content -LiteralPath $manifestPath -Encoding UTF8

# Resolve licenses from the final standalone tree rather than the development
# workspace. Remove absolute installation paths so the artifact is portable
# and does not leak the builder's local filesystem layout.
$licenseOutput = & pnpm --dir $stagingRoot licenses list --prod --json
if ($LASTEXITCODE -ne 0) { throw "pnpm license inventory failed" }
$licenseInventory = ($licenseOutput -join [Environment]::NewLine) | ConvertFrom-Json
foreach ($licenseGroup in $licenseInventory.PSObject.Properties) {
  foreach ($package in @($licenseGroup.Value)) {
    $package.PSObject.Properties.Remove("paths")
  }
}
$licensePath = Join-Path $stagingRoot "third-party-licenses.json"
$licenseInventory | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath $licensePath -Encoding UTF8

Set-DeterministicTimestamps -Root $stagingRoot -Timestamp $commitDate

# Publish metadata beside the archive as well as inside it. These sidecars are
# what release jobs upload for scanners and reviewers without exposing the
# complete staging directory as a release artifact.
$metadata = @(
  @{ Source = $manifestPath; Name = "toolbox-$Platform.build-manifest.json" },
  @{ Source = $licensePath; Name = "toolbox-$Platform.third-party-licenses.json" }
)
foreach ($item in $metadata) {
  $sidecar = Join-Path $packageRoot $item.Name
  Copy-Item -LiteralPath $item.Source -Destination $sidecar -Force
  Set-DeterministicTimestamps -Root $sidecar -Timestamp $commitDate
  $digest = (Get-FileHash -LiteralPath $sidecar -Algorithm SHA256).Hash.ToLowerInvariant()
  "$digest  $($item.Name)" | Set-Content -LiteralPath "$sidecar.sha256" -Encoding ASCII
}

if (Test-Path -LiteralPath $archivePath) { Remove-Item -LiteralPath $archivePath -Force }
if ($Platform -eq "windows") {
  New-DeterministicZip -Root $stagingRoot -Destination $archivePath -Timestamp $commitDate
} else {
  New-DeterministicTarGz -Root $stagingRoot -PackageRoot $packageRoot -Destination $archivePath -Timestamp $commitDate
}

$archiveHash = (Get-FileHash -LiteralPath $archivePath -Algorithm SHA256).Hash.ToLowerInvariant()
"$archiveHash  $(Split-Path -Leaf $archivePath)" | Set-Content -LiteralPath "$archivePath.sha256" -Encoding ASCII
Write-Output $archivePath
