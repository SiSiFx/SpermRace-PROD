# 🧬 SpermRace.io – Spermatozoide Battle Royale

A real-time multiplayer battle royale game where players control spermatozoa in a race to fertilize the egg. Built with TypeScript, WebSockets, and HTML5 Canvas.

## 🎮 Game Features

- **Real-time multiplayer** - Up to 100 simultaneous spermatozoa
- **Mouse-only controls** - Point-to-swim mechanics
- **Swimming trails** - Spermatozoa leave persistent trails in their wake
- **Collision detection** - Hit your own trail and you're eliminated!
- **Server-authoritative** - All game logic runs on the server
- **Spatial partitioning** - Optimized for 50+ players
- **Configurable mechanics** - Easy tuning of spermatozoide physics and gameplay
- **AI Bot System** - Built-in bot testing and stress testing capabilities
- **🎭 Demo Mode** - Complete showcase with auto-bots, fake wallet, and live stats
- **💰 Crypto Integration** - Simple wallet connection, entry fees, and winner rewards
- **🗺️ Live Minimap** - Real-time player positions and world overview
- **📊 Game Stats** - Live elimination counter, deaths, and performance tracking
- **🏆 Live Leaderboards** - Dynamic rankings with prize pool updates
- **🤖 AI Bot System** - 8 different skill level bots with varied behaviors

## 🎛️ Gameplay Configuration

All core game mechanics are easily tunable through the unified configuration system in `packages/server/src/game.config.ts`. This is the **single source of truth** for all game settings - no environment variables or .env files needed:

```typescript
export const GAME_CONFIG = {
  gameplay: {
    // Arena dimensions
    arena: {
      width: 4000,
      height: 4000,
    },

    // Spermatozoide physics
    sperm: {
      baseSpeed: 500,        // Sperm base swimming speed
      maxTurnRate: 12,       // Maximum turn rate
      turnAcceleration: 60,  // Turn acceleration
      turnDamping: 12,       // Turn damping
    },

    // Swimming and propulsion system
    propulsion: {
      turnRateThreshold: 8,  // Threshold for swimming maneuvers
      highSpeedPropulsion: 8, // High-speed propulsion
      lowSpeedPropulsion: 6,  // Low-speed propulsion
    },

    // Trail system
    trail: {
      minSpacingSquared: 16, // Minimum distance between trail points
      maxPoints: 35,         // Maximum trail points
      hitRadius: 6,          // Collision detection radius
    },
  },
};
```

**To tweak gameplay during development:**
1. Edit `packages/server/src/game.config.ts`
2. Restart the server (`pnpm dev`)
3. Test your changes immediately

**Note**: All configuration is hardcoded in `game.config.ts` for simplicity and consistency. No environment variables or .env files are used.

## 🥔 Potato Mode

Test how the game performs on low-end hardware:

- **Server-side**: Reduces tick rate from 60 to 10 TPS
- **Client-side**: Drops network updates (adjustable 0-100%)
- **Realistic simulation**: Adds artificial CPU delays

### How to Use Potato Mode

1. **Server**: Set `features.potatoMode: true` in `game.config.ts`
2. **Client**: Use the orange "🥔 Potato Mode" slider in the top-right UI
   - Toggle to enable/disable
   - Adjust intensity (0-100%) for network simulation

**Note**: The potato mode slider in the UI is the primary way to test performance.

## 🚀 Quick Start

### Development Setup

```bash
# Clone and install
git clone <repository>
cd spermrace.io
pnpm install

# Setup development environment (enables all debug features)
./setup-development.sh

# Start both server and client with one command
pnpm dev
```

### 🎭 Demo Mode

Experience the full game with auto-bots, crypto features, and live stats:

```bash
# Start demo mode with auto-bots and fake wallet
pnpm demo

# Visit: http://localhost:5173/
# or: http://localhost:3000?mode=demo
```

