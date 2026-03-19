param(
    [string]$WebBase = 'http://127.0.0.1:8085',
    [string]$ApiBase = 'http://127.0.0.1:8000'
)

$ErrorActionPreference = 'Stop'
$script:results = @()

function Add-Result {
    param(
        [string]$Name,
        [bool]$Ok,
        [string]$Detail
    )
    $script:results += [pscustomobject]@{
        Name = $Name
        Ok = $Ok
        Detail = $Detail
    }
}

function Test-Url {
    param(
        [string]$Name,
        [string]$Url,
        [int]$TimeoutSec = 8
    )
    try {
        $response = Invoke-WebRequest -Uri $Url -UseBasicParsing -TimeoutSec $TimeoutSec
        Add-Result -Name $Name -Ok ($response.StatusCode -ge 200 -and $response.StatusCode -lt 300) -Detail ("HTTP {0}" -f $response.StatusCode)
        return $response
    }
    catch {
        Add-Result -Name $Name -Ok $false -Detail $_.Exception.Message
        return $null
    }
}

function Assert-Contains {
    param(
        [string]$Name,
        [string]$Body,
        [string[]]$Needles
    )
    $missing = @($Needles | Where-Object { $Body -notmatch [regex]::Escape($_) })
    if ($missing.Count -eq 0) {
        Add-Result -Name $Name -Ok $true -Detail 'All expected markers found'
    }
    else {
        Add-Result -Name $Name -Ok $false -Detail ("Missing: {0}" -f ($missing -join ', '))
    }
}

$vesselPage = Test-Url -Name 'Vessel page reachable' -Url "$WebBase/vessel-dashboard-lite.html"
$facilityPage = Test-Url -Name 'Facility page reachable' -Url "$WebBase/facility-dashboard-lite.html"

if ($vesselPage) {
    Assert-Contains -Name 'Vessel page key elements' -Body $vesselPage.Content -Needles @(
        'id="profileMeta"',
        'id="apiHealthNote"',
        'id="dataStatus"',
        'id="facilityMap"',
        'id="vesselCalendarGrid"'
    )
}

if ($facilityPage) {
    Assert-Contains -Name 'Facility page key elements' -Body $facilityPage.Content -Needles @(
        'id="profileMeta"',
        'id="apiHealthNote"',
        'id="dataStatusNote"',
        'id="facilityMap"',
        'id="onlyAvailableBoats"'
    )
}

Test-Url -Name 'dashboard-lite.css reachable' -Url "$WebBase/app/dashboard-lite.css" | Out-Null
Test-Url -Name 'vessel JS reachable' -Url "$WebBase/app/vessel-dashboard-lite.js" | Out-Null
Test-Url -Name 'facility JS reachable' -Url "$WebBase/app/facility-dashboard-lite.js" | Out-Null
Test-Url -Name 'shared store JS reachable' -Url "$WebBase/app/pilot-shared-store.js" | Out-Null

Test-Url -Name 'API facilities' -Url "$ApiBase/api/facilities?limit=5" -TimeoutSec 20 | Out-Null
Test-Url -Name 'API disease spread' -Url "$ApiBase/api/facilities/disease-spread" -TimeoutSec 20 | Out-Null
Test-Url -Name 'API clearances no params' -Url "$ApiBase/api/pilot/clearances" -TimeoutSec 20 | Out-Null
Test-Url -Name 'API clearances with params' -Url "$ApiBase/api/pilot/clearances?profile_name=masoval&actor=masoval" -TimeoutSec 20 | Out-Null
Test-Url -Name 'API route proposals list' -Url "$ApiBase/api/route-proposals" -TimeoutSec 20 | Out-Null

$failed = @($script:results | Where-Object { -not $_.Ok })
$passed = @($script:results | Where-Object { $_.Ok })

Write-Host ''
Write-Host '=== Smoke E2E results ==='
$script:results | ForEach-Object {
    $icon = if ($_.Ok) { '[OK]' } else { '[FAIL]' }
    Write-Host ("{0} {1} :: {2}" -f $icon, $_.Name, $_.Detail)
}

Write-Host ''
Write-Host ("Passed: {0}" -f $passed.Count)
Write-Host ("Failed: {0}" -f $failed.Count)

if ($failed.Count -gt 0) {
    exit 1
}

exit 0
