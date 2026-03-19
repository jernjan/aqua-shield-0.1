<#
  start-servers.ps1
  Start EKTE_API (port 8000) and the vessel dashboard (port 8082).
#>

Write-Host "" 
Write-Host "Starting vessel dashboard servers..." -ForegroundColor Cyan
Write-Host "" 

# Kill existing servers on ports 8000 and 8082
Write-Host "Stopping any existing servers on ports 8000 and 8082..." -ForegroundColor Yellow

$pids = (Get-NetTCPConnection -LocalPort 8000 -State Listen -ErrorAction SilentlyContinue | ForEach-Object { $_.OwningProcess })
if ($pids) {
  Stop-Process -Id $pids -Force -ErrorAction SilentlyContinue
  Write-Host "Stopped API (port 8000)" -ForegroundColor Green
}

$pids = (Get-NetTCPConnection -LocalPort 8082 -State Listen -ErrorAction SilentlyContinue | ForEach-Object { $_.OwningProcess })
if ($pids) {
    Stop-Process -Id $pids -Force -ErrorAction SilentlyContinue
  Write-Host "Stopped dashboard (port 8082)" -ForegroundColor Green
}

Start-Sleep -Seconds 1

# Start API
Write-Host ""
Write-Host "Starting API on port 8000..." -ForegroundColor Green
$apiPath = "c:\Users\janin\OneDrive\Skrivebord\Kyst monitor DEMO\EKTE_API"
Start-Process powershell -WindowStyle Normal -ArgumentList "-NoExit", "-Command", "cd '$apiPath'; python -m uvicorn src.api.main:app --host 127.0.0.1 --port 8000"

Start-Sleep -Seconds 2

# Start Dashboard
Write-Host "Starting vessel dashboard on port 8082..." -ForegroundColor Green
$dashboardPath = "c:\Users\janin\OneDrive\Skrivebord\Kyst monitor DEMO\14.04. NY BUILD\vessel-dashboard"
Start-Process powershell -WindowStyle Normal -ArgumentList "-NoExit", "-Command", "cd '$dashboardPath'; python server.py --port 8082"

Write-Host ""
Write-Host "Servers are starting." -ForegroundColor Green
Write-Host "API:       http://127.0.0.1:8000" -ForegroundColor Cyan
Write-Host "Dashboard: http://127.0.0.1:8082" -ForegroundColor Cyan
Write-Host "" 
Write-Host "Wait a few seconds, then open the dashboard URL in your browser." -ForegroundColor Yellow
Write-Host "" 
