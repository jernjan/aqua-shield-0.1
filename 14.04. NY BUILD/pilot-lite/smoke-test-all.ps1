param(
    [string]$RenderBaseUrl = "",
    [switch]$SkipLocal,
    [switch]$SkipRender,
    [string]$LocalBaseUrl = "http://localhost:8085",
    [string]$ApiBase = "http://localhost:8000",
    [int]$TimeoutSec = 20
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$singleScript = Join-Path $scriptDir 'smoke-test-render.ps1'

if (-not (Test-Path $singleScript)) {
    Write-Host "Fant ikke smoke-test-render.ps1 i $scriptDir" -ForegroundColor Red
    exit 2
}

$localResult = $null
$renderResult = $null

if (-not $SkipLocal) {
    Write-Host "" 
    Write-Host "=== Kjører lokal smoke-test ===" -ForegroundColor Cyan
    & $singleScript -BaseUrl $LocalBaseUrl -ApiBase $ApiBase -TimeoutSec $TimeoutSec
    $localResult = $LASTEXITCODE
}

if (-not $SkipRender) {
    if ([string]::IsNullOrWhiteSpace($RenderBaseUrl)) {
        Write-Host "RenderBaseUrl mangler. Bruk -RenderBaseUrl https://<din-frontend>.onrender.com eller -SkipRender." -ForegroundColor Yellow
        $renderResult = 2
    }
    else {
        Write-Host ""
        Write-Host "=== Kjører Render smoke-test ===" -ForegroundColor Cyan
        & $singleScript -BaseUrl $RenderBaseUrl -ApiBase $ApiBase -TimeoutSec $TimeoutSec
        $renderResult = $LASTEXITCODE
    }
}

Write-Host ""
Write-Host "=== Samlet oppsummering ===" -ForegroundColor Cyan
if ($null -ne $localResult) {
    Write-Host ("Lokal:  {0}" -f ($(if ($localResult -eq 0) { 'OK' } else { "FAIL ($localResult)" })))
}
if ($null -ne $renderResult) {
    Write-Host ("Render: {0}" -f ($(if ($renderResult -eq 0) { 'OK' } else { "FAIL ($renderResult)" })))
}

if (($null -ne $localResult -and $localResult -ne 0) -or ($null -ne $renderResult -and $renderResult -ne 0)) {
    exit 1
}

Write-Host "Begge valgte smoke-tester bestått." -ForegroundColor Green
exit 0
