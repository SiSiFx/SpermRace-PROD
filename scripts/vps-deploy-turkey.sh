#!/usr/bin/env bash
# ============================================================================
# SpermRace.io - VPS Deployment Script (Turkey-Optimized)
# Handles ISP restrictions common in Turkey (GitHub, npm, etc.)
# ============================================================================

set -euo pipefail

# ====== COLORS & LOGGING ======
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

info() { echo -e "${CYAN}[INFO]${NC} $*"; }
ok() { echo -e "${GREEN}[OK]${NC} $*"; }
warn() { echo -e "${YELLOW}[WARN]${NC} $*"; }
die() { echo -e "${RED}[FATAL]${NC} $*"; exit 1; }

# ====== CONFIGURATION ======
APP_DIR="/opt/spermrace"
WEB_ROOT="/var/www/spermrace"
NGINX_CONF="/etc/nginx/sites-available/spermrace"
NGINX_ENABLED="/etc/nginx/sites-enabled/spermrace"
PM2_APP_NAME="spermrace-server-ws"

if [[ $EUID -eq 0 ]]; then
  die "Do NOT run as root. Use a sudo-capable user."
fi

# ====== INTERACTIVE PROMPTS ======
info "🎯 SpermRace.io - VPS Deployment (Turkey-Optimized)"
echo ""

read -p "Domain name (e.g., game.yourdomain.com): " DOMAIN
[[ -z "$DOMAIN" ]] && die "Domain is required"

read -p "Email for Let's Encrypt: " EMAIL
[[ -z "$EMAIL" ]] && die "Email is required"

echo ""
info "Code source:"
echo "  The tarball should already be uploaded to /tmp/spermrace-deploy.tar.gz"
read -p "Tarball location [/tmp/spermrace-deploy.tar.gz]: " TARBALL_LOCATION
TARBALL_LOCATION="${TARBALL_LOCATION:-/tmp/spermrace-deploy.tar.gz}"

if [[ ! -f "$TARBALL_LOCATION" ]]; then
  die "Tarball not found at $TARBALL_LOCATION. Please upload it first using SCP."
fi

echo ""
info "Solana Configuration:"
read -p "Solana RPC endpoint: " SOLANA_RPC
[[ -z "$SOLANA_RPC" ]] && die "Solana RPC is required"

read -p "Prize Pool Wallet (public key): " PRIZE_POOL_WALLET
[[ -z "$PRIZE_POOL_WALLET" ]] && die "Prize pool wallet is required"

read -sp "Prize Pool Secret Key: " PRIZE_POOL_SECRET
echo ""
[[ -z "$PRIZE_POOL_SECRET" ]] && die "Prize pool secret is required"

read -p "Additional frontend origin (optional): " VERCEL_ORIGIN

ALLOWED_ORIGINS="https://${DOMAIN}"
[[ -n "$VERCEL_ORIGIN" ]] && ALLOWED_ORIGINS="${ALLOWED_ORIGINS},${VERCEL_ORIGIN}"

echo ""
ok "Configuration complete. Starting deployment..."
sleep 2

# ====== SYSTEM PACKAGES ======
info "📦 Installing system packages..."
sudo apt update
sudo apt install -y nginx curl build-essential ca-certificates ufw

