#!/usr/bin/env bash
# ============================================================================
# SpermRace.io - Fully Automated VPS Deployment Script
# ============================================================================
# This script handles EVERYTHING:
# - System provisioning (Node, pnpm, pm2, Nginx, Certbot)
# - Code fetching (HTTP tarball or Git)
# - Building (TypeScript compile, Vite build)
# - Nginx + TLS configuration
# - PM2 process management
# - Health checks & verification
# ============================================================================

set -euo pipefail

# ====== COLORS & LOGGING ======
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

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

# Check if running as root
if [[ $EUID -eq 0 ]]; then
  die "Do NOT run as root. Use a sudo-capable user."
fi

# ====== INTERACTIVE PROMPTS ======
info "🎯 SpermRace.io - VPS Deployment Wizard"
echo ""

read -p "Domain name (e.g., game.yourdomain.com): " DOMAIN
[[ -z "$DOMAIN" ]] && die "Domain is required"

read -p "Email for Let's Encrypt (e.g., admin@yourdomain.com): " EMAIL
[[ -z "$EMAIL" ]] && die "Email is required"

echo ""
info "Choose code source:"
echo "  1) HTTP tarball (from your PC)"
echo "  2) Git repository"
read -p "Choice [1/2]: " CODE_SOURCE_CHOICE

if [[ "$CODE_SOURCE_CHOICE" == "1" ]]; then
  read -p "Tarball URL (e.g., http://YOUR_PC_IP:9000/spermrace-deploy.tar.gz): " TARBALL_URL
  [[ -z "$TARBALL_URL" ]] && die "Tarball URL is required"
  CODE_SOURCE="tarball"
elif [[ "$CODE_SOURCE_CHOICE" == "2" ]]; then
  read -p "Git repository URL: " REPO_URL
  [[ -z "$REPO_URL" ]] && die "Git URL is required"
  read -p "Branch [main]: " BRANCH
  BRANCH="${BRANCH:-main}"
  CODE_SOURCE="git"
else
  die "Invalid choice"
fi

echo ""
info "Solana Configuration:"
read -p "Solana RPC endpoint (e.g., https://api.mainnet-beta.solana.com): " SOLANA_RPC
[[ -z "$SOLANA_RPC" ]] && die "Solana RPC is required"

read -p "Prize Pool Wallet (public key): " PRIZE_POOL_WALLET
[[ -z "$PRIZE_POOL_WALLET" ]] && die "Prize pool wallet is required"

read -sp "Prize Pool Secret Key (base58 or JSON): " PRIZE_POOL_SECRET
echo ""
[[ -z "$PRIZE_POOL_SECRET" ]] && die "Prize pool secret is required"

read -p "Additional frontend origin (Vercel, optional): " VERCEL_ORIGIN

# Build ALLOWED_ORIGINS
ALLOWED_ORIGINS="https://${DOMAIN}"
[[ -n "$VERCEL_ORIGIN" ]] && ALLOWED_ORIGINS="${ALLOWED_ORIGINS},${VERCEL_ORIGIN}"

echo ""
ok "Configuration complete. Starting deployment..."
sleep 2

# ====== SYSTEM PROVISIONING ======
info "📦 Installing system packages..."
sudo apt update
sudo apt install -y nginx git curl build-essential ca-certificates ufw

# ====== NODE.JS 20 ======
if ! command -v node &>/dev/null || [[ "$(node -v | cut -d'.' -f1 | tr -d 'v')" -lt 20 ]]; then
  info "📦 Installing Node.js 20..."
  curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
  sudo apt install -y nodejs
fi
ok "Node.js $(node -v)"

# ====== PNPM ======
if ! command -v pnpm &>/dev/null; then
  info "📦 Installing pnpm..."
  sudo npm install -g pnpm
fi
ok "pnpm $(pnpm -v)"

# ====== PM2 ======
if ! command -v pm2 &>/dev/null; then
  info "📦 Installing PM2..."
  sudo npm install -g pm2
  pm2 startup systemd -u "$USER" --hp "$HOME" | grep 'sudo' | bash || true
fi
ok "PM2 installed"

# ====== FIREWALL ======
info "🔒 Configuring firewall (UFW)..."
sudo ufw --force enable
sudo ufw allow 22/tcp comment "SSH"
sudo ufw allow 80/tcp comment "HTTP"
sudo ufw allow 443/tcp comment "HTTPS"
sudo ufw allow 8080/tcp comment "WebSocket Backend"
ok "Firewall configured"

# ====== FETCH CODE ======
info "📥 Fetching code..."
sudo mkdir -p "$APP_DIR"
sudo chown "$USER":"$USER" "$APP_DIR"

if [[ "$CODE_SOURCE" == "tarball" ]]; then
  cd "$APP_DIR"
  wget -O spermrace-deploy.tar.gz "$TARBALL_URL" || die "Failed to download tarball"
  tar -xzf spermrace-deploy.tar.gz
  rm spermrace-deploy.tar.gz
  ok "Tarball extracted"
