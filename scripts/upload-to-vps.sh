#!/usr/bin/env bash
# ============================================================================
# Upload SpermRace.io project to VPS via SCP (bypasses Turkey ISP blocks)
# ============================================================================

set -euo pipefail

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

info() { echo -e "${CYAN}[INFO]${NC} $*"; }
ok() { echo -e "${GREEN}[OK]${NC} $*"; }
warn() { echo -e "${YELLOW}[WARN]${NC} $*"; }
die() { echo -e "${RED}[ERROR]${NC} $*"; exit 1; }

# Check arguments
if [[ $# -lt 1 ]]; then
  echo "Usage: $0 <VPS_HOST> [VPS_USER] [VPS_PORT]"
  echo ""
  echo "Examples:"
  echo "  $0 185.123.45.67"
  echo "  $0 game.yourdomain.com root 22"
  echo "  $0 185.123.45.67 ubuntu"
  exit 1
fi

VPS_HOST="$1"
VPS_USER="${2:-root}"
VPS_PORT="${3:-22}"

echo ""
info "🎯 SpermRace.io - VPS Upload Script"
echo ""

# Get project root (script is in scripts/)
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
TARBALL_NAME="spermrace-deploy.tar.gz"
TARBALL_PATH="$PROJECT_ROOT/$TARBALL_NAME"

info "Project root: $PROJECT_ROOT"

# Create tarball
info "📦 Creating project tarball..."
if [[ -f "$TARBALL_PATH" ]]; then
  rm -f "$TARBALL_PATH"
fi

cd "$PROJECT_ROOT"
tar -czf "$TARBALL_NAME" \
  --exclude=node_modules \
  --exclude=dist \
  --exclude=.git \
  --exclude='*.tar.gz' \
  --exclude=.env \
  --exclude='.env.*' \
  --exclude=.pm2 \
  .

SIZE_MB=$(du -m "$TARBALL_PATH" | cut -f1)
ok "Tarball created: ${SIZE_MB} MB"

# Upload via SCP
info "📤 Uploading to VPS (${VPS_USER}@${VPS_HOST}:${VPS_PORT})..."
info "You may be prompted for your SSH password or key passphrase..."

REMOTE_PATH="/tmp/$TARBALL_NAME"
scp -P "$VPS_PORT" "$TARBALL_PATH" "${VPS_USER}@${VPS_HOST}:${REMOTE_PATH}" || die "SCP upload failed!"

ok "Upload complete!"

# Cleanup local tarball
info "🧹 Cleaning up local tarball..."
rm -f "$TARBALL_PATH"
ok "Cleanup complete"

# Instructions for VPS
echo ""
echo "======================================================================"
ok "🎉 Project uploaded to VPS!"
echo "======================================================================"
echo ""
info "Next steps - Run these commands on your VPS:"
echo ""
echo -e "${YELLOW}ssh ${VPS_USER}@${VPS_HOST}${NC}"
echo ""
echo -e "${YELLOW}# Extract the project${NC}"
echo -e "${CYAN}mkdir -p ~/spermrace-deploy${NC}"
echo -e "${CYAN}cd ~/spermrace-deploy${NC}"
echo -e "${CYAN}tar -xzf ${REMOTE_PATH}${NC}"
echo ""
echo -e "${YELLOW}# Run the deployment script${NC}"
echo -e "${CYAN}chmod +x scripts/vps-deploy-turkey.sh${NC}"
echo -e "${CYAN}./scripts/vps-deploy-turkey.sh${NC}"
echo ""
echo "======================================================================"
echo ""
info "💡 Tip: The deployment script will ask for configuration interactively"
echo ""









