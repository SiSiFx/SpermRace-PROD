# Memories

## Patterns

### mem-game-architecture
> **Game Architecture:**
> - Server: `packages/server/` - Node.js WebSocket server, authoritative game state
> - Client: `packages/client/src/NewGameView.tsx` - Main game file (6000+ lines), PixiJS rendering
> - Shared: `packages/shared/` - Type definitions, constants
>
> **Key Physics Values (in NewGameView.tsx):**
> - Base speed: ~200px/s
> - Drift rate: 3.0 multiplier
> - Trail expiration: 8-15 seconds
> - Arena: 4000x4000 default
>
> **Game Loop:**
> - Server runs at 60fps (setInterval)
> - Client interpolates between server updates
> - Input is sent to server, server validates and broadcasts
<!-- tags: architecture, reference | created: 2026-01-27 -->

### mem-game-feel-targets
> **Target Game Feel:**
> - Input latency: <16ms
> - Physics: Mario Kart-style drift (heavy but responsive)
> - Collisions: Pixel-perfect, no "I didn't touch that!" moments
> - Camera: Dynamic zoom based on speed, look-ahead offset
> - Feedback: Screen shake, particles, haptics on all major events
<!-- tags: game-design, targets | created: 2026-01-27 -->

## Decisions

## Fixes

### mem-fix-pixijs-v8
> **PixiJS v8 BREAKING CHANGES** (project uses v8.12.0):
> 1. `app.view` is now `app.canvas` - use `this.app.canvas` to get HTMLCanvasElement
> 2. Application constructor NO LONGER accepts options - must use `await app.init({width, height, backgroundColor, etc.})`
> 3. Graphics API changed - use `.fill()/.stroke()` instead of `beginFill()/endFill()`
> 4. ALWAYS check package.json version and search "[library] v[X] migration guide" before using any library API
> This caused "RELOAD NEEDED" runtime errors because app.view returned undefined in v8.
<!-- tags: pixijs, breaking-changes, critical | created: 2026-01-27 -->

### mem-fix-vite-typecheck
> **VITE DOES NOT TYPE-CHECK** - it only transpiles with esbuild. A passing `pnpm build` does NOT mean types are correct!
> Example bug: GameWorld constructor expected `(container: PIXI.Container, arena?)` but was called with `(arena)`. This type mismatch was NOT caught by build.
> ALWAYS run `npx tsc --noEmit` before marking tasks complete.
> This caused "addChild is not a function" runtime error because arena object has no addChild method.
<!-- tags: vite, typescript, critical | created: 2026-01-27 -->

### mem-fix-deferred-graphics
> **Defer PIXI graphics setup**: When creating classes that use PIXI containers, do NOT add children in the constructor.
> Instead: (1) Accept only data params in constructor, (2) Create a `setupGraphics(container)` method, (3) Call setupGraphics() after PIXI app and containers are initialized.
> This pattern prevents "X is not a function" errors when objects are constructed before PIXI is ready.
<!-- tags: pixi, architecture, critical | created: 2026-01-27 -->

## Context