**Demo Features:**
- ✅ Auto-connects mock wallet with 1.0 SOL (no real money)
- ✅ Full production game logic with real-time stats
- ✅ 8 AI bots with different skill levels (easy/medium/hard/expert)
- ✅ Live minimap + crash counter overlays
- ✅ Real leaderboards and prize pool tracking
- ✅ All game features except actual SOL transactions

**Note**: The shared package (@skidr/shared) is automatically built during installation and before starting the development server. This ensures all TypeScript type definitions are available to the client and server packages.

### Quick Commands

```bash
pnpm dev          # Start development mode (full crypto + debug)
pnpm demo         # Start demo mode (auto-bots + fake wallet)
pnpm prod         # Start production mode (real crypto)
pnpm server       # Start server only
pnpm client       # Start client only
pnpm build        # Build client for production
pnpm build:shared # Build shared package only
```

### 🎮 Environment Modes

The game supports three distinct modes:

**🔧 Development Mode** (`pnpm dev`)
- Full crypto features with mock wallet
- Debug UI (F1) and dev tools
- Bot testing capabilities
- Performance monitoring

**🎭 Demo Mode** (`pnpm demo`)
- Auto-connects mock wallet with 1.0 SOL
- Full production game logic and real stats
- 8-12 AI bots fighting automatically
- Real-time leaderboards and prize pools
- No real money transactions (wallet mocked)

**🚀 Production Mode** (`pnpm prod`)
- Real wallet connections
- Real SOL transactions
- No debug features
- Optimized for performance

### Troubleshooting

If you encounter TypeScript errors related to missing modules from `@skidr/shared`, run:

```bash
pnpm build:shared
```

This builds the shared package and generates the necessary TypeScript definitions.

### Production Deployment

For the simplest, low-maintenance production setup (one VPS, one domain, unified API+WS, static SPA via Nginx), follow:

- DEPLOYMENT-VPS.md — step-by-step guide
- Unified backend on a single port (WS at /ws, API at /api)
- Nginx serves the built client from /var/www/spermrace

```bash
# Backend (PM2)
pm2 start ops/pm2/ecosystem.config.js && pm2 save

# Frontend (build locally, upload to VPS web root)
pnpm --filter client build
scp -r packages/client/dist/* USER@VPS:/var/www/spermrace/
```

## 🔧 Configuration

### Unified Configuration System

All configuration is centralized in `packages/server/src/game.config.ts`. This file contains:

- **Server settings**: Port, max players, performance options
- **Gameplay mechanics**: Car physics, arena size, trail settings
- **Bot system**: AI behavior, spawn settings, cleanup
- **Feature flags**: Debug, performance monitoring, security

**Important**: This is the single source of truth for all settings. No environment variables or .env files are used - everything is hardcoded for simplicity and consistency.

### Feature Flags

Easily toggle features by editing `game.config.ts`:

**Server-side:**
- `features.debug` - Enable debug logging
- `features.performanceMonitoring` - Show performance metrics
- `features.antiCheatLogging` - Log security events
- `features.potatoMode` - Enable potato mode
- `features.botTesting` - Enable AI bot stress testing

**Client-side:**
- Debug UI elements are controlled by server feature flags
- Performance monitoring is controlled by server settings

## 🏗️ Architecture for GIZ

This project maintains GIZ's original 3-package structure with additional infrastructure:

```
spermrace.io/
├── packages/
│   ├── shared/          # 🎯 SHARED PACKAGE (types & common code)
│   │   ├── src/
│   │   │   ├── types/   # Game types & interfaces
│   │   │   └── index.ts # Exports for client & server
│   │   └── package.json
│   │
│   ├── client/          # 🎮 CLIENT PACKAGE (game frontend)
│   │   ├── src/
│   │   │   ├── input/   # Mouse steering
│   │   │   ├── render/  # Canvas rendering
│   │   │   ├── components/ # UI components
│   │   │   └── net.ts   # WebSocket networking
│   │   └── index.html
│   │
│   ├── server/          # ⚙️ SERVER PACKAGE (game logic)
│   │   ├── src/
│   │   │   ├── game/    # Core game logic & physics
│   │   │   │   ├── sperm.ts    # Spermatozoide entity & physics
│   │   │   │   ├── world.ts    # World simulation & collision
│   │   │   │   └── collision/  # Collision detection system
│   │   │   ├── environments/   # Environment-specific setups
│   │   │   │   ├── demo/       # Demo mode (with bots)
│   │   │   │   ├── dev/        # Development mode
│   │   │   │   └── prod/       # Production mode
│   │   │   └── game.config.ts  # Unified configuration
│   │   └── package.json
│   │
│   ├── frontend/        # 🌐 INFRASTRUCTURE: Landing Page (Next.js)
│   │   └── src/pages/   # React pages & wallet integration
│   │
│   └── backend/         # 🗄️ INFRASTRUCTURE: API Backend
│       └── src/api/     # REST API & database integration
```

