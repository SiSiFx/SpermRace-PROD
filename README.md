# 🧬 SpermRace.io

**Real-time multiplayer racing game with Solana crypto integration**

A competitive multiplayer game where players control sperm cells racing to fertilize the egg. Built with TypeScript, WebSocket, HTML5 Canvas, and Solana blockchain.

[![Production](https://img.shields.io/badge/status-production-success)]()
[![Server](https://img.shields.io/badge/server-online-success)]()
[![Solana](https://img.shields.io/badge/blockchain-solana-blueviolet)]()

🎮 **Play Now:** [https://spermrace.io](https://spermrace.io)

---

## 🎯 Features

### Game Modes
- **🏆 Tournament Mode** - Compete for real SOL prizes
  - Entry fees: 0.006 SOL (Small), 0.01 SOL (Medium), 0.05 SOL (Big)
  - Prize distribution: 85% winner, 10% platform, 5% second place
  - Solo player protection with automatic refunds
- **🎮 Practice Mode** - Free play to learn the game

### Gameplay
- **Real-time multiplayer** - Up to 32 players per lobby
- **Cross-platform** - Optimized for mobile and desktop
- **Touch controls** - Mobile-optimized joystick and boost button
- **Smooth physics** - 60 FPS server-side game loop
- **Collision detection** - Advanced spatial partitioning system

### Blockchain Integration
- **Solana wallet support** - Phantom, Solflare, Coinbase
- **Entry fee system** - Automatic payment processing
- **Prize distribution** - Instant payouts to winners
- **Refund system** - Auto-refund if lobby doesn't fill (60s countdown)
- **Transaction tracking** - View all transactions on Solscan

### User Experience
- **Player stats** - Track games played, win rate, kills, earnings
- **Mobile responsive** - Full support for portrait and landscape
- **Tutorial overlay** - Learn controls before playing
- **Orientation warning** - Guides mobile users to optimal orientation
- **Live countdown** - Visual feedback for lobby start times

---

## 🏗️ Architecture

```
spermrace/
├── packages/
│   ├── client/              # Frontend (Vite + React + Canvas)
│   │   ├── src/
│   │   │   ├── App.tsx              # PC version
│   │   │   ├── AppMobile.tsx        # Mobile version
│   │   │   ├── NewGameView.tsx      # Canvas game rendering
│   │   │   ├── WsProvider.tsx       # WebSocket connection
│   │   │   ├── WalletProvider.tsx   # Solana wallet
│   │   │   └── *.css                # Styling
│   │   └── vercel.json      # Deployment config
│   │
│   ├── server/              # Backend (Node.js + WebSocket)
│   │   ├── src/
│   │   │   ├── index.ts             # Main server & HTTP endpoints
│   │   │   ├── GameWorld.ts         # Game physics & simulation
│   │   │   ├── LobbyManager.ts      # Matchmaking & lobby logic
│   │   │   ├── CollisionSystem.ts   # Collision detection
│   │   │   ├── Player.ts            # Player entity
│   │   │   ├── SmartContractService.ts  # Solana transactions
│   │   │   └── AuthService.ts       # SIWS authentication
│   │   └── dist/            # Compiled JavaScript
│   │
│   └── shared/              # Shared types & schemas
│       └── src/
│           ├── schemas.ts   # Message schemas (Zod)
│           └── constants.ts # Game constants
│
├── .env                     # Environment variables
├── ecosystem.config.js      # PM2 configuration
└── README.md               # This file
```

---

## 🚀 Quick Start

### Prerequisites
- **Node.js** 18+ and **pnpm** 8+
- **Solana wallet** (Phantom recommended)
- **VPS** for production deployment (optional)

### Development Setup

```bash
# Clone repository
git clone git@github.com:SiSiFx/SpermRace-PROD.git spermrace
cd spermrace

# Install dependencies
pnpm install

# Build shared package
pnpm --filter shared build

# Start development
# Terminal 1: Server
pnpm --filter server dev

# Terminal 2: Client
pnpm --filter client dev

# Visit http://localhost:5173
```

### Production Deployment

**Server (VPS with PM2):**
```bash
# Build server
cd /opt/spermrace
pnpm --filter server build

# Start with PM2
pm2 start ecosystem.config.js
pm2 save

# Check status
pm2 status
pm2 logs spermrace-server-ws
```

**Client (Vercel):**
```bash
# Deploy to Vercel
cd packages/client
vercel --prod

# Or push to main branch (auto-deploy if connected)
git push origin master
```

---

## ⚙️ Configuration

### Environment Variables

Create `/opt/spermrace/.env`:

```bash
# Server
NODE_ENV=production
PORT=8080

# Solana
SOLANA_RPC_ENDPOINT=https://mainnet.helius-rpc.com/?api-key=YOUR_KEY
PRIZE_POOL_WALLET=YOUR_WALLET_ADDRESS
PRIZE_POOL_SECRET_KEY=YOUR_SECRET_KEY_BASE58

# Security
ALLOWED_ORIGINS=https://spermrace.io,https://www.spermrace.io,...

# Game Settings
SKIP_ENTRY_FEE=false
ENABLE_DEV_BOTS=false
AUTH_GRACE_MS=70000
LOBBY_MAX_WAIT=50
LOBBY_COUNTDOWN=10
```

### PM2 Configuration

See `ecosystem.config.js`:
```javascript
module.exports = {
  apps: [{
    name: 'spermrace-server-ws',
    script: './packages/server/dist/server/src/index.js',
    cwd: '/opt/spermrace',
    env_file: '/opt/spermrace/.env'
  }]
};
```

---

## 🎮 How to Play

### Tournament Mode

1. **Connect Wallet**
   - Click "Enter Tournament"
   - Select Phantom/Solflare/Coinbase
   - Approve connection

2. **Choose Tier**
   - Small: 0.006 SOL (~$0.12)
   - Medium: 0.01 SOL (~$0.20)
   - Big: 0.05 SOL (~$1.00)

3. **Pay Entry Fee**
   - Sign transaction in wallet
   - Wait for confirmation

4. **Join Lobby**
   - Wait for other players (or 60s solo timeout)
   - Game starts automatically when lobby fills

5. **Race to Win**
   - **Desktop:** Point with mouse to swim
   - **Mobile:** Use joystick to control direction
   - **Boost:** Space bar (desktop) or button (mobile)
   - Avoid obstacles and other players
   - First to reach the egg wins!

6. **Collect Prize**
   - Winner receives 85% of prize pool automatically
   - Transaction visible on Solscan

### Practice Mode

1. Click "Practice (Free)"
2. No wallet or payment required
3. Play solo to learn controls
4. No prizes awarded

---

## 🔐 Security Features

- **SIWS Authentication** - Sign-in with Solana for verified sessions
- **Rate limiting** - Prevents spam and abuse
- **Server-authoritative** - All game logic on server (anti-cheat)
- **Session tokens** - Secure WebSocket connections
- **Input validation** - All messages validated with Zod schemas
- **Refund protection** - Automatic refunds for solo lobbies

---

## 📊 API Endpoints

### HTTP Endpoints

```bash
GET  /api/healthz          # Server health check
GET  /api/prize-preflight  # Prize pool status
GET  /api/siws-challenge   # Get SIWS challenge
POST /api/siws-auth        # Authenticate with signed message
POST /api/analytics        # Track events
GET  /api/sol-price        # Current SOL price
GET  /api/metrics          # Prometheus metrics
```

### WebSocket Messages

**Client → Server:**
- `join` - Join lobby with entry fee tier
- `input` - Send player input (direction, boost)
- `leave` - Leave current lobby

**Server → Client:**
- `authenticated` - Authentication successful
- `lobbyState` - Current lobby state
- `lobbyCountdown` - Countdown to game start
- `soloPlayerWarning` - Solo player refund countdown
- `gameStarting` - Game about to begin
- `gameStateUpdate` - Real-time game state (30 FPS)
- `roundEnd` - Game ended, winner announced
- `lobbyRefund` - Entry fee refunded
- `refundFailed` - Refund failed (rare)
- `error` - Error message

---

## 🛠️ Development

### Project Structure

- **Monorepo:** pnpm workspace with 3 packages
- **TypeScript:** Strict type checking throughout
- **Shared types:** Single source of truth for client/server
- **Hot reload:** Both client and server support hot reload
- **Build:** Separate build processes for each package

### Common Commands

```bash
# Install dependencies
pnpm install

# Build all packages
pnpm -r build

# Build specific package
pnpm --filter client build
pnpm --filter server build
pnpm --filter shared build

# Development mode
pnpm --filter server dev
pnpm --filter client dev

# Type checking
pnpm --filter server tsc --noEmit
pnpm --filter client tsc --noEmit

# Lint (if configured)
pnpm --filter server lint
pnpm --filter client lint
```

### Git Workflow

```bash
# Check status
git status

# Commit changes
git add .
git commit -m "feat: description"

# Push to GitHub (backup)
git push origin master

# View history
git log --oneline -10
```

**⚠️ Important:** This repo is in **push-only mode**. Never `git pull` without reviewing changes first. See `GIT_PUSH_ONLY_GUIDE.md` for details.

---

## 📝 Troubleshooting

### Server Issues

**Server won't start:**
```bash
# Check PM2 logs
pm2 logs spermrace-server-ws

# Restart server
pm2 restart spermrace-server-ws

# Check environment
cat /opt/spermrace/.env
```

**CORS errors:**
```bash
# Verify ALLOWED_ORIGINS includes your domain
grep ALLOWED_ORIGINS /opt/spermrace/.env

# Restart after changing
pm2 restart spermrace-server-ws
```

**Prize pool not configured:**
```bash
# Check prize pool status
curl https://spermrace.io/api/prize-preflight

# Verify secret key is set
grep PRIZE_POOL_SECRET_KEY /opt/spermrace/.env
```

### Client Issues

**Wallet won't connect:**
- Clear browser cache
- Try incognito mode
- Ensure wallet extension is installed
- Check browser console for errors

**Can't join tournament:**
- Verify wallet has enough SOL
- Check network tab for failed requests
- Ensure you're on the correct network (mainnet)

**Game freezes or lags:**
- Check internet connection
- Try refreshing page
- Test practice mode first
- Check server status

---

## 📈 Monitoring

### Server Health

```bash
# Check PM2 status
pm2 status

# View logs in real-time
pm2 logs spermrace-server-ws --lines 100

# Check memory usage
pm2 monit

# Metrics endpoint
curl https://spermrace.io/api/metrics
```

### Analytics

Analytics events tracked:
- `join_requested` - Player attempts to join
- `lobby_state` - Lobby state changes
- `lobby_refund` - Refund processed
- `refund_failed` - Refund failed
- Various debug events for troubleshooting

---

## 🔄 Backup & Recovery

### Automated Backups

**Git repository:** All code backed up to GitHub
- Repository: https://github.com/SiSiFx/SpermRace-PROD
- Auto-backup on every commit
- Version history preserved

**Local backups:**
```bash
# Create backup
cd /opt/spermrace
tar -czf /root/backups/spermrace-$(date +%Y%m%d).tar.gz \
  --exclude='node_modules' \
  --exclude='dist' \
  .
```

### Disaster Recovery

If VPS crashes:
```bash
# On new VPS:
git clone git@github.com:SiSiFx/SpermRace-PROD.git /opt/spermrace
cd /opt/spermrace

# Restore .env from backup
scp backup-server:/path/to/.env .env

# Install and build
pnpm install
pnpm --filter server build

# Start
pm2 start ecosystem.config.js
pm2 save
```

See `RESTORATION_REPORT.md` for full recovery procedures.

---

## 📚 Documentation

- **RESTORATION_REPORT.md** - Complete system restoration guide
- **GIT_PUSH_ONLY_GUIDE.md** - Safe Git workflow for production
- **DEPLOYMENT-VPS.md** - VPS deployment instructions (if exists)
- **ARCHITECTURE.md** - Detailed architecture overview (if exists)

---

## 🤝 Contributing

This is a private production repository. For feature requests or bug reports:

1. Test thoroughly in practice mode first
2. Check server logs for errors
3. Document steps to reproduce
4. Contact repository owner

---

## 📄 License

Proprietary - All rights reserved

---

## 🎯 Key Metrics

- **Server uptime:** Check with `pm2 status`
- **Prize pool:** 0.000895 SOL (check /api/prize-preflight)
- **Players:** Real-time via WebSocket
- **Response time:** <100ms average

---

## 🆘 Support

**Production issues:**
- Check server logs: `pm2 logs spermrace-server-ws`
- View health: `curl https://spermrace.io/api/healthz`
- GitHub: https://github.com/SiSiFx/SpermRace-PROD

**Game support:**
- Practice mode available for testing
- No real money required for practice
- Tournament mode requires SOL for entry fees

---

**Built with ❤️ using TypeScript, Node.js, Solana, and React**

Last updated: November 10, 2025
