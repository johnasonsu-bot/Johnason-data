$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot

& node (Join-Path $PSScriptRoot "validate-package.js") $root
if ($LASTEXITCODE -ne 0) { throw "Static package boundary validation failed" }

$syntaxFailures = @()
Get-ChildItem (Join-Path $root "backend\src") -Recurse -File -Filter "*.js" | ForEach-Object {
  & node --check $_.FullName 2>$null
  if ($LASTEXITCODE -ne 0) { $syntaxFailures += $_.FullName }
}
if ($syntaxFailures.Count -gt 0) { throw "Backend syntax validation failed: $($syntaxFailures -join ', ')" }

Push-Location (Join-Path $root "backend")
try {
  & npm.cmd ci
  if ($LASTEXITCODE -ne 0) { throw "Backend dependency installation failed" }
  & node -e "require('./src/app'); console.log('Backend module load passed')"
  if ($LASTEXITCODE -ne 0) { throw "Backend module load failed" }
  & npm.cmd test
  if ($LASTEXITCODE -ne 0) { throw "Backend tests failed" }
} finally {
  Pop-Location
}

Push-Location (Join-Path $root "frontend")
try {
  & npm.cmd ci --legacy-peer-deps
  if ($LASTEXITCODE -ne 0) { throw "Frontend dependency installation failed" }
  & npm.cmd run build
  if ($LASTEXITCODE -ne 0) { throw "Frontend build failed" }
} finally {
  Pop-Location
}

Write-Host "Third-party source package verification passed."
