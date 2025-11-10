## SpermRace.io - VPS Deployment (Low RAM Safe)

Copy/paste these blocks in order over SSH. Avoid leading pipes or line numbers.

### 0) Optional: tmux to avoid session drops
```bash
apt update && apt install -y tmux
tmux new -s deploy
```

### 1) Add 2G swap (prevents build OOM)
```bash
fallocate -l 2G /swapfile || dd if=/dev/zero of=/swapfile bs=1M count=2048
chmod 600 /swapfile && mkswap /swapfile && swapon /swapfile
grep -q '/swapfile' /etc/fstab || echo '/swapfile none swap sw 0 0' >> /etc/fstab
sysctl vm.swappiness=10
```

### 2) Production configuration + low-concurrency
```bash
export DOMAIN="spermrace.io"
export EMAIL="admin@spermrace.io"
export TARBALL_PATH="/tmp/spermrace-deploy.tar.gz"
export NODE_ENV="production"
export PORT="8080"
export SOLANA_RPC_ENDPOINT="https://api.mainnet-beta.solana.com"
export PRIZE_POOL_WALLET="5YKciEvHaGKC6xDntXqWTp3UEkGww5bU72Z7eckxR4j9"
export PRIZE_POOL_SECRET_KEY="<PASTE_BASE58_OR_JSON_SECRET>"
export SKIP_ENTRY_FEE="false"
export ALLOWED_ORIGINS="https://spermrace.io,https://www.spermrace.io"

export NODE_OPTIONS="--max_old_space_size=512"
export PNPM_CONFIG_CHILD_CONCURRENCY=2
export PNPM_WORKSPACE_CONCURRENCY=1
```

### 3) System prerequisites (Node 20, pnpm, pm2, nginx, certbot)
```bash
apt-get update -y
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt-get install -y nodejs nginx certbot python3-certbot-nginx ufw

npm config set registry https://registry.npmmirror.com
npm install -g pnpm pm2
npm config delete registry
```

### 4) Extract code to /opt/spermrace
```bash
mkdir -p /opt/spermrace
cp -f "$TARBALL_PATH" /opt/spermrace/spermrace-deploy.tar.gz
cd /opt/spermrace && tar -xzf spermrace-deploy.tar.gz && rm -f spermrace-deploy.tar.gz
```

### 5) Write server .env
```bash
cat > /opt/spermrace/packages/server/.env <<EOF
NODE_ENV=${NODE_ENV}
PORT=${PORT}
ALLOWED_ORIGINS=${ALLOWED_ORIGINS}
SOLANA_RPC_ENDPOINT=${SOLANA_RPC_ENDPOINT}
PRIZE_POOL_WALLET=${PRIZE_POOL_WALLET}
PRIZE_POOL_SECRET_KEY=${PRIZE_POOL_SECRET_KEY}
LOG_JSON=true
SKIP_ENTRY_FEE=${SKIP_ENTRY_FEE}
EOF
```

### 6) Package install (mirror + minimal RAM)
```bash
cd /opt/spermrace
pnpm config set registry https://registry.npmmirror.com
pnpm fetch
pnpm install --offline --no-frozen-lockfile
```

### 7) Build server minimal set
```bash
NODE_OPTIONS="--max_old_space_size=512" pnpm --filter @spermrace/shared build
NODE_OPTIONS="--max_old_space_size=512" pnpm --filter @spermrace/server  build
```

### 8) PM2 start and health check
```bash
cd /opt/spermrace/packages/server
pm2 delete spermrace-server-ws 2>/dev/null || true
pm2 start dist/index.js --name spermrace-server-ws --node-args="--max-old-space-size=512" --max-memory-restart 600M --env production
pm2 save
pm2 status
curl -fsS http://127.0.0.1:${PORT}/api/healthz || true
```

### 9) Nginx + TLS (after DNS A record points to 93.180.133.94)
```bash
bash -lc 'cat > /etc/nginx/sites-available/spermrace <<NGINX
upstream backend { server 127.0.0.1:${PORT}; keepalive 32; }
server {
  listen 80; server_name ${DOMAIN};
  location /.well-known/acme-challenge/ { root /var/www/certbot; }
  location / { return 301 https://$server_name$request_uri; }
}
server {
  listen 443 ssl http2; server_name ${DOMAIN};
  ssl_certificate /etc/letsencrypt/live/${DOMAIN}/fullchain.pem;
  ssl_certificate_key /etc/letsencrypt/live/${DOMAIN}/privkey.pem;
  location /api/ { proxy_pass http://backend; proxy_http_version 1.1; proxy_set_header Upgrade $http_upgrade; proxy_set_header Connection "upgrade"; }
  location /ws  { proxy_pass http://backend; proxy_http_version 1.1; proxy_set_header Upgrade $http_upgrade; proxy_set_header Connection "Upgrade"; proxy_buffering off; }
}
NGINX'
ln -sf /etc/nginx/sites-available/spermrace /etc/nginx/sites-enabled/spermrace
nginx -t && systemctl reload nginx

mkdir -p /var/www/certbot
sed -i 's|ssl_certificate|# ssl_certificate|g' /etc/nginx/sites-available/spermrace
systemctl reload nginx
certbot certonly --webroot -w /var/www/certbot -d "${DOMAIN}" --email "${EMAIL}" --agree-tos --non-interactive || true
sed -i 's|# ssl_certificate|ssl_certificate|g' /etc/nginx/sites-available/spermrace
systemctl reload nginx
curl -I https://${DOMAIN}/api/healthz || true
```

### 10) Frontend (optional) to web root
```bash
mkdir -p /var/www/spermrace
rm -rf /var/www/spermrace/* || true
cp -r /opt/spermrace/packages/client/dist/* /var/www/spermrace/ 2>/dev/null || true
chown -R www-data:www-data /var/www/spermrace
```

### 11) Monitoring & logs
```bash
pm2 logs --lines 100
pm2 monit
ufw status
nginx -t && systemctl status nginx --no-pager
```
