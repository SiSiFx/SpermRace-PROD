# skidr.io Game Configuration Guide

This document explains how to configure all aspects of the skidr.io game using the unified configuration system.

## Overview

**All game parameters are now centralized and hardcoded in a single file:**

> **`packages/server/src/game.config.ts`**

This file is the **single source of truth** for all server, gameplay, and bot settings. There are **no environment variables** or `.env` files used—everything is managed directly in this config file.

---

## Configuration Structure

The configuration is organized into logical sections:

### 1. Server Settings (`GAME_CONFIG.server`)
- **Network settings**: Port, max players, heartbeat interval
- **Performance settings**: Tick rate, spatial partitioning, trail optimization
- **Security settings**: Input rate limiting
- **Logging**: Log level

### 2. Gameplay Mechanics (`GAME_CONFIG.gameplay`)
- **Arena**: Dimensions (width, height)
- **Spawn**: How far from center cars can spawn
- **Car physics**: Speed, turn rates, acceleration, damping
- **Drift system**: Turn rate thresholds, grip multipliers
- **Trail system**: Spacing, max points, collision radius
- **Wall physics**: Bounce damping

### 3. Bot System (`GAME_CONFIG.bots`)
- **Spawn settings**: Minimum distance, max attempts, max per request
- **AI behavior**: Update intervals, logging frequency
- **Cleanup**: Death delay for removing bot data

### 4. Feature Flags (`GAME_CONFIG.features`)
- **Development features**: Debug, performance monitoring, anti-cheat logging
- **Game features**: Bot testing, security, rate limiting, heartbeat
- **Performance modes**: Potato mode for testing

---

## Quick Configuration Examples

### Adjusting Game Speed
```typescript
// In game.config.ts
gameplay: {
  car: {
    baseSpeed: 600, // Increase from 500 to 600 for faster gameplay
  },
}
```

### Making the Game More Responsive
```typescript
// In game.config.ts
gameplay: {
  car: {
    turnAcceleration: 80, // Increase from 60 to 80 for faster turning
    turnDamping: 15,      // Increase from 12 to 15 for more responsive steering
  },
}
```

### Adjusting Trail Length
```typescript
// In game.config.ts
gameplay: {
  trail: {
    maxPoints: 50, // Increase from 35 to 50 for longer trails
  },
}
```

### Changing Arena Size
```typescript
// In game.config.ts
gameplay: {
  arena: {
    width: 5000,  // Increase from 4000 to 5000
    height: 5000, // Increase from 4000 to 5000
  },
}
```

### Adjusting Bot Behavior
```typescript
// In game.config.ts
bots: {
  ai: {
    updateInterval: 30, // Decrease from 50 to 30 for more responsive bots
  },
  spawn: {
    minDistance: 150, // Increase from 100 to 150 for safer bot spawning
  },
}
```

### Controlling Bot Logging
```typescript
// In game.config.ts
bots: {
  logging: {
    enabled: true,         // Enable/disable all bot logging
    creation: true,        // Log bot creation (every logInterval bots)
    removal: true,         // Log bot removal
    collisions: false,     // Log individual bot collisions (can be spammy)
    kills: false,          // Log individual bot kills (can be spammy)
    stats: true,           // Log bot statistics
    warnings: true,        // Log warnings (spawn issues, etc.)
  },
}
```

---

## Performance Tuning

### For High Player Counts (50+ players)
```typescript
server: {
  tickRate: 60, // Ensure 60 TPS for smooth gameplay
  enableSpatialPartitioning: true, // Enable for better collision detection
  enableTrailOptimization: true,   // Enable for better trail performance
}
```

### For Low-Performance Servers
```typescript
server: {
  tickRate: 30, // Reduce to 30 TPS to save CPU
  enableSpatialPartitioning: false, // Disable if causing issues
  enableTrailOptimization: false,   // Disable if causing issues
}
```

### Potato Mode Testing
```typescript
features: {
  potatoMode: true, // Simulates low-performance hardware
}
```

---

## Bot Testing Configuration

### Light Stress Test
```typescript
bots: {
  spawn: {
    maxPerRequest: 10, // Limit to 10 bots per request
  },
}
```

### Heavy Stress Test
```typescript
bots: {
  spawn: {
    maxPerRequest: 100, // Allow up to 100 bots per request
  },
  ai: {
    updateInterval: 20, // More frequent updates for better AI
  },
}
```

---

## Security Configuration

### Strict Anti-Cheat
```typescript
server: {
  maxInputRate: 20, // Reduce from 30 to 20 for stricter rate limiting
}
features: {
  antiCheatLogging: true, // Enable detailed cheat detection logging
}
```

### Relaxed for Development
```typescript
server: {
  maxInputRate: 60, // Increase for development testing
}
features: {
  antiCheatLogging: false, // Disable to reduce log noise
}
```

---

## Migration Note (for users coming from `.env` or environment-based config)

- **All configuration is now hardcoded in `game.config.ts`.**
- **There is no `.env`, `env.example`, or `config.ts` file.**
- If you previously used environment variables, simply set your desired values directly in `game.config.ts`.
- For secrets or deployment-specific values, you will need to edit the config file before deploying.

---

## Best Practices

1. **Start with defaults**: The default values are carefully tuned for good gameplay
2. **Test incrementally**: Make small changes and test thoroughly
3. **Monitor performance**: Use the performance monitoring features to track impact
4. **Document changes**: Keep notes of what works well for your specific use case

---

## Troubleshooting

### Game feels too fast/slow
- Adjust `gameplay.car.baseSpeed`
- Modify `server.tickRate` for overall game speed

### Controls feel unresponsive
- Increase `gameplay.car.turnAcceleration`
- Decrease `gameplay.car.turnDamping`

### Too many collisions
- Increase `gameplay.trail.hitRadius`
- Adjust `gameplay.spawn.spread`

### Performance issues
- Enable `server.enableSpatialPartitioning`
- Enable `server.enableTrailOptimization`
- Reduce `server.tickRate` if needed

### Bot issues
- Check `bots.spawn.minDistance` for spawn conflicts
- Adjust `bots.ai.updateInterval` for AI responsiveness
- Verify `features.botTesting` is enabled 