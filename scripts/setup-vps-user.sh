#!/usr/bin/env bash
# ============================================================================
# SpermRace.io - VPS Initial Setup (Create Deploy User)
# Run this first as root to create a non-root deployment user
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
die() { echo -e "${RED}[FATAL]${NC} $*"; exit 1; }

# Check if running as root
if [[ $EUID -ne 0 ]]; then
   die "This script must be run as root (for initial setup only)"
fi

echo ""
info "🎯 SpermRace.io - VPS Initial Setup"
echo ""

# Get username
read -p "Enter username for deployment (default: deploy): " DEPLOY_USER
DEPLOY_USER="${DEPLOY_USER:-deploy}"

# Check if user already exists
if id "$DEPLOY_USER" &>/dev/null; then
    warn "User '$DEPLOY_USER' already exists"
    read -p "Continue anyway? (y/n): " CONTINUE
    if [[ "$CONTINUE" != "y" ]]; then
        exit 0
    fi
else
    # Create user
    info "Creating user '$DEPLOY_USER'..."
    adduser --gecos "" "$DEPLOY_USER"
    ok "User created"
fi

# Add to sudo group
info "Adding user to sudo group..."
usermod -aG sudo "$DEPLOY_USER"
ok "User added to sudo group"

# Create SSH directory
info "Setting up SSH access..."
USER_HOME="/home/$DEPLOY_USER"
mkdir -p "$USER_HOME/.ssh"
chmod 700 "$USER_HOME/.ssh"

# Copy root's authorized_keys if it exists
if [[ -f /root/.ssh/authorized_keys ]]; then
    cp /root/.ssh/authorized_keys "$USER_HOME/.ssh/authorized_keys"
    ok "Copied SSH keys from root"
fi

# Set permissions
chown -R "$DEPLOY_USER:$DEPLOY_USER" "$USER_HOME/.ssh"
chmod 600 "$USER_HOME/.ssh/authorized_keys" 2>/dev/null || true

# Allow sudo without password for this user (optional, for automation)
info "Configuring sudo access..."
echo "$DEPLOY_USER ALL=(ALL) NOPASSWD:ALL" > "/etc/sudoers.d/$DEPLOY_USER"
chmod 440 "/etc/sudoers.d/$DEPLOY_USER"
ok "Sudo configured"

# Update system packages
info "Updating system packages..."
apt update
apt upgrade -y

# Install basic requirements
info "Installing basic requirements..."
apt install -y curl wget git build-essential

ok "VPS setup complete!"

echo ""
echo "======================================================================"
info "✅ VPS is ready for deployment!"
echo "======================================================================"
echo ""
info "Next steps:"
echo "  1. Upload tarball:"
echo "     scp spermrace-deploy.tar.gz $DEPLOY_USER@\$(hostname -I | awk '{print \$1}'):/tmp/"
echo ""
echo "  2. SSH as the new user:"
echo "     ssh $DEPLOY_USER@\$(hostname -I | awk '{print \$1}')"
echo ""
echo "  3. Run deployment script:"
echo "     bash /path/to/vps-deploy-turkey.sh"
echo ""
echo "======================================================================"
