param(
    [switch]$ForceRestart,
    [int]$Port = 8000
)

$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$venvPython = Join-Path $root ".venv\Scripts\python.exe"

if (-not (Test-Path $venvPython)) {
    throw "Fant ikke venv-python: $venvPython"
}

function Test-ApiHealth {
    param([int]$TargetPort)
    try {
        $response = Invoke-RestMethod -Uri "http://127.0.0.1:$TargetPort/health" -TimeoutSec 3 -ErrorAction Stop
        return $null -ne $response
    }
    catch {
        return $false
    }
}

function Test-PortListening {
    param([int]$TargetPort)
    $conn = Get-NetTCPConnection -LocalPort $TargetPort -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1
    return $null -ne $conn
}

function Wait-ApiReady {
    param(
        [int]$TargetPort,
        [int]$MaxWaitSec = 60
    )

    $deadline = (Get-Date).AddSeconds($MaxWaitSec)
    while ((Get-Date) -lt $deadline) {
        if (Test-PortListening -TargetPort $TargetPort) {
            return $true
        }

        if (Test-ApiHealth -TargetPort $TargetPort) {
            return $true
        }

        Start-Sleep -Milliseconds 800
    }

    return $false
}

function Get-PortOwner {
    param([int]$TargetPort)
    return Get-NetTCPConnection -LocalPort $TargetPort -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1
}

$existing = Get-PortOwner -TargetPort $Port
if ($existing -and -not $ForceRestart) {
    if ((Test-PortListening -TargetPort $Port) -or (Test-ApiHealth -TargetPort $Port)) {
        Write-Host "[OK] API kjører allerede på port $Port (PID $($existing.OwningProcess))." -ForegroundColor Green
        Write-Host "Docs: http://127.0.0.1:$Port/docs" -ForegroundColor White
        exit 0
    }
}

if ($existing) {
    Write-Host "[INFO] Stopper eksisterende prosess på port $Port (PID $($existing.OwningProcess))..." -ForegroundColor Yellow
    Stop-Process -Id $existing.OwningProcess -Force -ErrorAction SilentlyContinue
    Start-Sleep -Milliseconds 800
}

Write-Host "[INFO] Starter API på port $Port..." -ForegroundColor Cyan
$cmd = "cd '$root'; & '$venvPython' -m uvicorn src.api.main:app --host 0.0.0.0 --port $Port --log-level info"
Start-Process powershell -ArgumentList "-NoExit", "-Command", $cmd -WindowStyle Minimized | Out-Null

if (Wait-ApiReady -TargetPort $Port -MaxWaitSec 75) {
    Write-Host "[OK] API er oppe: http://127.0.0.1:$Port/health" -ForegroundColor Green
    Write-Host "Docs: http://127.0.0.1:$Port/docs" -ForegroundColor White
    exit 0
}

Write-Host "[FAIL] API svarte ikke innen tidsfristen. Sjekk minimert API-terminal for stacktrace." -ForegroundColor Red
exit 1
