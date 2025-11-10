# Prompt for ChatGPT on VPS

Copy and paste this prompt to ChatGPT when you're connected to the VPS:

---

I'm on an Ubuntu VPS (IP: 93.180.133.94, located in Turkey) and need to deploy a Node.js WebSocket server for a multiplayer game.

**Project**: SpermRace.io - WebSocket-based multiplayer game with Solana blockchain integration
**Current Status**: Project tarball should be at `/root/spermrace-deploy.tar.gz`

**Context**:
- This is a PRODUCTION deployment (no mock/dummy data allowed)
- VPS is in Turkey (npm/GitHub may be blocked by ISP)
- I have a deployment script optimized for Turkey with NVM and npm mirrors
- Need to install Node.js, build the project, configure Nginx with SSL, and start the server with PM2

**Required Information** (I'll provide these):
- Domain name: _________________
- Email for SSL certificates: _________________
- Solana Program ID: _________________
- Solana Treasury Public Key: _________________
- Solana Treasury Secret Key: _________________
- Solana Network (mainnet-beta or devnet): _________________

**What I need you to do**:

1. Check if the tarball exists: `ls -lh /root/spermrace-deploy.tar.gz`
2. Extract it: `cd /root && tar -xzf spermrace-deploy.tar.gz && cd spermrace`
3. Run the Turkey-optimized deployment script: `./scripts/vps-deploy-turkey.sh`
4. The script will prompt for the required values above - help me enter them correctly
5. Monitor the deployment process and troubleshoot any issues
6. After deployment, verify the server is working with health checks
7. Help me test WebSocket connections and check PM2 status

**Important Notes**:
- The deployment script handles everything: Node.js install, dependencies, build, Nginx, SSL, firewall
- It's optimized for Turkey ISP restrictions
- It uses NVM for Node.js and npm mirrors for packages
- PM2 will manage the server process with auto-restart
- Nginx will act as reverse proxy with SSL termination

**Common Issues to Watch For**:
- npm registry blocked → script uses npmmirror.com
- Node.js install fails → script uses NVM
- SSL certificate issues → needs valid domain DNS pointing to this IP
- Firewall blocking → script configures UFW to allow ports 22, 80, 443

Please guide me through the deployment step-by-step and help troubleshoot any errors.

---

**Full context document**: See VPS_DEPLOYMENT_CONTEXT.md for complete technical details.

