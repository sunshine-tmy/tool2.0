[CmdletBinding()]
param(
  [Parameter(Mandatory)]
  [string]$Directory,
  [Parameter(Mandatory)]
  [string]$ExpectedSubject
)

$resolvedDirectory = (Resolve-Path -LiteralPath $Directory -ErrorAction Stop).Path
if ([string]::IsNullOrWhiteSpace($ExpectedSubject)) {
  throw "ExpectedSubject is required"
}

$targets = @(
  Get-ChildItem -LiteralPath $resolvedDirectory -File -Filter "*.exe" -Recurse
)
if ($targets.Count -eq 0) {
  throw "No executable files found for Authenticode verification"
}

foreach ($target in $targets) {
  $signature = Get-AuthenticodeSignature -LiteralPath $target.FullName
  if ($signature.Status -ne "Valid") {
    throw "Authenticode signature is not valid: $($target.FullName) ($($signature.Status))"
  }
  if ($signature.SignerCertificate.Subject -ne $ExpectedSubject) {
    throw "Unexpected signing subject for $($target.FullName): $($signature.SignerCertificate.Subject)"
  }
}

Write-Host "Verified Authenticode signatures for $($targets.Count) executable files"
