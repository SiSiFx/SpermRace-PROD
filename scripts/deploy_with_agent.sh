#!/usr/bin/env bash
set -euo pipefail

# Make apt non-interactive for all installs
export DEBIAN_FRONTEND=noninteractive

# =============================================================================================
# SpermRace.io - One‑shot VPS deploy with AI agent guidance
# - Installs Node 20, pnpm, pm2, nginx, certbot
# - Builds monorepo (pnpm)
# - Serves static client via Nginx and proxies API/WS to Node server on 8080
# - Creates .cursor boot files and reminds the AI agent to read CONTEXT.md
# =============================================================================================

# ---------------------------
# Required settings (override via env or edit here)
# ---------------------------
: "${DOMAIN:=yourdomain.com}"
: "${APP_DIR:=/opt/sperm-race}"
: "${CLIENT_ROOT:=/var/www/sperm-race-client}"
: "${RPC:=https://api.devnet.solana.com}"

# At least one of REPO_SSH or REPO_HTTPS must be provided if APP_DIR is empty
: "${REPO_SSH:=}"
: "${REPO_HTTPS:=}"

echo "[INFO] DOMAIN=$DOMAIN"
echo "[INFO] APP_DIR=$APP_DIR"
echo "[INFO] CLIENT_ROOT=$CLIENT_ROOT"
echo "[INFO] RPC=$RPC"

# Determine run user for PM2 (prefer invoking sudo user, else current user)
RUN_USER="${SUDO_USER:-$(id -un)}"
RUN_HOME="$(getent passwd "$RUN_USER" | cut -d: -f6 || echo "/root")"
echo "[INFO] RUN_USER=$RUN_USER (home: $RUN_HOME)"

echo "[STEP] System deps"
apt-get update -y
apt-get install -y nginx curl ca-certificates gnupg ufw git rsync sudo jq build-essential python3 make g++ pkg-config

echo "[STEP] Node 20 + pnpm + pm2"
if ! command -v node >/dev/null 2>&1; then
  curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
  apt-get install -y nodejs
fi
if ! command -v pnpm >/dev/null 2>&1; then
  npm i -g pnpm
fi
if ! command -v pm2 >/dev/null 2>&1; then
  npm i -g pm2
fi

echo "[STEP] Clone or update repo into $APP_DIR"
mkdir -p "$APP_DIR"
if [ ! -d "$APP_DIR/.git" ]; then
  if [ -n "$REPO_SSH" ]; then
    git clone "$REPO_SSH" "$APP_DIR"
  elif [ -n "$REPO_HTTPS" ]; then
    git clone "$REPO_HTTPS" "$APP_DIR"
  else
    echo "[WARN] No REPO_SSH/REPO_HTTPS provided. Assuming sources already exist in $APP_DIR."
  fi
else
  cd "$APP_DIR" && git fetch --all && git reset --hard "origin/$(git rev-parse --abbrev-ref HEAD)"
fi
cd "$APP_DIR"

echo "[STEP] Install and build (pnpm monorepo)"
pnpm install --frozen-lockfile || pnpm install
pnpm -r build

echo "[STEP] Publish client to $CLIENT_ROOT"
mkdir -p "$CLIENT_ROOT"
rsync -a --delete packages/client/dist/ "$CLIENT_ROOT/"

echo "[STEP] Start server with pm2 (PORT=8080, WS=/ws)"
# Clean up any previous root-owned PM2 app if it exists
pm2 delete sperm-race-server || true
# Start and save under the chosen RUN_USER to avoid root/systemd mismatch
sudo -H -u "$RUN_USER" env \
  ALLOWED_ORIGINS="https://$DOMAIN,https://www.$DOMAIN" \
  PORT=8080 \
  NODE_ENV=production \
  SOLANA_RPC_ENDPOINT="$RPC" \
  pm2 start packages/server/dist/index.js --name sperm-race-server
sudo -H -u "$RUN_USER" pm2 save
# Create systemd unit bound to RUN_USER
pm2 startup systemd -u "$RUN_USER" --hp "$RUN_HOME" || true