elif [[ "$CODE_SOURCE" == "git" ]]; then
  if [[ -d "$APP_DIR/.git" ]]; then
    cd "$APP_DIR"
    git fetch origin
    git checkout "$BRANCH"
    git pull origin "$BRANCH"
    ok "Git repository updated"
  else
    rm -rf "$APP_DIR"
    git clone -b "$BRANCH" "$REPO_URL" "$APP_DIR"
    ok "Git repository cloned"
  fi
fi

cd "$APP_DIR"

# ====== CREATE .ENV ======
info "⚙️  Creating .env file..."
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

# ====== BUILD PROJECT ======
info "🔨 Installing dependencies..."
pnpm install --frozen-lockfile || pnpm install

info "🔨 Building project..."
pnpm --filter @spermrace/shared build
pnpm --filter @spermrace/server build
pnpm --filter @spermrace/client build

ok "Build complete"

# ====== DEPLOY FRONTEND ======
info "🌐 Deploying frontend to Nginx..."
sudo mkdir -p "$WEB_ROOT"
sudo rm -rf "$WEB_ROOT"/*
sudo cp -r "$APP_DIR/packages/client/dist"/* "$WEB_ROOT/"
sudo chown -R www-data:www-data "$WEB_ROOT"
ok "Frontend deployed to $WEB_ROOT"

# ====== NGINX CONFIGURATION ======
info "⚙️  Configuring Nginx..."
sudo tee "$NGINX_CONF" > /dev/null <<'NGINX_EOF'
# Rate limiting zones
limit_req_zone $binary_remote_addr zone=api_limit:10m rate=30r/s;
limit_req_zone $binary_remote_addr zone=ws_limit:10m rate=10r/s;
limit_conn_zone $binary_remote_addr zone=conn_limit:10m;

# Upstream backend
upstream backend {
    server 127.0.0.1:8080 max_fails=3 fail_timeout=30s;
    keepalive 32;
}

server {
    listen 80;
    listen [::]:80;
    server_name DOMAIN_PLACEHOLDER;
    server_tokens off;

    # Let's Encrypt challenge
    location /.well-known/acme-challenge/ {
        root /var/www/certbot;
    }

    # Redirect to HTTPS
    location / {
        return 301 https://$server_name$request_uri;
    }
}

server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name DOMAIN_PLACEHOLDER;
    server_tokens off;

    # TLS configuration
    ssl_certificate /etc/letsencrypt/live/DOMAIN_PLACEHOLDER/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/DOMAIN_PLACEHOLDER/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers 'ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256:ECDHE-ECDSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-GCM-SHA384';
    ssl_prefer_server_ciphers off;

    # Security headers
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;
    add_header Content-Security-Policy "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self' data:; connect-src 'self' wss://DOMAIN_PLACEHOLDER https://api.mainnet-beta.solana.com https://api.devnet.solana.com; frame-ancestors 'none';" always;

    # Static files (SPA)
    root /var/www/spermrace;
    index index.html;

    # Compression
    gzip on;
    gzip_vary on;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml text/javascript;

    # SPA routing
    location / {
        try_files $uri $uri/ /index.html;
    }

    # API endpoints
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

    # WebSocket endpoint
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

# Replace domain placeholder
sudo sed -i "s/DOMAIN_PLACEHOLDER/${DOMAIN}/g" "$NGINX_CONF"

# Enable site
sudo ln -sf "$NGINX_CONF" "$NGINX_ENABLED"
sudo nginx -t || die "Nginx config test failed"
ok "Nginx configured"

# ====== LET'S ENCRYPT TLS ======
info "🔒 Setting up Let's Encrypt TLS..."
if ! command -v certbot &>/dev/null; then
  sudo apt install -y certbot python3-certbot-nginx
fi

# Temporarily enable HTTP for challenge
sudo sed -i 's|ssl_certificate|# ssl_certificate|g' "$NGINX_CONF"
sudo systemctl reload nginx

sudo certbot certonly --nginx -d "$DOMAIN" --email "$EMAIL" --agree-tos --non-interactive --redirect || warn "Certbot failed, check DNS and retry manually"

# Re-enable SSL lines
sudo sed -i 's|# ssl_certificate|ssl_certificate|g' "$NGINX_CONF"
sudo systemctl reload nginx
ok "TLS configured"

# ====== PM2 START ======
info "🚀 Starting backend with PM2..."
cd "$APP_DIR/packages/server"

# Stop old process if exists
pm2 delete "$PM2_APP_NAME" 2>/dev/null || true

# Start new process
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
info "📋 PM2 Commands:"
echo "   pm2 status"
echo "   pm2 logs $PM2_APP_NAME"
echo "   pm2 restart $PM2_APP_NAME --update-env"
echo ""
info "🔄 Update deployment:"
echo "   cd $APP_DIR && git pull && pnpm install && pnpm build"
echo "   pm2 restart $PM2_APP_NAME"
echo ""
warn "⚠️  Remember to:"
echo "   - Update DNS A record: $DOMAIN -> $(curl -s ifconfig.me)"
echo "   - Test from client: update VITE_WS_URL and VITE_API_URL"
echo "   - Monitor logs: pm2 logs $PM2_APP_NAME --lines 100"
echo ""
echo "======================================================================"









