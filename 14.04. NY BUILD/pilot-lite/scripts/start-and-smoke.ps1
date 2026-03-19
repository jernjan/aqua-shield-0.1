param(
    [switch]$SkipSmoke
)

$ErrorActionPreference = 'Stop'

$pilotLiteRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$repoRoot = (Resolve-Path (Join-Path $pilotLiteRoot '..\..')).Path
$apiRoot = Join-Path $repoRoot 'EKTE_API'

$apiPythonCandidates = @(
    (Join-Path $apiRoot '.venv\\Scripts\\python.exe'),
    (Join-Path $repoRoot '.venv\\Scripts\\python.exe'),
    'python'
)

$webPythonCandidates = @(
    (Join-Path $repoRoot '.venv\\Scripts\\python.exe'),
    (Join-Path $apiRoot '.venv\\Scripts\\python.exe'),
    'python'
)

$apiPythonExe = $apiPythonCandidates | Where-Object {
    if ($_ -eq 'python') { return $true }
    Test-Path $_
} | Select-Object -First 1

$webPythonExe = $webPythonCandidates | Where-Object {
    if ($_ -eq 'python') { return $true }
    Test-Path $_
} | Select-Object -First 1

if (-not $apiPythonExe -or -not $webPythonExe) {
    throw "Fant ikke Python. API-kandidater: $($apiPythonCandidates -join ', ') WEB-kandidater: $($webPythonCandidates -join ', ')"
}

function Stop-PortProcess {
    param([int]$Port)
    $listeners = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue
    foreach ($listener in $listeners) {
        try { Stop-Process -Id $listener.OwningProcess -Force -ErrorAction SilentlyContinue } catch {}
    }
}

function Wait-Url {
    param(
        [string]$Url,
        [int]$MaxWaitSec = 30,
        [int]$TimeoutSec = 4
    )

    $start = Get-Date
    while (((Get-Date) - $start).TotalSeconds -lt $MaxWaitSec) {
        try {
            $null = Invoke-WebRequest -Uri $Url -UseBasicParsing -TimeoutSec $TimeoutSec -ErrorAction Stop
            return $true
        } catch {
            Start-Sleep -Milliseconds 900
        }
    }
    return $false
}

Write-Host 'Stopper prosesser på porter 8000 og 8085...' -ForegroundColor Yellow
Stop-PortProcess -Port 8000
Stop-PortProcess -Port 8085
Start-Sleep -Seconds 1

$runDir = Join-Path $pilotLiteRoot '.run'
if (-not (Test-Path $runDir)) {
    New-Item -ItemType Directory -Path $runDir | Out-Null
}

$apiOut = Join-Path $runDir 'pilot-lite-api.out.log'
$apiErr = Join-Path $runDir 'pilot-lite-api.err.log'
$webOut = Join-Path $runDir 'pilot-lite-web.out.log'
$webErr = Join-Path $runDir 'pilot-lite-web.err.log'

Write-Host "Starter API (8000) med $apiPythonExe" -ForegroundColor Cyan
$apiProc = Start-Process -FilePath $apiPythonExe -WorkingDirectory $apiRoot -ArgumentList @('-m', 'uvicorn', 'src.api.main:app', '--host', '127.0.0.1', '--port', '8000') -WindowStyle Hidden -PassThru -RedirectStandardOutput $apiOut -RedirectStandardError $apiErr

Write-Host "Starter Pilot Lite web (8085) med $webPythonExe" -ForegroundColor Cyan
$webProc = Start-Process -FilePath $webPythonExe -WorkingDirectory $pilotLiteRoot -ArgumentList @('-m', 'http.server', '8085') -WindowStyle Hidden -PassThru -RedirectStandardOutput $webOut -RedirectStandardError $webErr

$upApi = Wait-Url -Url 'http://127.0.0.1:8000/api/facilities/disease-spread' -MaxWaitSec 45 -TimeoutSec 5
$upWeb = Wait-Url -Url 'http://127.0.0.1:8085/vessel-dashboard-lite.html' -MaxWaitSec 30 -TimeoutSec 5

if (-not $upApi -or -not $upWeb) {
    Write-Host ''
    Write-Host '[FAIL] Oppstart feilet.' -ForegroundColor Red
    Write-Host "API oppe: $upApi"
    Write-Host "Web oppe: $upWeb"
    Write-Host "API logg: $apiOut"
    Write-Host "WEB logg: $webOut"
    exit 1
}

Write-Host ''
Write-Host '[OK] API:  http://127.0.0.1:8000/docs' -ForegroundColor Green
Write-Host '[OK] Web:  http://127.0.0.1:8085/vessel-dashboard-lite.html' -ForegroundColor Green
Write-Host '[OK] Web:  http://127.0.0.1:8085/facility-dashboard-lite.html' -ForegroundColor Green

if ($SkipSmoke) {
    Write-Host ''
    Write-Host 'Skipper smoke-test (-SkipSmoke).' -ForegroundColor Yellow
    exit 0
}

Write-Host ''
Write-Host 'Varmstarter API-endepunkter...' -ForegroundColor Cyan
try {
    $null = Invoke-WebRequest -Uri 'http://127.0.0.1:8000/api/facilities?limit=5' -UseBasicParsing -TimeoutSec 20 -ErrorAction Stop
    $null = Invoke-WebRequest -Uri 'http://127.0.0.1:8000/api/pilot/clearances?profile_name=masoval&actor=masoval' -UseBasicParsing -TimeoutSec 20 -ErrorAction Stop
} catch {
    Write-Host "Advarsel: varmstart feilet: $($_.Exception.Message)" -ForegroundColor Yellow
}

Write-Host ''
Write-Host 'Kjører smoke-test...' -ForegroundColor Cyan
Set-Location $pilotLiteRoot
& (Join-Path $pilotLiteRoot 'scripts\smoke-e2e.ps1')
$exitCode = $LASTEXITCODE

if ($exitCode -ne 0) {
    Write-Host ''
    Write-Host 'Første smoke-test feilet, prøver én gang til etter kort venting...' -ForegroundColor Yellow
    Start-Sleep -Seconds 3
    & (Join-Path $pilotLiteRoot 'scripts\\smoke-e2e.ps1')
    $exitCode = $LASTEXITCODE
}

if ($exitCode -eq 0) {
    Write-Host ''
    Write-Host '[OK] Smoke-test bestått.' -ForegroundColor Green
} else {
    Write-Host ''
    Write-Host '[FAIL] Smoke-test feilet.' -ForegroundColor Red
}

exit $exitCode
