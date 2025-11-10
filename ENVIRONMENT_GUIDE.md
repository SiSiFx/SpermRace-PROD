# Environment Configuration Guide

This guide explains how to use the three separate environments: **Development**, **Demo**, and **Production**.

## 🏗️ Environment Overview

### Development Environment
- **Purpose**: Full-featured development with all debugging tools
- **Features**: All crypto features enabled with testnet, full debugging UI
- **Usage**: Local development, testing, and debugging

### Demo Environment  
- **Purpose**: Clean gameplay demo without crypto features
- **Features**: Pure slither.io-like gameplay, no wallet connections
- **Usage**: Public demos, showcasing core gameplay

### Production Environment
- **Purpose**: Live production with real money features
- **Features**: Full crypto integration, real money transactions
- **Usage**: Live production deployment

## 🚀 Running Different Environments

### Root Commands (Recommended)
```bash
# Development (default)
pnpm dev
pnpm start:dev

# Demo
pnpm demo
pnpm start:demo

# Production
pnpm prod
pnpm start:prod
```

### Individual Package Commands
```bash
# Client only
pnpm client:dev    # Development
pnpm client:demo   # Demo
pnpm client:prod   # Production

# Server only
pnpm server:dev    # Development
pnpm server:demo   # Demo
pnpm server:prod   # Production
```

## 📦 Building for Different Environments

```bash
# Build for development
pnpm build:dev

# Build for demo
pnpm build:demo

# Build for production
pnpm build:prod
```

## 🌍 Environment Files

### Client Environment Files
- `.env.development` - Development configuration
- `.env.demo` - Demo configuration  
- `.env.production` - Production configuration

### Server Environment Files
- `.env.development` - Development server configuration
- `.env.demo` - Demo server configuration
- `.env.production` - Production server configuration

## 🔧 Environment Variables

### Client Variables (VITE_ prefix)
- `VITE_SERVER_URL` - WebSocket server URL
- `VITE_API_URL` - HTTP API URL
- `VITE_ENABLE_DEBUG` - Enable debug features
- `VITE_ENABLE_REAL_MONEY` - Enable real money features
- `VITE_SHOW_WALLET_BUTTON` - Show wallet connection button
- `VITE_USE_TESTNET` - Use testnet for crypto features

### Server Variables
- `PORT` - Server port
- `NODE_ENV` - Environment mode
- `ENABLE_BOTS` - Enable bot system
- `LOG_LEVEL` - Logging level
- `ENABLE_DEBUG` - Enable debug logging

## 📋 Feature Comparison

| Feature | Development | Demo | Production |
|---------|-------------|------|------------|
| Gameplay | ✅ | ✅ | ✅ |
| Multiplayer | ✅ | ✅ | ✅ |
| Leaderboard | ✅ | ✅ | ✅ |
| Wallet Connect | ✅ (Testnet) | ❌ | ✅ (Mainnet) |
| Crypto Rewards | ✅ (Mock) | ❌ | ✅ (Real) |
| Real Money | ❌ | ❌ | ✅ |
| Debug UI | ✅ | ❌ | ❌ |
| Dev Tools | ✅ | ❌ | ❌ |
| Performance Monitor | ✅ | ❌ | ✅ |
| Bot Testing | ✅ | ❌ | ❌ |

## 🎯 URL Parameters

You can override the environment mode using URL parameters:

```
http://localhost:3000?mode=development
http://localhost:3000?mode=demo
http://localhost:3000?mode=production
```

## 🔒 Security Notes

### Development
- Uses mock wallets and testnet
- Debug information exposed
- CORS enabled for development

### Demo
- No crypto features enabled
- Clean user experience
- No sensitive data exposed

### Production
- Real money transactions
- HTTPS/WSS required
- Security features enabled
- Error logging to external services

## 🛠️ Configuration Priority

Environment detection follows this priority:

1. **URL Parameters** (highest priority)
2. **Vite Environment Variables** (VITE_APP_MODE)
3. **Node Environment** (NODE_ENV)
4. **Hostname Detection** (localhost = dev, demo.* = demo)
5. **Default** (demo for safety)

## 📝 Adding New Environment Variables

### Client Variables
1. Add to `.env.development`, `.env.demo`, `.env.production`
2. Update `src/config/env.ts` interface and implementation
3. Use with `CLIENT_ENV.YOUR_VARIABLE`

### Server Variables
1. Add to server `.env.*` files
2. Update `src/env.ts` interface and implementation
3. Use with `ENV.YOUR_VARIABLE`

## 🚨 Common Issues

### Environment Not Loading
- Check file names (`.env.development`, not `.env.dev`)
- Ensure VITE_ prefix for client variables
- Verify NODE_ENV is set correctly

### Features Not Working
- Check feature flags in environment files
- Verify URL parameters aren't overriding
- Check console logs for environment detection

### Build Issues
- Use specific build commands (`build:dev`, `build:demo`, `build:prod`)
- Check TypeScript compilation
- Verify environment file syntax

## 🔄 Switching Environments

### During Development
```bash
# Switch from dev to demo
pnpm demo

# Switch from demo to production
pnpm prod
```

### In Production
- Use proper build commands
- Set NODE_ENV environment variable
- Ensure correct .env file is present
- Configure reverse proxy for WSS/HTTPS

## 📊 Environment Logging

Each environment logs its configuration on startup:

```
🎮 skidr.io - Running in DEVELOPMENT mode
📋 Enabled features: gameplay, multiplayer, leaderboard, walletConnect, cryptoRewards, debugUI, devTools, botTesting, performanceMonitor, mockWallet, skipIntro, fastMode
```

This helps verify the correct environment is loaded.