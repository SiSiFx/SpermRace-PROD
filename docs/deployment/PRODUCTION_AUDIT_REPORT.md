# 🚨 PRODUCTION AUDIT REPORT - SpermRace.io

**Date:** October 21, 2025
**Auditor:** Claude Code
**Status:** ⚠️ **CRITICAL - PRODUCTION SYSTEM ACTIVE**

---

## 🎯 EXECUTIVE SUMMARY

**FINDING:** `/opt/spermrace` is **ACTIVELY RUNNING IN PRODUCTION** with live traffic on `spermrace.io` (mainnet).

**RECOMMENDATION:** ⛔ **DO NOT DELETE OR MODIFY `/opt/spermrace`**

---

## 📊 DIRECTORY COMPARISON

| Aspect | `/opt/spermrace` | `/root` |
|--------|------------------|---------|
| **Purpose** | 🔴 **PRODUCTION** | 🟢 **DEVELOPMENT** |
| **Status** | Live, serving traffic | Staging/development |
| **Size** | 882 MB | 2.7 GB |
| **Last Modified** | Oct 20, 2025 | Oct 21, 2025 (today) |
| **Environment** | `NODE_ENV=production` | Not configured |
| **Network** | Solana Mainnet | N/A |
| **Domain** | `spermrace.io`, `api.spermrace.io` | None |
| **Managed By** | PM2 (process manager) | Manual/dev |

---

## 🔍 PRODUCTION EVIDENCE

### **1. Running Processes**

```
PM2 Process: spermrace-server-ws
├─ PID: 2690250
├─ Uptime: 45 hours
├─ Script: /opt/spermrace/packages/server/dist/server/src/index.js
├─ Status: online
├─ Restarts: 12
└─ Port: 8080
```

**Active Node Processes:**
- `2666240` - Server instance (43h uptime)
- `2666581` - Server instance (43h uptime)
- `2667730` - Server instance (45h uptime, **LISTENING ON :8080**)
- `2690250` - PM2 managed instance (27h uptime)
- `223548` - TypeScript watch process (compiling on file changes)

### **2. Nginx Configuration**

**Domain:** `spermrace.io` + `api.spermrace.io`

```nginx
# /etc/nginx/sites-enabled/spermrace
upstream backend { server 127.0.0.1:8080; }

server {
  listen 443 ssl http2;
  server_name spermrace.io;

  location /api/ {
    proxy_pass http://backend; # → /opt/spermrace server on :8080
  }

  location /ws {
    proxy_pass http://backend; # → WebSocket connections
  }
}
```

