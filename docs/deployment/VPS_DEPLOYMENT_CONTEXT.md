# VPS Deployment Context - SpermRace.io

## Current Situation
- **VPS IP**: 93.180.133.94
- **VPS Location**: Turkey (ISP restrictions apply - npm/GitHub may be blocked)
- **OS**: Ubuntu Server
- **Access**: SSH as root (key-based authentication configured)
- **Project**: SpermRace.io - WebSocket-based multiplayer game on Solana blockchain

## Project Overview
This is a **PRODUCTION-READY** monorepo with:
- **Frontend**: React + PixiJS (deployed to Vercel separately)
- **Backend**: Node.js WebSocket server (to be deployed on THIS VPS)
- **Blockchain**: Solana integration for entry fees and prize payouts
- **Architecture**: Client connects to Vercel frontend → WebSocket to VPS backend

## Files Already on VPS
The project tarball should be at: `/root/spermrace-deploy.tar.gz`

If not, you need to transfer it from the Windows PC at:
```bash
# From Windows PC (run in PowerShell):
scp -i "$env:USERPROFILE\.ssh\id_ed25519_vps" "C:\Users\SISI\Documents\spermrace-deploy.tar.gz" root@93.180.133.94:/root/
```

## Deployment Script Location
Once extracted, the deployment script is at:
`/root/spermrace/scripts/vps-deploy-turkey.sh`

This script is **Turkey-optimized** with:
- NVM for Node.js installation (bypasses apt issues)
- npm mirror configuration (bypasses npm registry blocks)
- Automatic system provisioning
- PM2 process management
- Nginx configuration
- UFW firewall setup

## Step-by-Step Deployment

### 1. Extract the Project
```bash
cd /root
tar -xzf spermrace-deploy.tar.gz
cd spermrace
```

### 2. Required Environment Variables
Before running the deploy script, you need these values:

**REQUIRED:**
- `DOMAIN`: Your domain name (e.g., spermrace.io or game.example.com)
- `EMAIL`: Your email for Let's Encrypt SSL certificates
- `SOLANA_PROGRAM_ID`: Your Solana smart contract program ID
- `SOLANA_TREASURY_PUBKEY`: Treasury wallet public key for receiving fees
- `SOLANA_TREASURY_SECRET`: Treasury wallet secret key (base58) for sending prizes

