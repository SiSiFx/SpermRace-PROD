import * as PIXI from 'pixi.js';
import { Car, Trail, TrailPoint, Theme } from './types';

export interface TrailSystemConfig {
  theme: Theme;
  trailContainer: PIXI.Container;
  worldContainer: PIXI.Container;
}

export class TrailSystem {
  private trails: Trail[] = [];
  private config: TrailSystemConfig;
  private lastToastAt = 0;

  constructor(config: TrailSystemConfig) {
    this.config = config;
  }

  getTrails(): Trail[] {
    return this.trails;
  }

  update(
    cars: Car[],
    player: Car | null,
    camera: { x: number; y: number; zoom: number },
    screenWidth: number,
    screenHeight: number
  ) {
    const now = Date.now();
    const camX = -(camera.x - screenWidth / 2) / camera.zoom;
    const camY = -(camera.y - screenHeight / 2) / camera.zoom;
    const lodRadius = 1200 / camera.zoom;

    // Add trail points for cars
    for (const car of cars) {
      if (car.destroyed) continue;
      
      // LOD: only add points for cars near camera (except player)
      if (car !== player) {
        const dx = car.x - camX;
        const dy = car.y - camY;
        if (dx * dx + dy * dy > lodRadius * lodRadius) continue;
      }
      
      this.addTrailPoint(car);
    }

    // Update and clean trails
    for (let i = this.trails.length - 1; i >= 0; i--) {
      const trail = this.trails[i];
      const maxAge = 3.0;
      
      // Remove old points
      trail.points = trail.points.filter(point => {
        return (now - point.time) / 1000 <= maxAge;
      });
      
      // Remove trail if no points left
      if (trail.points.length === 0) {
        if (trail.graphics && trail.graphics.parent) {
          try { this.config.trailContainer.removeChild(trail.graphics); } catch {}
          try { trail.graphics.destroy(); } catch {}
        }
        this.trails.splice(i, 1);
      } else {
        this.renderTrail(trail, player, camera, screenWidth, screenHeight);
      }
    }
  }

  private addTrailPoint(car: Car) {
    const now = Date.now();
    const interval = 30;
    
    if (now - car.lastTrailTime > interval) {
      let trail = this.trails.find(t => t.carId === car.type);
      
      if (!trail) {
        trail = {
          carId: car.type,
          car: car,
          points: [],
          graphics: new PIXI.Graphics()
        };
        this.trails.push(trail);
        try { this.config.trailContainer.addChild(trail.graphics); } catch {}
      }
      
      trail.points.push({
        x: car.x,
        y: car.y,
        time: now,
        isBoosting: car.isBoosting
      });
      
      car.lastTrailTime = now;
      
      if (trail.points.length > 60) {
        trail.points.shift();
      }
    }
  }

  private renderTrail(
    trail: Trail,
    player: Car | null,
    camera: { x: number; y: number; zoom: number },
    screenWidth: number,
    screenHeight: number
  ) {
    if (!trail.graphics || trail.points.length < 2) return;
    
    trail.graphics.clear();
    const now = Date.now();
    const car = trail.car;
    
    const trailColor = car.type === 'player' ? this.config.theme.accent : this.config.theme.enemy;
    
    // LOD for distant bots
    const isBot = car.type !== 'player';
    const camX = -(camera.x - screenWidth / 2) / camera.zoom;
    const camY = -(camera.y - screenHeight / 2) / camera.zoom;
    const dxCam = car.x - camX;
    const dyCam = car.y - camY;
    const far = (dxCam * dxCam + dyCam * dyCam) > (1600 * 1600);
    const step = (isBot && far) ? 2 : 1;
    
    const pts: TrailPoint[] = [];
    for (let i = 0; i < trail.points.length; i += step) {
      const p = trail.points[i];
      const age = (now - p.time) / 1000;
      if (age <= 3.0) pts.push(p);
    }
    if (pts.length < 2) return;

    const isPlayerTrail = !!(player && trail.car === player);
    const baseWidth = car.type === 'player' ? 2 : 1.6;
    const alphaStart = 1.0;

    if (isPlayerTrail) {
      // Player trail: simple line
      const first = pts[0];
      trail.graphics.moveTo(first.x, first.y);
      for (let i = 1; i < pts.length; i++) {
        trail.graphics.lineTo(pts[i].x, pts[i].y);
      }
      trail.graphics.stroke({ width: baseWidth, color: trailColor, alpha: alphaStart, cap: 'round', join: 'round' });
    } else {
      // Ghost tail wiggle for enemies
      this.renderGhostTrail(trail, car, pts, baseWidth, trailColor, alphaStart, now);
    }

    // Proximity glow
    if (player && trail.car !== player && pts.length >= 2) {
      for (let i = 1; i < pts.length; i++) {
        const a = pts[i - 1];
        const b = pts[i];
        const dist = this.pointToLineDistance(player.x, player.y, a.x, a.y, b.x, b.y);
        if (dist < 60) {
          const glowAlpha = Math.max(0, 0.25 * (1 - dist / 60));
          trail.graphics
            .moveTo(a.x, a.y)
            .lineTo(b.x, b.y)
            .stroke({ width: baseWidth + 1, color: this.config.theme.enemyGlow, alpha: glowAlpha, cap: 'round', join: 'round' });
        }
      }
    }
  }