### 🎯 GIZ Work Areas

**Primary GIZ packages (preserve structure):**
- `packages/shared/` - Types and shared utilities
- `packages/client/` - Game client and rendering  
- `packages/server/` - Core game logic and physics

**Infrastructure packages (don't modify):**
- `packages/frontend/` - Landing page and wallet UI
- `packages/backend/` - API and database integration

### 🚀 Quick Start for GIZ

```bash
# Clone and setup
git clone <repository>
cd spermrace.io
pnpm install

# Start development (all packages)
pnpm dev

# Work on specific packages
pnpm --filter client dev    # Client only
pnpm --filter server dev    # Server only  
pnpm --filter shared build  # Build shared types
```

## 🎯 Game Mechanics

### Controls
- **Mouse**: Point where you want to swim
- **Arrow Keys**: Alternative swimming direction (fallback)

### Physics
- **Movement**: Smooth swimming acceleration/deceleration with configurable parameters
- **Trails**: Persistent swimming trails with collision detection
- **Collision**: Self-collision detection with spawn protection
- **Propulsion System**: Configurable swimming power and maneuverability

### Performance
- **Spatial Partitioning**: O(log n) collision detection for 50+ players
- **Trail Optimization**: Efficient trail point management
- **Network Optimization**: Minimal data transfer with potato mode simulation

## 🆕 Latest Updates

### New Components Added
- **🗺️ Live Minimap** (`packages/client/src/components/Minimap.ts`) - Real-time player positions overlay
- **📊 Game Stats** (`packages/client/src/components/GameStats.ts`) - Crash counter, eliminations, survival time  
- **🏆 Demo Dashboard** (`packages/frontend/src/pages/demo.tsx`) - Complete showcase with prize pools and earnings
- **🤖 Enhanced Bots** (`packages/server/src/demo/DemoController.ts`) - 8 intelligent AI opponents with varied skills

### Production Ready
- **Environment switching**: Simple config change from DEMO → PRODUCTION  
- **Smart contracts**: Ready for real SOL transactions
- **Monitoring**: Built-in performance tracking
- **Documentation**: Complete deployment guides in `PRODUCTION_DEPLOYMENT.md`

## 🔒 Security Features

- **Input validation** - All inputs validated server-side
- **Rate limiting** - Prevents spam inputs (configurable max inputs/second)
- **Session tokens** - Authenticated WebSocket connections
- **Anti-cheat logging** - Tracks suspicious behavior

## 🧪 Testing

### Performance Testing
- **FPS Throttling**: Test client performance at different framerates
- **Potato Mode**: Simulate low-end hardware and slow networks
- **Player Scaling**: Test with multiple simultaneous players

### Bot Testing
- **AI Bots**: Built-in bot system for stress testing
- **Stress Controller**: Automated stress testing scenarios
- **Debug Commands**: In-game bot management via debug UI

## 📚 Documentation

- **CONFIGURATION.md**: Detailed guide for tuning all game parameters
- **README.md**: This file - project overview and quick start
- **Code Comments**: Extensive inline documentation in source files

## 🤝 Contributing

1. Fork the repository
2. Make your changes
3. Test thoroughly with the built-in testing tools
4. Submit a pull request

## 📄 License

This project is licensed under the MIT License. 