**OPTIONAL (but recommended):**
- `SOLANA_RPC_ENDPOINT`: Custom Solana RPC (default: https://api.mainnet-beta.solana.com)
- `SOLANA_NETWORK`: mainnet-beta or devnet (default: mainnet-beta)
- `ALLOWED_ORIGINS`: Comma-separated allowed origins (default: https://$DOMAIN)
- `NODE_ENV`: production (default)
- `PORT`: Server port (default: 8080)

### 3. Run the Deployment Script

**Interactive Mode** (script will prompt for each value):
```bash
cd /root/spermrace
chmod +x scripts/vps-deploy-turkey.sh
./scripts/vps-deploy-turkey.sh
```

**Non-Interactive Mode** (provide all values upfront):
```bash
DOMAIN="your-domain.com" \
EMAIL="your-email@example.com" \
SOLANA_PROGRAM_ID="YourProgramID111111111111111111111111111" \
SOLANA_TREASURY_PUBKEY="YourTreasuryPublicKey1111111111111111111" \
SOLANA_TREASURY_SECRET="YourBase58SecretKey" \
SOLANA_NETWORK="mainnet-beta" \
./scripts/vps-deploy-turkey.sh
```

### 4. What the Script Does

The script will automatically:

1. **Install Node.js via NVM** (bypasses apt/snap issues in Turkey)
2. **Configure npm mirrors** (uses npmmirror.com for Turkey)
3. **Install system dependencies**: nginx, certbot, ufw, build-essential
4. **Install PM2 globally** for process management
5. **Install project dependencies**: `pnpm install --frozen-lockfile`
6. **Build all packages**: client, server, shared
7. **Create production .env** file with your variables
8. **Configure Nginx** with your domain
9. **Obtain SSL certificate** from Let's Encrypt
10. **Configure UFW firewall**: Allow 22, 80, 443
11. **Start server with PM2**: Zero-downtime process management
12. **Run health checks**: Verify server is responding

### 5. After Deployment

**Check Server Status:**
```bash
pm2 status
pm2 logs spermrace-server-ws
```

**Check Nginx:**
```bash
systemctl status nginx
curl http://localhost:8080/api/healthz
```

**Check Firewall:**
```bash
ufw status
```

**Test Endpoints:**
```bash
# Health check
curl https://your-domain.com/api/healthz

# Readiness check
curl https://your-domain.com/api/readyz

# WebSocket (should upgrade connection)
curl -i -N -H "Connection: Upgrade" -H "Upgrade: websocket" https://your-domain.com/ws
```

### 6. PM2 Management Commands

```bash
# View logs
pm2 logs spermrace-server-ws

# Restart server
pm2 restart spermrace-server-ws

# Stop server
pm2 stop spermrace-server-ws

# View detailed info
pm2 info spermrace-server-ws

# Monitor CPU/memory
pm2 monit
```

## Turkey-Specific Workarounds

### If npm registry is blocked:
The script automatically configures:
```bash
npm config set registry https://registry.npmmirror.com
```

### If GitHub is blocked:
You already have the code via tarball, so no GitHub access needed!

### If Node.js installation fails:
The script uses NVM (Node Version Manager) which downloads from nodejs.org mirrors.

## Architecture Details

### Server Stack
- **Runtime**: Node.js 20.x
- **WebSocket**: `ws` library with `perMessageDeflate` compression
- **Process Manager**: PM2 with cluster mode
- **Reverse Proxy**: Nginx with SSL/TLS termination
- **Firewall**: UFW (Uncomplicated Firewall)

### Server Features
- **Authentication**: SIWS (Sign-In with Solana) + JWT
- **Rate Limiting**: 100 req/min per IP for API, 10 conn/min for WebSocket
- **Security**: Helmet headers, CORS, origin validation
- **Observability**: JSON logging, request correlation, health endpoints
- **Resilience**: Ping/pong heartbeats, auto-reconnect, backpressure handling

### Nginx Configuration
- **Port 80**: HTTP → HTTPS redirect
- **Port 443**: HTTPS with TLS 1.2/1.3
- **Location /**: Serves static files (if any) or proxies to backend
- **Location /api/**: Proxies to Node.js server (port 8080)
- **Location /ws**: Proxies WebSocket connections with upgrade
- **Security Headers**: HSTS, CSP, X-Frame-Options, X-Content-Type-Options
- **Rate Limiting**: Applied to /api/ and /ws paths

### PM2 Configuration
- **Process Name**: spermrace-server-ws
- **Instances**: 2 (cluster mode for zero-downtime)
- **Max Memory**: 512MB per instance
- **Auto Restart**: On crash
- **Log Rotation**: 10MB max, 10 files retained
- **Startup**: Auto-start on server reboot

## Frontend Deployment (Separate - Vercel)

The frontend is deployed separately to Vercel. You'll need to configure these environment variables on Vercel:

```
VITE_WS_URL=wss://your-domain.com/ws
VITE_API_BASE=https://your-domain.com/api
VITE_SOLANA_NETWORK=mainnet-beta
VITE_SOLANA_RPC_ENDPOINT=https://api.mainnet-beta.solana.com
```

The frontend will then connect to this VPS for WebSocket gameplay.

## DNS Configuration

Point your domain to this VPS:
```
A record: your-domain.com → 93.180.133.94
```

If using subdomain:
```
A record: game.your-domain.com → 93.180.133.94
```

## Security Notes

- **Secrets**: Never commit `.env` files or expose secrets
- **Firewall**: Only ports 22, 80, 443 are open
- **SSH**: Root login with key-based authentication only
- **SSL**: Auto-renewed by certbot every 90 days
- **Rate Limiting**: Enforced at Nginx level
- **Origin Validation**: Server validates WebSocket origin headers

## Troubleshooting

### Server won't start:
```bash
# Check logs
pm2 logs spermrace-server-ws --lines 100

# Check if port 8080 is in use
netstat -tlnp | grep 8080

# Try manual start
cd /root/spermrace/packages/server
node dist/index.js
```

### Nginx errors:
```bash
# Check Nginx config
nginx -t

# Check Nginx logs
tail -f /var/log/nginx/error.log

# Reload config
systemctl reload nginx
```

### SSL certificate issues:
```bash
# Test SSL
certbot certificates

# Renew manually
certbot renew --dry-run
```

### Can't connect to server:
```bash
# Check firewall
ufw status verbose

# Check if server is listening
netstat -tlnp | grep :8080

# Test locally
curl http://localhost:8080/api/healthz
```

## Load Testing (After Deployment)

From your Windows PC, test the server:
```bash
cd C:\Users\SISI\Documents\skidr.io fork
node scripts/loadtest/ws-broadcast.js wss://your-domain.com/ws 50
```

This simulates 50 concurrent WebSocket connections with realistic gameplay.

## Monitoring

**Real-time monitoring:**
```bash
# CPU/Memory
pm2 monit

# Logs
pm2 logs --lines 50

# System resources
htop
```

**Check active connections:**
```bash
# WebSocket connections
netstat -an | grep :8080 | grep ESTABLISHED | wc -l

# Nginx connections
netstat -an | grep :443 | grep ESTABLISHED | wc -l
```

## Rollback Plan

If deployment fails, you can rollback:
```bash
# Stop server
pm2 stop spermrace-server-ws

# Revert to previous version (if you have one)
cd /root/spermrace-backup
pm2 start ecosystem.config.js

# Or restore from tarball
cd /root
rm -rf spermrace
tar -xzf spermrace-deploy-backup.tar.gz
```

## Next Steps After Successful Deployment

1. **Test the deployment**: Visit https://your-domain.com/api/healthz
2. **Deploy frontend to Vercel** with updated environment variables
3. **Test WebSocket connection** from frontend
4. **Run load tests** to verify performance
5. **Configure monitoring** (optional: Prometheus, Grafana, Uptime robot)
6. **Set up backups** (optional: automated database/config backups)

## Important Files on VPS

- **Project root**: `/root/spermrace/`
- **Server code**: `/root/spermrace/packages/server/`
- **Environment**: `/root/spermrace/packages/server/.env.production`
- **Nginx config**: `/etc/nginx/sites-enabled/spermrace`
- **SSL certs**: `/etc/letsencrypt/live/your-domain.com/`
- **PM2 config**: `/root/spermrace/ops/pm2/ecosystem.config.js`
- **Logs**: `/root/.pm2/logs/` and `/var/log/nginx/`

## Support Commands for ChatGPT

If you're using ChatGPT on the VPS, here are useful commands to run:

```bash
# Show current directory and files
pwd && ls -la

# Show system info
uname -a && df -h && free -h

# Check if tarball exists
ls -lh /root/spermrace-deploy.tar.gz

# Extract and enter project
cd /root && tar -xzf spermrace-deploy.tar.gz && cd spermrace && ls -la

# Run deployment (interactive)
./scripts/vps-deploy-turkey.sh

# Check server status
pm2 status && pm2 logs --lines 20
```

---

**This is a PRODUCTION deployment. All data must be REAL. No mock/dummy data allowed.**

Good luck with the deployment! 🚀

