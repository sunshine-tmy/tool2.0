param(
  [Parameter(Mandatory = $true)]
  [string]$Url,

  [Parameter(Mandatory = $true)]
  [string]$Destination
)

$ErrorActionPreference = "Stop"
$ProgressPreference = "SilentlyContinue"

$uri = [System.Uri]$Url
if ($uri.Scheme -ne "https") {
  throw "Only HTTPS model downloads are allowed."
}

$destinationPath = [System.IO.Path]::GetFullPath($Destination)
$destinationDirectory = [System.IO.Path]::GetDirectoryName($destinationPath)
if (-not $destinationDirectory) {
  throw "Invalid destination path."
}

[System.IO.Directory]::CreateDirectory($destinationDirectory) | Out-Null
Invoke-WebRequest -UseBasicParsing -Uri $uri.AbsoluteUri -OutFile $destinationPath

