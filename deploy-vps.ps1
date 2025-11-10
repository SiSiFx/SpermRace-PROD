# Deploy SpermRace.io on Turkey VPS
$vpsIP = "93.180.133.94"
$vpsUser = "root"

Write-Host "============================================" -ForegroundColor Cyan
Write-Host "  SpermRace.io VPS Deployment" -ForegroundColor Cyan
Write-Host "============================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "VPS IP: $vpsIP" -ForegroundColor Yellow
Write-Host "User: $vpsUser" -ForegroundColor Yellow
Write-Host "Password: yELys6TZvJzT!" -ForegroundColor Green
Write-Host ""
Write-Host "Connecting to VPS..." -ForegroundColor Cyan
Write-Host ""

# SSH into VPS
ssh "$vpsUser@$vpsIP"