  private renderGhostTrail(
    trail: Trail,
    car: Car,
    pts: TrailPoint[],
    baseWidth: number,
    trailColor: number,
    alphaStart: number,
    now: number
  ) {
    const headX = car.x;
    const headY = car.y;
    const ghost: Array<{ x: number; y: number }> = [];
    ghost.push({ x: headX, y: headY });

    const time = now * 0.004;
    const amplitudeBase = car.type.startsWith('bot') ? 4 : 6;
    const speedMag = Math.hypot(car.vx, car.vy);
    const speedFactor = 1.0 + Math.min(1.5, speedMag / 260);

    for (let idx = pts.length - 1; idx >= 0; idx--) {
      const p = pts[idx];
      const prev = idx === pts.length - 1 ? { x: headX, y: headY } : pts[idx + 1];
      const dirX = p.x - prev.x;
      const dirY = p.y - prev.y;
      const len = Math.hypot(dirX, dirY) || 1;
      const nx = -dirY / len;
      const ny = dirX / len;
      const t = (pts.length - 1 - idx) / Math.max(1, pts.length - 1);
      const envelope = Math.pow(t, 1.6);
      const phase = time * speedFactor + t * 4.0;
      const offset = Math.sin(phase) * amplitudeBase * envelope;
      ghost.push({ x: p.x + nx * offset, y: p.y + ny * offset });
    }

    if (ghost.length < 2) return;

    const g0 = ghost[0];
    const g1 = ghost[1];
    const m0x = (g0.x + g1.x) * 0.5;
    const m0y = (g0.y + g1.y) * 0.5;
    trail.graphics.moveTo(m0x, m0y);
    
    for (let i = 1; i < ghost.length - 1; i++) {
      const c = ghost[i];
      const n = ghost[i + 1];
      const mx = (c.x + n.x) * 0.5;
      const my = (c.y + n.y) * 0.5;
      trail.graphics.quadraticCurveTo(c.x, c.y, mx, my);
    }

    trail.graphics.stroke({ width: baseWidth, color: trailColor, alpha: alphaStart, cap: 'round', join: 'round' });
  }

  checkCollisions(
    cars: Car[],
    player: Car | null,
    onKill: (killer: Car, victim: Car) => void,
    onNearMiss: (x: number, y: number, distance: number) => void
  ) {
    for (const car of cars) {
      if (car.destroyed) continue;
      
      let closestMiss = Infinity;
      let missX = 0, missY = 0;
      
      for (const trail of this.trails) {
        if (trail.points.length < 2) continue;

        const now = Date.now();
        const isSelfTrail = trail.car === car;
        
        // No self-collision
        if (isSelfTrail) continue;

        for (let i = 1; i < trail.points.length; i++) {
          const p1 = trail.points[i - 1];
          const p2 = trail.points[i];
          const age = (now - p2.time) / 1000;

          if (age > 3.0) continue;

          const distance = this.pointToLineDistance(car.x, car.y, p1.x, p1.y, p2.x, p2.y);
          const hitboxSize = p2.isBoosting ? 12 : 6;

          if (distance < hitboxSize) {
            onKill(trail.car, car);
            break;
          }
          
          // Near-miss detection
          if (car === player && distance < 40 && distance < closestMiss) {
            closestMiss = distance;
            missX = (p1.x + p2.x) / 2;
            missY = (p1.y + p2.y) / 2;
          }
        }

        if (car.destroyed) break;
      }
      
      // Trigger near-miss notification
      if (car === player && closestMiss < 25 && Math.random() < 0.08) {
        onNearMiss(missX, missY, closestMiss);
      }
    }
  }

  pointToLineDistance(px: number, py: number, x1: number, y1: number, x2: number, y2: number): number {
    const A = px - x1;
    const B = py - y1;
    const C = x2 - x1;
    const D = y2 - y1;
    const dot = A * C + B * D;
    const lenSq = C * C + D * D;
    let param = -1;
    if (lenSq !== 0) param = dot / lenSq;
    
    let xx: number, yy: number;
    if (param < 0) {
      xx = x1; yy = y1;
    } else if (param > 1) {
      xx = x2; yy = y2;
    } else {
      xx = x1 + param * C;
      yy = y1 + param * D;
    }
    
    const dx = px - xx;
    const dy = py - yy;
    return Math.sqrt(dx * dx + dy * dy);
  }

  destroy() {
    for (const trail of this.trails) {
      try {
        if (trail.graphics && trail.graphics.parent) {
          trail.graphics.parent.removeChild(trail.graphics);
        }
        trail.graphics.destroy();
      } catch {}
    }
    this.trails = [];
  }
}
