# SpermRace.io - NewGameView Refactor v7.0

**Goal:** Split 6,447-line `NewGameView.tsx` into modular architecture.
**Agents:** 6 parallel + 1 final | **Base:** dev branch

---

# STRATEGY

1. **6 agents** (not 12) - less coordination, more ownership
2. **NEW orchestrator file** - create `SpermRaceGame.ts`, don't touch `NewGameView.tsx`
3. **Keep old code working** - fallback if new code has issues
4. **Verification** - each agent tests their module works

---

# PHASE 1: CREATE MODULES (6 Agents Parallel)

## TASK 1: Core Types & Engine Setup

**Creates:** `game/types.ts`, `game/index.ts`

### game/types.ts
```typescript
import * as PIXI from 'pixi.js';

export interface Car {
  id: string;
  x: number;
  y: number;
  angle: number;
  targetAngle: number;
  speed: number;
  baseSpeed: number;
  boostSpeed: number;
  targetSpeed: number;
  speedTransitionRate: number;
  driftFactor: number;
  maxDriftFactor: number;
  vx: number;
  vy: number;
  color: number;
  type: string;
  name: string;
  kills: number;
  destroyed: boolean;
  respawnTimer: number;
  isBoosting: boolean;
  boostTimer: number;
  boostCooldown: number;
  boostEnergy: number;
  maxBoostEnergy: number;
  boostRegenRate: number;
  boostConsumptionRate: number;
  minBoostEnergy: number;
  trailPoints: TrailPoint[];
  trailGraphics: PIXI.Graphics | null;
  lastTrailTime: number;
  turnTimer: number;
  boostAITimer: number;
  currentTrailId: string | null;
  sprite: PIXI.Container;
  headGraphics?: PIXI.Graphics;
  tailGraphics?: PIXI.Graphics | null;
  tailWaveT?: number;
  nameplate?: HTMLDivElement;
  outZoneTime?: number;
  turnResponsiveness?: number;
  accelerationScalar?: number;
  hotspotBuffExpiresAt?: number;
  spotlightUntil?: number;
  killBoostUntil?: number;
}

export interface TrailPoint {
  x: number;
  y: number;
  time: number;
  isBoosting: boolean;
  expiresAt?: number;
}

export interface Trail {
  carId: string;
  car: Car;
  points: TrailPoint[];
  graphics: PIXI.Graphics;
}

export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  color: number;
  graphics: PIXI.Graphics;
}

export interface Pickup {
  x: number;
  y: number;
  radius: number;
  type: 'energy' | 'overdrive';
  amount: number;
  graphics: PIXI.Container;
  shape: PIXI.Graphics;
  aura: PIXI.Graphics;
  pulseT: number;
  rotationSpeed: number;
  color: number;
  expiresAt?: number;
}

export interface BoostPad {
  x: number;
  y: number;
  radius: number;
  cooldownMs: number;
  lastTriggeredAt: number;
  graphics: PIXI.Graphics;
}

export interface RadarPing {
  x: number;
  y: number;
  timestamp: number;
  playerId: string;
  kind?: 'sweep' | 'echo' | 'bounty';
  ttlMs?: number;
}

export interface ArenaBounds {
  width: number;
  height: number;
}

export interface InputState {
  targetX: number;
  targetY: number;
  accelerate: boolean;
  boost: boolean;
}

export interface ZoneBounds {
  left: number;
  right: number;
  top: number;
  bottom: number;
}
```

### game/index.ts
```typescript
export * from './types';
export { Physics } from './Physics';
export { InputHandler } from './InputHandler';
export { Camera } from './Camera';
export { TrailSystem } from './TrailSystem';
export { GameWorld } from './GameWorld';
export { UISystem } from './UISystem';
```

### Verification:
```bash
cd packages/client && npx tsc --noEmit src/game/types.ts
```

---

## TASK 2: Physics + Input

**Creates:** `game/Physics.ts`, `game/InputHandler.ts`

