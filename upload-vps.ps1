# Upload SpermRace.io to Turkey VPS
$source = "C:\Users\SISI\Documents\skidr.io fork\spermrace-deploy.tar.gz"
$destination = "root@93.180.133.94:/tmp/"

Write-Host "Uploading tarball to VPS..." -ForegroundColor Cyan
Write-Host "Source: $source" -ForegroundColor Yellow
Write-Host "Destination: $destination" -ForegroundColor Yellow
Write-Host ""
Write-Host "When prompted, enter password: yELys6TZvJzT!" -ForegroundColor Green
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
