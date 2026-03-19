$ErrorActionPreference = "Stop"

$root = $PSScriptRoot
$pythonCandidates = @(
    (Join-Path $root "..\..\.venv\Scripts\python.exe"),
    (Join-Path $root "..\..\EKTE_API\.venv\Scripts\python.exe"),
    "python"
)

$pythonExe = $pythonCandidates | Where-Object {
    if ($_ -eq "python") { return $true }
    Test-Path $_
} | Select-Object -First 1

Write-Host "Stopper eventuelle prosesser på port 8085..." -ForegroundColor Yellow
$listeners = Get-NetTCPConnection -LocalPort 8085 -State Listen -ErrorAction SilentlyContinue
foreach ($listener in $listeners) {
    try {
        Stop-Process -Id $listener.OwningProcess -Force -ErrorAction SilentlyContinue
    } catch {}
}

Start-Sleep -Seconds 1

Write-Host "Starter Pilot Lite på http://127.0.0.1:8085" -ForegroundColor Green
Start-Process -FilePath $pythonExe -WorkingDirectory $root -ArgumentList @("-m", "http.server", "8085")

Start-Sleep -Seconds 2

try {
    $null = Invoke-WebRequest -Uri "http://127.0.0.1:8085/ops-lite.html" -UseBasicParsing -TimeoutSec 5
    Write-Host "Pilot Lite er oppe." -ForegroundColor Green
    Write-Host "Ops: http://127.0.0.1:8085/ops-lite.html"
    Write-Host "Kalender: http://127.0.0.1:8085/calendar-lite.html"
} catch {
    Write-Host "Kunne ikke verifisere oppstart automatisk. Sjekk nettleser manuelt." -ForegroundColor Yellow
}