### game/Physics.ts
```typescript
import { Car, InputState, BoostPad } from './types';

// Normalize angle to [-PI, PI]
function normalizeAngle(a: number): number {
  while (a > Math.PI) a -= 2 * Math.PI;
  while (a < -Math.PI) a += 2 * Math.PI;
  return a;
}

export class Physics {
  updateCar(car: Car, deltaTime: number, boostPads: BoostPad[]): void {
    if (car.destroyed) return;
    const now = Date.now();

    // Hotspot buff check
    if (car.hotspotBuffExpiresAt && car.hotspotBuffExpiresAt <= now) {
      car.hotspotBuffExpiresAt = undefined;
    }
    const buffActive = !!(car.hotspotBuffExpiresAt && car.hotspotBuffExpiresAt > now);

    // Boost energy management
    if (car.isBoosting) {
      car.boostEnergy -= car.boostConsumptionRate * deltaTime;
      car.targetSpeed = car.boostSpeed;
      if (buffActive) car.targetSpeed *= 1.08;
      car.driftFactor = Math.min(car.maxDriftFactor, car.driftFactor + deltaTime * 2.0);
      if (car.boostEnergy <= 0) {
        car.boostEnergy = 0;
        car.isBoosting = false;
        car.targetSpeed = car.baseSpeed;
      }
    } else {
      car.boostEnergy += car.boostRegenRate * deltaTime;
      if (car.boostEnergy > car.maxBoostEnergy) car.boostEnergy = car.maxBoostEnergy;
      if (car.killBoostUntil && now < car.killBoostUntil) {
        car.targetSpeed = car.boostSpeed * 0.8;
      } else {
        car.targetSpeed = car.baseSpeed;
        if (buffActive) car.targetSpeed *= 1.05;
      }
      car.driftFactor = Math.max(0, car.driftFactor - deltaTime * 1.5);
    }

    // Boost pad check
    for (const pad of boostPads) {
      const dx = car.x - pad.x, dy = car.y - pad.y;
      const distSq = dx * dx + dy * dy;
      if (distSq <= pad.radius * pad.radius && (now - pad.lastTriggeredAt) >= pad.cooldownMs) {
        pad.lastTriggeredAt = now;
        car.boostEnergy = Math.min(car.maxBoostEnergy, car.boostEnergy + 20);
        car.isBoosting = true;
        car.targetSpeed = car.boostSpeed * 1.05;
      }
    }

    // Speed interpolation
    const speedDiff = car.targetSpeed - car.speed;
    car.speed += speedDiff * (car.accelerationScalar ?? car.speedTransitionRate) * deltaTime;

    // Angle interpolation
    const angleDiff = normalizeAngle(car.targetAngle - car.angle);
    const turnRate = car.turnResponsiveness ?? 7.0;
    car.angle += angleDiff * Math.min(1.0, turnRate * deltaTime);

    // Velocity calculation with drift
    const forwardX = Math.cos(car.angle);
    const forwardY = Math.sin(car.angle);
    const driftAngle = car.angle + Math.PI / 2;
    const driftIntensity = car.driftFactor * car.speed * 0.4 * Math.abs(angleDiff);
    car.vx = forwardX * car.speed + Math.cos(driftAngle) * driftIntensity;
    car.vy = forwardY * car.speed + Math.sin(driftAngle) * driftIntensity;

    // Position update
    car.x += car.vx * deltaTime;
    car.y += car.vy * deltaTime;

    // Sprite sync
    car.sprite.x = car.x;
    car.sprite.y = car.y;
    car.sprite.rotation = car.angle;
  }

  updateBot(car: Car, deltaTime: number, boostPads: BoostPad[]): void {
    if (car.destroyed) return;

    // Random direction changes
    car.turnTimer -= deltaTime;
    if (car.turnTimer <= 0) {
      car.targetAngle += (Math.random() - 0.5) * Math.PI * 0.5;
      car.turnTimer = 1.0 + Math.random() * 2.0;
    }

    // Random boost
    car.boostAITimer -= deltaTime;
    if (car.boostAITimer <= 0) {
      if (!car.isBoosting && car.boostEnergy >= car.minBoostEnergy && Math.random() < 0.3) {
        car.isBoosting = true;
        car.targetSpeed = car.boostSpeed;
        car.boostAITimer = 2.0 + Math.random() * 3.0;
      } else if (car.isBoosting && (car.boostEnergy < 10 || Math.random() < 0.4)) {
        car.isBoosting = false;
        car.targetSpeed = car.baseSpeed;
        car.boostAITimer = 1.0 + Math.random() * 2.0;
      } else {
        car.boostAITimer = 0.5;
      }
    }

    this.updateCar(car, deltaTime, boostPads);
  }
}
```

### game/InputHandler.ts
```typescript
import { InputState } from './types';

export class InputHandler {
  private keys: Record<string, boolean> = {};
  private mouse = { x: 0, y: 0 };
  private touch = { active: false, x: 0, y: 0 };
  private cleanupFns: (() => void)[] = [];

  setup(canvas: HTMLCanvasElement): void {
    const onKeyDown = (e: KeyboardEvent) => { this.keys[e.key.toLowerCase()] = true; };
    const onKeyUp = (e: KeyboardEvent) => { this.keys[e.key.toLowerCase()] = false; };
    const onMouseMove = (e: MouseEvent) => { this.mouse.x = e.clientX; this.mouse.y = e.clientY; };
    const onTouchStart = (e: TouchEvent) => {
      if (e.touches.length > 0) {
        this.touch.active = true;
        this.touch.x = e.touches[0].clientX;
        this.touch.y = e.touches[0].clientY;
      }
    };
    const onTouchMove = (e: TouchEvent) => {
      if (e.touches.length > 0) {
        this.touch.x = e.touches[0].clientX;
        this.touch.y = e.touches[0].clientY;
      }
    };
    const onTouchEnd = () => { this.touch.active = false; };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    canvas.addEventListener('mousemove', onMouseMove);
    canvas.addEventListener('touchstart', onTouchStart, { passive: true });
    canvas.addEventListener('touchmove', onTouchMove, { passive: true });
    canvas.addEventListener('touchend', onTouchEnd);

    this.cleanupFns.push(
      () => window.removeEventListener('keydown', onKeyDown),
      () => window.removeEventListener('keyup', onKeyUp),
      () => canvas.removeEventListener('mousemove', onMouseMove),
      () => canvas.removeEventListener('touchstart', onTouchStart),
      () => canvas.removeEventListener('touchmove', onTouchMove),
      () => canvas.removeEventListener('touchend', onTouchEnd)
    );
  }

  getInput(playerX: number, playerY: number, cameraX: number, cameraY: number, zoom: number, screenW: number, screenH: number): InputState {
    let targetX = playerX;
    let targetY = playerY;

    if (this.touch.active) {
      targetX = (this.touch.x - screenW / 2 - cameraX) / zoom;
      targetY = (this.touch.y - screenH / 2 - cameraY) / zoom;
    } else {
      targetX = (this.mouse.x - screenW / 2 - cameraX) / zoom;
      targetY = (this.mouse.y - screenH / 2 - cameraY) / zoom;
    }

    return {
      targetX,
      targetY,
      accelerate: this.keys['w'] || this.keys['arrowup'] || this.touch.active,
      boost: this.keys[' '] || this.keys['shift']
    };
  }

  destroy(): void {
    this.cleanupFns.forEach(fn => fn());
    this.cleanupFns = [];
  }
}
```

