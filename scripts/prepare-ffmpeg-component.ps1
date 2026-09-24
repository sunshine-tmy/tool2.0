<#
.SYNOPSIS
  校验并准备 FFmpeg 8.1.2 Windows x64 shared runtime 能力包 staging。
.DESCRIPTION
  优先使用 FFMPEG_SOURCE_ARCHIVE 指定的本地归档；未指定时从固定 GitHub Release 下载。
  任何解压/复制动作之前都校验上游归档大小和 SHA-256。私钥不会由此脚本读取。
#>
param(
  [string]$SourceArchive
)

$ErrorActionPreference = "Stop"

$RepositoryRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$PackageRoot = Join-Path $RepositoryRoot ".package"
$StageParent = Join-Path $PackageRoot "stage"
$StageTarget = Join-Path $StageParent "ffmpeg-8.1.2"
$WorkDirectory = Join-Path $PackageRoot (".prepare-ffmpeg-" + [guid]::NewGuid().ToString("N"))
$ArchivePath = Join-Path $WorkDirectory "ffmpeg-8.1.2-full_build-shared.7z"
$ExtractedDirectory = Join-Path $WorkDirectory "extracted"
$PayloadDirectory = Join-Path $WorkDirectory "payload"
$SourceUrl = "https://github.com/GyanD/codexffmpeg/releases/download/8.1.2/ffmpeg-8.1.2-full_build-shared.7z"
$ExpectedBytes = 59459100
$ExpectedSha256 = "cba748035c21ce1431d0823c7a3a711f38616f89f87a265dceddf9b7f6749d2d"
$ArchiveRoot = "ffmpeg-8.1.2-full_build-shared"
$BinRelativePath = "$ArchiveRoot/bin"

if ([string]::IsNullOrWhiteSpace($SourceArchive)) {
  $SourceArchive = $env:FFMPEG_SOURCE_ARCHIVE
}
if (Test-Path -LiteralPath $StageTarget) {
  throw "目标 staging 目录已存在，为避免覆盖用户文件而停止：$StageTarget"
}
if ((Test-Path -LiteralPath $PackageRoot) -and -not (Get-Item -LiteralPath $PackageRoot).PSIsContainer) {
  throw ".package 路径不是目录：$PackageRoot"
}

New-Item -ItemType Directory -Path $PackageRoot -Force | Out-Null
New-Item -ItemType Directory -Path $StageParent -Force | Out-Null
New-Item -ItemType Directory -Path $WorkDirectory -Force | Out-Null

