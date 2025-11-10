$null = $PSStyle; # ensure PS7 safe; no-op
param(
  [string]$Domain,
  [int]$Port,
  [switch]$UseHttps,
  [switch]$AddHosts,
  [string]$RpcEndpoint,
  [switch]$LogJson
)

$ErrorActionPreference = 'Stop'

# Defaults if not provided
if (-not $Domain) { $Domain = 'game.127.0.0.1.nip.io' }
if (-not $Port) { $Port = 8081 }
if (-not $RpcEndpoint) { $RpcEndpoint = 'https://api.devnet.solana.com' }

function Write-Info($msg) { Write-Host "[i] $msg" -ForegroundColor Cyan }
function Write-Ok($msg) { Write-Host "[OK] $msg" -ForegroundColor Green }
function Write-Warn($msg) { Write-Host "[!] $msg" -ForegroundColor Yellow }
function Write-Err($msg) { Write-Host "[x] $msg" -ForegroundColor Red }

function Ensure-Tool($name, $checkCmd, $installCmd) {
  $ok = $false
  try { & $checkCmd | Out-Null; $ok = $true } catch { $ok = $false }
  if ($ok) { Write-Ok "$name present" } else { Write-Warn "$name not found - installing"; & $installCmd }
}

function Add-HostsEntry($host) {
  $hosts = "$env:SystemRoot\System32\drivers\etc\hosts"
  $line = "127.0.0.1`t$host"
  $content = ''
  if (Test-Path $hosts) { $content = Get-Content -Raw -Path $hosts }
  if ($content -notmatch "(?m)^127\.0\.0\.1\s+$([Regex]::Escape($host))\s*$") {
    $isAdmin = ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltinRole]::Administrator)
    if (-not $isAdmin) {
      Write-Info "Elevating to add hosts entry for $host (UAC prompt)"
      Start-Process powershell -Verb RunAs -ArgumentList '-NoProfile','-ExecutionPolicy','Bypass','-Command',"Add-Content -Path `"$hosts`" -Value `"`r`n$line`"" | Out-Null
      Start-Sleep -Seconds 1
    } else {
      Add-Content -Path $hosts -Value "`r`n$line"
    }
    ipconfig /flushdns | Out-Null
    Write-Ok "Hosts entry added: $line"
  } else {
    Write-Ok "Hosts entry exists"
  }
}

function Render-Caddyfile($domain, $port, $https, $rootPath) {
  $scheme = 'http'
  if ($https) { $scheme = 'https' }
  $lines = @()
  $lines += '{'
  $lines += '  admin off'
  $lines += '}'
  $lines += ''
  $lines += ("{0}://{1}:{2} {{" -f $scheme, $domain, $port)
  if ($https) { $lines += '  tls internal' }
  $lines += ("  root * `"{0}`"" -f $rootPath)
  $lines += '  file_server'
  $lines += '  @ws {'
  $lines += '    path /ws'
  $lines += '  }'
  $lines += '  reverse_proxy @ws 127.0.0.1:8080'
  $lines += '  reverse_proxy /api/* 127.0.0.1:8080'
  $lines += '}'
  return ($lines -join "`n") + "`n"
}

function Start-Caddy($caddyfilePath) {
  Write-Info "Stopping existing caddy instances (if any)"
  Get-Process -Name caddy -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
  $caddyExe = $null
  try { $caddyExe = (Get-Command caddy -ErrorAction Stop).Source } catch { }
  if (-not $caddyExe) { $caddyExe = "$env:LocalAppData\Microsoft\WinGet\Links\caddy.exe" }
  if (-not (Test-Path $caddyExe)) {
    Write-Info "Installing Caddy via winget"
    winget install --id CaddyServer.Caddy --exact --silent --accept-package-agreements --accept-source-agreements | Out-Null
  }
  Write-Info "Starting Caddy with config: $caddyfilePath"
  Start-Process -FilePath $caddyExe -ArgumentList @('run','--config', $caddyfilePath) -WindowStyle Hidden | Out-Null
  Start-Sleep -Seconds 2
}

function Start-Server($allowedOrigin) {
  Write-Info "Setting environment and starting server"
  $env:NODE_ENV = 'production'
  $env:PORT = '8080'
  $env:ALLOWED_ORIGINS = $allowedOrigin
  $env:SOLANA_RPC_ENDPOINT = $RpcEndpoint
  $env:LOG_LEVEL = 'info'
  if ($LogJson) { $env:LOG_JSON = 'true' }
  Ensure-Tool 'PM2' { pm2 -v } { npm i -g pm2 --silent | Out-Null }
  if (-not (Test-Path 'packages/server/dist/index.js')) {
    Write-Info "Building project"
    pnpm build | Out-Null
  }
  pm2 start 'packages/server/dist/index.js' --name spermrace-server-ws --node-args '--enable-source-maps' --time | Out-Null
  pm2 save | Out-Null
  $health = Invoke-WebRequest -Uri 'http://127.0.0.1:8080/api/healthz' -UseBasicParsing
  if ($health.StatusCode -ne 200) { throw 'Server health check failed' }
  Write-Ok 'Server healthy on :8080'
}

# MAIN
$repoRoot = (Resolve-Path '.').Path
Write-Info ("Repo: {0}" -f $repoRoot)

Ensure-Tool 'pnpm' { pnpm -v } { throw 'pnpm is required. Install from https://pnpm.io/installation' }

if ($Domain -eq 'game.local' -and $AddHosts) { Add-HostsEntry -host $Domain }

Write-Info 'Building client'
pnpm --filter client build | Out-Null

$rootPath = Join-Path $repoRoot 'packages\client\dist'
if (-not (Test-Path $rootPath)) { throw ("Client dist not found: {0}" -f $rootPath) }

$scheme = 'http'
if ($UseHttps) { $scheme = 'https' }
$origin = ("{0}://{1}:{2}" -f $scheme, $Domain, $Port)

Start-Server -allowedOrigin $origin

$caddyText = Render-Caddyfile -domain $Domain -port $Port -https:$UseHttps -rootPath $rootPath
$caddyFile = Join-Path $env:TEMP ("caddyfile-{0}.Caddyfile" -f (Get-Date).ToString('yyyyMMdd-HHmmss'))
Set-Content -Path $caddyFile -Value $caddyText -Encoding UTF8
Start-Caddy -caddyfilePath $caddyFile

try {
  $url = ("{0}/api/healthz" -f $origin)
  if ($UseHttps) { [System.Net.ServicePointManager]::ServerCertificateValidationCallback = { $true } }
  $resp = Invoke-WebRequest -Uri $url -UseBasicParsing -TimeoutSec 5
  Write-Ok ("Gateway healthy: {0} => {1}" -f $url, $resp.StatusCode)
  Write-Host ("Open {0} in your browser." -f $origin) -ForegroundColor Green
} catch {
  Write-Warn ("Gateway health failed: {0}" -f $_)
  Write-Host ("Try opening {0} manually and check Caddy/PM2 logs." -f $origin) -ForegroundColor Yellow
}


