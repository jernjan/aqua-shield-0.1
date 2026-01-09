# Test local server endpoints for AquaShield
# Usage: Open PowerShell, cd to repo root and run: .\scripts\test_local_endpoints.ps1

$ports = @(3001, 4000)
$base = $null
foreach ($p in $ports) {
  try {
    $r = Invoke-WebRequest -Uri "http://localhost:$p/api/health" -UseBasicParsing -TimeoutSec 2 -ErrorAction Stop
    if ($r.StatusCode -eq 200) { $base = "http://localhost:$p"; break }
  } catch { }
}

if (-not $base) {
  Write-Host "Could not find a running server on ports 3001 or 4000. Start the server first:`n  cd server; npm run dev`" -ForegroundColor Yellow
  exit 1
}

Write-Host "Found server at $base" -ForegroundColor Green

Write-Host "GET /api/alerts"
Invoke-RestMethod -Uri "$base/api/alerts" -Method Get | ConvertTo-Json -Depth 5 | Write-Host

Write-Host "POST /api/alerts/test (creates a test alert)"
$body = @{ facilityName = 'LocalTest' } | ConvertTo-Json
Invoke-RestMethod -Uri "$base/api/alerts/test" -Method Post -Body $body -ContentType 'application/json' | ConvertTo-Json -Depth 5 | Write-Host

Write-Host "POST /api/admin/run-cron (runs nightly analysis)"
try {
  Invoke-RestMethod -Uri "$base/api/admin/run-cron" -Method Post -TimeoutSec 60 | ConvertTo-Json -Depth 5 | Write-Host
} catch {
  Write-Host "Run-cron failed: $_" -ForegroundColor Red
}

Write-Host "Done. Check the server console/logs for more details." -ForegroundColor Cyan
