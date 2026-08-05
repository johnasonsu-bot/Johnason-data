$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
if (-not (Test-Path "$root/.env")) { Copy-Item "$root/.env.example" "$root/.env" }

foreach ($commandName in @("node", "npm.cmd", "docker")) {
  if (-not (Get-Command $commandName -ErrorAction SilentlyContinue)) { throw "Missing required command: $commandName" }
}

$envFile = Get-Content "$root/.env" | Where-Object { $_ -match '^\s*[^#][^=]*=' }
foreach ($line in $envFile) {
  $key, $value = $line -split '=', 2
  if ($key) { Set-Item -Path "Env:$($key.Trim())" -Value $value.Trim() }
}

function Get-ProcessAncestryText([int]$ProcessId, $Processes) {
  $parts = [System.Collections.Generic.List[string]]::new()
  $visited = [System.Collections.Generic.HashSet[int]]::new()
  $currentId = $ProcessId
  while ($currentId -gt 0 -and $visited.Add($currentId)) {
    $process = $Processes | Where-Object { $_.ProcessId -eq $currentId } | Select-Object -First 1
    if (-not $process) { break }
    if ($process.CommandLine) { $parts.Add([string]$process.CommandLine) }
    $currentId = [int]$process.ParentProcessId
  }
  return ($parts -join "`n")
}

function Get-SourceProcessRootId([int]$ProcessId, $Processes) {
  $visited = [System.Collections.Generic.HashSet[int]]::new()
  $currentId = $ProcessId
  $sourceRootId = 0
  while ($currentId -gt 0 -and $visited.Add($currentId)) {
    $process = $Processes | Where-Object { $_.ProcessId -eq $currentId } | Select-Object -First 1
    if (-not $process) { break }
    if ($process.CommandLine -and $process.CommandLine -match "data-platform-source") {
      $sourceRootId = [int]$process.ProcessId
    }
    $currentId = [int]$process.ParentProcessId
  }
  return $(if ($sourceRootId -gt 0) { $sourceRootId } else { $ProcessId })
}

function Stop-ProcessTree([int]$RootProcessId, $Processes) {
  $targetIds = [System.Collections.Generic.HashSet[int]]::new()
  [void]$targetIds.Add($RootProcessId)
  do {
    $added = $false
    foreach ($process in $Processes) {
      if ($targetIds.Contains([int]$process.ParentProcessId) -and $targetIds.Add([int]$process.ProcessId)) {
        $added = $true
      }
    }
  } while ($added)
  foreach ($targetId in @($targetIds)) {
    Stop-Process -Id $targetId -Force -ErrorAction SilentlyContinue
  }
}

function Stop-StaleSourcePortProcess([int]$Port) {
  $listeners = @(Get-NetTCPConnection -State Listen -LocalPort $Port -ErrorAction SilentlyContinue)
  if ($listeners.Count -eq 0) { return }
  $processes = Get-CimInstance Win32_Process
  foreach ($listener in $listeners) {
    $processId = [int]$listener.OwningProcess
    $ancestry = Get-ProcessAncestryText $processId $processes
    $isKnownSourceProcess = $ancestry -match "data-platform-source" -or
      ($Port -eq 46120 -and $ancestry -match "vite(?:\.js)?") -or
      ($Port -eq 46121 -and $ancestry -match "node(?:\.exe)?\s+src/server\.js")
    if (-not $isKnownSourceProcess) {
      throw "Port $Port is occupied by an unrelated process (PID $processId). Stop it before starting the source edition."
    }
    $sourceRootId = Get-SourceProcessRootId $processId $processes
    Stop-ProcessTree $sourceRootId $processes
  }
  for ($attempt = 0; $attempt -lt 40; $attempt++) {
    if (-not (Get-NetTCPConnection -State Listen -LocalPort $Port -ErrorAction SilentlyContinue)) { return }
    Start-Sleep -Milliseconds 250
  }
  throw "Stale source edition process on port $Port could not be stopped."
}

Stop-StaleSourcePortProcess 46120
Stop-StaleSourcePortProcess 46121