### Verification:
```bash
cd packages/client && npx tsc --noEmit src/game/Physics.ts src/game/InputHandler.ts
```

---

## TASK 3: Camera + Effects

**Creates:** `game/Camera.ts`, `game/Effects.ts`

### game/Camera.ts
```typescript
import * as PIXI from 'pixi.js';

export class Camera {
  x = 0;
  y = 0;
  zoom = 0.55;
  targetZoom = 0.55;
  shakeX = 0;
  shakeY = 0;
  private shakeDecay = 0.85;
  private smoothing = 0.10;

  update(
    target: { x: number; y: number; speed?: number } | null,
    worldContainer: PIXI.Container,
    screenWidth: number,
    screenHeight: number
  ): void {
    if (target) {
      // Speed-based zoom
      const speed = target.speed || 200;
      this.targetZoom = 0.8 - (speed / 1000);
      this.targetZoom = Math.max(0.4, Math.min(0.8, this.targetZoom));

      // Smooth zoom
      this.zoom += (this.targetZoom - this.zoom) * 0.05;

      // Camera follow
      const targetCamX = -target.x * this.zoom;
      const targetCamY = -target.y * this.zoom;
      this.x += (targetCamX - this.x) * this.smoothing;
      this.y += (targetCamY - this.y) * this.smoothing;
    }

    // Apply shake
    const finalX = this.x + this.shakeX;
    const finalY = this.y + this.shakeY;
    this.shakeX *= this.shakeDecay;
    this.shakeY *= this.shakeDecay;

    // Update world container
    worldContainer.x = screenWidth / 2 + finalX;
    worldContainer.y = screenHeight / 2 + finalY;
    worldContainer.scale.set(this.zoom);
  }

  shake(intensity: number = 1): void {
    this.shakeX = (Math.random() - 0.5) * 12 * intensity;
    this.shakeY = (Math.random() - 0.5) * 12 * intensity;
  }

  worldToScreen(wx: number, wy: number, screenW: number, screenH: number): { x: number; y: number } {
    return {
      x: wx * this.zoom + this.x + screenW / 2,
      y: wy * this.zoom + this.y + screenH / 2
    };
  }
}
```

### game/Effects.ts
```typescript
import * as PIXI from 'pixi.js';
import { Particle } from './types';

export class Effects {
  private particles: Particle[] = [];
  private particlePool: PIXI.Graphics[] = [];
  private container: PIXI.Container;

  constructor(container: PIXI.Container) {
    this.container = container;
  }

  createExplosion(x: number, y: number, color: number): void {
    const count = 12;
    for (let i = 0; i < count; i++) {
      const angle = (i / count) * Math.PI * 2;
      const speed = 100 + Math.random() * 150;
      const g = this.getParticle();
      g.clear();
      g.circle(0, 0, 3 + Math.random() * 3).fill({ color, alpha: 0.8 });
      g.x = x;
      g.y = y;
      this.container.addChild(g);

      this.particles.push({
        x, y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 0.5 + Math.random() * 0.3,
        color,
        graphics: g
      });
    }
  }

  update(deltaTime: number): void {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.life -= deltaTime;
      if (p.life <= 0) {
        this.container.removeChild(p.graphics);
        this.returnParticle(p.graphics);
        this.particles.splice(i, 1);
        continue;
      }
      p.x += p.vx * deltaTime;
      p.y += p.vy * deltaTime;
      p.vx *= 0.95;
      p.vy *= 0.95;
      p.graphics.x = p.x;
      p.graphics.y = p.y;
      p.graphics.alpha = p.life * 2;
    }
  }

  triggerHaptic(type: 'light' | 'medium' | 'heavy'): void {
    try {
      if (!navigator.vibrate) return;
      switch (type) {
        case 'light': navigator.vibrate(10); break;
        case 'medium': navigator.vibrate(30); break;
        case 'heavy': navigator.vibrate([50, 30, 50]); break;
      }
    } catch {}
  }

  private getParticle(): PIXI.Graphics {
    return this.particlePool.pop() || new PIXI.Graphics();
  }

  private returnParticle(p: PIXI.Graphics): void {
    if (this.particlePool.length < 100) {
      this.particlePool.push(p);
    }
  }

  destroy(): void {
    this.particles.forEach(p => {
      this.container.removeChild(p.graphics);
    });
    this.particles = [];
    this.particlePool = [];
  }
}
```

