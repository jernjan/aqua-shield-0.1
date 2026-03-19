param(
    [int]$Port = 8000,
    [int]$FacilityCode = 10335,
    [int]$TimeoutSec = 90
)

$ErrorActionPreference = "Stop"

function Get-HasProperty {
    param(
        [Parameter(Mandatory = $true)]$Object,
        [Parameter(Mandatory = $true)][string]$Name
    )

    if ($null -eq $Object) {
        return $false
    }

    return [bool]($Object.PSObject.Properties.Name -contains $Name)
}

Write-Host "[INFO] Verifiserer API på port $Port for facility $FacilityCode..." -ForegroundColor Cyan

$base = "http://127.0.0.1:$Port"

# 1) risk-score
$risk = Invoke-RestMethod "$base/api/facility/$FacilityCode/risk-score" -TimeoutSec $TimeoutSec
$riskHasDetails = $null -ne $risk.details
$riskHasCompat = if ($riskHasDetails) { Get-HasProperty -Object $risk.details -Name "disease_host_compatibility" } else { $false }

Write-Output ("RISK_DETAILS_PRESENT=" + $riskHasDetails)
Write-Output ("RISK_COMPAT_PRESENT=" + $riskHasCompat)

# 2) predictions/all
$all = Invoke-RestMethod "$base/api/risk/predictions/all" -TimeoutSec $TimeoutSec
$top = @()
if ($all.top_20_by_risk) {
    $top = @($all.top_20_by_risk)
}

$allCount = $top.Count
$allCompatCount = 0
foreach ($item in $top) {
    if (Get-HasProperty -Object $item -Name "disease_host_compatibility") {
        $allCompatCount++
    }
}

Write-Output ("ALL_COUNT=" + $allCount)
Write-Output ("ALL_COMPAT_COUNT=" + $allCompatCount)
Write-Output ("ALL_COMPAT_ALL_ITEMS=" + [bool]($allCount -gt 0 -and $allCompatCount -eq $allCount))

# 3) predictions/facility
$facility = Invoke-RestMethod "$base/api/risk/predictions/facility/$FacilityCode" -TimeoutSec $TimeoutSec
$facilityHasCompat = Get-HasProperty -Object $facility -Name "disease_host_compatibility"

Write-Output ("FACILITY_COMPAT_PRESENT=" + $facilityHasCompat)

# 4) predictions/demo (kan være tom)
$demo = Invoke-RestMethod "$base/api/risk/predictions/demo" -TimeoutSec $TimeoutSec
$demoPreds = @()
if ($demo.predictions) {
    $demoPreds = @($demo.predictions)
}

$demoCount = $demoPreds.Count
$demoTopCompat = $false
$demoSourceCompat = $false

if ($demoCount -gt 0) {
    $first = $demoPreds[0]
    $demoTopCompat = Get-HasProperty -Object $first -Name "disease_host_compatibility"

    if ($first.nearby_sources -and @($first.nearby_sources).Count -gt 0) {
        $sourceFirst = @($first.nearby_sources)[0]
        $demoSourceCompat = Get-HasProperty -Object $sourceFirst -Name "disease_host_compatibility"
    }
}

Write-Output ("DEMO_COUNT=" + $demoCount)
Write-Output ("DEMO_TOP_COMPAT_PRESENT=" + $demoTopCompat)
Write-Output ("DEMO_SOURCE_COMPAT_PRESENT=" + $demoSourceCompat)

if (-not $riskHasCompat -or -not $facilityHasCompat -or ($allCount -gt 0 -and $allCompatCount -ne $allCount)) {
    Write-Host "[FAIL] En eller flere kjerne-endepunkter mangler disease_host_compatibility." -ForegroundColor Red
    exit 1
}

Write-Host "[OK] Kjerne-endepunkter har disease_host_compatibility." -ForegroundColor Green
if ($demoCount -eq 0) {
    Write-Host "[INFO] Demo-predictions er tom nå (forventet i perioder)." -ForegroundColor Yellow
}

exit 0
