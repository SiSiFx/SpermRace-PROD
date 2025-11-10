#!/usr/bin/env bash
# ============================================================================
# SpermRace.io - Complete VPS Deployment (Root-Compatible)
# Modified version that can run as root
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

# Determine if we're root
if [[ $EUID -eq 0 ]]; then
  warn "Running as root - will create deploy user"
  DEPLOY_USER="deploy"
  NEED_SUDO=""
else
  DEPLOY_USER="$USER"
  NEED_SUDO="sudo"
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
read -p "Solana RPC endpoint [https://api.mainnet-beta.solana.com]: " SOLANA_RPC
SOLANA_RPC="${SOLANA_RPC:-https://api.mainnet-beta.solana.com}"

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

# ====== CREATE DEPLOY USER IF ROOT ======
if [[ $EUID -eq 0 ]]; then
  if ! id "$DEPLOY_USER" &>/dev/null; then
    info "Creating deploy user..."
    adduser --disabled-password --gecos "" "$DEPLOY_USER"
    usermod -aG sudo "$DEPLOY_USER"
    echo "$DEPLOY_USER ALL=(ALL) NOPASSWD:ALL" > "/etc/sudoers.d/$DEPLOY_USER"
    chmod 440 "/etc/sudoers.d/$DEPLOY_USER"
    ok "Deploy user created: $DEPLOY_USER"
  fi
fi

# ====== SYSTEM PACKAGES ======
info "📦 Installing system packages..."
$NEED_SUDO apt update
$NEED_SUDO apt install -y nginx curl build-essential ca-certificates ufw

# ====== NODE.JS 20 ======
if ! command -v node &>/dev/null || [[ "$(node -v | cut -d'.' -f1 | tr -d 'v')" -lt 20 ]]; then
  info "📦 Installing Node.js 20 via NodeSource..."

  curl -fsSL https://deb.nodesource.com/setup_20.x | $NEED_SUDO bash -
  $NEED_SUDO apt install -y nodejs
fi
ok "Node.js $(node -v)"

# ====== PNPM ======
if ! command -v pnpm &>/dev/null; then
  info "📦 Installing pnpm..."
  curl -fsSL https://get.pnpm.io/install.sh | sh - || npm install -g pnpm

  export PNPM_HOME="$HOME/.local/share/pnpm"
  export PATH="$PNPM_HOME:$PATH"
fi
ok "pnpm $(pnpm -v)"

# ====== PM2 ======
if ! command -v pm2 &>/dev/null; then
  info "📦 Installing PM2..."
  npm install -g pm2
  if [[ $EUID -ne 0 ]]; then
    pm2 startup systemd -u "$USER" --hp "$HOME" | grep 'sudo' | bash || true
  fi
fi
ok "PM2 installed"

# ====== FIREWALL ======
info "🔒 Configuring firewall..."
$NEED_SUDO ufw --force enable
$NEED_SUDO ufw allow 22/tcp comment "SSH"
$NEED_SUDO ufw allow 80/tcp comment "HTTP"
$NEED_SUDO ufw allow 443/tcp comment "HTTPS"
$NEED_SUDO ufw allow 8080/tcp comment "Backend"
ok "Firewall configured"

# ====== EXTRACT CODE ======
info "📥 Extracting project..."
$NEED_SUDO mkdir -p "$APP_DIR"
$NEED_SUDO chown "$DEPLOY_USER":"$DEPLOY_USER" "$APP_DIR"
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

# ====== BUILD PROJECT ======
info "🔨 Installing dependencies..."
pnpm install --no-frozen-lockfile || pnpm install --no-frozen-lockfile --registry https://registry.npmmirror.com

info "🔨 Building project..."
pnpm --filter @spermrace/shared build || die "Shared build failed"
pnpm --filter @spermrace/server build || die "Server build failed"
pnpm --filter @spermrace/client build || die "Client build failed"

ok "Build complete"

