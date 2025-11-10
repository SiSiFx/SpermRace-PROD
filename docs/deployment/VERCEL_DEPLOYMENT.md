# SpermRace.io - Vercel Frontend Deployment

## Architecture Overview
- **Backend**: VPS (93.180.133.94) - PM2 process 'spermrace-server'
- **Frontend**: Vercel (packages/client/)
- **WebSocket**: wss://your-domain.com/ws (proxied through Nginx on VPS)

---

## Quick Vercel Deployment

### Option 1: Using Vercel CLI

```bash
# Install Vercel CLI (if not installed)
npm i -g vercel

# Navigate to client package
cd "C:\Users\SISI\Documents\skidr.io fork\packages\client"

# Deploy to Vercel
vercel --prod

# Follow prompts:
# - Project name: spermrace-io
# - Framework: Vite
# - Build command: npm run build
# - Output directory: dist
```

### Option 2: Using GitHub + Vercel Dashboard

1. **Push to GitHub:**
```bash
cd "C:\Users\SISI\Documents\skidr.io fork"
git add .
git commit -m "feat: deploy spermrace.io to production"
git push origin main
```

2. **Connect to Vercel:**
- Go to https://vercel.com/new
- Import your GitHub repository
- Configure:
  - **Framework Preset**: Vite
  - **Root Directory**: `packages/client`
  - **Build Command**: `cd ../.. && pnpm install && pnpm --filter @spermrace/client build`
  - **Output Directory**: `packages/client/dist`

---

## Environment Variables for Vercel

Add these in Vercel Dashboard → Settings → Environment Variables:

```bash
# WebSocket Backend (Your VPS)
VITE_WS_URL=wss://spermrace.io/ws

# OR if using IP directly
VITE_WS_URL=ws://93.180.133.94:8080/ws

# Solana Configuration
VITE_SOLANA_RPC_ENDPOINT=https://api.mainnet-beta.solana.com

# Optional: Game Config
VITE_GAME_MODE=production
```

---

## Custom Instructions for Claude Code/Cursor

Use this custom instruction when deploying:

```
CONTEXT: SpermRace.io monorepo deployment
- Backend: Already deployed on VPS (93.180.133.94) with PM2
- Frontend: Deploy packages/client/ to Vercel
- Framework: Vite + React + TypeScript
- Shared types: @spermrace/shared (must build first)

TASKS:
1. Verify packages/client/vite.config.ts is configured for production
2. Check that packages/client/.env.production exists with correct VITE_WS_URL
3. Build packages/shared first: pnpm --filter @spermrace/shared build
4. Build packages/client: pnpm --filter @spermrace/client build
5. Deploy to Vercel: vercel --prod

IMPORTANT:
- WebSocket URL must point to VPS: wss://spermrace.io/ws or ws://93.180.133.94:8080/ws
- Ensure CORS is configured on backend to allow Vercel domain
- Test WebSocket connection after deployment
```

---

## Post-Deployment Checklist

### 1. Update Backend CORS
SSH to VPS and update server environment:

```bash
ssh root@93.180.133.94

# Edit server .env
nano /opt/spermrace/packages/server/.env

# Add Vercel URL to ALLOWED_ORIGINS
ALLOWED_ORIGINS=https://your-vercel-app.vercel.app,https://spermrace.io

# Restart PM2
pm2 restart spermrace-server
pm2 save
```

### 2. Configure Custom Domain (Optional)
In Vercel Dashboard:
- Settings → Domains → Add Domain: `spermrace.io`
- Update DNS:
  - Type: A
  - Name: @
  - Value: 76.76.21.21 (Vercel IP)

### 3. Test WebSocket Connection
Open browser console on your Vercel deployment:

```javascript
const ws = new WebSocket('wss://spermrace.io/ws');
ws.onopen = () => console.log('✅ Connected!');
ws.onerror = (e) => console.error('❌ Connection failed:', e);
```

---

## Troubleshooting

### Issue: WebSocket connection fails
**Solution:** Check Nginx configuration on VPS:

```bash
ssh root@93.180.133.94
sudo nano /etc/nginx/sites-available/spermrace

# Verify WebSocket proxy config exists:
location /ws {
    proxy_pass http://localhost:8080;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "Upgrade";
}

# Reload Nginx
sudo nginx -t && sudo systemctl reload nginx
```

### Issue: CORS errors
**Solution:** Update server ALLOWED_ORIGINS and restart:

```bash
ssh root@93.180.133.94
cd /opt/spermrace/packages/server
nano .env
# Add your Vercel URL
pm2 restart spermrace-server
```

### Issue: Build fails on Vercel
**Solution:** Ensure build commands include shared package:

```bash
# In Vercel build settings:
pnpm install && pnpm --filter @spermrace/shared build && pnpm --filter @spermrace/client build
```

---

## Quick Commands Reference

```bash
# Check backend status
ssh root@93.180.133.94 "pm2 status"

# View backend logs
ssh root@93.180.133.94 "pm2 logs spermrace-server --lines 50"

# Restart backend
ssh root@93.180.133.94 "pm2 restart spermrace-server"

# Deploy frontend to Vercel
cd "C:\Users\SISI\Documents\skidr.io fork\packages\client"
vercel --prod

# Check Nginx status
ssh root@93.180.133.94 "sudo systemctl status nginx"
```

---

## Current Deployment Status

✅ **Backend (VPS)**
- Server: 93.180.133.94
- Port: 8080
- Process: PM2 'spermrace-server'
- Status: Running

⏳ **Frontend (Vercel)**
- Action needed: Deploy packages/client/
- WebSocket: Connect to VPS backend

---

## Next Steps

1. **Deploy to Vercel** using one of the options above
2. **Update backend ALLOWED_ORIGINS** with your Vercel URL
3. **Test the game** at your Vercel URL
4. **Monitor logs** for any connection issues

**Your VPS backend is ready and waiting for frontend connections!** 🚀
