# SpermRace.io Production Deployment Guide

## Quick Deploy Commands

### Frontend (Vercel)
```bash
cd /opt/spermrace
vercel --prod --token "SjoCdquq5fAxnxJUYiHA9Qpw"
```

### Backend (VPS)
```bash
cd /opt/spermrace/packages/server
pnpm install && pnpm build
pm2 restart server
```

---

## Environment Variables

### Frontend (Vercel) - Build-time Variables

Set these in Vercel dashboard or via CLI:

```bash
# API & WebSocket
VITE_API_BASE=https://api.spermrace.io/api
VITE_WS_URL=wss://api.spermrace.io/ws

# Solana Configuration
VITE_SOLANA_NETWORK=mainnet-beta
VITE_SOLANA_RPC_ENDPOINT=https://api.mainnet-beta.solana.com
VITE_SOLANA_CLUSTER=mainnet

# Wallet Connect (Optional - for WalletConnect support)
VITE_WALLETCONNECT_PROJECT_ID=your_walletconnect_project_id
```

### Backend (VPS) - Runtime Variables

Set in `/opt/spermrace/.env` or via PM2 ecosystem:

```bash
# Server
PORT=8080
NODE_ENV=production
LOG_LEVEL=info

# Solana
SOLANA_RPC_ENDPOINT=https://api.mainnet-beta.solana.com

# Prize Pool (REQUIRED for tournaments)
PRIZE_POOL_WALLET=<public_key>
PRIZE_POOL_SECRET_KEY=<base58_or_json_array_secret>
PLATFORM_FEE_WALLET=<public_key>

# Security
ALLOWED_ORIGINS=https://spermrace.io,https://www.spermrace.io
SKIP_ENTRY_FEE=false
ENABLE_DEV_BOTS=false

# Rate Limiting (Optional)
SIWS_NONCE_TTL_MS=60000
AUTH_GRACE_MS=30000
WS_UNAUTH_MAX=3
```

---

## Deployment Steps

### 1. Frontend Deployment (Vercel)

```bash
# Set environment variables
vercel env add VITE_API_BASE production
vercel env add VITE_WS_URL production
vercel env add VITE_SOLANA_NETWORK production
vercel env add VITE_SOLANA_RPC_ENDPOINT production
vercel env add VITE_WALLETCONNECT_PROJECT_ID production

# Deploy
cd /opt/spermrace
vercel --prod --token "SjoCdquq5fAxnxJUYiHA9Qpw"
```

### 2. Backend Deployment (VPS)

```bash
# Create/update .env file
cat > /opt/spermrace/.env << 'EOF'
PORT=8080
NODE_ENV=production
SOLANA_RPC_ENDPOINT=https://api.mainnet-beta.solana.com
PRIZE_POOL_WALLET=<your_wallet>
PRIZE_POOL_SECRET_KEY=<your_secret>
ALLOWED_ORIGINS=https://spermrace.io,https://www.spermrace.io
SKIP_ENTRY_FEE=false
ENABLE_DEV_BOTS=false
LOG_LEVEL=info
EOF

# Build and deploy
cd /opt/spermrace/packages/server
pnpm install
pnpm build

# Start with PM2
pm2 restart server
pm2 save
```

### 3. Caddy Reverse Proxy

Ensure Caddy is configured at `/opt/spermrace/ops/caddy/Caddyfile`:

```caddyfile
api.spermrace.io {
  encode zstd gzip
  reverse_proxy 127.0.0.1:8080 {
    transport http {
      versions h2c 1.1
    }
  }
}
```

Reload Caddy:
```bash
sudo systemctl reload caddy
```

---

## Verification

### Backend Health Checks

```bash
# Health endpoint
curl https://api.spermrace.io/api/healthz
# Expected: {"ok":true}

# Readiness (checks RPC connection)
curl https://api.spermrace.io/api/readyz
# Expected: {"ok":true,"rpc":"ok"}

# Prize preflight (MUST return configured:true for tournaments)
curl https://api.spermrace.io/api/prize-preflight
# Expected: {"configured":true,"address":"<wallet>","sol":<balance>}

# WebSocket health
curl https://api.spermrace.io/api/ws-healthz
# Expected: {"ok":true,"connections":<number>}
```

### Frontend Checks

