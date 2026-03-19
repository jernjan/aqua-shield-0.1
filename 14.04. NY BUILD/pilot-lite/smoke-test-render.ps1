param(
    [string]$BaseUrl,
    [string]$ApiBase = "http://localhost:8000",
    [int]$TimeoutSec = 20
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

function Test-HttpEndpoint {
    param(
        [string]$Name,
        [string]$Url,
        [int]$TimeoutSeconds,
        [string]$Kind = "required"
    )

    $start = Get-Date
    try {
        $response = Invoke-WebRequest -Uri $Url -Method Get -TimeoutSec $TimeoutSeconds -UseBasicParsing
        $elapsed = [math]::Round(((Get-Date) - $start).TotalMilliseconds)
        return [PSCustomObject]@{
            Name = $Name
            Url = $Url
            Kind = $Kind
            Ok = $true
            StatusCode = [int]$response.StatusCode
            LatencyMs = $elapsed
            Error = ""
        }
    }
    catch {
        $elapsed = [math]::Round(((Get-Date) - $start).TotalMilliseconds)
        $statusCode = $null
        try {
            if ($_.Exception.Response -and $_.Exception.Response.StatusCode) {
                $statusCode = [int]$_.Exception.Response.StatusCode
            }
        }
        catch { }

        return [PSCustomObject]@{
            Name = $Name
            Url = $Url
            Kind = $Kind
            Ok = $false
            StatusCode = $statusCode
            LatencyMs = $elapsed
            Error = $_.Exception.Message
        }
    }
}

$normalizedBaseUrl = if ([string]::IsNullOrWhiteSpace($BaseUrl)) { "" } else { $BaseUrl.Trim().TrimEnd('/') }
$normalizedApiBase = if ([string]::IsNullOrWhiteSpace($ApiBase)) { "" } else { $ApiBase.Trim().TrimEnd('/') }

if ([string]::IsNullOrWhiteSpace($normalizedBaseUrl)) {
    Write-Host "Bruk: ./smoke-test-render.ps1 -BaseUrl https://<din-render-frontend>.onrender.com" -ForegroundColor Yellow
    exit 2
}

Write-Host "Starter smoke test..." -ForegroundColor Cyan
Write-Host "Frontend: $normalizedBaseUrl"
Write-Host "API:      $normalizedApiBase"
Write-Host ""

$checks = @(
    @{ Name = 'Frontend startside'; Url = "$normalizedBaseUrl/index.html"; Kind = 'required' },
    @{ Name = 'System Check side'; Url = "$normalizedBaseUrl/system-check.html"; Kind = 'required' },
    @{ Name = 'Vessel dashboard'; Url = "$normalizedBaseUrl/vessel-dashboard-lite.html"; Kind = 'required' },
    @{ Name = 'Facility dashboard'; Url = "$normalizedBaseUrl/facility-dashboard-lite.html"; Kind = 'required' },
    @{ Name = 'API vessels'; Url = "$normalizedApiBase/api/vessels?limit=1"; Kind = 'required' },
    @{ Name = 'API facilities'; Url = "$normalizedApiBase/api/facilities?limit=1&skip=0&include_geo=true"; Kind = 'required' },
    @{ Name = 'API disease spread'; Url = "$normalizedApiBase/api/facilities/disease-spread?ts=$([DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds())"; Kind = 'required' },
    @{ Name = 'API at-risk facilities'; Url = "$normalizedApiBase/api/vessels/at-risk-facilities?min_duration_minutes=20&include_test_vessels=false&lookback_days=7"; Kind = 'optional' },
    @{ Name = 'API lice risk'; Url = "$normalizedApiBase/api/vessels/at-lice-risk-facilities?min_duration_minutes=20&include_test_vessels=false&lookback_days=7"; Kind = 'optional' }
)

$results = @()
foreach ($check in $checks) {
    $result = Test-HttpEndpoint -Name $check.Name -Url $check.Url -TimeoutSeconds $TimeoutSec -Kind $check.Kind
    $results += $result

    if ($result.Ok) {
        Write-Host ("[OK]   {0} ({1} ms, HTTP {2})" -f $result.Name, $result.LatencyMs, $result.StatusCode) -ForegroundColor Green
    }
    else {
        $codeText = if ($null -ne $result.StatusCode) { "HTTP $($result.StatusCode)" } else { "ingen statuskode" }
        Write-Host ("[FAIL] {0} ({1} ms, {2})" -f $result.Name, $result.LatencyMs, $codeText) -ForegroundColor Red
    }
}

$requiredFails = @($results | Where-Object { -not $_.Ok -and $_.Kind -eq 'required' })
$optionalFails = @($results | Where-Object { -not $_.Ok -and $_.Kind -eq 'optional' })

Write-Host ""
Write-Host "Oppsummering:" -ForegroundColor Cyan
Write-Host ("- Totalt:      {0}" -f $results.Count)
Write-Host ("- Kritiske fail: {0}" -f $requiredFails.Count)
Write-Host ("- Valgfrie fail: {0}" -f $optionalFails.Count)

if ($requiredFails.Count -gt 0) {
    Write-Host ""
    Write-Host "Kritiske feil:" -ForegroundColor Red
    foreach ($fail in $requiredFails) {
        Write-Host ("- {0}: {1}" -f $fail.Name, $fail.Error)
    }
    exit 1
}

if ($optionalFails.Count -gt 0) {
    Write-Host ""
    Write-Host "Valgfrie varsler:" -ForegroundColor Yellow
    foreach ($fail in $optionalFails) {
        Write-Host ("- {0}: {1}" -f $fail.Name, $fail.Error)
    }
}

Write-Host ""
Write-Host "Smoke test bestått (kritiske sjekker OK)." -ForegroundColor Green
exit 0
