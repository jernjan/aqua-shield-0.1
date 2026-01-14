# Test backtesting API
Start-Sleep -Seconds 3

Write-Host "🧪 Starting backtesting on 2024 data..."
$body = @{
    startDate = "2024-01-01"
    endDate = "2024-12-31"
    step = "7days"
} | ConvertTo-Json

try {
    $resp = Invoke-WebRequest -Uri 'http://localhost:3001/api/admin/backtest/start' `
        -Method POST `
        -Body $body `
        -ContentType 'application/json' `
        -UseBasicParsing `
        -TimeoutSec 30

    $data = $resp.Content | ConvertFrom-Json
    $jobId = $data.jobId
    Write-Host "✅ Job started with ID: $jobId"
    Write-Host ""
    Write-Host "⏳ Monitoring progress..."
    Write-Host ""

    # Poll status until complete
    $completed = $false
    $attempts = 0
    $maxAttempts = 120  # 10 minutes with 5-second intervals

    while (-not $completed -and $attempts -lt $maxAttempts) {
        Start-Sleep -Seconds 5
        
        try {
            $statusResp = Invoke-WebRequest -Uri "http://localhost:3001/api/admin/backtest/status/$jobId" `
                -UseBasicParsing `
                -TimeoutSec 10
            
            $status = $statusResp.Content | ConvertFrom-Json
            
            Write-Host -NoNewline "`r  Progress: $($status.progress)% - $($status.currentDate)"
            
            if ($status.status -eq 'completed') {
                $completed = $true
                Write-Host ""
                Write-Host ""
                Write-Host "✅ BACKTESTING COMPLETE!"
                Write-Host ""
                
                # Get results
                $resultsResp = Invoke-WebRequest -Uri "http://localhost:3001/api/admin/backtest/results/$jobId" `
                    -UseBasicParsing
                
                $results = $resultsResp.Content | ConvertFrom-Json
                
                Write-Host "📊 RESULTS:"
                Write-Host "  Period: $($results.period)"
                Write-Host "  Duration: $($results.duration)"
                Write-Host ""
                Write-Host "📈 METRICS:"
                Write-Host "  Sensitivity (TPR): $($results.metrics.sensitivity)"
                Write-Host "  Specificity (TNR): $($results.metrics.specificity)"
                Write-Host "  Precision (PPV):   $($results.metrics.precision)"
                Write-Host "  F1 Score:          $($results.metrics.f1)"
                Write-Host ""
                Write-Host "🎯 CONFUSION MATRIX:"
                Write-Host "  True Positives:  $($results.metrics.truePositives)"
                Write-Host "  False Positives: $($results.metrics.falsePositives)"
                Write-Host "  True Negatives:  $($results.metrics.trueNegatives)"
                Write-Host "  False Negatives: $($results.metrics.falseNegatives)"
                Write-Host "  Total Predictions: $($results.metrics.totalPredictions)"
            } elseif ($status.status -eq 'failed') {
                Write-Host ""
                Write-Host "❌ Backtesting failed!"
                $completed = $true
            }
        } catch {
            Write-Host "⚠️  Status check failed, retrying..."
        }
        
        $attempts++
    }

    if (-not $completed) {
        Write-Host ""
        Write-Host "⏱️  Backtesting timeout (10 minutes)"
    }

} catch {
    Write-Host "❌ Error: $($_.Exception.Message)"
}
