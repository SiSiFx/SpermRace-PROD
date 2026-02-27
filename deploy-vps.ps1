# Deploy SpermRace.io on Turkey VPS
$vpsIP = $env:VPS_IP
if (-not $vpsIP) { $vpsIP = "REPLACE_WITH_VPS_IP" }
$vpsUser = $env:VPS_USER
if (-not $vpsUser) { $vpsUser = "root" }

Write-Host "============================================" -ForegroundColor Cyan
Write-Host "  SpermRace.io VPS Deployment" -ForegroundColor Cyan
Write-Host "============================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "VPS IP: $vpsIP" -ForegroundColor Yellow
Write-Host "User: $vpsUser" -ForegroundColor Yellow
Write-Host "Password: (will be prompted by ssh)" -ForegroundColor Green
Write-Host ""
Write-Host "Connecting to VPS..." -ForegroundColor Cyan
Write-Host ""

# SSH into VPS
ssh "$vpsUser@$vpsIP"
