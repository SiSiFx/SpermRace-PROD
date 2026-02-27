# Upload SpermRace.io to Turkey VPS
$source = $env:TARBALL_LOCAL
if (-not $source) { $source = Join-Path $PSScriptRoot "spermrace-deploy.tar.gz" }

$vpsIP = $env:VPS_IP
if (-not $vpsIP) { $vpsIP = "REPLACE_WITH_VPS_IP" }
$vpsUser = $env:VPS_USER
if (-not $vpsUser) { $vpsUser = "root" }

$destination = "$vpsUser@$vpsIP:/tmp/"

Write-Host "Uploading tarball to VPS..." -ForegroundColor Cyan
Write-Host "Source: $source" -ForegroundColor Yellow
Write-Host "Destination: $destination" -ForegroundColor Yellow
Write-Host ""
Write-Host "When prompted, enter password (or use ssh keys)." -ForegroundColor Green
Write-Host ""

scp $source $destination

if ($LASTEXITCODE -eq 0) {
    Write-Host ""
    Write-Host "✓ Upload successful!" -ForegroundColor Green
} else {
    Write-Host ""
    Write-Host "✗ Upload failed!" -ForegroundColor Red
}

Write-Host ""
Write-Host "Press any key to continue..."
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
