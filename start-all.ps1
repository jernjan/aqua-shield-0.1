$ErrorActionPreference = "Stop"

$root = $PSScriptRoot
$apiPath = Join-Path $root "EKTE_API"
$adminPath = Join-Path $root "14.04. NY BUILD\admin-dashboard"
$facilityPath = Join-Path $root "14.04. NY BUILD\facility-dashboard"
$vesselPath = Join-Path $root "14.04. NY BUILD\vessel-dashboard"

$pythonCandidates = @(
    (Join-Path $root ".venv\Scripts\python.exe"),
    (Join-Path $apiPath ".venv\Scripts\python.exe")
)

$pythonExe = $pythonCandidates | Where-Object { Test-Path $_ } | Select-Object -First 1
if (-not $pythonExe) {
    throw "Fant ikke python i .venv. Sjekket: $($pythonCandidates -join ', ')"
}

function Stop-PortProcess {
    param([int]$Port)

    $listeners = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue
    foreach ($listener in $listeners) {
        try {
            Stop-Process -Id $listener.OwningProcess -Force -ErrorAction SilentlyContinue
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
        $null = Invoke-WebRequest -Uri $Url -UseBasicParsing -TimeoutSec $TimeoutSec -ErrorAction Stop
        return $true
    }
    catch {
        return $false
    }
}

function Wait-Url {
    param(
        [string]$Url,
        [int]$MaxWaitSec = 30
    )

    $start = Get-Date
    while (((Get-Date) - $start).TotalSeconds -lt $MaxWaitSec) {
        if (Test-Url -Url $Url) {
            return $true
        }
        Start-Sleep -Milliseconds 1200
    }

    return $false
}

Write-Host "Stopper prosesser på porter 8000/8080/8081/8082/8084..." -ForegroundColor Yellow
foreach ($port in 8000, 8080, 8081, 8082, 8084) {
    Stop-PortProcess -Port $port
}
Start-Sleep -Seconds 1

$runDir = Join-Path $root ".run"
if (-not (Test-Path $runDir)) {
    New-Item -ItemType Directory -Path $runDir | Out-Null
}

$apiLog = Join-Path $runDir "api.log"
$apiErrLog = Join-Path $runDir "api.err.log"
$adminLog = Join-Path $runDir "admin.log"
$adminErrLog = Join-Path $runDir "admin.err.log"
$facilityLog = Join-Path $runDir "facility.log"
$facilityErrLog = Join-Path $runDir "facility.err.log"
$facilityOwnerLog = Join-Path $runDir "facility-owner.log"
$facilityOwnerErrLog = Join-Path $runDir "facility-owner.err.log"
$vesselLog = Join-Path $runDir "vessel.log"
$vesselErrLog = Join-Path $runDir "vessel.err.log"

Write-Host "Starter API + dashboards med: $pythonExe" -ForegroundColor Cyan

$apiProc = Start-Process -FilePath $pythonExe -WorkingDirectory $apiPath -ArgumentList @("-m", "uvicorn", "src.api.main:app", "--host", "127.0.0.1", "--port", "8000") -WindowStyle Hidden -PassThru -RedirectStandardOutput $apiLog -RedirectStandardError $apiErrLog
$adminProc = Start-Process -FilePath $pythonExe -WorkingDirectory $adminPath -ArgumentList @("-m", "http.server", "8080") -WindowStyle Hidden -PassThru -RedirectStandardOutput $adminLog -RedirectStandardError $adminErrLog
$facilityProc = Start-Process -FilePath $pythonExe -WorkingDirectory $facilityPath -ArgumentList @("-m", "http.server", "8081") -WindowStyle Hidden -PassThru -RedirectStandardOutput $facilityLog -RedirectStandardError $facilityErrLog
$facilityOwnerProc = Start-Process -FilePath $pythonExe -WorkingDirectory $facilityPath -ArgumentList @("-m", "http.server", "8084") -WindowStyle Hidden -PassThru -RedirectStandardOutput $facilityOwnerLog -RedirectStandardError $facilityOwnerErrLog
$vesselProc = Start-Process -FilePath $pythonExe -WorkingDirectory $vesselPath -ArgumentList @("-m", "http.server", "8082") -WindowStyle Hidden -PassThru -RedirectStandardOutput $vesselLog -RedirectStandardError $vesselErrLog

$processInfo = @(
    @{ name = "api"; pid = $apiProc.Id; port = 8000 },
    @{ name = "admin"; pid = $adminProc.Id; port = 8080 },
    @{ name = "facility"; pid = $facilityProc.Id; port = 8081 },
    @{ name = "facility-owner"; pid = $facilityOwnerProc.Id; port = 8084 },
    @{ name = "vessel"; pid = $vesselProc.Id; port = 8082 }
)

$processFile = Join-Path $runDir "processes.json"
$processInfo | ConvertTo-Json | Set-Content -Path $processFile -Encoding UTF8

Start-Sleep -Seconds 2

$targets = @(
    @{ name = "API"; url = "http://127.0.0.1:8000/health" },
    @{ name = "Admin"; url = "http://127.0.0.1:8080" },
    @{ name = "Facility"; url = "http://127.0.0.1:8081" },
    @{ name = "Facility Owner"; url = "http://127.0.0.1:8084" },
    @{ name = "Vessel"; url = "http://127.0.0.1:8082" }
)

$allOk = $true
Write-Host "\nStatus:" -ForegroundColor Cyan
foreach ($target in $targets) {
    $ok = Wait-Url -Url $target.url -MaxWaitSec 45
    if ($ok) {
        Write-Host "[OK] $($target.name) - $($target.url)" -ForegroundColor Green
    }
    else {
        Write-Host "[FAIL] $($target.name) - $($target.url)" -ForegroundColor Red
        $allOk = $false
    }
}

Write-Host "\nProsessfil: $processFile"
Write-Host "Loggmappe: $runDir"

if ($allOk) {
    Write-Host "\nAlt er startet." -ForegroundColor Green
    exit 0
}

Write-Host "\nEn eller flere tjenester svarte ikke. Sjekk logger i .run/" -ForegroundColor Yellow
exit 1