### Verification:
```bash
cd packages/client && npx tsc --noEmit src/game/Camera.ts src/game/Effects.ts
```

---

## TASK 4: Trail System + Collision

**Creates:** `game/TrailSystem.ts`, `game/Collision.ts`

### game/TrailSystem.ts
```typescript
import * as PIXI from 'pixi.js';
import { Car, Trail, TrailPoint } from './types';

export class TrailSystem {
  private trails: Map<string, Trail> = new Map();
  private container: PIXI.Container;

  constructor(container: PIXI.Container) {
    this.container = container;
  }

  addPoint(car: Car): void {
    if (car.destroyed) return;

    const now = Date.now();
    const lastPoint = car.trailPoints[car.trailPoints.length - 1];

    // Only add point if moved enough distance
    if (lastPoint) {
      const dx = car.x - lastPoint.x;
      const dy = car.y - lastPoint.y;
      if (dx * dx + dy * dy < 225) return; // 15px minimum
    }

    const point: TrailPoint = {
      x: car.x,
      y: car.y,
      time: now,
      isBoosting: car.isBoosting,
      expiresAt: now + 8000 // 8 second trail life
    };

    car.trailPoints.push(point);

    // Get or create trail
    let trail = this.trails.get(car.id);
    if (!trail) {
      const graphics = new PIXI.Graphics();
      this.container.addChild(graphics);
      trail = { carId: car.id, car, points: [], graphics };
      this.trails.set(car.id, trail);
    }
    trail.points = car.trailPoints;
  }

  update(): void {
    const now = Date.now();

    this.trails.forEach((trail, carId) => {
      // Remove expired points
      trail.points = trail.points.filter(p => !p.expiresAt || p.expiresAt > now);
      trail.car.trailPoints = trail.points;

      // Render trail
      this.renderTrail(trail);

      // Remove empty trails
      if (trail.points.length === 0) {
        this.container.removeChild(trail.graphics);
        this.trails.delete(carId);
      }
    });
  }

  private renderTrail(trail: Trail): void {
    const g = trail.graphics;
    g.clear();

    if (trail.points.length < 2) return;

    const color = trail.car.color;

    for (let i = 1; i < trail.points.length; i++) {
      const p0 = trail.points[i - 1];
      const p1 = trail.points[i];
      const width = p1.isBoosting ? 6 : 4;
      const alpha = p1.isBoosting ? 0.9 : 0.7;

      g.moveTo(p0.x, p0.y);
      g.lineTo(p1.x, p1.y);
      g.stroke({ width, color, alpha });
    }
  }

  getTrails(): Trail[] {
    return Array.from(this.trails.values());
  }

  clear(): void {
    this.trails.forEach(trail => {
      this.container.removeChild(trail.graphics);
    });
    this.trails.clear();
  }
}
```

### game/Collision.ts
```typescript
import { Car, Trail, ArenaBounds } from './types';

export interface CollisionResult {
  victim: Car;
  killer: Car | null;
  hitPoint: { x: number; y: number };
}

export class Collision {
  checkTrailCollisions(cars: Car[], trails: Trail[]): CollisionResult[] {
    const results: CollisionResult[] = [];
    const hitRadius = 12;

    for (const car of cars) {
      if (car.destroyed) continue;

      for (const trail of trails) {
        // Skip own trail (last 5 points for safety)
        const isOwnTrail = trail.carId === car.id;
        const points = trail.points;
        const skipCount = isOwnTrail ? 5 : 0;

        for (let i = skipCount + 1; i < points.length; i++) {
          const p0 = points[i - 1];
          const p1 = points[i];

          const dist = this.pointToSegmentDistance(car.x, car.y, p0.x, p0.y, p1.x, p1.y);

          if (dist < hitRadius) {
            results.push({
              victim: car,
              killer: isOwnTrail ? null : trail.car,
              hitPoint: { x: car.x, y: car.y }
            });
            break;
          }
        }
      }
    }

    return results;
  }

  checkArenaBounds(car: Car, arena: ArenaBounds): boolean {
    const halfW = arena.width / 2;
    const halfH = arena.height / 2;
    return car.x < -halfW || car.x > halfW || car.y < -halfH || car.y > halfH;
  }

  private pointToSegmentDistance(
    px: number, py: number,
    x1: number, y1: number,
    x2: number, y2: number
  ): number {
    const dx = x2 - x1;
    const dy = y2 - y1;
    const lengthSq = dx * dx + dy * dy;

    if (lengthSq === 0) {
      return Math.sqrt((px - x1) ** 2 + (py - y1) ** 2);
    }

    let t = ((px - x1) * dx + (py - y1) * dy) / lengthSq;
    t = Math.max(0, Math.min(1, t));

    const nearX = x1 + t * dx;
    const nearY = y1 + t * dy;

    return Math.sqrt((px - nearX) ** 2 + (py - nearY) ** 2);
  }
}
```

### Verification:
```bash
cd packages/client && npx tsc --noEmit src/game/TrailSystem.ts src/game/Collision.ts
```

---

## TASK 5: Game World (Zone, Pickups, Spawning)

