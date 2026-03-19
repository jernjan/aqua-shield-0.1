param(
    [string]$RenderBaseUrl = "",
    [string]$ApiBase = "http://localhost:8000",
    [string]$LocalBaseUrl = "http://localhost:8085",
    [switch]$SkipLocal,
    [switch]$SkipRender,
    [int]$TimeoutSec = 20
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$smokeAllScript = Join-Path $scriptDir 'smoke-test-all.ps1'
if (-not (Test-Path $smokeAllScript)) {
    Write-Host "Fant ikke smoke-test-all.ps1 i $scriptDir" -ForegroundColor Red
    exit 2
}

$timestamp = Get-Date
$stampText = $timestamp.ToString('yyyy-MM-dd HH:mm:ss')
$reportPath = Join-Path $scriptDir 'PREFLIGHT_REPORT.md'

$invokeParams = @{
    ApiBase = $ApiBase
    LocalBaseUrl = $LocalBaseUrl
    TimeoutSec = $TimeoutSec
}
if ($SkipLocal) { $invokeParams['SkipLocal'] = $true }
if ($SkipRender) { $invokeParams['SkipRender'] = $true }
if (-not [string]::IsNullOrWhiteSpace($RenderBaseUrl)) { $invokeParams['RenderBaseUrl'] = $RenderBaseUrl }

Write-Host "Kjører preflight..." -ForegroundColor Cyan
& $smokeAllScript @invokeParams
$smokeExit = $LASTEXITCODE

$status = if ($smokeExit -eq 0) { 'READY' } else { 'NOT READY' }
$statusEmoji = if ($smokeExit -eq 0) { '✅' } else { '❌' }

$lines = @()
$lines += "# Preflight Report"
$lines += ""
$lines += "- Kjørt: $stampText"
$lines += "- Resultat: $statusEmoji $status"
$lines += "- Exit code (smoke): $smokeExit"
$lines += "- Local base: $LocalBaseUrl"
$lines += "- Render base: $(if ([string]::IsNullOrWhiteSpace($RenderBaseUrl)) { '-' } else { $RenderBaseUrl })"
$lines += "- API base: $ApiBase"
$lines += ""
$lines += "## Anbefalt neste steg"
if ($smokeExit -eq 0) {
    $lines += "- Del testlenke til brukere"
    $lines += "- Be testere bruke TEST_BRIEF_10_MIN.md"
    $lines += "- Samle funn i feedback-inbox.html"
}
else {
    $lines += "- Kjør smoke-test script med verbose output"
    $lines += "- Verifiser API/CORS og frontend URL"
    $lines += "- Prøv igjen når kritiske feil er løst"
}

Set-Content -Path $reportPath -Value ($lines -join [Environment]::NewLine) -Encoding UTF8

Write-Host ""
Write-Host "Preflight-rapport skrevet til: $reportPath" -ForegroundColor Cyan

if ($smokeExit -eq 0) {
    Write-Host "Systemstatus: READY" -ForegroundColor Green
    exit 0
}

Write-Host "Systemstatus: NOT READY" -ForegroundColor Red
exit 1
