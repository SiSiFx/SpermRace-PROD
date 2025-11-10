#!/bin/bash

##############################################################################
# Skidr.io VPS Deployment Script
# Usage: bash scripts/deploy-vps.sh [environment]
# Environment: dev|production (default: production)
##############################################################################

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
ENVIRONMENT=${1:-production}
PROJECT_DIR="/home/deploy/skidr.io"
LOG_DIR="/var/log/pm2"

echo -e "${BLUE}╔══════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║         Skidr.io VPS Deployment Script                  ║${NC}"
echo -e "${BLUE}║         Environment: ${ENVIRONMENT}                              ║${NC}"
echo -e "${BLUE}╚══════════════════════════════════════════════════════════╝${NC}"

# Function to print step
print_step() {
    echo -e "\n${GREEN}▶ $1${NC}"
}

# Function to print warning
print_warning() {
    echo -e "${YELLOW}⚠ $1${NC}"
}

# Function to print error
print_error() {
    echo -e "${RED}✗ $1${NC}"
}

# Check if running as deploy user
if [ "$USER" != "deploy" ]; then
    print_error "This script must be run as 'deploy' user"
    echo "Switch user: su - deploy"
    exit 1
fi

# Step 1: Check prerequisites
print_step "Step 1/10: Checking prerequisites..."

command -v node >/dev/null 2>&1 || { print_error "Node.js not installed. Install it first."; exit 1; }
command -v pnpm >/dev/null 2>&1 || { print_error "pnpm not installed. Run: npm install -g pnpm"; exit 1; }
command -v pm2 >/dev/null 2>&1 || { print_error "PM2 not installed. Run: npm install -g pm2"; exit 1; }

NODE_VERSION=$(node -v)
echo -e "  ✓ Node.js ${NODE_VERSION}"
echo -e "  ✓ pnpm $(pnpm -v)"
echo -e "  ✓ PM2 $(pm2 -v)"

# Step 2: Navigate to project directory
print_step "Step 2/10: Navigating to project directory..."

if [ -d "$PROJECT_DIR" ]; then
    cd "$PROJECT_DIR"
    echo -e "  ✓ Changed to $PROJECT_DIR"
else
    print_error "Project directory not found: $PROJECT_DIR"
    echo "Clone repository first: git clone <repo-url> $PROJECT_DIR"
    exit 1
fi

# Step 3: Backup current deployment (if exists)
print_step "Step 3/10: Creating backup..."

BACKUP_DIR="$HOME/backups/skidr-$(date +%Y%m%d-%H%M%S)"
if [ -d "packages/server/dist" ]; then
    mkdir -p "$BACKUP_DIR"
    cp -r packages/server/dist "$BACKUP_DIR/"
    cp -r packages/client/dist "$BACKUP_DIR/" 2>/dev/null || true
    echo -e "  ✓ Backup created at $BACKUP_DIR"
else
    echo -e "  ℹ No previous deployment to backup"
fi

# Step 4: Pull latest code
print_step "Step 4/10: Pulling latest code from git..."

CURRENT_BRANCH=$(git rev-parse --abbrev-ref HEAD)
echo -e "  Current branch: $CURRENT_BRANCH"

git fetch origin
git pull origin $CURRENT_BRANCH

LATEST_COMMIT=$(git log -1 --pretty=format:"%h - %s")
echo -e "  ✓ Updated to: $LATEST_COMMIT"

# Step 5: Install dependencies
print_step "Step 5/10: Installing dependencies..."

pnpm install --frozen-lockfile
echo -e "  ✓ Dependencies installed"

# Step 6: Build project
print_step "Step 6/10: Building project..."

pnpm build

if [ ! -f "packages/server/dist/index.js" ]; then
    print_error "Server build failed - index.js not found"
    exit 1
fi

echo -e "  ✓ Server built successfully"
echo -e "  ✓ Client built successfully"

# Step 7: Check environment configuration
print_step "Step 7/10: Checking environment configuration..."

ENV_FILE="packages/server/.env.$ENVIRONMENT"

if [ ! -f "$ENV_FILE" ]; then
    print_warning "Environment file not found: $ENV_FILE"
    print_warning "Using default .env file if exists"
    ENV_FILE="packages/server/.env"
fi

