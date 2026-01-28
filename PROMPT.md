# SpermRace.io - Incremental Refactoring Mission

**Role:** You are a senior engineer doing a careful, incremental refactor of a 6000-line monolith.

## THE PROBLEM

`packages/client/src/NewGameView.tsx` is 6500 lines - too big to maintain.
We need to extract it into clean modules WITHOUT breaking the game.

## THE GOLDEN RULE

**ONE MODULE AT A TIME. TEST. COMMIT. REPEAT.**

Do NOT:
- Refactor multiple things at once
- Delete code before the replacement works
- Skip testing in browser
- Assume the build passing means it works

DO:
- Extract ONE module
- Keep the old code working
- Test the build: `cd packages/client && pnpm build`
- Test in browser: actually play the game
- Commit only when verified working

## WHAT'S ALREADY DONE

✅ `src/game/Constants.ts` - All tunable values extracted (PLAYER, BOT, CAMERA, JUICE, etc.)

## NEXT MODULES TO EXTRACT (in order)

### 1. Camera.ts (~150 lines)
Extract from NewGameView.tsx:
- Camera state (x, y, zoom, shake)
- `updateCamera()` method
- `screenShake()` method
- Zoom calculations

### 2. Physics.ts (~200 lines)
Extract:
- `updateCar()` physics
- Drift calculations
- Speed/acceleration
- Collision response

### 3. BotAI.ts (~150 lines)
Extract:
- Bot decision making
- Target selection
- Difficulty scaling

### 4. TrailSystem.ts (~300 lines)
Extract:
- Trail point management
- Trail collision detection
- Trail rendering

### 5. Effects.ts (~200 lines)
Extract:
- Particle system
- Explosions
- Visual feedback

## HOW TO EXTRACT A MODULE

1. **Read the existing code** - Find all related functions/state in NewGameView.tsx
2. **Create the new file** - Copy the code to `src/game/ModuleName.ts`
3. **Export a class or functions** - Keep the same interface
4. **Update NewGameView.tsx** - Import and use the new module
5. **Test build** - `cd packages/client && pnpm build`
6. **Test browser** - Actually run the game, check nothing broke
7. **Commit** - Only if everything works

## CRITICAL RULES

1. **PixiJS v8 API:**
   - Use `app.canvas` (NOT `app.view`)
   - Use `await app.init({})` (NOT constructor options)
   - Use `.fill()/.stroke()` (NOT beginFill/endFill)

2. **Deferred Graphics:**
   - Don't add PIXI children in constructors
   - Create `setupGraphics(container)` method
   - Call it after PIXI app is initialized

3. **Testing:**
   - Build must pass: `pnpm build`
   - Game must work in browser
   - No console errors

## COMPLETION

After successfully extracting ONE module and verifying it works:
- Commit with message: `refactor: extract ModuleName.ts from NewGameView`
- Emit `REFACTOR_PHASE_COMPLETE`

The next iteration will extract the next module.
