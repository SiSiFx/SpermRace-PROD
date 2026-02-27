# AI Navigation - NewGameView.tsx Quick Reference

## ✅ Region Markers Added (10 Major Sections)

The file now has clear `//#region` markers for IDE folding and AI navigation:

### 1. **IMPORTS & TYPE DEFINITIONS** (Lines 1-50)
- React, PIXI, game types
- Interface definitions

### 2. **CORE GAME CLASS** (Lines 51-5850)
The main SpermRaceGame class with sub-regions:

#### 2.1 INITIALIZATION & SETUP (Lines ~444-660)
- `init()` - Main entry point
- PIXI application setup
- Canvas configuration

#### 2.2 WORLD SETUP & RENDERING (Lines ~661-1220)
- `setupWorld()` - Arena creation
- `createGrid()` - Visual grid
- `drawArenaBorder()` - Boundaries

#### 2.3 CONTROLS & INPUT SYSTEM (Lines ~1221-1710)
- `setupControls()` - Input handlers
- Keyboard, mouse, touch events

#### 2.4 ENTITY CREATION & SPAWNING (Lines ~1711-1900)
- `randomEdgeSpawn()` - Spawn points
- `buildSpawnQueue()` - Spawn logic
- `createCar()` - Entity factory

#### 2.5 BOOST & MOVEMENT MECHANICS (Lines ~1901-2490)
- `startBoost()` - Dash activation
- `tryActivatePracticeLunge()` - Impulse mechanic
- Visual boost effects

#### 2.6 GAME LOOP & MAIN UPDATE (Lines ~2491-3240)
- `gameLoop()` - 60fps tick
- Pre-start countdown
- Entity updates

#### 2.7 PHYSICS & COLLISION DETECTION (Lines ~3241-3990)
- `updateCar()` - Movement physics
- `checkArenaCollision()` - Boundaries
- `checkTrailCollisions()` - Path detection

#### 2.8 CAMERA & VISUAL RENDERING (Lines ~2051-3240)
- `updateCamera()` - Follow logic
- Dynamic zoom
- Screen shake

#### 2.9 UI & HUD SYSTEMS (Lines ~1264-2050)
- `setupRadar()` - Minimap
- `updateLeaderboard()` - Scores
- Game over screen

#### 2.10 GAME STATE MANAGEMENT (Lines ~3991-4110)
- `destroyCar()` - Entity cleanup
- `endGame()` - Victory/defeat
- `restartGame()` - Reset

#### 2.11 EFFECTS & PARTICLES (Lines ~4111-5840)
- `updateParticles()` - Particle system
- Explosion effects
- Pooling

### 3. **UTILITY FUNCTIONS** (Lines ~5851-5900)
- `normalizeAngle()` - Math helpers
- Animation injectors

### 4. **REACT COMPONENT** (Lines ~5900-5937)
- `NewGameView` - React wrapper
- WebSocket integration

---

## 🎯 How to Use These Markers

### In VS Code:
1. **Fold sections**: Click the arrows next to line numbers
2. **Navigate**: Use Outline view (Ctrl+Shift+O)
3. **Search regions**: Ctrl+F for `//#region`

### For AI Models:
- Each region header describes the purpose
- Jump directly to relevant sections
- Understand code organization at a glance

### Common Patterns:
```typescript
//#region ============================================================
// SECTION NAME
// Brief description of what's in this section
// ============================================================

// ... code ...

//#endregion
```

---

## 📊 File Statistics
- **Total Lines**: ~5937 (after markers)
- **Region Sections**: 14 major regions
- **Class Methods**: 158
- **Organization**: Single class + utilities
- **Markers Added**: ~70 marker lines

---

## 🚀 Navigation Tips

**To debug spawn issues:**  
→ Go to `ENTITY CREATION & SPAWNING` region

**To fix physics bugs:**  
→ Go to `PHYSICS & COLLISION DETECTION` region

**To modify game flow:**  
→ Go to `GAME LOOP & MAIN UPDATE` region

**To update UI:**  
→ Go to `UI & HUD SYSTEMS` region