if [ -f "$ENV_FILE" ]; then
    # Check for critical environment variables
    if grep -q "PRIZE_POOL_SECRET_KEY=USE_KMS_OR_SECRET_MANAGER" "$ENV_FILE"; then
        print_error "PRIZE_POOL_SECRET_KEY not configured!"
        echo "Edit $ENV_FILE and set production wallet credentials"
        exit 1
    fi

    if grep -q "ALLOWED_ORIGINS=https://your-game.vercel.app" "$ENV_FILE"; then
        print_warning "ALLOWED_ORIGINS still has default value"
        echo "Update ALLOWED_ORIGINS in $ENV_FILE with your Vercel URL"
    fi

    echo -e "  ✓ Environment file found: $ENV_FILE"
else
    print_error "No environment file found"
    echo "Create $ENV_FILE from .env.production.example"
    exit 1
fi

# Step 8: Stop current PM2 processes (if running)
print_step "Step 8/10: Stopping current PM2 processes..."

pm2 describe spermrace-server-ws >/dev/null 2>&1 && pm2 stop spermrace-server-ws && echo -e "  ✓ Stopped spermrace-server-ws" || echo -e "  ℹ No running process to stop"

# Step 9: Start/Restart with PM2
print_step "Step 9/10: Starting server with PM2..."

pm2 start ops/pm2/ecosystem.config.js

# Wait for server to start
sleep 3

# Check if server is running
pm2 describe spermrace-server-ws >/dev/null 2>&1 && echo -e "  ✓ Server started successfully" || { print_error "Server failed to start"; echo "Check logs: pm2 logs spermrace-server-ws"; exit 1; }

# Save PM2 process list
pm2 save
echo -e "  ✓ PM2 process list saved"

# Step 10: Health check
print_step "Step 10/10: Running health check..."

sleep 2

# Check if port 8080 is listening
if netstat -tuln | grep -q ":8080 "; then
    echo -e "  ✓ Server listening on port 8080"
else
    print_warning "Port 8080 not listening. Server may still be starting..."
fi

# Try to connect to health endpoints
if curl -fsS http://localhost:8080/api/healthz >/dev/null 2>&1; then
    echo -e "  ✓ Health check passed (/api/healthz)"
else
    print_warning "Health endpoint not responding"
fi
if curl -fsS http://localhost:8080/api/readyz >/dev/null 2>&1; then
    echo -e "  ✓ Readiness check passed (/api/readyz)"
else
    print_warning "Readiness endpoint not responding"
fi

# Display PM2 status
echo -e "\n${GREEN}PM2 Status:${NC}"
pm2 status

# Display logs location
echo -e "\n${BLUE}Logs:${NC}"
echo -e "  stdout: $LOG_DIR/spermrace-out.log"
echo -e "  stderr: $LOG_DIR/spermrace-err.log"
echo -e "  View: pm2 logs spermrace-server-ws"

# Display server info
echo -e "\n${GREEN}╔══════════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║              Deployment Successful! 🚀                   ║${NC}"
echo -e "${GREEN}╚══════════════════════════════════════════════════════════╝${NC}"

echo -e "\n${BLUE}Server Details:${NC}"
echo -e "  Environment: ${ENVIRONMENT}"
echo -e "  Version: $(git describe --tags 2>/dev/null || echo 'latest')"
echo -e "  Commit: $LATEST_COMMIT"
echo -e "  Server URL: ws://$(hostname -I | awk '{print $1}'):8080"

echo -e "\n${YELLOW}Next Steps:${NC}"
echo -e "  1. Monitor logs: ${BLUE}pm2 logs spermrace-server-ws${NC}"
echo -e "  2. Check metrics: ${BLUE}pm2 monit${NC}"
echo -e "  3. Update Vercel VITE_WS_URL to: ${BLUE}wss://your-domain.com${NC}"
echo -e "  4. Test WebSocket connection from client"

echo -e "\n${YELLOW}Useful Commands:${NC}"
echo -e "  Restart: ${BLUE}pm2 restart spermrace-server-ws${NC}"
echo -e "  Stop: ${BLUE}pm2 stop spermrace-server-ws${NC}"
echo -e "  Reload (zero-downtime): ${BLUE}pm2 reload spermrace-server-ws${NC}"
echo -e "  Show logs: ${BLUE}pm2 logs skidr-server --lines 100${NC}"

exit 0
