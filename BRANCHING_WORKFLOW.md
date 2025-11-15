# SpermRace.io - Branching & Deployment Workflow

## 🌳 Branch Strategy

```
master (production)  ← Merges from dev after testing
  ↑
dev (staging)        ← Daily development, feature branches merge here
  ↑
feature/* branches   ← Individual features/fixes
```

---

## 🚀 Deployment Flow

### Automatic Vercel Deployments:

| Branch/PR | Deployment Type | URL | When |
|-----------|----------------|-----|------|
| `master` | **Production** | https://spermrace.vercel.app | On push to master |
| `dev` | **Preview** | https://spermrace-git-dev-*.vercel.app | On push to dev |
| Any PR | **Preview** | https://spermrace-git-pr-*.vercel.app | On PR creation |
| `feature/*` | **Preview** | https://spermrace-git-feature-*.vercel.app | On push to branch |

---

## 📝 Development Workflow

### 1. **New Feature/Fix**

```bash
# Start from latest dev
git checkout dev
git pull origin dev

# Create feature branch
git checkout -b feature/hotspot-duration-fix

# Make changes, commit
git add .
git commit -m "feat: Extend hotspot duration to 10s"

# Push feature branch
git push -u origin feature/hotspot-duration-fix
```

**Result:** Vercel deploys preview at `spermrace-git-feature-hotspot-duration-fix-*.vercel.app`

---

### 2. **Merge to Dev for Testing**

```bash
# Option A: Merge locally
git checkout dev
git merge feature/hotspot-duration-fix
git push origin dev

# Option B: Create PR (recommended)
# On GitHub: Create PR from feature/hotspot-duration-fix → dev
# Review changes
# Merge PR
```

**Result:** Vercel deploys to dev preview URL for team testing

---

### 3. **Deploy to Production**

```bash
# After thorough testing on dev:
git checkout master
git pull origin master
git merge dev
git push origin master
```

**Result:** Vercel deploys to production URL

---

## 🛠️ Quick Commands

### Check Current Branch
```bash
git branch -vv
```

### See Recent Deployments
```bash
vercel list
```

### Rollback Production (if needed)
```bash
# Find previous deployment
vercel list

# Promote previous deployment to production
vercel promote <deployment-url> --prod
```

### Delete Old Feature Branch
```bash
# After merged to dev:
git branch -d feature/my-feature        # Delete local
git push origin --delete feature/my-feature  # Delete remote
```

---

## 🔥 Hotfix Process (Critical Bugs)

```bash
# Start from master
git checkout master
git pull origin master

# Create hotfix branch
git checkout -b hotfix/critical-collision-bug

# Fix and commit
git add .
git commit -m "fix: Critical collision grace period"

# Push hotfix
git push -u origin hotfix/critical-collision-bug
```

**Test on preview URL, then:**

```bash
# Merge to master immediately
git checkout master
git merge hotfix/critical-collision-bug
git push origin master

# Also merge back to dev
git checkout dev
git merge hotfix/critical-collision-bug
git push origin dev

# Delete hotfix branch
git branch -d hotfix/critical-collision-bug
git push origin --delete hotfix/critical-collision-bug
```

---

## 📊 Vercel Build Configuration

Your `vercel.json` is configured for:
- ✅ Static client deployment
- ✅ API/WebSocket proxy to external server
- ✅ Auto-build with `vercel-build` script

### Verify Build Script:
```json
// package.json
{
  "scripts": {
    "vercel-build": "pnpm --filter shared build && pnpm --filter client build"
  }
}
```

---

## 🎯 Best Practices

### ✅ DO:
- Always test on `dev` before merging to `master`
- Use descriptive branch names: `feature/`, `fix/`, `hotfix/`
- Create PRs for code review
- Delete merged feature branches
- Use semantic commit messages: `feat:`, `fix:`, `refactor:`

### ❌ DON'T:
- Don't push directly to `master` (except hotfixes)
- Don't keep stale branches
- Don't merge untested code to master
- Don't commit sensitive data (.env files)

---

## 📱 Testing Preview Deployments

After pushing any branch, check Vercel dashboard or GitHub PR for preview URL:

```bash
# Example URLs:
https://spermrace-git-dev-sisifx.vercel.app              # dev branch
https://spermrace-git-feature-xyz-sisifx.vercel.app      # feature branch
https://spermrace-pr-123-sisifx.vercel.app               # Pull request #123
```

**Test checklist for dev:**
- [ ] Game loads without black screen
- [ ] Overdrive hotspots appear at 32% and 62%
- [ ] Zone closes at ~42 seconds
- [ ] Collision grace period works (no spawn deaths)
- [ ] WebGL context recovery (switch tabs and back)

---

## 🔧 Troubleshooting

### Build Fails on Vercel

```bash
# Check locally first:
pnpm run vercel-build

# If it works locally but fails on Vercel:
# 1. Check Vercel build logs
# 2. Ensure .vercelignore is correct
# 3. Verify Node.js version matches (18+)
```

### Stale Deployment

```bash
# Force rebuild:
vercel --prod --force
```

### Wrong Branch Deployed

```bash
# Check which branch is linked:
git branch -vv

# Ensure master is production branch in Vercel dashboard:
# Settings → Git → Production Branch: master
```

---

## 📚 Related Docs

- [Vercel Git Integration](https://vercel.com/docs/concepts/git)
- [Preview Deployments](https://vercel.com/docs/concepts/deployments/preview-deployments)
- [Environment Variables](https://vercel.com/docs/concepts/projects/environment-variables)

---

## 🎮 Current Status

**Last Updated:** 2025-11-15

**Active Branches:**
- `master` - Production (commit: 5ea0dfe)
- `dev` - Staging (commit: 431d84c)

**Recent Changes:**
- ✅ Added `vercel-build` script
- ✅ Fixed zone duration (42s)
- ✅ Fixed collision grace period
- ✅ Added WebGL context recovery
