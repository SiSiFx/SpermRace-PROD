# 🔍 Sentry Setup Guide for SpermRace.io

## ✅ Step 1: Create Sentry Account (5 minutes)

1. **Go to Sentry**: https://sentry.io/signup/
2. **Sign up with**:
   - GitHub (easiest)
   - Google
   - Email

3. **Choose plan**: "Developer" (Free)
   - 5,000 errors per month
   - 50 replays per month
   - Unlimited team members

---

## ✅ Step 2: Create New Project (2 minutes)

1. **After signup, click "Create Project"**
2. **Select Platform**: Choose **"React"**
3. **Set Alert Frequency**: Choose **"Alert me on every new issue"** (for launch)
4. **Name your project**: `spermrace` or `spermrace-prod`
5. **Click "Create Project"**

---

## ✅ Step 3: Get Your DSN Key (1 minute)

After creating project, you'll see a screen with code examples.

**Look for this line:**
```javascript
Sentry.init({
  dsn: "https://abc123def456@o123456.ingest.sentry.io/7890123",
  // ...
});
```

**Copy the DSN** (the long URL string)

It looks like: `https://[KEY]@o[ORG-ID].ingest.sentry.io/[PROJECT-ID]`

---

## ✅ Step 4: Add DSN to Your Project (2 minutes)

### Option A: Using .env file (Recommended)

1. **Create `.env` file** in `/opt/spermrace/`:
```bash
cd /opt/spermrace
cp .env.example .env
```

2. **Edit `.env` file** and add your DSN:
```env
VITE_SENTRY_DSN=https://your-actual-dsn@sentry.io/your-project-id
```

3. **Restart dev server** (if running)

### Option B: Direct code (Quick test)

Edit `/opt/spermrace/packages/client/src/utils/sentry.ts`:

```typescript
dsn: "YOUR_DSN_HERE", // Replace with actual DSN
```

---

## ✅ Step 5: Test Sentry Integration (5 minutes)

### Test in Development

1. **Enable Sentry in dev mode:**
```javascript
// In browser console:
localStorage.setItem('SENTRY_ENABLED', '1');
```

2. **Trigger a test error:**
```javascript
// In browser console:
throw new Error('Sentry test error');
```

3. **Check Sentry dashboard**: Should see error appear within ~30 seconds

### Test in Production Build

```bash
cd /opt/spermrace
npm run build
npm run preview
```

Open browser, trigger an error, check Sentry.

---

## ✅ Step 6: Configure Alerts (3 minutes)

1. **Go to**: Settings → Alerts → Create New Alert
2. **Choose**: "Issues"
3. **Set conditions**:
   - When: "A new issue is created"
   - Send to: Your email
4. **Save alert**

Now you'll get emailed when errors occur!

---

## 📊 What Sentry Will Track

### Automatically Captured:
- ✅ **JavaScript errors** (unhandled exceptions)
- ✅ **Promise rejections** (async errors)
- ✅ **Network errors** (failed API calls)
- ✅ **Performance issues** (slow page loads)
- ✅ **Session replays** (video of what user did when error occurred)

### What You'll See:
- Error message
- Stack trace (line numbers, file names)
- User browser/device info
- Breadcrumbs (what user did before error)
- Session replay (optional, shows screen recording)

---

## 🎮 Sentry Features for SpermRace

### 1. Error Grouping
Similar errors grouped together:
- "WebGL context lost" → All WebGL errors grouped
- "Wallet connection failed" → All wallet errors grouped

### 2. Performance Monitoring
See how fast your game loads:
- Time to first render
- API response times
- WebSocket connection time

### 3. Session Replay (Limited in free tier)
Watch video of what user experienced when error occurred:
- See exactly what they clicked
- See their screen
- Understand the bug context

### 4. Release Tracking
Track which version has errors:
- Version 1.0.0: 5 errors
- Version 1.0.1: 2 errors (better!)

---

## 🔧 Advanced Configuration

### Track User Actions

When user connects wallet:
```typescript
import { setSentryUser } from './utils/sentry';

// After wallet connection
setSentryUser(publicKey.toString());
```

### Add Custom Context

When error occurs in game:
```typescript
import { captureError } from './utils/sentry';

try {
  // Game logic
} catch (error) {
  captureError(error, {
    gameState: 'in-progress',
    playerCount: 24,
    tier: 'mega',
  });
}
```

### Add Breadcrumbs (Debugging Trail)

Track game events:
```typescript
import { addBreadcrumb } from './utils/sentry';

// Track important game events
addBreadcrumb('Player joined tournament', { tier: 'nano' });
addBreadcrumb('Game started', { playerCount: 32 });
addBreadcrumb('Player got kill', { killCount: 5 });
```

---

## 📈 Sentry Dashboard Overview

### Issues Tab
- See all errors
- Sort by frequency
- Mark as resolved

### Performance Tab
- Page load times
- Transaction durations
- Slow operations

### Releases Tab
- Track versions
- See error rates per version
- Compare releases

### Alerts Tab
- Configure email/Slack alerts
- Set thresholds
- Create custom rules

---

## 💡 Best Practices

### DO:
- ✅ Check Sentry **daily** for first week after launch
- ✅ Mark errors as "Resolved" after fixing
- ✅ Add context to important errors
- ✅ Use breadcrumbs for complex flows

### DON'T:
- ❌ Ignore low-frequency errors (might be critical for those users)
- ❌ Send sensitive data (passwords, private keys)
- ❌ Spam Sentry with expected errors (user cancelled wallet)

---

## 🆘 Common Issues

### "No errors showing up"

1. Check DSN is correct in .env
2. Verify VITE_SENTRY_DSN in browser console:
   ```javascript
   console.log(import.meta.env.VITE_SENTRY_DSN);
   ```
3. Make sure in production mode or `SENTRY_ENABLED=1`
4. Check browser network tab for Sentry API calls

### "Too many errors"

1. Some errors are expected (user cancels wallet)
2. Add to `ignoreErrors` in `sentry.ts`:
   ```typescript
   ignoreErrors: [
     'User rejected',
     'User cancelled',
     // Add your patterns here
   ],
   ```

### "Session replays not working"

- Free tier limited to 50/month
- Only captures when errors occur
- Check quota in Sentry dashboard

---

## 💰 Free Tier Limits

**What you get free forever:**
- 5,000 errors per month
- 50 session replays per month
- Unlimited team members
- 30 days of data retention
- Unlimited projects

**If you exceed:**
- Errors stop being tracked (but app keeps working)
- Upgrade to paid plan ($26/month) for more

---

## 🚀 You're All Set!

### ✅ Integration Complete:
- Sentry SDK installed
- Error tracking active
- Logger integrated
- Configuration ready

### 🎯 Next Steps:
1. Deploy to production
2. Monitor Sentry dashboard
3. Fix any errors that appear
4. Scale as needed

---

## 📞 Need Help?

- **Sentry Docs**: https://docs.sentry.io/platforms/javascript/guides/react/
- **Sentry Discord**: https://discord.gg/sentry
- **Our Code**: Check `/packages/client/src/utils/sentry.ts`

**Your error tracking is now professional-grade!** 🎮✨
