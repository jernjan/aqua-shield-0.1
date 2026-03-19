param(
    [string]$OwnerPattern = 'm[aå].*s[øo].*val|masoval',
    [int]$PageSize = 2000,
    [int]$MaxPages = 8
)

$base = 'https://gis.fiskeridir.no/server/rest/services/Yggdrasil/Akvakulturregisteret/FeatureServer/0/query'
$all = @()
$offset = 0

for ($i = 0; $i -lt $MaxPages; $i += 1) {
    $params = @{
        f                 = 'json'
        where             = '1=1'
        outFields         = 'loknr,navn,kommune,fylke,status_lokalitet,til_innehavere'
        returnGeometry    = 'false'
        orderByFields     = 'loknr'
        resultOffset      = $offset
        resultRecordCount = $PageSize
    }

    try {
        $resp = Invoke-RestMethod -Uri $base -Method Get -Body $params -TimeoutSec 90
    } catch {
        Write-Error "FDIR query failed at offset=$offset :: $($_.Exception.Message)"
        exit 1
    }

    if ($resp.error) {
        Write-Error "ArcGIS error: $($resp.error.message)"
        if ($resp.error.details) {
            Write-Error ($resp.error.details -join ' | ')
        }
        exit 1
    }

    $batch = @($resp.features)
    if ($batch.Count -eq 0) { break }

    $all += $batch

    if ($batch.Count -lt $PageSize) { break }
    $offset += $batch.Count
}

$rows = $all | ForEach-Object {
    $a = $_.attributes
    [PSCustomObject]@{
        localityNo = $a.loknr
        name = $a.navn
        municipality = $a.kommune
        county = $a.fylke
        status = $a.status_lokalitet
        holder = [string]$a.til_innehavere
    }
}

$matches = $rows |
    Where-Object { $_.holder -match "(?i)$OwnerPattern" } |
    Sort-Object localityNo, name -Unique

Write-Output ("FDIR fetched records: {0}" -f $rows.Count)
Write-Output ("Owner pattern: {0}" -f $OwnerPattern)
Write-Output ("Matched localities: {0}" -f $matches.Count)

$matches |
    Select-Object localityNo, name, municipality, county, status, holder |
    Format-Table -AutoSize