try {
  if (-not [string]::IsNullOrWhiteSpace($SourceArchive)) {
    $ResolvedSourceArchive = (Resolve-Path -LiteralPath $SourceArchive).Path
    if (-not (Get-Item -LiteralPath $ResolvedSourceArchive).PSIsContainer) {
      Copy-Item -LiteralPath $ResolvedSourceArchive -Destination $ArchivePath
    } else {
      throw "FFMPEG_SOURCE_ARCHIVE 必须指向归档文件：$ResolvedSourceArchive"
    }
  } else {
    Write-Host "下载固定版本 FFmpeg 8.1.2 shared build（约 57 MiB）..."
    $Curl = Get-Command "curl.exe" -ErrorAction SilentlyContinue
    if ($Curl) {
      & $Curl.Source --fail --location --retry 3 --retry-all-errors --connect-timeout 30 --max-time 1800 --output $ArchivePath $SourceUrl
      if ($LASTEXITCODE -ne 0) {
        throw "curl 下载失败，退出码 $LASTEXITCODE"
      }
    } else {
      Invoke-WebRequest -Uri $SourceUrl -OutFile $ArchivePath -MaximumRedirection 5
    }
  }

  $Archive = Get-Item -LiteralPath $ArchivePath
  if ($Archive.Length -ne $ExpectedBytes) {
    throw "上游压缩包大小不匹配：$($Archive.Length) bytes，预期 $ExpectedBytes"
  }
  $ActualSha256 = (Get-FileHash -LiteralPath $ArchivePath -Algorithm SHA256).Hash.ToLowerInvariant()
  if ($ActualSha256 -ne $ExpectedSha256) {
    throw "上游压缩包 SHA-256 不匹配：$ActualSha256"
  }

  $Tar = Get-Command "tar.exe" -ErrorAction SilentlyContinue
  if (-not $Tar) {
    throw "未找到 Windows tar.exe；需要 Windows 自带的 libarchive 以读取经过校验的 .7z 归档"
  }
  $ArchiveEntries = @(& $Tar.Source -tf $ArchivePath)
  if ($LASTEXITCODE -ne 0) {
    throw "无法读取经过校验的 FFmpeg 归档目录"
  }
  $BinEntries = @($ArchiveEntries | Where-Object { $_ -match "^$([regex]::Escape($BinRelativePath))/(ffmpeg\.exe|ffprobe\.exe|[^/]+\.dll)$" })
  if (($BinEntries -notcontains "$BinRelativePath/ffmpeg.exe") -or ($BinEntries -notcontains "$BinRelativePath/ffprobe.exe")) {
    throw "归档中缺少预期的 ffmpeg.exe 或 ffprobe.exe"
  }
  $LicenseEntry = "$ArchiveRoot/LICENSE"
  if ($ArchiveEntries -notcontains $LicenseEntry) {
    throw "归档中缺少预期的 LICENSE 文件"
  }
  $DllEntries = @($BinEntries | Where-Object { $_ -match "\.dll$" })
  if ($DllEntries.Count -lt 1) {
    throw "FFmpeg shared build 缺少运行时 DLL，拒绝生成无法独立运行的能力包"
  }

  New-Item -ItemType Directory -Path $ExtractedDirectory -Force | Out-Null
  & $Tar.Source -xf $ArchivePath -C $ExtractedDirectory @($BinEntries + $LicenseEntry)
  if ($LASTEXITCODE -ne 0) {
    throw "提取 FFmpeg 必需运行时文件失败"
  }

  $BinaryDirectory = Join-Path $ExtractedDirectory $BinRelativePath
  $FfmpegPath = Join-Path $BinaryDirectory "ffmpeg.exe"
  $FfprobePath = Join-Path $BinaryDirectory "ffprobe.exe"
  $FfmpegVersion = (& $FfmpegPath -version 2>&1 | Select-Object -First 1).ToString()
  if ($LASTEXITCODE -ne 0 -or $FfmpegVersion -notmatch "^ffmpeg version 8\.1\.2-full_build\b") {
    throw "ffmpeg 自检失败或版本不符：$FfmpegVersion"
  }
  $FfprobeVersion = (& $FfprobePath -version 2>&1 | Select-Object -First 1).ToString()
  if ($LASTEXITCODE -ne 0 -or $FfprobeVersion -notmatch "^ffprobe version 8\.1\.2-full_build\b") {
    throw "ffprobe 自检失败或版本不符：$FfprobeVersion"
  }

  New-Item -ItemType Directory -Path (Join-Path $PayloadDirectory "bin") -Force | Out-Null
  Copy-Item -LiteralPath $FfmpegPath -Destination (Join-Path $PayloadDirectory "bin/ffmpeg.exe")
  Copy-Item -LiteralPath $FfprobePath -Destination (Join-Path $PayloadDirectory "bin/ffprobe.exe")
  foreach ($DllEntry in $DllEntries) {
    $DllName = [System.IO.Path]::GetFileName($DllEntry)
    Copy-Item -LiteralPath (Join-Path $BinaryDirectory $DllName) -Destination (Join-Path $PayloadDirectory "bin/$DllName")
  }
  Copy-Item -LiteralPath (Join-Path $ExtractedDirectory "$ArchiveRoot/LICENSE") -Destination (Join-Path $PayloadDirectory "LICENSE.txt")

  $BinaryHashes = [ordered]@{}
  Get-ChildItem -LiteralPath (Join-Path $PayloadDirectory "bin") -File | Sort-Object Name | ForEach-Object {
    $BinaryHashes["bin/$($_.Name)"] = (Get-FileHash -LiteralPath $_.FullName -Algorithm SHA256).Hash.ToLowerInvariant()
  }
  $Provenance = [ordered]@{
    component = "ffmpeg"
    version = "8.1.2"
    variant = "full_build-shared"
    platform = "win32-x64"
    sourceProject = "https://www.gyan.dev/ffmpeg/builds/"
    sourceRelease = "https://github.com/GyanD/codexffmpeg/releases/tag/8.1.2"
    sourceUrl = $SourceUrl
    sourceArchiveBytes = $ExpectedBytes
    sourceArchiveSha256 = $ExpectedSha256
    ffmpegVersion = $FfmpegVersion
    ffprobeVersion = $FfprobeVersion
    runtimeDllCount = $DllEntries.Count
    binaries = $BinaryHashes
  }
  $ProvenanceText = $Provenance | ConvertTo-Json -Depth 5
  [System.IO.File]::WriteAllText(
    (Join-Path $PayloadDirectory "SOURCE.json"),
    $ProvenanceText + "`n",
    [System.Text.UTF8Encoding]::new($false)
  )

  Move-Item -LiteralPath $PayloadDirectory -Destination $StageTarget
  $InstalledBytes = (Get-ChildItem -LiteralPath $StageTarget -File -Recurse | Measure-Object -Property Length -Sum).Sum
  Write-Host "FFmpeg staging 已准备：$StageTarget"
  Write-Host "运行时版本：$FfmpegVersion"
  Write-Host "随包 DLL 数量：$($DllEntries.Count)"
  Write-Host "staging 文件大小：$InstalledBytes bytes"
  Write-Host "上游 SHA-256：$ActualSha256"
} finally {
  if (Test-Path -LiteralPath $WorkDirectory) {
    $ResolvedPackageRoot = [System.IO.Path]::GetFullPath($PackageRoot).TrimEnd([System.IO.Path]::DirectorySeparatorChar) + [System.IO.Path]::DirectorySeparatorChar
    $ResolvedWorkDirectory = [System.IO.Path]::GetFullPath($WorkDirectory)
    if (-not $ResolvedWorkDirectory.StartsWith($ResolvedPackageRoot, [System.StringComparison]::OrdinalIgnoreCase)) {
      throw "临时目录解析后超出 .package，拒绝清理：$ResolvedWorkDirectory"
    }
    Remove-Item -LiteralPath $ResolvedWorkDirectory -Recurse -Force
  }
}
