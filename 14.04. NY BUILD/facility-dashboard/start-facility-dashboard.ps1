<#
  start-facility-dashboard.ps1
  Start facility dashboard (facility owner dashboard) on port 8084.
#>

Write-Host ""
Write-Host "Starting facility dashboard (port 8084)..." -ForegroundColor Cyan
Write-Host ""

# Stop existing server on port 8084
Write-Host "Stopping any existing server on port 8084..." -ForegroundColor Yellow
$pids = (Get-NetTCPConnection -LocalPort 8084 -State Listen -ErrorAction SilentlyContinue | ForEach-Object { $_.OwningProcess })
if ($pids) {
    Stop-Process -Id $pids -Force -ErrorAction SilentlyContinue
    Write-Host "Stopped existing dashboard (port 8084)" -ForegroundColor Green
}

Start-Sleep -Seconds 1

# Start Facility Dashboard
Write-Host ""
Write-Host "Starting facility dashboard on http://localhost:8084..." -ForegroundColor Green
$facilityPath = "$PSScriptRoot"
Start-Process powershell -WindowStyle Normal -ArgumentList "-NoExit", "-Command", "cd '$facilityPath'; python -m http.server 8084"

Start-Sleep -Seconds 2

Write-Host ""
Write-Host "Facility dashboard is running." -ForegroundColor Green
Write-Host "Dashboard: http://localhost:8084" -ForegroundColor Cyan
Write-Host "Make sure API is running on http://localhost:8000" -ForegroundColor Yellow
Write-Host ""
Write-Host "Press Ctrl+C in the dashboard window to stop" -ForegroundColor Gray
Write-Host ""
