#!/usr/bin/env pwsh
# ============================================================================
# Upload SpermRace.io project to VPS via SCP (bypasses Turkey ISP blocks)
# ============================================================================

param(
    [Parameter(Mandatory=$true)]
    [string]$VpsHost,
    
    [Parameter(Mandatory=$false)]
    [string]$VpsUser = "root",
    
    [Parameter(Mandatory=$false)]
    [int]$VpsPort = 22
)

$ErrorActionPreference = "Stop"

# Colors
function Write-Info { Write-Host "[INFO] $args" -ForegroundColor Cyan }
function Write-Success { Write-Host "[OK] $args" -ForegroundColor Green }
function Write-Warning { Write-Host "[WARN] $args" -ForegroundColor Yellow }
function Write-Error { Write-Host "[ERROR] $args" -ForegroundColor Red }

Write-Host ""
Write-Info "🎯 SpermRace.io - VPS Upload Script"
Write-Host ""

# Get project root (script is in scripts/windows/)
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$ProjectRoot = (Get-Item "$ScriptDir/../..").FullName
$TarballName = "spermrace-deploy.tar.gz"
$TarballPath = Join-Path $ProjectRoot $TarballName

Write-Info "Project root: $ProjectRoot"

# Check if tar is available (Git Bash includes tar.exe)
$TarCommand = $null
if (Get-Command tar -ErrorAction SilentlyContinue) {
    $TarCommand = "tar"
} elseif (Get-Command "C:\Program Files\Git\usr\bin\tar.exe" -ErrorAction SilentlyContinue) {
    $TarCommand = "C:\Program Files\Git\usr\bin\tar.exe"
} else {
    Write-Error "tar command not found. Please install Git for Windows."
    exit 1
}

Write-Info "Using tar: $TarCommand"

# Create tarball
Write-Info "📦 Creating project tarball..."
if (Test-Path $TarballPath) {
    Remove-Item $TarballPath -Force
}

Push-Location $ProjectRoot
try {
    & $TarCommand -czf $TarballName `
        --exclude=node_modules `
        --exclude=dist `
        --exclude=.git `
        --exclude=*.tar.gz `
        --exclude=.env `
        --exclude=".env.*" `
        --exclude=".pm2" `
        .
    
    if ($LASTEXITCODE -ne 0) {
        throw "tar failed with exit code $LASTEXITCODE"
    }
    
    $Size = (Get-Item $TarballPath).Length / 1MB
    Write-Success "Tarball created: $([math]::Round($Size, 2)) MB"
} finally {
    Pop-Location
}

# Check if scp is available
if (-not (Get-Command scp -ErrorAction SilentlyContinue)) {
    Write-Error "scp command not found. Please install OpenSSH Client:"
    Write-Host "  Windows Settings > Apps > Optional Features > Add OpenSSH Client" -ForegroundColor Yellow
    exit 1
}

# Upload via SCP
Write-Info "📤 Uploading to VPS ($VpsUser@${VpsHost}:${VpsPort})..."
Write-Info "You may be prompted for your SSH password or key passphrase..."

$RemotePath = "/tmp/$TarballName"
scp -P $VpsPort $TarballPath "${VpsUser}@${VpsHost}:${RemotePath}"

if ($LASTEXITCODE -ne 0) {
    Write-Error "SCP upload failed!"
    exit 1
}

Write-Success "Upload complete!"

# Cleanup local tarball
Write-Info "🧹 Cleaning up local tarball..."
Remove-Item $TarballPath -Force
Write-Success "Cleanup complete"

# Instructions for VPS
Write-Host ""
Write-Host "======================================================================" -ForegroundColor Green
Write-Success "🎉 Project uploaded to VPS!"
Write-Host "======================================================================" -ForegroundColor Green
Write-Host ""
Write-Info "Next steps - Run these commands on your VPS:"
Write-Host ""
Write-Host "  ssh ${VpsUser}@${VpsHost}" -ForegroundColor Yellow
Write-Host ""
Write-Host "  # Extract the project" -ForegroundColor Yellow
Write-Host "  mkdir -p ~/spermrace-deploy" -ForegroundColor Cyan
Write-Host "  cd ~/spermrace-deploy" -ForegroundColor Cyan
Write-Host "  tar -xzf ${RemotePath}" -ForegroundColor Cyan
Write-Host ""
Write-Host "  # Run the deployment script" -ForegroundColor Yellow
Write-Host "  chmod +x scripts/vps-deploy-turkey.sh" -ForegroundColor Cyan
Write-Host "  ./scripts/vps-deploy-turkey.sh" -ForegroundColor Cyan
Write-Host ""
Write-Host "======================================================================" -ForegroundColor Green
Write-Host ""
Write-Info "💡 Tip: The deployment script will ask for configuration interactively"
Write-Host ""