echo "[STEP] Nginx config"
cat >/etc/nginx/sites-available/sperm-race <<NGINX
server {
  listen 80;
  server_name $DOMAIN www.$DOMAIN;
  return 301 https://\$host\$request_uri;
}
server {
  listen 443 ssl http2;
  server_name $DOMAIN www.$DOMAIN;

  ssl_certificate /etc/letsencrypt/live/$DOMAIN/fullchain.pem;
  ssl_certificate_key /etc/letsencrypt/live/$DOMAIN/privkey.pem;

  root $CLIENT_ROOT;
  index index.html;

  location / {
    try_files \$uri /index.html;
    add_header Cache-Control "public, max-age=60";
  }

  # WebSocket (path fixed at /ws)
  location /ws {
    proxy_pass http://127.0.0.1:8080/ws;
    proxy_http_version 1.1;
    proxy_set_header Upgrade \$http_upgrade;
    proxy_set_header Connection "upgrade";
    proxy_set_header Host \$host;
    proxy_set_header X-Forwarded-Proto \$scheme;
    proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
    proxy_read_timeout 60s;
    proxy_send_timeout 60s;
  }

  # HTTP API
  location /api/ {
    proxy_pass http://127.0.0.1:8080;
    proxy_set_header Host \$host;
    proxy_set_header X-Forwarded-Proto \$scheme;
    proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
  }
}
NGINX

# Remove default nginx site to avoid port conflicts
rm -f /etc/nginx/sites-enabled/default || true
ln -sf /etc/nginx/sites-available/sperm-race /etc/nginx/sites-enabled/sperm-race

echo "[STEP] TLS via certbot (first time)"
if [ ! -e "/etc/letsencrypt/live/$DOMAIN/fullchain.pem" ]; then
  apt-get install -y certbot python3-certbot-nginx
  certbot --nginx -d "$DOMAIN" -d "www.$DOMAIN" --non-interactive --agree-tos -m admin@"$DOMAIN" || true
fi

echo "[STEP] Reload nginx"
nginx -t && systemctl reload nginx || systemctl restart nginx || true

echo "[STEP] Optional firewall (UFW)"
ufw allow OpenSSH || true
ufw allow 'Nginx Full' || true
# ufw enable  # Uncomment if you want to enable UFW non-interactively

echo "[STEP] Create .cursor boot files for the AI agent"
mkdir -p "$APP_DIR/.cursor"
cat > "$APP_DIR/.cursor/boot.md" <<'BOOT'
You are working in a pnpm monorepo for SpermRace.io.

Read CONTEXT.md at repo root first. Treat it as source of truth for:
- architecture, flows, game rules, networking, build/deploy, conventions
- client: packages/client/src/NewGameView.tsx (PixiJS v8) is the canonical game view
- server: packages/server/src/index.ts exposes HTTP and WS on the same port (default 8080), WS path /ws

Do not re-introduce deprecated files (e.g. packages/client/src/GameCanvas.tsx).
Practice (local) and Tournament (WS) share the same in‑match logic and HUD.

Non‑interactive rules:
- No prompts during builds; use defaults and non‑interactive flags
- Keep Vite client on 5174 for dev; proxy /api and /ws to 8080
- In production, static client via Nginx, proxy /api and /ws to the Node server

Gameplay and HUD to preserve (high level):
- lethal trails, self‑kill possible, permanent elimination
- boost at speed 400 with visual effects, without changing trail type
- countdown: 5–3s show everyone (zoomed out), 2–0s focus on player; inputs frozen
- spawns along map edges; rectangular zone slicer; rotating sonar with sweep‑based pings clipped to map
- game over screen with rank + replay/menu

Primary tasks on this host:
1) Ensure dev runs: server on 8080 (HTTP+WS /ws), client on 5174; proxy works
2) Preserve sonar clipping, countdown camera, zone slicer, elimination flow
3) Keep CORS aligned: ALLOWED_ORIGINS must include the site origin(s)
BOOT

cat > "$APP_DIR/.cursor/rules.md" <<'RULES'
- Always consult CONTEXT.md before changing gameplay or networking
- Keep PixiJS v8 API usage (.rect().fill(), .stroke(), .circle(), .roundRect())
- Do not re‑enable removed components or duplicate game files
- Prefer small, safe edits; keep production server path /ws stable
- Respect TypeScript types and avoid any; fix lints
RULES

echo "[DONE] Deployment finished. Next steps:"
echo " - Health:   curl -s https://$DOMAIN/api/healthz | jq . || curl -s http://$DOMAIN/api/healthz"
echo " - WS test:  wscat -c wss://$DOMAIN/ws   (or ws://$DOMAIN/ws without TLS)"
echo " - PM2:      pm2 status"
echo ""
echo "[AI AGENT] If you are running cursorcli on this VPS:"
echo " - Open $APP_DIR/CONTEXT.md and read it fully"
echo " - cursor will auto‑load $APP_DIR/.cursor/boot.md and .cursor/rules.md if configured"
echo " - Work primarily in packages/client/src/NewGameView.tsx and packages/server/src/index.ts"




