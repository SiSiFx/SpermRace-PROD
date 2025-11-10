#!/usr/bin/env bash
# Quick manual finish - skip the scanning that hangs
set -e

echo "=== Manual Deployment Finish ==="
echo "Skipping stuck scanning process..."

# Install Node.js 20
echo "[1/7] Installing Node.js 20..."
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo bash -
sudo apt-get install -y nodejs

# Install pnpm
echo "[2/7] Installing pnpm..."
curl -fsSL https://get.pnpm.io/install.sh | sh -
export PNPM_HOME="$HOME/.local/share/pnpm"
export PATH="$PNPM_HOME:$PATH"

# Install PM2
echo "[3/7] Installing PM2..."
sudo npm install -g pm2

# Extract and build project
echo "[4/7] Extracting project..."
sudo mkdir -p /opt/spermrace
cd /opt/spermrace
sudo tar -xzf /tmp/spermrace-deploy.tar.gz

echo "[5/7] Building project..."
pnpm install
pnpm --filter @spermrace/shared build
pnpm --filter @spermrace/server build
pnpm --filter @spermrace/client build

# Deploy frontend
echo "[6/7] Deploying frontend..."
sudo mkdir -p /var/www/spermrace
sudo cp -r packages/client/dist/* /var/www/spermrace/

# Start with PM2
echo "[7/7] Starting server..."
cd packages/server
pm2 start dist/index.js --name spermrace-server
pm2 save

echo ""
echo "=== DEPLOYMENT COMPLETE ==="
echo "Frontend: /var/www/spermrace"
echo "Backend: PM2 process 'spermrace-server'"
echo ""
echo "Check status: pm2 status"