$pythonCommand = if ($env:PYTHON) { $env:PYTHON } else { "python" }
if (-not (Get-Command $pythonCommand -ErrorAction SilentlyContinue)) { Write-Warning "Python 3 was not detected. Platform startup can continue, but DataX tasks will not run." }
if (-not (Get-Command "java" -ErrorAction SilentlyContinue)) { Write-Warning "Java was not detected. Platform startup can continue, but DataX tasks will not run." }

docker compose --env-file "$root/.env" -f "$root/compose.dev.yml" up -d mysql
if ($LASTEXITCODE -ne 0) { throw "Failed to start third-party source MySQL" }
for ($attempt = 0; $attempt -lt 30; $attempt++) {
  $previousErrorActionPreference = $ErrorActionPreference
  $ErrorActionPreference = "Continue"
  docker exec data-platform-source-mysql mysqladmin -uroot "-p$($env:DB_PASSWORD)" ping --silent 2>&1 | Out-Null
  $mysqlPingExitCode = $LASTEXITCODE
  $ErrorActionPreference = $previousErrorActionPreference
  if ($mysqlPingExitCode -eq 0) { break }
  Start-Sleep -Seconds 2
}
if ($mysqlPingExitCode -ne 0) { throw "Third-party source MySQL did not become ready" }

Copy-Item "$root/.env" "$root/backend/.env" -Force
$env:PORT = '46121'
$env:FRONTEND_URL = 'http://127.0.0.1:46120'
$env:DB_HOST = '127.0.0.1'
$env:DB_PORT = '46122'
$env:DB_NAME = 'data_platform_source'
$env:VITE_PROXY_TARGET = 'http://127.0.0.1:46121'

$logDir = Join-Path $root 'runtime/local-dev'
New-Item -ItemType Directory -Force $logDir | Out-Null
$backendFailedMarker = Join-Path $logDir 'backend.failed'
Remove-Item -LiteralPath $backendFailedMarker -Force -ErrorAction SilentlyContinue
$backendCommand = "Set-Location '$root/backend'; npm.cmd ci; if (`$LASTEXITCODE -ne 0) { Set-Content -LiteralPath '$backendFailedMarker' -Value 'dependency-install'; exit `$LASTEXITCODE }; node ..\scripts\import-seed-project-assets.js; if (`$LASTEXITCODE -ne 0) { Set-Content -LiteralPath '$backendFailedMarker' -Value 'seed-import'; exit `$LASTEXITCODE }; npm.cmd run dev"
$frontendCommand = "Set-Location '$root/frontend'; npm.cmd ci --legacy-peer-deps; npm.cmd run dev -- --force"
$backendProcess = Start-Process powershell -PassThru -WindowStyle Hidden -ArgumentList '-ExecutionPolicy','Bypass','-NoProfile','-Command',$backendCommand -RedirectStandardOutput (Join-Path $logDir 'backend.log') -RedirectStandardError (Join-Path $logDir 'backend-error.log')
$frontendProcess = Start-Process powershell -PassThru -WindowStyle Hidden -ArgumentList '-ExecutionPolicy','Bypass','-NoProfile','-Command',$frontendCommand -RedirectStandardOutput (Join-Path $logDir 'frontend.log') -RedirectStandardError (Join-Path $logDir 'frontend-error.log')

function Wait-HttpReady([string]$Url, [string]$Name, $Process, [string]$FailedMarker = "") {
  for ($attempt = 0; $attempt -lt 180; $attempt++) {
    if ($FailedMarker -and (Test-Path -LiteralPath $FailedMarker)) { throw "$Name failed before it became ready. Check $logDir." }
    if ($Process -and $Process.HasExited) { throw "$Name process exited before it became ready. Check $logDir." }
    try {
      $response = Invoke-WebRequest -UseBasicParsing -Uri $Url -TimeoutSec 3
      if ($response.StatusCode -ge 200 -and $response.StatusCode -lt 500) { return }
    } catch {
      Start-Sleep -Seconds 2
    }
  }
  throw "$Name did not become ready. Check $logDir."
}

Wait-HttpReady 'http://127.0.0.1:46121/api/health' 'Third-party source backend' $backendProcess $backendFailedMarker
Wait-HttpReady 'http://127.0.0.1:46120' 'Third-party source frontend' $frontendProcess
Write-Host 'Source edition is ready at http://127.0.0.1:46120'
