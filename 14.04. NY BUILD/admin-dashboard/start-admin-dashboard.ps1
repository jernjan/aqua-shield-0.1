param(
    [switch]$ForceRestart,
    [int]$Port = 8080
)

function Test-PortListening {
    param([int]$TargetPort)
    try {
        $conn = Get-NetTCPConnection -LocalPort $TargetPort -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1
        return $null -ne $conn
    }
    catch {
        return $false
    }
}

$root = Split-Path -Parent $MyInvocation.MyCommand.Path

if (-not $ForceRestart) {
    if (Test-PortListening -TargetPort $Port) {
        Write-Host "[OK] Admin Dashboard already on port $Port" -ForegroundColor Green
        exit 0
    }
}

$existing = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1
if ($existing) {
    Write-Host "[INFO] Stopping process on port $Port..." -ForegroundColor Yellow
    Stop-Process -Id $existing.OwningProcess -Force -ErrorAction SilentlyContinue
    Start-Sleep -Milliseconds 500
}

Write-Host "[INFO] Starting Admin Dashboard on port $Port..." -ForegroundColor Cyan
Push-Location $root | Out-Null
Start-Process python -ArgumentList "-m", "http.server", "$Port" -WindowStyle Minimized
Pop-Location | Out-Null

Start-Sleep -Seconds 1

if (Test-PortListening -TargetPort $Port) {
    Write-Host "[OK] Admin Dashboard running on port $Port" -ForegroundColor Green
    exit 0
}

Write-Host "[FAIL] Admin Dashboard failed to start" -ForegroundColor Red
exit 1
