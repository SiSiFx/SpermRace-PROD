# 🤖 Instructions for Claude (AI Assistant on VPS)

## Context

You are helping deploy **SpermRace.io**, a real-time multiplayer WebSocket game built with:
- **Frontend**: React + Vite + PixiJS (SPA)
- **Backend**: Node.js + Express + WebSocket Server + Solana integration
- **Stack**: TypeScript, pnpm monorepo, PM2, Nginx reverse proxy, Let's Encrypt TLS

This is a **PRODUCTION** deployment. The project uses **REAL Solana transactions** for entry fees and prize payouts. **NO MOCK DATA** is allowed.

---

## 🎯 Your Mission

Deploy the entire project **autonomously** on a fresh Ubuntu/Debian VPS by executing the provided script. The script handles:

1. ✅ System provisioning (Node 20, pnpm, PM2, Nginx, Certbot)
2. ✅ Code fetching (HTTP tarball from developer's PC or Git)
3. ✅ Building the monorepo (TypeScript → JavaScript, Vite → optimized bundles)
4. ✅ Nginx configuration (reverse proxy, TLS, WebSocket upgrades, security headers)
5. ✅ PM2 process management (auto-restart, clustering)
6. ✅ Health checks and verification

---

## 📦 Step 1: Download the Project

The developer is running an HTTP server on their PC. Download the project tarball:

```bash
# The developer will give you the exact URL, like:
wget http://192.168.1.100:9000/spermrace-deploy.tar.gz

# Or use curl:
curl -O http://192.168.1.100:9000/spermrace-deploy.tar.gz
```

**Expected file**: `spermrace-deploy.tar.gz` (~5-20 MB, excludes `node_modules`, `.git`, `dist`)

---

## 🚀 Step 2: Extract and Run the Deployment Script

```bash
# Extract the tarball
tar -xzf spermrace-deploy.tar.gz
cd spermrace-deploy  # or whatever the extracted directory is

# Make the deployment script executable
chmod +x scripts/vps-deploy-interactive.sh

# Run the deployment wizard
./scripts/vps-deploy-interactive.sh
```

---

## 🗣️ Step 3: Answer the Interactive Prompts

The script will ask you for:

1. **Domain name**: `game.yourdomain.com` (must point to VPS IP via DNS A record)
2. **Email**: For Let's Encrypt TLS certificate (e.g., `admin@yourdomain.com`)
3. **Code source**:
   - Option 1: HTTP tarball (you already downloaded it)
   - Option 2: Git repository (if project is on GitHub/GitLab)
4. **Solana RPC endpoint**: 
   - Mainnet: `https://api.mainnet-beta.solana.com`
   - Devnet: `https://api.devnet.solana.com`
5. **Prize Pool Wallet**: Solana public key (e.g., `7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU`)
6. **Prize Pool Secret Key**: Base58 or JSON array (ask user for this securely)
7. **Vercel Origin** (optional): If frontend is also on Vercel (e.g., `https://spermrace.vercel.app`)

**IMPORTANT**: The developer will provide these values. If not, **ASK** before proceeding.

---

## 🔍 Step 4: Monitor the Deployment

The script will:
- Install packages (Nginx, Node, PM2)
- Build the project (`pnpm install`, `pnpm build`)
- Configure Nginx with TLS
- Start the backend with PM2
- Run health checks

**Watch for**:
- ✅ Green `[OK]` messages
- ⚠️ Yellow `[WARN]` messages (may need manual fixes)
- ❌ Red `[FATAL]` messages (script will exit)

---

## ✅ Step 5: Verify Deployment

After the script completes, test these endpoints:

```bash
# Health check (should return 200 OK with uptime)
curl -I http://localhost:8080/api/healthz

# WebSocket health (should return 200 OK)
curl -I http://localhost:8080/api/ws-healthz

# Prometheus metrics
curl http://localhost:8080/api/metrics

# Prize pool preflight
curl http://localhost:8080/api/prize-preflight
```

**Expected output**:
- Health checks: `HTTP/1.1 200 OK`
- Metrics: Plain text with `# TYPE` and `# HELP` lines
- Preflight: JSON with `{ "address": "...", "lamports": ..., "sol": ..., "configured": true }`

---

## 🌐 Step 6: Test from Browser

1. Update DNS: Point `game.yourdomain.com` to VPS IP
2. Wait for DNS propagation (1-60 min)
3. Open `https://game.yourdomain.com` in browser
4. Check browser console for errors
5. Test WebSocket connection (should see `[WS] Connected` in console)
6. Try joining a game/tournament

---

## 🔧 Troubleshooting

### Nginx issues
```bash
sudo nginx -t                    # Test config syntax
sudo systemctl status nginx       # Check status
sudo journalctl -u nginx -n 50   # View logs
```

### PM2 issues
```bash
pm2 status                       # List processes
pm2 logs spermrace-server-ws     # View logs
pm2 restart spermrace-server-ws  # Restart
```

### TLS/Certbot issues
```bash
sudo certbot certificates        # List certificates
sudo certbot renew --dry-run     # Test renewal
```

### WebSocket connection fails
- Check firewall: `sudo ufw status`
- Check ALLOWED_ORIGINS in `.env`
- Check browser console for CORS errors

### Build fails
```bash
cd /opt/spermrace
pnpm install --force            # Reinstall deps
pnpm --filter @spermrace/shared build
pnpm --filter @spermrace/server build
pnpm --filter @spermrace/client build
```

---

## 📊 Post-Deployment Monitoring

```bash
# PM2 monitoring (CPU, RAM, logs)
pm2 monit

# Real-time logs
pm2 logs spermrace-server-ws --lines 100

# Nginx access logs
sudo tail -f /var/log/nginx/access.log

# Nginx error logs
sudo tail -f /var/log/nginx/error.log
```

---

## 🔄 Updating the Deployment

When the developer pushes new code:

```bash
cd /opt/spermrace

# If using Git:
git pull origin main

# If using tarball:
wget http://DEV_PC_IP:9000/spermrace-deploy.tar.gz
tar -xzf spermrace-deploy.tar.gz

# Rebuild and restart:
pnpm install
pnpm build
sudo cp -r packages/client/dist/* /var/www/spermrace/
pm2 restart spermrace-server-ws --update-env
```

---

## 🔒 Security Checklist

- ✅ Firewall enabled (UFW): Only ports 22, 80, 443, 8080 open
- ✅ TLS certificate from Let's Encrypt (auto-renews)
- ✅ HSTS header enabled (forces HTTPS)
- ✅ CSP header configured (prevents XSS)
- ✅ `.env` file with production secrets (NOT committed to Git)
- ✅ PM2 process runs as non-root user
- ✅ Nginx rate limiting configured (30 req/s for API, 10 req/s for WS)

---

## 📞 If You Get Stuck

**Ask the user for**:
1. Missing secrets (Solana keys, RPC endpoints)
2. DNS setup confirmation
3. Firewall rules on their router/cloud provider
4. Error logs from PM2 or Nginx

**Common issues**:
- **DNS not ready**: `curl https://game.yourdomain.com` fails → Wait for DNS or use IP temporarily
- **Certbot fails**: Domain must resolve to VPS IP before running Certbot
- **PM2 crashes**: Check logs with `pm2 logs spermrace-server-ws --err`
- **Wallet connection fails**: Check CSP header and `ALLOWED_ORIGINS`

---

## 🎉 Success Criteria

Deployment is successful when:
1. ✅ `https://game.yourdomain.com` loads the game UI
2. ✅ WebSocket connects (check browser DevTools Network tab)
3. ✅ Players can join lobbies and games
4. ✅ Solana transactions work (entry fees, payouts)
5. ✅ PM2 process is stable (no crashes in logs)
6. ✅ Health checks return 200 OK

---

## 🧠 Key Files to Know

- **Backend entry**: `/opt/spermrace/packages/server/src/index.ts`
- **Frontend entry**: `/opt/spermrace/packages/client/src/main.tsx`
- **Environment**: `/opt/spermrace/packages/server/.env`
- **Nginx config**: `/etc/nginx/sites-available/spermrace`
- **PM2 logs**: `~/.pm2/logs/spermrace-server-ws-*.log`
- **Web root**: `/var/www/spermrace`

---

## 🚨 Production Rules (from User Preferences)

This project is **REAL, PROFESSIONAL, PRODUCTION-READY**. You MUST:

- ❌ **NEVER** use mock/fake/dummy data
- ❌ **NEVER** use `Math.random()` for game state or prices
- ✅ **ALWAYS** use real market data (Solana blockchain)
- ✅ **ALWAYS** validate all inputs (WebSocket messages, API requests)
- ✅ **ALWAYS** log errors properly (JSON format for production)
- ✅ **TREAT** this as a system that will handle **real money** (Solana transactions)

---

**Good luck! You've got this. The script handles 99% of the work. Just answer the prompts correctly and verify each step.** 🚀









