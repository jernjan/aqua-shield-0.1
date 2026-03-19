param(
    [int]$TimeoutSec = 90
)

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "FULL STACK VERIFICATION" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Track results
$results = @{}
$failCount = 0

# 1. Check API health
Write-Host "[1/4] Checking API health...  " -ForegroundColor Yellow -NoNewline
try {
    $response = Invoke-RestMethod "http://127.0.0.1:8000/health" -TimeoutSec 5 -ErrorAction Stop
    Write-Host "OK" -ForegroundColor Green
    $results["API_HEALTH"] = "OK"
}
catch {
    Write-Host "FAILED" -ForegroundColor Red
    $results["API_HEALTH"] = "FAILED"
    $failCount++
}

# 2. Check compatibility fields
Write-Host "[2/4] Checking API compatibility... " -ForegroundColor Yellow -NoNewline
try {
    $apiRoot = "C:\Users\janin\OneDrive\Skrivebord\Kyst monitor DEMO\EKTE_API"
    & "$apiRoot\verify-compatibility.ps1" -Port 8000 -FacilityCode 10335 | Out-Null
    if ($LASTEXITCODE -eq 0) {
        Write-Host "OK" -ForegroundColor Green
        $results["COMPAT_FIELDS"] = "OK"
    }
    else {
        Write-Host "FAILED" -ForegroundColor Red
        $results["COMPAT_FIELDS"] = "FAILED"
        $failCount++
    }
}
catch {
    Write-Host "ERROR" -ForegroundColor Red
    $results["COMPAT_FIELDS"] = "ERROR"
    $failCount++
}

# 3. Check dashboards
Write-Host "[3/4] Checking dashboards..." -ForegroundColor Yellow

$dashboards = @(
    @{ Name = "Admin"; Port = 8082 },
    @{ Name = "Facility"; Port = 8084 },
    @{ Name = "Vessel"; Port = 8081 }
)

foreach ($dashboard in $dashboards) {
    Write-Host "  - $($dashboard.Name) (port $($dashboard.Port))... " -ForegroundColor Yellow -NoNewline
    try {
        $response = Invoke-RestMethod "http://127.0.0.1:$($dashboard.Port)" -TimeoutSec 5 -ErrorAction Stop
        Write-Host "OK" -ForegroundColor Green
        $results["$($dashboard.Name.ToUpper())"] = "OK"
    }
    catch {
        Write-Host "FAILED" -ForegroundColor Red
        $results["$($dashboard.Name.ToUpper())"] = "FAILED"
        $failCount++
    }
}

# 4. Summary
Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "VERIFICATION SUMMARY" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

foreach ($key in $results.Keys) {
    $value = $results[$key]
    if ($value -eq "OK") {
        Write-Host "  [OK]   $key" -ForegroundColor Green
    }
    else {
        Write-Host "  [FAIL] $key" -ForegroundColor Red
    }
}

Write-Host ""

if ($failCount -eq 0) {
    Write-Host "========================================" -ForegroundColor Green
    Write-Host "ALL SYSTEMS OPERATIONAL" -ForegroundColor Green
    Write-Host "========================================" -ForegroundColor Green
    exit 0
}
else {
    Write-Host "========================================" -ForegroundColor Red
    Write-Host "$failCount SYSTEM(S) NEED ATTENTION" -ForegroundColor Red
    Write-Host "========================================" -ForegroundColor Red
    exit 1
}
