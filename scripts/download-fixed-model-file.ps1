param(
  [Parameter(Mandatory = $true)]
  [string]$Url,

  [Parameter(Mandatory = $true)]
  [string]$Destination,

  [string]$ExpectedSha256 = ""
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
$temporaryPath = Join-Path $destinationDirectory ("." + [System.IO.Path]::GetFileName($destinationPath) + "." + [System.Guid]::NewGuid().ToString("N") + ".tmp")
try {
  Invoke-WebRequest -UseBasicParsing -Uri $uri.AbsoluteUri -OutFile $temporaryPath
  if ($ExpectedSha256) {
    if ($ExpectedSha256 -notmatch "^[a-fA-F0-9]{64}$") {
      throw "ExpectedSha256 must contain exactly 64 hexadecimal characters."
    }
    $actualSha256 = (Get-FileHash -LiteralPath $temporaryPath -Algorithm SHA256).Hash.ToLowerInvariant()
    if ($actualSha256 -ne $ExpectedSha256.ToLowerInvariant()) {
      throw "Downloaded file SHA-256 does not match the pinned digest."
    }
  }
  Move-Item -LiteralPath $temporaryPath -Destination $destinationPath -Force
} finally {
  if (Test-Path -LiteralPath $temporaryPath) {
    Remove-Item -LiteralPath $temporaryPath -Force
  }
}
