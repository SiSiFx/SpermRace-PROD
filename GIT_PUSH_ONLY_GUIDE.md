# Git Push-Only Backup Guide

**Repository:** https://github.com/SiSiFx/SpermRace-PROD  
**Mode:** PUSH-ONLY (Backup Safety)  
**Status:** ✅ Active

## What This Means

Your code is now safely backed up to GitHub. This is **PUSH-ONLY** mode, which means:

✅ **What it DOES:**
- Backs up your code to the cloud
- Protects against VPS crashes
- Preserves version history
- Allows disaster recovery

❌ **What it DOES NOT do:**
- Auto-deploy changes
- Affect your running server
- Pull updates automatically
- Risk breaking production

## Daily Workflow

### Normal Operations (No Changes)
**Do nothing!** Your server runs independently of GitHub.

### When You Make Changes
```bash
cd /opt/spermrace

# 1. Make your changes to source files
vim packages/server/src/index.ts

# 2. Test locally first

# 3. Commit changes
git add .
git commit -m "Description of changes"

# 4. Push backup to GitHub
git push origin master

# 5. (Optional) Deploy to production
pnpm --filter server build
pm2 restart spermrace-server-ws
```

## Emergency: Restore from Backup

If your VPS crashes and you need to restore:

```bash
# On new VPS:
cd /opt
git clone git@github.com:SiSiFx/SpermRace-PROD.git spermrace
cd spermrace

# Restore .env file (get from backups)
# Then build and start
pnpm install
pnpm --filter server build
pm2 start ecosystem.config.js
```

## Important Rules

### ✅ SAFE Operations
- `git status` - Check status
- `git log` - View history
- `git add` - Stage changes
- `git commit` - Save changes locally
- `git push` - Backup to GitHub
- `git diff` - Compare changes

### ⚠️ CAREFUL Operations
- `git pull` - Downloads from GitHub (review first!)
- `git reset --hard` - Discards local changes
- `git checkout` - Switches branches

### 🛡️ Protection Steps

Before pulling any changes:
```bash
# 1. Check what will change
git fetch
git diff HEAD origin/master

# 2. Review carefully
git log origin/master

# 3. If safe, pull
git pull

# 4. Don't restart server yet
# 5. Test build first
pnpm --filter server build

# 6. Only restart if build succeeds
pm2 restart spermrace-server-ws
```

## Current Backup Status

**Last Push:** See `git log`  
**Remote:** git@github.com:SiSiFx/SpermRace-PROD.git  
**Branch:** master  
**Commits:** 2  
**Files:** 211  

## Quick Reference

```bash
# Check status
cd /opt/spermrace && git status

# View recent changes
git log --oneline -10

# Push backup
git push origin master

# View remote
git remote -v
```

## Emergency Contacts

- **View code online:** https://github.com/SiSiFx/SpermRace-PROD
- **Restoration report:** See RESTORATION_REPORT.md
- **Server logs:** `pm2 logs spermrace-server-ws`

---
**Created:** November 10, 2025  
**Purpose:** Push-only cloud backup for disaster recovery
