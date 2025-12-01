# 🧪 SpermRace.io - Testing Guide

## 📱 Device Testing Schedule

### Phase 1: Internal Testing (Week 1)
**Goal:** Find critical bugs before any user testing

#### iOS Testing
- [ ] **iPhone 14 Pro** (notch, high-end)
  - Safari browser
  - Test: Touch controls, wallet connection, full tournament flow
  
- [ ] **iPhone SE 2020** (small screen, mid-range)
  - Safari browser  
  - Test: UI scaling, button visibility, performance

- [ ] **iPad Air** (tablet, landscape)
  - Safari browser
  - Test: Layout responsiveness, controls

#### Android Testing
- [ ] **Samsung Galaxy S21** (high-end)
  - Chrome browser
  - Test: Graphics quality, performance, wallet deep links
  
- [ ] **Google Pixel 6** (mid-range)
  - Chrome browser
  - Test: Touch responsiveness, animations

- [ ] **Samsung Galaxy A50** (low-end, common device)
  - Chrome browser
  - **Critical:** Performance under stress, 32-player games

#### Desktop Testing
- [ ] **Chrome** (Windows/Mac/Linux)
  - Keyboard controls, 4K resolution, 1080p, 720p
  
- [ ] **Firefox** (Windows/Mac)
  - Cross-browser compatibility
  
- [ ] **Safari** (Mac only)
  - WebGL rendering, wallet extensions

---

## 🔥 Load Testing

### Option 1: Artillery (Free, Simple)

**Install:**
```bash
npm install -g artillery
```

**Create test config** `load-test.yml`:
```yaml
config:
  target: "wss://spermrace.io"
  phases:
    - duration: 60
      arrivalRate: 5  # 5 new connections per second
      name: "Warm up"
    - duration: 120
      arrivalRate: 20  # 20 new connections per second
      name: "Ramp up load"
    - duration: 60
      arrivalRate: 50  # 50 new connections per second
      name: "Peak load"
  ws:
    url: "/ws"

scenarios:
  - engine: ws
    flow:
      - connect:
          url: "/ws"
      - think: 1
      - send: '{"type":"auth","publicKey":"test123"}'
      - think: 2
      - send: '{"type":"join","tier":1}'
      - think: 30
      - send: '{"type":"movement","x":100,"y":100}'
```

**Run test:**
```bash
artillery run load-test.yml
```

### Option 2: k6 (More Advanced, Free)

**Install:**
```bash
# Mac
brew install k6

# Linux
sudo apt-key adv --keyserver hkp://keyserver.ubuntu.com:80 --recv-keys C5AD17C747E3415A3642D57D77C6C491D6AC1D69
echo "deb https://dl.k6.io/deb stable main" | sudo tee /etc/apt/sources.list.d/k6.list
sudo apt-get update
sudo apt-get install k6
```

**Create test script** `load-test.js`:
```javascript
import ws from 'k6/ws';
import { check } from 'k6';

export let options = {
  stages: [
    { duration: '1m', target: 50 },  // Ramp up to 50 users
    { duration: '3m', target: 100 }, // Stay at 100 users
    { duration: '1m', target: 0 },   // Ramp down
  ],
};

export default function () {
  const url = 'wss://spermrace.io/ws';
  
  const res = ws.connect(url, function (socket) {
    socket.on('open', () => {
      console.log('Connected');
      
      // Authenticate
      socket.send(JSON.stringify({
        type: 'auth',
        publicKey: `test-${__VU}-${__ITER}`
      }));
      
      // Join game
      socket.setTimeout(() => {
        socket.send(JSON.stringify({
          type: 'join',
          tier: 1
        }));
      }, 1000);
      
      // Simulate movement for 30 seconds
      let interval = socket.setInterval(() => {
        socket.send(JSON.stringify({
          type: 'movement',
          x: Math.random() * 1000,
          y: Math.random() * 1000
        }));
      }, 100);
      
      socket.setTimeout(() => {
        socket.close();
      }, 30000);
    });
    
    socket.on('message', (msg) => {
      // Process server messages
    });
    
    socket.on('close', () => {
      console.log('Disconnected');
    });
  });
  
  check(res, { 'Connected successfully': (r) => r && r.status === 101 });
}
```

**Run test:**
```bash
k6 run load-test.js
```

### What to Monitor During Load Tests

1. **Server Metrics:**
   - CPU usage (should stay < 80%)
   - Memory usage (watch for leaks)
   - Network bandwidth
   - WebSocket connections count

2. **Client Metrics:**
   - Average FPS (should be 50-60)
   - Connection drops
   - Latency (should be < 100ms)

3. **Database:**
   - Query response times
   - Connection pool usage
   - Lock waits

---

## 🔍 Free Error Logging: Sentry Setup

