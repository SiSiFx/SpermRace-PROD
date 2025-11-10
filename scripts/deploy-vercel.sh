#!/bin/bash

##############################################################################
# Skidr.io Vercel Deployment Script
# Usage: bash scripts/deploy-vercel.sh [environment]
# Environment: preview|production (default: production)
##############################################################################

set -e

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m'

ENVIRONMENT=${1:-production}

echo -e "${BLUE}╔══════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║         Skidr.io Vercel Deployment                      ║${NC}"
echo -e "${BLUE}╚══════════════════════════════════════════════════════════╝${NC}"

# Check if Vercel CLI is installed
if ! command -v vercel &> /dev/null; then
    echo -e "${YELLOW}Vercel CLI not found. Installing...${NC}"
    npm install -g vercel
fi

# Navigate to client directory
cd "$(dirname "$0")/../packages/client"

echo -e "\n${GREEN}▶ Building client...${NC}"
pnpm build

echo -e "\n${GREEN}▶ Deploying to Vercel...${NC}"

if [ "$ENVIRONMENT" = "production" ]; then
    vercel --prod
else
    vercel
fi

echo -e "\n${GREEN}╔══════════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║           Vercel Deployment Complete! 🚀                 ║${NC}"
echo -e "${GREEN}╚══════════════════════════════════════════════════════════╝${NC}"

echo -e "\n${YELLOW}Remember to:${NC}"
echo -e "  1. Set environment variables in Vercel dashboard:"
echo -e "     - VITE_WS_URL=wss://your-vps-domain.com"
echo -e "     - VITE_SOLANA_NETWORK=mainnet-beta"
echo -e "  2. Update ALLOWED_ORIGINS on VPS server with Vercel URL"

exit 0
