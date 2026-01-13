param(
    [string]$JobId = "33c66767-92b6-4ac3-bb49-23b718d67c21",
    [int]$CheckIntervalSeconds = 20,
    [int]$MaxChecks = 60
)

Write-Host "🔍 Backtesting Monitor" -ForegroundColor Cyan
Write-Host "Job ID: $JobId" -ForegroundColor Yellow
Write-Host "Checking every $CheckIntervalSeconds seconds"
Write-Host ""

$checkCount = 0
while ($checkCount -lt $MaxChecks) {
    $checkCount++
    try {
        $response = Invoke-WebRequest -Uri "http://localhost:3001/api/admin/backtest/status/$JobId" `
            -UseBasicParsing -TimeoutSec 5 -ErrorAction Stop
        $status = $response.Content | ConvertFrom-Json
        
        $timestamp = Get-Date -Format "HH:mm:ss"
        
        if ($status.status -eq 'running') {
            Write-Host "[$timestamp] 🔄 Running | Progress: $($status.progress)% | Date: $($status.currentDate)"
        }
        if ($status.status -eq 'completed') {
            Write-Host "[$timestamp] ✅ COMPLETED!" -ForegroundColor Green
            Write-Host ""
            Write-Host "📊 Results:" -ForegroundColor Green
            $sens = [math]::Round($status.result.sensitivity * 100, 1)
            $spec = [math]::Round($status.result.specificity * 100, 1)
            $prec = [math]::Round($status.result.precision * 100, 1)
            Write-Host "  Sensitivity: $sens%"
            Write-Host "  Specificity: $spec%"
            Write-Host "  Precision:   $prec%"
            Write-Host "  F1 Score:    $($status.result.f1)"
            Write-Host ""
            Write-Host "  TP: $($status.result.truePositives) | FP: $($status.result.falsePositives)"
            Write-Host "  FN: $($status.result.falseNegatives) | TN: $($status.result.trueNegatives)"
            exit 0
        }
        if ($status.status -ne 'running' -and $status.status -ne 'completed') {
            Write-Host "[$timestamp] ⚠️ Status: $($status.status)" -ForegroundColor Yellow
        }
    }
    catch {
        Write-Host "[$([datetime]::Now.ToString('HH:mm:ss'))] ❌ Error: $($_.Exception.Message)" -ForegroundColor Red
    }
    
    if ($checkCount -lt $MaxChecks) {
        Start-Sleep -Seconds $CheckIntervalSeconds
    }
}

Write-Host ""
Write-Host "⏱️ Timeout after $checkCount checks ($(($CheckIntervalSeconds * $checkCount) / 60) min)" -ForegroundColor Yellow