### Step 1: Create Sentry Account
1. Go to https://sentry.io/signup/
2. Choose "React" as platform
3. Free tier: 5,000 errors/month

### Step 2: Install Sentry

```bash
cd /opt/spermrace/packages/client
npm install @sentry/react
```

### Step 3: Add Sentry to Your App

**Create** `packages/client/src/utils/sentry.ts`:
```typescript
import * as Sentry from "@sentry/react";

export function initSentry() {
  // Only initialize in production
  if (import.meta.env.PROD) {
    Sentry.init({
      dsn: "YOUR_SENTRY_DSN_HERE", // Get from sentry.io dashboard
      integrations: [
        new Sentry.BrowserTracing(),
        new Sentry.Replay({
          maskAllText: true,
          blockAllMedia: true,
        }),
      ],
      
      // Performance Monitoring
      tracesSampleRate: 0.1, // 10% of transactions
      
      // Session Replay
      replaysSessionSampleRate: 0.1, // 10% of sessions
      replaysOnErrorSampleRate: 1.0, // 100% of errors
      
      // Environment
      environment: import.meta.env.MODE,
      
      // Release tracking
      release: "spermrace@" + import.meta.env.VITE_APP_VERSION,
      
      // Filter out noise
      beforeSend(event, hint) {
        // Don't send events from localhost
        if (window.location.hostname === 'localhost') {
          return null;
        }
        return event;
      },
    });
  }
}
```

**Update** `packages/client/src/main.tsx`:
```typescript
import { initSentry } from './utils/sentry';

// Initialize Sentry first
initSentry();

// Rest of your app initialization...
```

**Update logger.ts to send to Sentry:**
```typescript
import * as Sentry from "@sentry/react";

export const logger = {
  error: (...args: any[]) => {
    console.error(...args);
    
    // Send to Sentry in production
    if (import.meta.env.PROD) {
      const error = args[0];
      if (error instanceof Error) {
        Sentry.captureException(error);
      } else {
        Sentry.captureMessage(String(error), 'error');
      }
    }
  },
  // ... rest
};
```

### Step 4: Add Source Maps (for better debugging)

**Update** `vite.config.ts`:
```typescript
export default defineConfig({
  build: {
    sourcemap: true, // Generate source maps
  },
  plugins: [
    // ... existing plugins
  ]
});
```

---

## 📊 Testing Checklist

### Pre-Launch Testing (1 Week Before)

#### Day 1-2: Core Functionality
- [ ] Tournament flow works on all devices
- [ ] Wallet connection (Phantom, Solflare) works
- [ ] Practice mode works without wallet
- [ ] Results screen shows correct data
- [ ] Leaderboard updates properly

#### Day 3-4: Edge Cases
- [ ] Last player standing wins
- [ ] Zone kills work correctly
- [ ] Disconnect/reconnect during game
- [ ] Multiple browser tabs
- [ ] Slow network (3G simulation)
- [ ] Battery saver mode (iOS)

#### Day 5: Performance
- [ ] Load test: 100 concurrent connections
- [ ] Load test: 32-player game
- [ ] Memory leak check (play 10 games in a row)
- [ ] FPS monitoring on low-end device

#### Day 6-7: Soft Launch
- [ ] Invite 20-50 beta testers
- [ ] Monitor Sentry for errors
- [ ] Gather feedback via Discord/Telegram
- [ ] Fix critical bugs

### Launch Day Checklist
- [ ] Sentry dashboard open
- [ ] Server monitoring active
- [ ] Database backups scheduled
- [ ] Rollback plan ready
- [ ] Social media posts scheduled
- [ ] Support channels staffed

---

## 🛠 Quick Commands

### Test Build Locally
```bash
cd /opt/spermrace
npm run build
npm run preview  # Test production build
```

### Check Bundle Size
```bash
npm run build -- --mode production
ls -lh packages/client/dist/assets/
```

### Simulate Slow Network (Chrome DevTools)
1. Open DevTools → Network tab
2. Throttling: "Slow 3G"
3. Test gameplay

### Test on Real Devices
**iOS:** Use Safari Web Inspector
**Android:** Use Chrome Remote Debugging
```bash
# Enable USB debugging on Android
# Connect device via USB
# Chrome → More Tools → Remote Devices
```

---

## 📈 Success Metrics to Track

### Day 1
- [ ] No P0 (critical) bugs
- [ ] < 5% crash rate
- [ ] Average FPS > 50

### Week 1
- [ ] 90%+ game completion rate
- [ ] < 100ms average latency
- [ ] Positive user feedback

### Month 1
- [ ] Growing daily active users
- [ ] Low refund requests
- [ ] High tournament participation

---

**Next Steps:**
1. Clean console logs (in progress)
2. Set up Sentry account
3. Schedule device testing
4. Run load test on staging
5. Soft launch to 50 users

Need help with any of these? Let me know!
