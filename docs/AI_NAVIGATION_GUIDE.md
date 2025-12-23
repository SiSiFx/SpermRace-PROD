## AI Navigation Guide for NewGameView.tsx

This document provides a structured index of the 5860-line game file for AI model navigation.

## File Structure Overview

**Total Lines:** 5860  
**Total Methods:** 158  
**Organization:** Single SpermRaceGame class with functional sections

---

## Section Index

### 1. IMPORTS & TYPE DEFINITIONS (Lines 1-45)
- React imports
- PIXI.js imports  
- Game type definitions
- Utility imports

### 2. CORE CLASS DEFINITION (Lines 46-281)
- Class fields initialization
- Game state properties
- Arena configuration
- Camera settings
- UI containers

### 3. INITIALIZATION & SETUP (Lines 282-890)
**Key Methods:**
- `constructor()` - Line 282
- `init()` - Line 434  
- `setupWorld()` - Line 646
- `createGrid()` - Line 728
- `drawArenaBorder()` - Line 783

### 4. CONTROLS & INPUT (Lines 891-1100)
**Key Methods:**
- `setupControls()` - Keyboard/mouse/touch handling
- `handleMobileBoost()` - Mobile touch controls

### 5. ENTITY CREATION (Lines 1100-1500)
**Key Methods:**
- `createCar()` - Player/bot entity creation
- `createPlayer()` - Player initialization  
- `createBot()` - AI bot creation
- `buildSpawnQueue()` - Spawn point generation

### 6. BOOST & MOVEMENT (Lines 1500-1800)
**Key Methods:**
- `startBoost()` - Boost activation
- `tryActivatePracticeLunge()` - Dash mechanic
- `createBoostEffect()` - Visual effects

### 7. GAME LOOP & UPDATES (Lines 1800-2400)
**Key Methods:**
- `gameLoop()` - Main update loop (Line ~1800)
- `updateCar()` - Physics & movement (Line ~2100)
- `updateBot()` - AI behavior (Line ~2300)

### 8. PHYSICS & COLLISION (Lines 2400-3000)
**Key Methods:**
- `checkArenaCollision()` - Boundary checks
- `check CarCollisions()` - Entity collisions  
- `checkTrailCollisions()` - Path collision detection

### 9. ZONE SYSTEM (Lines 3000-3400)
**Key Methods:**
- `setupZone()` - Battle royale zone initialization
- `updateZone()` - Shrinking zone logic
- `applyZoneDamage()` - Damage over time

### 10. CAMERA & RENDERING (Lines 3400-3800)
**Key Methods:**
- `updateCamera()` - Camera follow logic
- `updateNameplates()` - HUD positioning
- `renderDebugOverlays()` - Debug visualization

### 11. GAME STATE MANAGEMENT (Lines 3800-4200)
**Key Methods:**
- `destroyCar()` - Entity elimination  
- `endGame()` - Victory/defeat handling
- `restartGame()` - Game reset
- `updateAliveCount()` - Player tracking

### 12. UI & HUD (Lines 4200-4800)
**Key Methods:**
- `setupRadar()` - Minimap initialization
- `updateRadar()` - Radar updates
- `updateLeaderboard()` - Score display
- `showGameOverScreen()` - End screen

### 13. PICKUPS & POWER-UPS (Lines 4800-5200)
**Key Methods:**
- `spawnPickup()` - Energy orb creation
- `collect Pickup()` - Collection logic
- `updatePickups()` - Pickup updates

### 14. EFFECTS & PARTICLES (Lines 5200-5500)
**Key Methods:**
- `createExplosion()` - Death effects
- `updateParticles()` - Particle system
- `screenShake()` - Camera shake

### 15. UTILITY & HELPERS (Lines 5500-5860)
**Key Methods:**
- `normalizeAngle()` - Math utilities
- `randomEdgeSpawn()` - Spawn logic  
- `dbg()` - Debug logging
- React component wrapper

---

## Quick Reference: Critical Methods

| Method | Line | Purpose |
|--------|------|---------|
| `init()` | 434 | Game initialization entry point |
| `gameLoop()` | ~1800 | Main update tick (60fps) |
| `updateCar()` | ~2100 | Core physics engine |
| `destroyCar()` | ~3800 | Entity cleanup |
| `endGame()` | ~3900 | Game over logic |

---

## AI Agent Instructions

**When debugging:**
1. Start at the method signature you need
2. Use section numbers to understand context
3. Related methods are grouped in sections

**When modifying:**
1. Identify the section first
2. Review surrounding methods
3. Update related functionality together

**Common Tasks:**
- Physics bugs → Section 8 (Physics & Collision)
- Input issues → Section 4 (Controls & Input)  
- Visual glitches → Section 14 (Effects & Particles)
- Game flow → Section 11 (Game State Management)
