# Memories

## Patterns

### mem-architecture
> **Project Structure:**
> - Client: `packages/client/src/` - Vite + React + PixiJS v8
> - Server: `packages/server/` - Node.js WebSocket
> - Shared: `packages/shared/` - Types and constants
> - Main game file: `NewGameView.tsx` (6500 lines - being refactored)
> - New modules go in: `packages/client/src/game/`
<!-- tags: architecture | created: 2026-01-27 -->

### mem-constants-done
> **Constants.ts COMPLETE:** All tunable game values extracted to `src/game/Constants.ts`
> - PLAYER: BASE_SPEED=220, BOOST_SPEED=850, drift, turning, boost params
> - BOT: Separate config with different turning/handling
> - CAMERA: Zoom levels, shake intensity, smoothing
> - JUICE: Near-miss rewards, kill bonuses, streak system
> - Helper functions: getArenaSize(), getDefaultZoom(), isMobile()
> - NewGameView.tsx updated to import and use these constants in createCar()
<!-- tags: refactor, complete | created: 2026-01-27 -->

## Fixes

### mem-fix-pixijs-v8
> **PixiJS v8 BREAKING CHANGES** (project uses v8.12.0):
> 1. `app.view` is now `app.canvas`
> 2. Application constructor NO LONGER accepts options - use `await app.init({})`
> 3. Graphics: use `.fill()/.stroke()` instead of `beginFill()/endFill()`
> ALWAYS check version and search migration guide before using any API.
<!-- tags: pixijs, critical | created: 2026-01-27 -->

### mem-fix-deferred-graphics
> **Defer PIXI graphics setup:** When creating classes that use PIXI containers:
> 1. Do NOT add children in constructor
> 2. Create a `setupGraphics(container)` method
> 3. Call setupGraphics() AFTER PIXI app is initialized
> This prevents "X is not a function" errors.
<!-- tags: pixi, critical | created: 2026-01-27 -->

### mem-fix-vite-typecheck
> **VITE DOES NOT TYPE-CHECK** - it only transpiles with esbuild.
> A passing `pnpm build` does NOT mean types are correct!
> ALWAYS run `npx tsc --noEmit` for type checking.
<!-- tags: vite, critical | created: 2026-01-27 -->

## Context

### mem-refactor-progress
> **Refactor Progress:**
> ✅ Phase 1: Constants.ts - DONE
> ⏳ Phase 2: Camera.ts - NEXT
> ⬜ Phase 3: Physics.ts
> ⬜ Phase 4: BotAI.ts
> ⬜ Phase 5: TrailSystem.ts
> ⬜ Phase 6: Effects.ts
>
> **Goal:** Reduce NewGameView.tsx from 6500 lines to ~500 lines (orchestrator only)
<!-- tags: refactor, progress | created: 2026-01-27 -->

### mem-camera-extraction-plan
> **Camera.ts Extraction Plan:**
>
> State to extract from SpermRaceGame class:
> - camera = { x, y, zoom, targetZoom, minZoom, maxZoom, shakeX, shakeY, shakeDecay }
> - cameraSmoothing
>
> Methods to extract:
> - updateCamera() - around line 2670
> - screenShake(intensity) - around line 364
> - Zoom calculations in game loop
>
> Interface:
> ```typescript
> class Camera {
>   x, y, zoom, targetZoom, shakeX, shakeY
>   update(target: {x, y}, deltaTime: number)
>   shake(intensity: number)
>   getTransform(): { x, y, scale }
> }
> ```
<!-- tags: camera, plan | created: 2026-01-27 -->
