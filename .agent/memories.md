# Memories

## Patterns

### mem-1769461846-8726
> Bio-Cyberpunk Design System
> 
> ## Core Color Palette
> - **Void Black**: #050508 (primary background)
> - **Abyssal**: #0a0a0f (secondary backgrounds)
> - **Toxic Green**: #39ff14 (primary accent - biological success)
> - **Electric Cyan**: #00ffff (primary accent - tech energy)
> - **Plasma Purple**: #bf00ff (secondary accent - mutations)
> - **Warning Amber**: #ff9500 (alerts/danger)
> - **Error Red**: #ff073a (critical failure)
> - **Lab White**: #f0f0f5 (primary text)
> - **Sterile Gray**: #8a8a95 (secondary text)
> 
> ## Design Philosophy
> 1. **Bio-Tech Fusion**: Combine organic curves with sharp tech edges
> 2. **High Contrast**: Always readable, even with glowing effects
> 3. **Living UI**: Subtle breathing animations, pulse effects
> 4. **Tactical Feel**: HUD elements should feel like combat interface
> 5. **Depth**: Layered glass effects, blurs, and shadows
> 
> ## Visual Elements
> - Scanline overlays (subtle)
> - Glass morphism with colored tints
> - Gradient borders with glow
> - Organic shapes mixed with geometric tech elements
> - Particle effects (DNA strands, cells)
> - Chromatic aberration on critical elements
<!-- tags:  | created: 2026-01-26 -->

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