**Creates:** `game/GameWorld.ts`

### game/GameWorld.ts
```typescript
import * as PIXI from 'pixi.js';
import { Car, ArenaBounds, Pickup, BoostPad, ZoneBounds } from './types';

export class GameWorld {
  arena: ArenaBounds;
  zone: ZoneBounds;
  pickups: Pickup[] = [];
  boostPads: BoostPad[] = [];

  private worldContainer: PIXI.Container;
  private zoneGraphics: PIXI.Graphics;
  private gridGraphics: PIXI.Graphics;
  private pickupsContainer: PIXI.Container;

  private zoneStartTime = 0;
  private zoneDuration = 90000;

  constructor(container: PIXI.Container, arena: ArenaBounds) {
    this.worldContainer = container;
    this.arena = arena;

    // Initialize zone to full arena
    this.zone = {
      left: -arena.width / 2,
      right: arena.width / 2,
      top: -arena.height / 2,
      bottom: arena.height / 2
    };

    // Create graphics layers
    this.gridGraphics = new PIXI.Graphics();
    this.zoneGraphics = new PIXI.Graphics();
    this.pickupsContainer = new PIXI.Container();

    container.addChild(this.gridGraphics);
    container.addChild(this.zoneGraphics);
    container.addChild(this.pickupsContainer);

    this.drawGrid();
    this.spawnBoostPads(10);
  }

  private drawGrid(): void {
    const g = this.gridGraphics;
    const gridSize = 160;
    const halfW = this.arena.width / 2;
    const halfH = this.arena.height / 2;

    for (let x = -halfW; x <= halfW; x += gridSize) {
      g.moveTo(x, -halfH).lineTo(x, halfH);
    }
    for (let y = -halfH; y <= halfH; y += gridSize) {
      g.moveTo(-halfW, y).lineTo(halfW, y);
    }
    g.stroke({ width: 1, color: 0x2a2f38, alpha: 0.08 });

    // Border
    g.rect(-halfW, -halfH, this.arena.width, this.arena.height);
    g.stroke({ width: 4, color: 0x22d3ee, alpha: 0.6 });
  }

  private spawnBoostPads(count: number): void {
    const halfW = this.arena.width / 2 - 200;
    const halfH = this.arena.height / 2 - 200;

    for (let i = 0; i < count; i++) {
      const x = (Math.random() - 0.5) * halfW * 2;
      const y = (Math.random() - 0.5) * halfH * 2;
      const g = new PIXI.Graphics();
      g.circle(0, 0, 30).fill({ color: 0x22d3ee, alpha: 0.3 });
      g.x = x;
      g.y = y;
      this.worldContainer.addChild(g);

      this.boostPads.push({
        x, y,
        radius: 30,
        cooldownMs: 5000,
        lastTriggeredAt: 0,
        graphics: g
      });
    }
  }

  startZone(): void {
    this.zoneStartTime = Date.now();
  }

  updateZone(cars: Car[]): void {
    if (!this.zoneStartTime) return;

    const elapsed = Date.now() - this.zoneStartTime;
    const progress = Math.min(1, elapsed / this.zoneDuration);

    // Shrink zone over time
    const shrinkAmount = progress * (this.arena.width / 2 - 150);
    this.zone.left = -this.arena.width / 2 + shrinkAmount;
    this.zone.right = this.arena.width / 2 - shrinkAmount;
    this.zone.top = -this.arena.height / 2 + shrinkAmount;
    this.zone.bottom = this.arena.height / 2 - shrinkAmount;

    // Draw zone
    this.zoneGraphics.clear();
    const w = this.zone.right - this.zone.left;
    const h = this.zone.bottom - this.zone.top;
    this.zoneGraphics.rect(this.zone.left, this.zone.top, w, h);
    this.zoneGraphics.stroke({ width: 3, color: 0xef4444, alpha: 0.8 });

    // Damage cars outside zone
    for (const car of cars) {
      if (car.destroyed) continue;
      if (this.isOutsideZone(car.x, car.y)) {
        car.outZoneTime = (car.outZoneTime || 0) + 1/60;
        if (car.outZoneTime > 3) {
          car.destroyed = true;
        }
      } else {
        car.outZoneTime = 0;
      }
    }
  }

  isOutsideZone(x: number, y: number): boolean {
    return x < this.zone.left || x > this.zone.right ||
           y < this.zone.top || y > this.zone.bottom;
  }

  getSpawnPoint(): { x: number; y: number; angle: number } {
    const margin = 200;
    return {
      x: (Math.random() - 0.5) * (this.arena.width - margin * 2),
      y: (Math.random() - 0.5) * (this.arena.height - margin * 2),
      angle: Math.random() * Math.PI * 2
    };
  }

  destroy(): void {
    this.gridGraphics.destroy();
    this.zoneGraphics.destroy();
    this.pickupsContainer.destroy();
    this.boostPads.forEach(p => p.graphics.destroy());
  }
}
```

### Verification:
```bash
cd packages/client && npx tsc --noEmit src/game/GameWorld.ts
```

---

## TASK 6: UI System (HUD, Radar, Leaderboard)

**Creates:** `game/UISystem.ts`

