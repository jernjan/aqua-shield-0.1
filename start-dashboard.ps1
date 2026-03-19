<#
    start-dashboard.ps1
    Robust oppstart for Kyst Monitor:
        - EKTE_API på port 8000 (alltid via .venv\Scripts\python.exe)
    - Vessel-dashboard på port 8081
    - Facility-dashboard på port 8084
        - Admin-dashboard på port 8080
#>

$ErrorActionPreference = "Stop"

Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "Starter Kyst Monitor (API + alle dashboard)" -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host ""

$root = $PSScriptRoot
$apiPath = Join-Path $root "EKTE_API"
$adminPath = Join-Path $root "14.04. NY BUILD\admin-dashboard"
$vesselPath = Join-Path $root "14.04. NY BUILD\vessel-dashboard"
$facilityPath = Join-Path $root "14.04. NY BUILD\facility-dashboard"
$venvPython = Join-Path $apiPath ".venv\Scripts\python.exe"

if (-not (Test-Path $venvPython)) {
    throw "Fant ikke venv-python: $venvPython"
}

function Stop-PortProcess {
    param([int]$Port)

    $conns = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue
    foreach ($conn in $conns) {
        try {
            Stop-Process -Id $conn.OwningProcess -Force -ErrorAction SilentlyContinue
            Write-Host "  - Frigjorde port $Port (PID $($conn.OwningProcess))" -ForegroundColor DarkYellow
        }
        catch {
        }
    }
}

function Test-Url {
    param(
        [string]$Url,
        [int]$TimeoutSec = 3
    )

    try {
        $null = Invoke-WebRequest $Url -UseBasicParsing -TimeoutSec $TimeoutSec -ErrorAction Stop
        return $true
    }
    catch {
        return $false
    }
}

function Wait-Url {
    param(
        [string]$Url,
        [int]$MaxWaitSec = 20,
        [int]$TryTimeoutSec = 3
    )

    $stopwatch = [System.Diagnostics.Stopwatch]::StartNew()
    while ($stopwatch.Elapsed.TotalSeconds -lt $MaxWaitSec) {
        if (Test-Url -Url $Url -TimeoutSec $TryTimeoutSec) {
            return $true
        }
        Start-Sleep -Milliseconds 1200
    }

    return $false
}

function Test-PortListening {
    param([int]$Port)

    $conn = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1
    return $null -ne $conn
}

function Wait-BackendReady {
    param(
        [int]$Port = 8000,
        [int]$MaxWaitSec = 75
    )

    $stopwatch = [System.Diagnostics.Stopwatch]::StartNew()
    while ($stopwatch.Elapsed.TotalSeconds -lt $MaxWaitSec) {
        # Port listening is enough to consider backend up for startup status
        if (Test-PortListening -Port $Port) {
            return $true
        }

        # Health endpoint can be slower due upstream checks, keep as secondary
        if (Test-Url -Url "http://127.0.0.1:$Port/health" -TimeoutSec 6) {
            return $true
        }

        Start-Sleep -Milliseconds 1500
    }

    return $false
}

Write-Host "Rydder gamle prosesser (8000, 8080, 8081, 8084)..." -ForegroundColor Yellow
foreach ($port in 8000, 8080, 8081, 8084) {
    Stop-PortProcess -Port $port
}
Start-Sleep -Seconds 1

Write-Host "Starter backend (venv) på port 8000..." -ForegroundColor Green
$apiCmd = "cd '$apiPath'; & '$venvPython' -m uvicorn src.api.main:app --host 127.0.0.1 --port 8000 --log-level info"
Start-Process powershell -ArgumentList "-NoExit", "-Command", $apiCmd -WindowStyle Minimized | Out-Null

Write-Host "Starter vessel-dashboard på port 8081..." -ForegroundColor Green
$vesselCmd = "cd '$vesselPath'; python -m http.server 8081"
Start-Process powershell -ArgumentList "-NoExit", "-Command", $vesselCmd -WindowStyle Minimized | Out-Null

Write-Host "Starter facility-dashboard på port 8084..." -ForegroundColor Green
$facilityCmd = "cd '$facilityPath'; python -m http.server 8084"
Start-Process powershell -ArgumentList "-NoExit", "-Command", $facilityCmd -WindowStyle Minimized | Out-Null

Write-Host "Starter admin-dashboard på port 8080..." -ForegroundColor Green
$adminCmd = "cd '$adminPath'; python -m http.server 8080"
Start-Process powershell -ArgumentList "-NoExit", "-Command", $adminCmd -WindowStyle Minimized | Out-Null

Write-Host ""
Write-Host "Venter på oppstart..." -ForegroundColor Yellow
Start-Sleep -Seconds 5

$targets = @(
    @{ Name = "Backend API"; Url = "http://127.0.0.1:8000/health"; Port = 8000 },
    @{ Name = "Vessel-dashboard"; Url = "http://127.0.0.1:8081"; Port = 8081 },
    @{ Name = "Facility-dashboard"; Url = "http://127.0.0.1:8084"; Port = 8084 },
    @{ Name = "Admin-dashboard"; Url = "http://127.0.0.1:8080"; Port = 8080 }
)

Write-Host ""
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "Serverstatus" -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan

$allOk = $true
foreach ($target in $targets) {
    if ($target.Port -eq 8000) {
        $ok = Wait-BackendReady -Port 8000 -MaxWaitSec 180
    }
    else {
        $ok = Wait-Url -Url $target.Url -MaxWaitSec 20 -TryTimeoutSec 4
    }

    if ($ok) {
        Write-Host ("[OK] {0} (port {1})" -f $target.Name, $target.Port) -ForegroundColor Green
    }
    else {
        Write-Host ("[FAIL] {0} (port {1})" -f $target.Name, $target.Port) -ForegroundColor Red
        $allOk = $false
    }
}

Write-Host ""
Write-Host "API docs:          http://127.0.0.1:8000/docs" -ForegroundColor White
Write-Host "Vessel-dashboard:  http://127.0.0.1:8081" -ForegroundColor White
Write-Host "Facility-dashboard:http://127.0.0.1:8084" -ForegroundColor White
Write-Host "Admin-dashboard:   http://127.0.0.1:8080" -ForegroundColor White

if ($allOk) {
    Write-Host ""
    Write-Host "Alt er oppe og kjorer." -ForegroundColor Green
}
else {
    Write-Host ""
    Write-Host "Noen tjenester svarte ikke. Kjor scriptet pa nytt eller sjekk terminalvinduene som ble apnet." -ForegroundColor Yellow
}