# ====== DEPLOY FRONTEND ======
info "🌐 Deploying frontend..."
$NEED_SUDO mkdir -p "$WEB_ROOT"
$NEED_SUDO rm -rf "$WEB_ROOT"/*
$NEED_SUDO cp -r "$APP_DIR/packages/client/dist"/* "$WEB_ROOT/"
$NEED_SUDO chown -R www-data:www-data "$WEB_ROOT"
ok "Frontend deployed"

# ====== NGINX CONFIGURATION ======
info "⚙️  Configuring Nginx..."
$NEED_SUDO tee "$NGINX_CONF" > /dev/null <<NGINX_EOF
limit_req_zone \$binary_remote_addr zone=api_limit:10m rate=30r/s;
limit_req_zone \$binary_remote_addr zone=ws_limit:10m rate=10r/s;
limit_conn_zone \$binary_remote_addr zone=conn_limit:10m;

upstream backend {
    server 127.0.0.1:8080 max_fails=3 fail_timeout=30s;
    keepalive 32;
}

server {
    listen 80;
    listen [::]:80;
    server_name ${DOMAIN};
    server_tokens off;

    location /.well-known/acme-challenge/ {
        root /var/www/certbot;
    }

    location / {
        return 301 https://\$server_name\$request_uri;
    }
}

server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name ${DOMAIN};
    server_tokens off;

    ssl_certificate /etc/letsencrypt/live/${DOMAIN}/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/${DOMAIN}/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_prefer_server_ciphers off;

    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;

    root /var/www/spermrace;
    index index.html;

    gzip on;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml;

    location / {
        try_files \$uri \$uri/ /index.html;
    }

    location /api/ {
        limit_req zone=api_limit burst=10 nodelay;
        proxy_pass http://backend;
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }

    location /ws {
        limit_req zone=ws_limit burst=5 nodelay;
        proxy_pass http://backend;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "Upgrade";
        proxy_set_header Host \$host;
        proxy_read_timeout 75s;
        proxy_buffering off;
    }
}
NGINX_EOF

$NEED_SUDO ln -sf "$NGINX_CONF" "$NGINX_ENABLED"
$NEED_SUDO nginx -t || die "Nginx config test failed"
ok "Nginx configured"

# ====== LET'S ENCRYPT ======
info "🔒 Setting up Let's Encrypt..."
if ! command -v certbot &>/dev/null; then
  $NEED_SUDO apt install -y certbot python3-certbot-nginx
fi

$NEED_SUDO sed -i 's|ssl_certificate|# ssl_certificate|g' "$NGINX_CONF"
$NEED_SUDO systemctl reload nginx

$NEED_SUDO mkdir -p /var/www/certbot
$NEED_SUDO certbot certonly --webroot -w /var/www/certbot -d "$DOMAIN" --email "$EMAIL" --agree-tos --non-interactive || {
  warn "Certbot failed. Ensure DNS points to this server."
}

$NEED_SUDO sed -i 's|# ssl_certificate|ssl_certificate|g' "$NGINX_CONF"
$NEED_SUDO systemctl reload nginx
ok "TLS configured"

# ====== PM2 START ======
info "🚀 Starting backend with PM2..."
cd "$APP_DIR/packages/server"

pm2 delete "$PM2_APP_NAME" 2>/dev/null || true

pm2 start dist/index.js \
  --name "$PM2_APP_NAME" \
  --max-memory-restart 600M \
  --env production

pm2 save
ok "Server started"

# ====== SUCCESS ======
echo ""
echo "======================================================================"
ok "🎉 Deployment complete!"
echo "======================================================================"
echo ""
info "🌐 Frontend:  https://${DOMAIN}"
info "🔌 WebSocket: wss://${DOMAIN}/ws"
info "📊 Health:    https://${DOMAIN}/api/healthz"
echo ""
info "Monitor: pm2 logs $PM2_APP_NAME"
echo "======================================================================"