### game/UISystem.ts
```typescript
import { Car, ZoneBounds, ArenaBounds } from './types';

export class UISystem {
  private container: HTMLElement;
  private radarCanvas: HTMLCanvasElement | null = null;
  private radarCtx: CanvasRenderingContext2D | null = null;
  private boostBarEl: HTMLDivElement | null = null;
  private aliveCountEl: HTMLDivElement | null = null;
  private killFeedEl: HTMLDivElement | null = null;
  private recentKills: Array<{ killer: string; victim: string; time: number }> = [];

  constructor(container: HTMLElement) {
    this.container = container;
    this.setup();
  }

  private setup(): void {
    // Create UI container
    const ui = document.createElement('div');
    ui.style.cssText = 'position:absolute;top:0;left:0;width:100%;height:100%;pointer-events:none;z-index:100;';
    this.container.appendChild(ui);

    // Radar
    this.radarCanvas = document.createElement('canvas');
    this.radarCanvas.width = 150;
    this.radarCanvas.height = 150;
    this.radarCanvas.style.cssText = 'position:absolute;bottom:20px;right:20px;border-radius:50%;background:rgba(0,0,0,0.5);';
    ui.appendChild(this.radarCanvas);
    this.radarCtx = this.radarCanvas.getContext('2d');

    // Boost bar
    this.boostBarEl = document.createElement('div');
    this.boostBarEl.style.cssText = 'position:absolute;bottom:20px;left:50%;transform:translateX(-50%);width:200px;height:8px;background:rgba(0,0,0,0.5);border-radius:4px;overflow:hidden;';
    this.boostBarEl.innerHTML = '<div style="height:100%;background:linear-gradient(90deg,#22d3ee,#6366f1);width:100%;transition:width 0.1s;"></div>';
    ui.appendChild(this.boostBarEl);

    // Alive count
    this.aliveCountEl = document.createElement('div');
    this.aliveCountEl.style.cssText = 'position:absolute;top:20px;left:50%;transform:translateX(-50%);font-size:24px;color:white;font-weight:bold;text-shadow:0 2px 4px rgba(0,0,0,0.5);';
    ui.appendChild(this.aliveCountEl);

    // Kill feed
    this.killFeedEl = document.createElement('div');
    this.killFeedEl.style.cssText = 'position:absolute;top:60px;right:20px;font-size:14px;color:white;text-align:right;';
    ui.appendChild(this.killFeedEl);
  }

  updateRadar(
    player: Car | null,
    enemies: Car[],
    arena: ArenaBounds,
    zone: ZoneBounds
  ): void {
    if (!this.radarCtx || !this.radarCanvas) return;
    const ctx = this.radarCtx;
    const size = this.radarCanvas.width;
    const center = size / 2;
    const scale = size / arena.width;

    ctx.clearRect(0, 0, size, size);

    // Background
    ctx.fillStyle = 'rgba(0, 20, 40, 0.8)';
    ctx.beginPath();
    ctx.arc(center, center, center, 0, Math.PI * 2);
    ctx.fill();

    // Zone
    ctx.strokeStyle = 'rgba(239, 68, 68, 0.5)';
    ctx.lineWidth = 2;
    const zoneW = (zone.right - zone.left) * scale;
    const zoneH = (zone.bottom - zone.top) * scale;
    const zoneX = center + zone.left * scale + arena.width * scale / 2;
    const zoneY = center + zone.top * scale + arena.height * scale / 2;
    ctx.strokeRect(zoneX, zoneY, zoneW, zoneH);

    // Enemies
    ctx.fillStyle = '#ff4444';
    for (const enemy of enemies) {
      if (enemy.destroyed) continue;
      const ex = center + enemy.x * scale;
      const ey = center + enemy.y * scale;
      ctx.beginPath();
      ctx.arc(ex, ey, 3, 0, Math.PI * 2);
      ctx.fill();
    }

    // Player
    if (player && !player.destroyed) {
      ctx.fillStyle = '#22d3ee';
      const px = center + player.x * scale;
      const py = center + player.y * scale;
      ctx.beginPath();
      ctx.arc(px, py, 4, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  updateBoostBar(energy: number, maxEnergy: number): void {
    if (!this.boostBarEl) return;
    const bar = this.boostBarEl.firstElementChild as HTMLDivElement;
    if (bar) {
      bar.style.width = `${(energy / maxEnergy) * 100}%`;
    }
  }

  updateAliveCount(count: number): void {
    if (!this.aliveCountEl) return;
    this.aliveCountEl.textContent = `${count} ALIVE`;
  }

  addKill(killer: string, victim: string): void {
    this.recentKills.unshift({ killer, victim, time: Date.now() });
    if (this.recentKills.length > 5) this.recentKills.pop();
    this.renderKillFeed();
  }

  private renderKillFeed(): void {
    if (!this.killFeedEl) return;
    const now = Date.now();
    this.recentKills = this.recentKills.filter(k => now - k.time < 5000);
    this.killFeedEl.innerHTML = this.recentKills
      .map(k => `<div style="margin:4px 0;opacity:${1 - (now - k.time) / 5000}">${k.killer} → ${k.victim}</div>`)
      .join('');
  }

  destroy(): void {
    this.radarCanvas?.remove();
    this.boostBarEl?.remove();
    this.aliveCountEl?.remove();
    this.killFeedEl?.remove();
  }
}
```

