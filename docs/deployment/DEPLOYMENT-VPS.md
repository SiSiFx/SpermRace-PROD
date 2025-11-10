## SpermRace.io — Production VPS Deployment Guide

Recommended: serve frontend + API + WebSocket on the same VPS/domain for lowest maintenance. Alternative Vercel frontend is included at the end.

### 1) DNS and TLS
- Create DNS A record: `game.yourdomain.com` → your VPS IP.
- Install Nginx and Certbot:
```bash
sudo apt update && sudo apt install -y nginx
sudo snap install core; sudo snap refresh core
sudo snap install --classic certbot
sudo ln -s /snap/bin/certbot /usr/bin/certbot
```
- Create `/etc/nginx/sites-available/game.conf` from `ops/nginx/game.conf.example` and replace `game.yourdomain.com` with your domain.
  Or render with script:
  ```bash
  node scripts/render-nginx.js --domain game.yourdomain.com --out ./game.conf
  sudo mv ./game.conf /etc/nginx/sites-available/game.conf
  ```
- Enable and test:
```bash
sudo ln -s /etc/nginx/sites-available/game.conf /etc/nginx/sites-enabled/game.conf
sudo nginx -t && sudo systemctl reload nginx
sudo certbot --nginx -d game.yourdomain.com --redirect --agree-tos -m YOUR_EMAIL
```

### 2) Node, PM2, and repository
```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs build-essential git
sudo npm i -g pnpm pm2

cd /opt && sudo mkdir spermrace && sudo chown $USER:$USER spermrace && cd spermrace
git clone YOUR_REPO_URL .
pnpm install
pnpm -w build
```

### 3) Server environment (production)
Create a `.env` file (not committed) or configure env in PM2. Required:
```bash
export SOLANA_RPC_ENDPOINT=https://api.devnet.solana.com
export PRIZE_POOL_WALLET=YOUR_PRIZE_POOL_PUBLIC_KEY
export PRIZE_POOL_SECRET_KEY=YOUR_SECRET_KEY_BASE58_OR_JSON_ARRAY
export PORT=8080
export PRICE_PORT=8081
export ENABLE_DEV_BOTS=false
export SKIP_ENTRY_FEE=false
export ALLOWED_ORIGINS=https://your-app.vercel.app,https://yourdomain.com
```

Optionally:
- `PLATFORM_FEE_WALLET` (Public key for platform fee)
- `INTERNAL_PRICE_URL` (override price proxy URL)

### 4) PM2 process
- Use the provided file `ops/pm2/ecosystem.config.js`. Edit values for your domain and keys if needed.
```bash
pm2 start ops/pm2/ecosystem.config.js
pm2 save
pm2 startup
```

### 5) Nginx reverse proxy (+ static frontend on same domain)
- Ensure `ops/nginx/game.conf.example` is adapted:
  - Serve SPA from `/var/www/spermrace` (copy built client there)
  - `/ws` → `http://127.0.0.1:8080`
  - `/api/` → `http://127.0.0.1:8080/`
```bash
sudo mkdir -p /var/www/spermrace && sudo chown $USER:$USER /var/www/spermrace
sudo nginx -t && sudo systemctl reload nginx
```

### 6) Frontend deploy (same VPS, easiest)
- Build the client locally and upload to the VPS web root:
```bash
pnpm --filter client build
scp -r packages/client/dist/* USER@VPS:/var/www/spermrace/
```
- Test: open `https://game.yourdomain.com` (SPA), WS at `/ws`, API at `/api`.

### 7) Alternative: Vercel (frontend)
- In Vercel Project Settings → Environment Variables:
  - `VITE_WS_URL` = `wss://game.yourdomain.com/ws`
  - `VITE_PRICE_API_URL` = `https://game.yourdomain.com/api/sol-price`
  - `VITE_SOLANA_RPC_ENDPOINT` = your RPC (devnet/mainnet)
- Deploy. Verify the app loads and connects via WSS.

### 8) Health checks
- Check price API: `https://game.yourdomain.com/api/sol-price`
- Health: `https://game.yourdomain.com/api/healthz`
- WS health: `https://game.yourdomain.com/api/ws-healthz`
- Readiness (RPC + prize balance): `https://game.yourdomain.com/api/readyz`

### 9) Security and production flags
- Bots must be disabled in prod: `ENABLE_DEV_BOTS=false`.
- Enforce real payments: `SKIP_ENTRY_FEE=false`.
- Restrict origins: `ALLOWED_ORIGINS` must include only your Vercel and site domains.
- Keep `PRIZE_POOL_SECRET_KEY` out of git; store in PM2 env or systemd unit.

### 10) Operations
- Logs:
```bash
pm2 logs spermrace-server-ws
```
- Restart after changes:
```bash
git pull && pnpm -w build && pm2 restart spermrace-server-ws
```
- Renew certificates (automatic with Certbot). Manual:
```bash
sudo certbot renew --dry-run
```

### 11) Troubleshooting
- WebSocket fails: check `ALLOWED_ORIGINS`, TLS, and Nginx `/ws` upgrade headers.
- Price 502: server will use stale cache if available; verify VPS can reach Jupiter.
- Entry fee issues: ensure RPC is healthy (`/api/readyz`) and prize wallet has funds for payouts + fees.

### 12) Rollback
- Keep previous PM2 version running: `pm2 list`, `pm2 restart <id> --update-env`.
- Use `git checkout <tag_or_commit>` and rebuild if needed.


