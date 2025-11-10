$ErrorActionPreference = 'Stop'

Write-Host "Building client and server..."
pnpm build

Write-Host "Starting server with production environment..."
$env:NODE_ENV = "production"
$env:PORT = "8080"
$env:ALLOWED_ORIGINS = "https://game.local"
# TODO: set real endpoints/keys before real money usage
$env:SOLANA_RPC_ENDPOINT = "https://api.devnet.solana.com"
$env:LOG_LEVEL = "info"
$env:LOG_JSON = "true"

pm2 start "packages/server/dist/index.js" --name spermrace-server-ws --node-args "--enable-source-maps" --cwd .
pm2 save

Write-Host "Ensure Caddy is installed (https://caddyserver.com/docs/install). Then run:"
Write-Host "  caddy run --config ops\caddy\Caddyfile"
Write-Host "Open https://game.local in your browser."