### Verification:
```bash
cd packages/client && npx tsc --noEmit src/game/UISystem.ts
```

---

# PHASE 2: ORCHESTRATOR (1 Agent - After Phase 1)

## TASK 7: Create SpermRaceGame.ts

**Creates:** `game/SpermRaceGame.ts` - THE NEW MAIN GAME CLASS

This is a NEW file that uses all the modules. **DO NOT modify NewGameView.tsx**.

### game/SpermRaceGame.ts
```typescript
import * as PIXI from 'pixi.js';
import { Car, ArenaBounds } from './types';
import { Physics } from './Physics';
import { InputHandler } from './InputHandler';
import { Camera } from './Camera';
import { Effects } from './Effects';
import { TrailSystem } from './TrailSystem';
import { Collision, CollisionResult } from './Collision';
import { GameWorld } from './GameWorld';
import { UISystem } from './UISystem';

export class SpermRaceGame {
  private app: PIXI.Application | null = null;
  private worldContainer!: PIXI.Container;
  private container: HTMLElement;

  // Game state
  private player: Car | null = null;
  private bots: Car[] = [];
  private arena: ArenaBounds = { width: 8000, height: 6000 };
  private gamePhase: 'waiting' | 'active' | 'finished' = 'waiting';

  // Systems
  private physics!: Physics;
  private input!: InputHandler;
  private camera!: Camera;
  private effects!: Effects;
  private trails!: TrailSystem;
  private collision!: Collision;
  private world!: GameWorld;
  private ui!: UISystem;

  constructor(container: HTMLElement) {
    this.container = container;
  }

  async init(): Promise<void> {
    const width = this.container.clientWidth || window.innerWidth;
    const height = this.container.clientHeight || window.innerHeight;

    // Create PIXI app
    this.app = new PIXI.Application();
    await this.app.init({
      width,
      height,
      backgroundColor: 0x1a1f2e,
      antialias: true,
      resolution: Math.min(window.devicePixelRatio, 2),
      autoDensity: true
    });

    const canvas = (this.app as any).canvas as HTMLCanvasElement;
    this.container.appendChild(canvas);
    canvas.style.outline = 'none';
    canvas.tabIndex = 0;
    canvas.focus();

    // Create world container
    this.worldContainer = new PIXI.Container();
    this.worldContainer.sortableChildren = true;
    this.app.stage.addChild(this.worldContainer);

    // Initialize systems
    this.physics = new Physics();
    this.input = new InputHandler();
    this.camera = new Camera();
    this.effects = new Effects(this.worldContainer);
    this.trails = new TrailSystem(this.worldContainer);
    this.collision = new Collision();
    this.world = new GameWorld(this.worldContainer, this.arena);
    this.ui = new UISystem(this.container);

    // Setup input
    this.input.setup(canvas);

    // Create player
    this.player = this.createCar(true);

    // Create bots
    for (let i = 0; i < 5; i++) {
      this.bots.push(this.createCar(false));
    }

    // Start game
    this.gamePhase = 'active';
    this.world.startZone();

    // Start game loop
    this.app.ticker.add(() => this.gameLoop());
  }

  private createCar(isPlayer: boolean): Car {
    const spawn = this.world.getSpawnPoint();
    const color = isPlayer ? 0x22d3ee : 0xff00ff;

    const sprite = new PIXI.Container();
    const head = new PIXI.Graphics();
    head.circle(0, 0, 12).fill({ color });
    sprite.addChild(head);
    sprite.x = spawn.x;
    sprite.y = spawn.y;
    sprite.rotation = spawn.angle;
    this.worldContainer.addChild(sprite);

    return {
      id: Math.random().toString(36).substr(2, 9),
      x: spawn.x,
      y: spawn.y,
      angle: spawn.angle,
      targetAngle: spawn.angle,
      speed: 200,
      baseSpeed: 200,
      boostSpeed: 300,
      targetSpeed: 200,
      speedTransitionRate: 3,
      driftFactor: 0,
      maxDriftFactor: 1.5,
      vx: 0,
      vy: 0,
      color,
      type: isPlayer ? 'player' : 'bot',
      name: isPlayer ? 'You' : `Bot${Math.floor(Math.random() * 100)}`,
      kills: 0,
      destroyed: false,
      respawnTimer: 0,
      isBoosting: false,
      boostTimer: 0,
      boostCooldown: 0,
      boostEnergy: 100,
      maxBoostEnergy: 100,
      boostRegenRate: 15,
      boostConsumptionRate: 25,
      minBoostEnergy: 20,
      trailPoints: [],
      trailGraphics: null,
      lastTrailTime: 0,
      turnTimer: 1,
      boostAITimer: 2,
      currentTrailId: null,
      sprite
    };
  }

  private gameLoop(): void {
    if (!this.app || this.gamePhase !== 'active') return;

    const deltaTime = 1 / 60;
    const screenW = this.app.screen.width;
    const screenH = this.app.screen.height;

    // Get input
    if (this.player && !this.player.destroyed) {
      const input = this.input.getInput(
        this.player.x, this.player.y,
        this.camera.x, this.camera.y,
        this.camera.zoom, screenW, screenH
      );

      // Apply input to player
      this.player.targetAngle = Math.atan2(
        input.targetY - this.player.y,
        input.targetX - this.player.x
      );
      if (input.boost && this.player.boostEnergy >= this.player.minBoostEnergy) {
        this.player.isBoosting = true;
      }
    }

    // Update physics
    if (this.player) {
      this.physics.updateCar(this.player, deltaTime, this.world.boostPads);
    }
    for (const bot of this.bots) {
      this.physics.updateBot(bot, deltaTime, this.world.boostPads);
    }

    // Update trails
    const allCars = [this.player, ...this.bots].filter(c => c && !c.destroyed) as Car[];
    for (const car of allCars) {
      this.trails.addPoint(car);
    }
    this.trails.update();

    // Check collisions
    const trails = this.trails.getTrails();
    const collisions = this.collision.checkTrailCollisions(allCars, trails);
    for (const col of collisions) {
      this.handleCollision(col);
    }

    // Update zone
    this.world.updateZone(allCars);

    // Update effects
    this.effects.update(deltaTime);

    // Update camera
    this.camera.update(this.player, this.worldContainer, screenW, screenH);

    // Update UI
    const aliveCount = allCars.filter(c => !c.destroyed).length;
    this.ui.updateAliveCount(aliveCount);
    this.ui.updateRadar(this.player, this.bots, this.arena, this.world.zone);
    if (this.player) {
      this.ui.updateBoostBar(this.player.boostEnergy, this.player.maxBoostEnergy);
    }

    // Check win/lose
    if (aliveCount <= 1) {
      this.gamePhase = 'finished';
    }
  }

  private handleCollision(col: CollisionResult): void {
    col.victim.destroyed = true;
    col.victim.sprite.visible = false;

    this.effects.createExplosion(col.hitPoint.x, col.hitPoint.y, col.victim.color);
    this.camera.shake(0.5);
    this.effects.triggerHaptic('heavy');

    if (col.killer) {
      col.killer.kills++;
      this.ui.addKill(col.killer.name, col.victim.name);
    }
  }

  destroy(): void {
    this.input.destroy();
    this.effects.destroy();
    this.trails.clear();
    this.world.destroy();
    this.ui.destroy();
    this.app?.destroy(true);
  }
}
```