✅ **SSL Certificate:** Active (Let's Encrypt)
✅ **HTTPS:** Enabled
✅ **HTTP/2:** Enabled

### **3. Environment Configuration**

**File:** `/opt/spermrace/.env`

```bash
NODE_ENV=production
PORT=8080
LOG_LEVEL=info

SOLANA_RPC_ENDPOINT=https://mainnet.helius-rpc.com/...  # 🔴 MAINNET!
PRIZE_POOL_WALLET=5YKciEvHaGKC6xDntXqWTp3UEkGww5bU72Z7eckxR4j9

SKIP_ENTRY_FEE=false      # Real money tournaments active
ENABLE_DEV_BOTS=false     # Production safeguard

ALLOWED_ORIGINS=https://spermrace.io,https://www.spermrace.io
```

⚠️ **This is REAL MONEY production** - Solana mainnet with actual SOL transactions!

### **4. Port Binding**

```
LISTEN 0 511 *:8080 *:* users:(("node /opt/sperm",pid=2667730,fd=19))
```

**Port 8080** is actively serving production traffic via Nginx reverse proxy.

---

## 🏗️ PRODUCTION ARCHITECTURE

```
Internet
    ↓
Nginx (:443 HTTPS)
    ↓
Reverse Proxy
    ↓
/opt/spermrace/packages/server/dist/server/src/index.js (:8080)
    ↓
Solana Mainnet (Helius RPC)
```

**Frontend:** Hosted separately (likely Vercel at `www.spermrace.io`)
**Backend:** Running from `/opt/spermrace` on this VPS
**Database:** In-memory (lobby/game state)
**Blockchain:** Solana Mainnet

---

## 📂 FILE STRUCTURE ANALYSIS

### **/opt/spermrace (PRODUCTION)**

```
/opt/spermrace/
├── packages/
│   ├── server/
│   │   ├── src/              # Source code
│   │   └── dist/             # ✅ Compiled production build
│   │       └── server/src/index.js  ← PM2 runs this
│   ├── client/               # Frontend (deployed separately)
│   └── shared/               # Shared types
├── .env                      # 🔴 PRODUCTION SECRETS
├── node_modules/             # Dependencies
└── package.json
```

**Build Status:** ✅ Production build exists (Oct 19 18:39)

### **/root (DEVELOPMENT)**

```
/root/
├── packages/               # Same structure
├── MOBILE_OPTIMIZATION_GUIDE.md  # ← New mobile work (today)
├── CLAUDE.md               # Development plan
├── .claude/                # Claude Code workspace
└── [No .env configured]    # Not production-ready
```

**Latest Changes:**
- Mobile touch controls (today)
- Responsive UI system (today)
- PWA manifest (today)

---

## ⚠️ CRITICAL WARNINGS

### **DO NOT:**

❌ Delete `/opt/spermrace`
❌ Modify files in `/opt/spermrace` directly
❌ Stop PM2 process without migration plan
❌ Change `/opt/spermrace/.env` without testing
❌ Run `rm -rf /opt/spermrace`

### **SAFE TO DO:**

✅ Continue development in `/root`
✅ Test changes locally in `/root`
✅ Create deployment scripts to sync `/root` → `/opt/spermrace`
✅ Use PM2 to restart safely after deployment
✅ Monitor production logs

---

## 🔄 DEPLOYMENT WORKFLOW (RECOMMENDED)

### **Current State:**
- `/root` = Development/staging environment
- `/opt/spermrace` = Live production

### **Proposed Workflow:**

```bash
# 1. Develop in /root
cd /root
# ... make changes, test locally ...

# 2. Build production assets
pnpm run build

# 3. Test build locally
node packages/server/dist/server/src/index.js

# 4. Deploy to production (careful!)
# Option A: Manual sync
rsync -av --exclude node_modules /root/packages/ /opt/spermrace/packages/

# Option B: Create deployment script
./scripts/deploy-to-production.sh

# 5. Restart PM2 gracefully
pm2 reload spermrace-server-ws
# OR
pm2 restart spermrace-server-ws --update-env
```

---

## 🔧 RECOMMENDED ACTIONS

### **Immediate (Today):**

1. ✅ **Do NOT touch `/opt/spermrace`** - Audit complete, production confirmed
2. ✅ **Continue dev work in `/root`** - Safe for mobile optimizations
3. ⚠️ **Create backup** of production:
   ```bash
   tar -czf /root/spermrace-prod-backup-oct21.tar.gz /opt/spermrace
   ```

### **Short-term (This Week):**

4. 📝 **Document deployment process** - How to push `/root` → `/opt/spermrace`
5. 🧪 **Set up staging environment** - Test changes before production
6. 📊 **Monitor production logs** - Ensure system is stable
   ```bash
   pm2 logs spermrace-server-ws
   ```

### **Long-term (Next Sprint):**

7. 🔄 **Create CI/CD pipeline** - Automated testing and deployment
8. 🔐 **Implement zero-downtime deployments** - Blue-green or rolling updates
9. 📈 **Set up monitoring** - Alerts for production issues

---

## 📋 PRODUCTION CHECKLIST

Before any production changes:

- [ ] Changes tested in `/root` development environment
- [ ] Build process runs without errors
- [ ] Environment variables reviewed (`.env`)
- [ ] Backup created of `/opt/spermrace`
- [ ] PM2 process will be reloaded (not restarted)
- [ ] Nginx configuration updated if needed
- [ ] SSL certificates are valid
- [ ] Database migrations run (if applicable)
- [ ] Monitoring alerts are active
- [ ] Rollback plan documented

---

## 🎯 CONCLUSION

**Status:** `/opt/spermrace` is **100% PRODUCTION** with live users and real money.

**Recommendation:**
- ✅ Keep `/opt/spermrace` **UNTOUCHED**
- ✅ Continue development in `/root`
- ✅ Create formal deployment process
- ✅ Test thoroughly before any production changes

**Risk Level:** 🔴 **HIGH** - Live mainnet transactions, real SOL, active users

**Next Steps:**
1. Continue mobile optimization work in `/root`
2. Test changes locally
3. Create deployment script when ready
4. Deploy during low-traffic window
5. Monitor production closely after deployment

---

## 📞 EMERGENCY CONTACTS

**Production Server:**
- Host: This VPS
- Domain: `spermrace.io`, `api.spermrace.io`
- Port: 8080 (internal), 443 (external)
- Process Manager: PM2
- Logs: `/root/.pm2/logs/spermrace-server-ws-*.log`

**Rollback Procedure:**
```bash
# If deployment breaks production:
pm2 stop spermrace-server-ws
cd /opt/spermrace
git checkout HEAD~1  # If using git
# OR
# Restore from backup
pm2 start spermrace-server-ws
```

---

**Report Generated:** October 21, 2025 17:32 UTC
**Audit Status:** ✅ Complete
**Action Required:** None (informational only)
