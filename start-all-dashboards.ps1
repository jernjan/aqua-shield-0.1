param(
    [switch]$ForceRestart
)

$ErrorActionPreference = "Stop"

Write-Host ""
Write-Host "╔══════════════════════════════════════════════════════════════╗" -ForegroundColor Cyan
Write-Host "║                  FULL STACK STARTUP                         ║" -ForegroundColor Cyan
Write-Host "║  API (8000) + Admin (8082) + Facility (8084) + Vessel (8081)║" -ForegroundColor Cyan
Write-Host "╚══════════════════════════════════════════════════════════════╝" -ForegroundColor Cyan
Write-Host ""

$root = "C:\Users\janin\OneDrive\Skrivebord\Kyst monitor DEMO"
$apiRoot = "$root\EKTE_API"
$adminRoot = "$root\14.04. NY BUILD\admin-dashboard"
$facilityRoot = "$root\14.04. NY BUILD\facility-dashboard"
$vesselRoot = "$root\14.04. NY BUILD\vessel-dashboard"

Write-Host "[1/4] Starting EKTE_API on port 8000..." -ForegroundColor Yellow
& "$apiRoot\start-api.ps1" -ForceRestart -Port 8000
Start-Sleep -Seconds 3

Write-Host ""
Write-Host "[2/4] Starting Admin Dashboard on port 8082..." -ForegroundColor Yellow
& "$adminRoot\start-admin-dashboard.ps1" -ForceRestart -Port 8082
Start-Sleep -Seconds 2

Write-Host ""
Write-Host "[3/4] Starting Facility Dashboard on port 8084..." -ForegroundColor Yellow
& "$facilityRoot\start-facility-dashboard-robust.ps1" -ForceRestart -Port 8084
Start-Sleep -Seconds 2

Write-Host ""
Write-Host "[4/4] Starting Vessel Dashboard on port 8081..." -ForegroundColor Yellow
& "$vesselRoot\start-vessel-dashboard.ps1" -ForceRestart -Port 8081
Start-Sleep -Seconds 2

Write-Host ""
Write-Host "╔══════════════════════════════════════════════════════════════╗" -ForegroundColor Green
Write-Host "║                    STACK READY                              ║" -ForegroundColor Green
Write-Host "╠══════════════════════════════════════════════════════════════╣" -ForegroundColor Green
Write-Host "║  API:              http://localhost:8000/docs               ║" -ForegroundColor Cyan
Write-Host "║  Admin Dashboard:  http://localhost:8082                    ║" -ForegroundColor Cyan
Write-Host "║  Facility Dash:    http://localhost:8084                    ║" -ForegroundColor Cyan
Write-Host "║  Vessel Dashboard: http://localhost:8081                    ║" -ForegroundColor Cyan
Write-Host "╚══════════════════════════════════════════════════════════════╝" -ForegroundColor Green
Write-Host ""
