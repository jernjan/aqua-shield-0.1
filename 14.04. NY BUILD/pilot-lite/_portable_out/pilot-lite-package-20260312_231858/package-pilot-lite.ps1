param(
    [string]$DestinationRoot = "$PSScriptRoot\_portable_out",
    [switch]$CreateZip
)

$ErrorActionPreference = "Stop"

$source = $PSScriptRoot
$timestamp = Get-Date -Format "yyyyMMdd_HHmmss"
$packageName = "pilot-lite-package-$timestamp"
$packagePath = Join-Path $DestinationRoot $packageName

Write-Host "Lager portable pakke i: $packagePath" -ForegroundColor Cyan
New-Item -ItemType Directory -Path $packagePath -Force | Out-Null

$exclude = @("_portable_out", "__pycache__")

Get-ChildItem -Path $source -Force | Where-Object {
    $exclude -notcontains $_.Name
} | ForEach-Object {
    Copy-Item -Path $_.FullName -Destination $packagePath -Recurse -Force
}

Write-Host "Kopi ferdig: $packagePath" -ForegroundColor Green

if ($CreateZip) {
    $zipPath = "$packagePath.zip"
    if (Test-Path $zipPath) {
        Remove-Item $zipPath -Force
    }
    Compress-Archive -Path "$packagePath\*" -DestinationPath $zipPath -Force
    Write-Host "Zip ferdig: $zipPath" -ForegroundColor Green
}
