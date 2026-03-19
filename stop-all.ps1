$ErrorActionPreference = "Continue"

$root = $PSScriptRoot
$runDir = Join-Path $root ".run"
$processFile = Join-Path $runDir "processes.json"

function Stop-PortProcess {
    param([int]$Port)

    $listeners = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue
    foreach ($listener in $listeners) {
        try {
            Stop-Process -Id $listener.OwningProcess -Force -ErrorAction SilentlyContinue
            Write-Host "Stoppet PID $($listener.OwningProcess) på port $Port" -ForegroundColor DarkYellow
        }
        catch {
        }
    }
}

if (Test-Path $processFile) {
    try {
        $processes = Get-Content -Raw -Path $processFile | ConvertFrom-Json
        foreach ($proc in $processes) {
            if ($proc.pid) {
                try {
                    Stop-Process -Id ([int]$proc.pid) -Force -ErrorAction SilentlyContinue
                    Write-Host "Stoppet $($proc.name) (PID $($proc.pid))" -ForegroundColor Yellow
                }
                catch {
                }
            }
        }
    }
    catch {
        Write-Host "Kunne ikke lese prosessfil, går videre med port-opprydding." -ForegroundColor DarkYellow
    }
}

foreach ($port in 8000, 8080, 8081, 8082) {
    Stop-PortProcess -Port $port
}

if (Test-Path $processFile) {
    Remove-Item $processFile -Force -ErrorAction SilentlyContinue
}

Write-Host "Ferdig. API og dashboards er stoppet." -ForegroundColor Green
