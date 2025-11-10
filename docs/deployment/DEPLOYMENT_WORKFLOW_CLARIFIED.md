# 🎯 DEPLOYMENT WORKFLOW - CLARIFIED

## Current Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    PRODUCTION SETUP                          │
└─────────────────────────────────────────────────────────────┘

Frontend (Client):
┌──────────────────┐
│  Vercel CDN      │  ← packages/client/
│  www.spermrace.io│  ← Built & deployed via Vercel
└──────────────────┘

Backend (Server):
┌──────────────────┐
│  VPS (This Box)  │  ← /opt/spermrace/packages/server/
│  api.spermrace.io│  ← PM2 process on port 8080
│  spermrace.io/ws │  ← WebSocket server
└──────────────────┘
```

---

## 📂 WHAT GOES WHERE

### **Vercel (Frontend Only):**
```
/root/packages/client/
├── src/
│   ├── App.tsx
│   ├── AppMobile.tsx              ← NEW mobile optimizations
│   ├── MobileTouchControls.tsx    ← NEW
│   ├── OrientationWarning.tsx     ← NEW
│   ├── mobile-controls.css        ← NEW
│   ├── responsive-utils.css       ← NEW
│   └── ...
├── public/
│   └── manifest.json              ← NEW PWA
├── index.html                     ← UPDATED
└── dist/  (built by Vercel)

Deployed to: www.spermrace.io
```

### **/opt/spermrace (Backend Only):**
```
/opt/spermrace/packages/server/
├── src/
│   ├── index.ts          ← Server entry
│   ├── GameWorld.ts      ← NEEDS UPDATE
│   ├── LobbyManager.ts   ← NEEDS UPDATE
│   ├── Player.ts         ← NEEDS UPDATE
│   ├── CollisionSystem.ts← NEEDS UPDATE
│   └── ...
├── dist/  (built on VPS)
│   └── server/src/index.js  ← PM2 runs this
└── .env  (production secrets)

Runs on: spermrace.io/api, spermrace.io/ws
```

---

## 🚀 CORRECT DEPLOYMENT PROCESS

### **1. MOBILE CHANGES (Client) → Vercel**

```bash
# In /root
cd /root

# Option A: Vercel CLI (from /root)
vercel --prod

# Option B: Git push (auto-deploy)
git push origin main  # If connected to Vercel
```

**What gets deployed:**
- ✅ Mobile touch controls
- ✅ Responsive UI
- ✅ PWA manifest
- ✅ All client-side changes

**Where it goes:**
- ✅ www.spermrace.io (Vercel CDN)

---

### **2. SERVER CHANGES (Backend) → VPS**

```bash
# Copy ONLY server files to /opt/spermrace
cp /root/packages/server/src/{GameWorld,LobbyManager,Player,CollisionSystem}.ts \
   /opt/spermrace/packages/server/src/

# Rebuild server
cd /opt/spermrace
pnpm run build:server

# Reload PM2
pm2 reload spermrace-server-ws
```

**What gets deployed:**
- ✅ Game physics fixes
- ✅ Lobby memory leak fixes
- ✅ Collision improvements

**Where it goes:**
- ✅ api.spermrace.io (VPS)
- ✅ spermrace.io/ws (WebSocket)

---

## ✅ CORRECTED UNDERSTANDING

**Your statement:**
> "normally i build vercel into opt/spermrace vercel prod"

**Actual workflow:**

❌ **NOT:** Vercel → /opt/spermrace
✅ **YES:**
1. **Client** → Vercel (separate deployment)
2. **Server** → /opt/spermrace (VPS)

They're **separate deployments**:

| Component | Source | Deployment | URL |
|-----------|--------|------------|-----|
| Frontend | `/root/packages/client` | Vercel | `www.spermrace.io` |
| Backend | `/opt/spermrace/packages/server` | VPS (PM2) | `api.spermrace.io` |

---

## 🎯 WHAT TO DEPLOY NOW

### **OPTION 1: Deploy Mobile Features (Vercel)**

**From /root:**
```bash
cd /root

# Deploy client to Vercel
vercel --prod

# Vercel will:
# 1. Build packages/client
# 2. Deploy to www.spermrace.io
# 3. Users get mobile optimizations
```

**Files deployed:**
- ✅ All mobile touch controls
- ✅ Responsive UI
- ✅ PWA support

---

### **OPTION 2: Deploy Server Fixes (VPS)**

**On VPS:**
```bash
# Copy server files
cp /root/packages/server/src/{GameWorld,LobbyManager,Player,CollisionSystem}.ts \
   /opt/spermrace/packages/server/src/

# Build + reload
cd /opt/spermrace
pnpm run build:server
pm2 reload spermrace-server-ws
```

**Files deployed:**
- ✅ Physics fixes
- ✅ Memory leak fixes

---

### **OPTION 3: Deploy Both (Recommended)**

```bash
# 1. Deploy client to Vercel
cd /root
vercel --prod

# 2. Deploy server to VPS
cp /root/packages/server/src/*.ts /opt/spermrace/packages/server/src/
cd /opt/spermrace
pnpm run build:server
pm2 reload spermrace-server-ws
```

---

## 📋 CHECKLIST FOR VERCEL DEPLOYMENT

Before running `vercel --prod`:

- [ ] All mobile files added to `/root/packages/client/src/`
- [ ] PWA manifest at `/root/packages/client/public/manifest.json`
- [ ] Updated `index.html` with PWA meta tags
- [ ] Test build locally: `cd /root && pnpm run build:client`
- [ ] Vercel environment variables configured:
  - `VITE_WS_URL` = `wss://spermrace.io/ws`
  - `VITE_SOLANA_NETWORK` = `mainnet-beta`
  - `VITE_API_BASE` = `https://spermrace.io/api`

---

## 🔍 VERIFY DEPLOYMENT

### **After Vercel Deploy:**
```bash
# Check live site
curl -I https://www.spermrace.io

# Test mobile features
# Open on phone: https://www.spermrace.io
```

### **After VPS Deploy:**
```bash
# Check server health
curl https://spermrace.io/api/healthz

# Check WebSocket
pm2 logs spermrace-server-ws
```

---

## ⚠️ IMPORTANT NOTES

1. **Client & Server are SEPARATE**
   - Client deploys don't affect server
   - Server deploys don't affect client

2. **Mobile files go to Vercel ONLY**
   - `/opt/spermrace` doesn't need mobile files
   - It only runs the backend server

3. **Current mobile files are ONLY in /root**
   - Not in production yet
   - Need Vercel deploy to go live

---

## 🎯 SUMMARY

**To deploy mobile optimizations:**
```bash
cd /root
vercel --prod
```

**To deploy server fixes:**
```bash
# Copy + build + reload
# (see OPTION 2 above)
```

**Both are independent!**

---

Is this clearer? Do you want to:
1. Deploy mobile to Vercel now?
2. Deploy server to VPS now?
3. Deploy both?