```bash
# Wallet test page
open https://spermrace.io/wallet-test.html

# Main app
open https://spermrace.io
```

**Test Wallet Connection:**
1. Visit https://spermrace.io
2. Click "Enter Tournament"
3. Select a tier
4. Wallet modal should open with multiple wallet options
5. Connect Phantom/Solflare and sign SIWS message
6. Verify lobby join

---

## Troubleshooting

### Wallet Not Opening

**Symptoms:** Wallet modal doesn't appear or hangs on "Connecting..."

**Solutions:**
1. Check browser console for errors
2. Verify HTTPS (wallets require secure origin)
3. Ensure `VITE_API_BASE` and `VITE_WS_URL` use HTTPS/WSS
4. Check CORS: `ALLOWED_ORIGINS` must include your frontend domain

### Prize Preflight Returns configured:false

**Symptoms:** `/api/prize-preflight` returns `{"configured":false}`

**Solutions:**
1. Verify `PRIZE_POOL_SECRET_KEY` is set correctly (base58 or JSON array)
2. Check RPC endpoint is accessible: `curl $SOLANA_RPC_ENDPOINT`
3. Ensure wallet has sufficient SOL balance
4. Review server logs: `pm2 logs server`

### CORS Errors

**Symptoms:** Browser console shows "blocked by CORS policy"

**Solutions:**
1. Add your domain to `ALLOWED_ORIGINS` in backend `.env`
2. Restart backend: `pm2 restart server`
3. Verify Caddy is forwarding CORS headers correctly

### WebSocket Connection Fails

**Symptoms:** "WS error" or connection immediately closes

**Solutions:**
1. Check `VITE_WS_URL` uses `wss://` protocol (not `ws://`)
2. Verify Caddy config allows WebSocket upgrades
3. Test WebSocket: `wscat -c wss://api.spermrace.io/ws`
4. Check firewall allows connections on port 8080

---

## PM2 Configuration

Example `/opt/spermrace/ops/pm2/ecosystem.config.js`:

```javascript
module.exports = {
  apps: [{
    name: 'server',
    script: './dist/index.js',
    cwd: '/opt/spermrace/packages/server',
    instances: 1,
    exec_mode: 'fork',
    env: {
      NODE_ENV: 'production',
      PORT: 8080,
    },
    env_file: '/opt/spermrace/.env',
    error_file: '/var/log/pm2/spermrace-error.log',
    out_file: '/var/log/pm2/spermrace-out.log',
    time: true,
  }]
};
```

---

## Security Checklist

- [ ] `PRIZE_POOL_SECRET_KEY` is NOT committed to git
- [ ] `ALLOWED_ORIGINS` contains ONLY production domains (no localhost)
- [ ] `SKIP_ENTRY_FEE=false` in production
- [ ] `ENABLE_DEV_BOTS=false` in production
- [ ] CSP headers are enabled (automatically via Helmet)
- [ ] Rate limiting is active (automatically configured)
- [ ] HTTPS/WSS enforced (Caddy + Vercel)
- [ ] Prize preflight returns `configured:true`

---

## Monitoring

### Server Logs
```bash
pm2 logs server --lines 100
pm2 monit
```

### Health Monitoring
Set up automated checks for:
- `https://api.spermrace.io/api/healthz` (every 1 min)
- `https://api.spermrace.io/api/readyz` (every 5 min)
- `https://api.spermrace.io/api/prize-preflight` (every 15 min)

### Metrics
- Monitor active WebSocket connections via `/api/ws-healthz`
- Track tournament completion rate
- Monitor RPC endpoint latency and errors

---

## Rollback Procedure

### Frontend Rollback
```bash
# Rollback to previous deployment
vercel rollback <deployment-url>
```

### Backend Rollback
```bash
# Revert to previous commit
cd /opt/spermrace
git log --oneline  # Find previous commit
git checkout <commit-hash>

# Rebuild and restart
cd packages/server
pnpm install && pnpm build
pm2 restart server
```

---

## Support

- **Logs:** `pm2 logs server`
- **Status:** `pm2 status`
- **Restart:** `pm2 restart server`
- **Health:** `curl https://api.spermrace.io/api/healthz`

For issues, check:
1. Server logs (`pm2 logs server`)
2. Caddy logs (`sudo journalctl -u caddy -f`)
3. Browser console (F12)
4. Network tab (check API/WS requests)
