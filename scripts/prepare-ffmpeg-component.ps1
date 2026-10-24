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

# Public entry: keep named parameters and native exit status.
& (Join-Path $PSScriptRoot "..\tooling\components\prepare-ffmpeg-component.ps1") @PSBoundParameters @args
exit $LASTEXITCODE