# ====== NODE.JS 20 (Mirror-friendly method) ======
if ! command -v node &>/dev/null || [[ "$(node -v | cut -d'.' -f1 | tr -d 'v')" -lt 20 ]]; then
  info "📦 Installing Node.js 20 via nvm (avoids blocked CDNs)..."
  
  # Download nvm install script to file first (can inspect if needed)
  if ! command -v wget &>/dev/null; then
    sudo apt install -y wget
  fi
  
  # Use GitHub mirror or raw.githubusercontent alternative
  if ! curl -fsSL https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh -o /tmp/nvm-install.sh; then
    warn "GitHub blocked, trying alternative..."
    # Alternative: use the tarball from your PC if you include nvm in it
    wget "${TARBALL_URL%/*}/nvm-install.sh" -O /tmp/nvm-install.sh || die "Cannot download nvm installer"
  fi
  
  bash /tmp/nvm-install.sh
  export NVM_DIR="$HOME/.nvm"
  [ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
  
  # Install Node 20 (nvm uses multiple mirrors)
  nvm install 20
  nvm use 20
  nvm alias default 20
fi
ok "Node.js $(node -v)"

# ====== PNPM (Direct binary download, no npm needed) ======
if ! command -v pnpm &>/dev/null; then
  info "📦 Installing pnpm via standalone script..."
  
  # Method 1: Official installer (may be blocked)
  if ! curl -fsSL https://get.pnpm.io/install.sh | sh -; then
    warn "pnpm installer blocked, using npm fallback..."
    npm install -g pnpm
  fi
  
  export PNPM_HOME="$HOME/.local/share/pnpm"
  export PATH="$PNPM_HOME:$PATH"
fi
ok "pnpm $(pnpm -v)"

# ====== PM2 ======
if ! command -v pm2 &>/dev/null; then
  info "📦 Installing PM2..."
  npm install -g pm2 || {
    warn "npm registry blocked, trying Taobao mirror..."
    npm config set registry https://registry.npmmirror.com
    npm install -g pm2
    npm config delete registry
  }
  pm2 startup systemd -u "$USER" --hp "$HOME" | grep 'sudo' | bash || true
fi
ok "PM2 installed"

# ====== FIREWALL ======
info "🔒 Configuring firewall..."
sudo ufw --force enable
sudo ufw allow 22/tcp comment "SSH"
sudo ufw allow 80/tcp comment "HTTP"
sudo ufw allow 443/tcp comment "HTTPS"
sudo ufw allow 8080/tcp comment "Backend"
ok "Firewall configured"

# ====== EXTRACT CODE ======
info "📥 Extracting project..."
sudo mkdir -p "$APP_DIR"
sudo chown "$USER":"$USER" "$APP_DIR"
cd "$APP_DIR"

cp "$TARBALL_LOCATION" ./spermrace-deploy.tar.gz || die "Failed to copy tarball"
tar -xzf spermrace-deploy.tar.gz || die "Failed to extract tarball"
rm spermrace-deploy.tar.gz
ok "Project extracted"

# ====== CREATE .ENV ======
info "⚙️  Creating .env file..."
mkdir -p "$APP_DIR/packages/server"
cat > "$APP_DIR/packages/server/.env" <<ENV_EOF
NODE_ENV=production
PORT=8080
ALLOWED_ORIGINS=${ALLOWED_ORIGINS}
SOLANA_RPC_ENDPOINT=${SOLANA_RPC}
PRIZE_POOL_WALLET=${PRIZE_POOL_WALLET}
PRIZE_POOL_SECRET_KEY=${PRIZE_POOL_SECRET}
LOG_JSON=true
SKIP_ENTRY_FEE=false
ENV_EOF
ok ".env created"

# ====== CONFIGURE NPM MIRROR (for Turkey) ======
info "🌐 Configuring npm registry mirrors..."
cd "$APP_DIR"

# Try using Chinese mirrors (often accessible from Turkey)
pnpm config set registry https://registry.npmmirror.com || true

# Also try Cloudflare mirror
# pnpm config set registry https://registry.npmjs.cf || true

# ====== BUILD PROJECT ======
info "🔨 Installing dependencies (this may take a while)..."
pnpm install --no-frozen-lockfile || {
  warn "Default registry failed, trying alternate mirrors..."
  pnpm config set registry https://registry.npmjs.org
  pnpm install --no-frozen-lockfile
}

info "🔨 Building project..."
pnpm --filter @spermrace/shared build || die "Shared build failed"
pnpm --filter @spermrace/server build || die "Server build failed"
pnpm --filter @spermrace/client build || die "Client build failed"

ok "Build complete"

# Reset registry to default
pnpm config delete registry || true

# ====== DEPLOY FRONTEND ======
info "🌐 Deploying frontend..."
sudo mkdir -p "$WEB_ROOT"
sudo rm -rf "$WEB_ROOT"/*
sudo cp -r "$APP_DIR/packages/client/dist"/* "$WEB_ROOT/"
sudo chown -R www-data:www-data "$WEB_ROOT"
ok "Frontend deployed"

# ====== NGINX CONFIGURATION ======
info "⚙️  Configuring Nginx..."
sudo tee "$NGINX_CONF" > /dev/null <<'NGINX_EOF'
limit_req_zone $binary_remote_addr zone=api_limit:10m rate=30r/s;
limit_req_zone $binary_remote_addr zone=ws_limit:10m rate=10r/s;
limit_conn_zone $binary_remote_addr zone=conn_limit:10m;

upstream backend {
    server 127.0.0.1:8080 max_fails=3 fail_timeout=30s;
    keepalive 32;
}

server {
    listen 80;
    listen [::]:80;
    server_name DOMAIN_PLACEHOLDER;
    server_tokens off;

    location /.well-known/acme-challenge/ {
        root /var/www/certbot;
    }

    location / {
        return 301 https://$server_name$request_uri;
    }
}

server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name DOMAIN_PLACEHOLDER;
    server_tokens off;

    ssl_certificate /etc/letsencrypt/live/DOMAIN_PLACEHOLDER/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/DOMAIN_PLACEHOLDER/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers 'ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256:ECDHE-ECDSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-GCM-SHA384';
    ssl_prefer_server_ciphers off;

    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;
    add_header Content-Security-Policy "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self' data:; connect-src 'self' wss://DOMAIN_PLACEHOLDER https://api.mainnet-beta.solana.com https://api.devnet.solana.com; frame-ancestors 'none';" always;

    root /var/www/spermrace;
    index index.html;

    gzip on;
    gzip_vary on;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml text/javascript;

    location / {
        try_files $uri $uri/ /index.html;
    }

    location /api/ {
        limit_req zone=api_limit burst=10 nodelay;
        limit_conn conn_limit 20;
        proxy_pass http://backend;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        proxy_read_timeout 60s;
        proxy_send_timeout 60s;
    }

    location /ws {
        limit_req zone=ws_limit burst=5 nodelay;
        limit_conn conn_limit 100;
        proxy_pass http://backend;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "Upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 75s;
        proxy_send_timeout 75s;
        proxy_buffering off;
    }
}
NGINX_EOF

sudo sed -i "s/DOMAIN_PLACEHOLDER/${DOMAIN}/g" "$NGINX_CONF"
sudo ln -sf "$NGINX_CONF" "$NGINX_ENABLED"
sudo nginx -t || die "Nginx config test failed"
ok "Nginx configured"

# ====== LET'S ENCRYPT TLS ======
info "🔒 Setting up Let's Encrypt TLS..."
if ! command -v certbot &>/dev/null; then
  sudo apt install -y certbot python3-certbot-nginx
fi

sudo sed -i 's|ssl_certificate|# ssl_certificate|g' "$NGINX_CONF"
sudo systemctl reload nginx

sudo mkdir -p /var/www/certbot
sudo certbot certonly --webroot -w /var/www/certbot -d "$DOMAIN" --email "$EMAIL" --agree-tos --non-interactive || {
  warn "Certbot failed. Make sure DNS points to this server: $(curl -s ifconfig.me)"
  warn "You can retry manually: sudo certbot certonly --nginx -d $DOMAIN"
}

sudo sed -i 's|# ssl_certificate|ssl_certificate|g' "$NGINX_CONF"
sudo systemctl reload nginx
ok "TLS configured"

# ====== PM2 START ======
info "🚀 Starting backend with PM2..."
cd "$APP_DIR/packages/server"

pm2 delete "$PM2_APP_NAME" 2>/dev/null || true

pm2 start dist/index.js \
  --name "$PM2_APP_NAME" \
  --node-args="--max-old-space-size=512" \
  --max-memory-restart 600M \
  --env production

pm2 save
ok "PM2 process started"

# ====== HEALTH CHECKS ======
info "🩺 Running health checks..."
sleep 5

HTTP_CODE=$(curl -o /dev/null -s -w "%{http_code}" http://localhost:8080/api/healthz || echo "000")
if [[ "$HTTP_CODE" == "200" ]]; then
  ok "Health check passed (HTTP $HTTP_CODE)"
else
  warn "Health check failed (HTTP $HTTP_CODE)"
fi

WS_CODE=$(curl -o /dev/null -s -w "%{http_code}" http://localhost:8080/api/ws-healthz || echo "000")
if [[ "$WS_CODE" == "200" ]]; then
  ok "WebSocket health check passed (HTTP $WS_CODE)"
else
  warn "WebSocket health check failed (HTTP $WS_CODE)"
fi

# ====== FINAL SUMMARY ======
echo ""
echo "======================================================================"
ok "🎉 Deployment complete!"
echo "======================================================================"
echo ""
info "🌐 Frontend:       https://${DOMAIN}"
info "🔌 WebSocket:      wss://${DOMAIN}/ws"
info "📊 Health:         https://${DOMAIN}/api/healthz"
info "📈 Metrics:        https://${DOMAIN}/api/metrics"
info "💰 Prize Preflight: https://${DOMAIN}/api/prize-preflight"
echo ""
info "📋 Useful Commands:"
echo "   pm2 status"
echo "   pm2 logs $PM2_APP_NAME"
echo "   pm2 restart $PM2_APP_NAME --update-env"
echo ""
info "🔄 To update deployment:"
echo "   # 1. Upload new tarball from your PC:"
echo "   scp spermrace-deploy.tar.gz $USER@$(curl -s ifconfig.me):/tmp/"
echo ""
echo "   # 2. Extract and rebuild on VPS:"
echo "   cd $APP_DIR"
echo "   cp /tmp/spermrace-deploy.tar.gz ."
echo "   tar -xzf spermrace-deploy.tar.gz && rm spermrace-deploy.tar.gz"
echo "   pnpm install && pnpm build"
echo "   sudo cp -r packages/client/dist/* /var/www/spermrace/"
echo "   pm2 restart $PM2_APP_NAME"
echo ""
warn "⚠️  Next steps:"
echo "   - Verify DNS: $DOMAIN -> $(curl -s ifconfig.me)"
echo "   - Test in browser: https://$DOMAIN"
echo "   - Monitor logs: pm2 logs $PM2_APP_NAME --lines 100"
echo ""
echo "======================================================================"