### Test the new game:
Create a simple test file to verify everything works:

```typescript
// packages/client/src/game/test.ts
import { SpermRaceGame } from './SpermRaceGame';

const container = document.getElementById('game-container');
if (container) {
  const game = new SpermRaceGame(container);
  game.init().then(() => console.log('Game started!'));
}
```

### Verification:
```bash
cd packages/client && npx tsc --noEmit src/game/SpermRaceGame.ts
```

---

# PHASE 2: INTEGRATION (1 Agent)

## TASK 8: Wire up NewGameView.tsx to SpermRaceGame

**Modifies:** `packages/client/src/NewGameView.tsx`

- [x] Import `SpermRaceGame` from `./game/SpermRaceGame`.
- [x] In the component, instantiate `SpermRaceGame` and use its `init()` method.
- [x] Ensure all existing props and WebSocket events are passed to the new engine.
- [x] Keep old logic as a commented-out fallback.

---

# PHASE 3: GAMEPLAY & AI (Parallel)

## TASK 9: Apex Predator AI & Interception
**Modifies:** `game/Physics.ts`
- [x] **Interception:** Bots calculate target angle based on player's velocity (predictive aim).
- [x] **Baiting:** Bots turn 180 degrees if a player is close behind to force a head-on collision.

## TASK 10: Drift-Boost Mechanics
**Modifies:** `game/Physics.ts`, `game/UISystem.ts`
- [x] **Store Energy:** Turning > 30 degrees for 1s builds "Drift Charge".
- [x] **Burst:** Release turn to gain 1.3x speed for 0.6s.
- [ ] **UI:** Show charge level on the character's ring.

---

# FINAL VERIFICATION
- [ ] All modules integrated and playable.
- [ ] Bots are demonstrably smarter (predictive movement).
- [ ] Drift-boost is functional and visible in UI.

---

# FILE SUMMARY

| Task | Agent | Files Created |
|------|-------|---------------|
| 1 | Agent 1 | `game/types.ts`, `game/index.ts` |
| 2 | Agent 2 | `game/Physics.ts`, `game/InputHandler.ts` |
| 3 | Agent 3 | `game/Camera.ts`, `game/Effects.ts` |
| 4 | Agent 4 | `game/TrailSystem.ts`, `game/Collision.ts` |
| 5 | Agent 5 | `game/GameWorld.ts` |
| 6 | Agent 6 | `game/UISystem.ts` |
| 7 | Agent 7 | `game/SpermRaceGame.ts` |

**Total: 10 new files, ~1,200 lines of modular code**

**Original `NewGameView.tsx` is UNTOUCHED** - still works as fallback!

---

# SUCCESS CRITERIA

- [x] All 10 module files created in `game/`
- [x] `npx tsc --noEmit src/game/*.ts` passes
- [x] `pnpm build` succeeds
- [x] NewGameView.tsx still works (unchanged)
- [x] New SpermRaceGame.ts can be tested independently
