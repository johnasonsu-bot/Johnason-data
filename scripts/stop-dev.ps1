$root = Split-Path -Parent $PSScriptRoot
$sourceRoot = [System.IO.Path]::GetFullPath($root)
$allProcesses = Get-CimInstance Win32_Process
$targetIds = [System.Collections.Generic.HashSet[int]]::new()
$callerIds = [System.Collections.Generic.HashSet[int]]::new()
$currentProcessId = $PID

do {
  [void]$callerIds.Add([int]$currentProcessId)
  $currentProcess = $allProcesses | Where-Object { $_.ProcessId -eq $currentProcessId } | Select-Object -First 1
  if (-not $currentProcess -or $currentProcess.ParentProcessId -eq 0) {
    break
  }
  $currentProcessId = [int]$currentProcess.ParentProcessId
} while ($true)

foreach ($process in $allProcesses) {
  if (-not $callerIds.Contains([int]$process.ProcessId) -and $process.CommandLine -and $process.CommandLine -like "*$sourceRoot*") {
    [void]$targetIds.Add([int]$process.ProcessId)
  }
}

do {
  $added = $false
  foreach ($process in $allProcesses) {
    if (-not $callerIds.Contains([int]$process.ProcessId) -and $targetIds.Contains([int]$process.ParentProcessId) -and $targetIds.Add([int]$process.ProcessId)) {
      $added = $true
    }
  }
} while ($added)

foreach ($processId in @($targetIds)) {
  Stop-Process -Id $processId -Force -ErrorAction SilentlyContinue
}

$envPath = Join-Path $root ".env"
$envFile = if (Test-Path $envPath) { $envPath } else { Join-Path $root ".env.example" }
docker compose --env-file $envFile -f (Join-Path $root "compose.dev.yml") down
Write-Host "Third-party source environment stopped."
