/**
 * Particle Object Pool
 * Pool for visual effect particles (explosions, trails, etc.)
 */

import { ObjectPool } from './ObjectPool';
import { Graphics } from 'pixi.js';

/**
 * Particle types for different visual effects
 */
export enum ParticleType {
  /** Explosion burst */
  EXPLOSION = 'explosion',

  /** Trail exhaust */
  EXHAUST = 'exhaust',

  /** Spark/electric effect */
  SPARK = 'spark',

  /** Smoke puff */
  SMOKE = 'smoke',

  /** Speed line/blur */
  SPEED_LINE = 'speed_line',

  /** Shield effect */
  SHIELD = 'shield',

  /** Death burst */
  DEATH_BURST = 'death_burst',
}

/**
 * Particle data structure
 */
export interface Particle {
  /** Particle type */
  type: ParticleType;

  /** X position */
  x: number;

  /** Y position */
  y: number;

  /** X velocity */
  vx: number;

  /** Y velocity */
  vy: number;

  /** Life remaining (0-1) */
  life: number;

  /** Decay rate (per second) */
  decay: number;

  /** Current size */
  size: number;

  /** Initial size */
  startSize: number;

  /** End size */
  endSize: number;

  /** Color (0xRRGGBB) */
  color: number;

  /** Alpha (0-1) */
  alpha: number;

  /** Rotation angle */
  rotation: number;

  /** Rotation speed */
  rotationSpeed: number;

  /** Gravity effect */
  gravity: number;

  /** Whether particle is active */
  active: boolean;
}

/**
 * Particle pool for visual effects
 */
export class ParticlePool {
  private readonly _pool: ObjectPool<Particle>;
  private readonly _active: Particle[] = [];
  private _graphics: Graphics | null = null;

  constructor(initialSize: number = 200, maxSize: number = 2000) {
    this._pool = new ObjectPool({
      create: () => this._createParticle(),
      reset: (p) => this._resetParticle(p),
      initialSize,
      maxSize,
    });
  }

  /**
   * Set graphics container for rendering particles
   */
  setGraphics(graphics: Graphics | null): void {
    this._graphics = graphics;
  }

  /**
   * Render all active particles
   */
  render(): void {
    if (!this._graphics) return;

    this._graphics.clear();

    for (const p of this._active) {
      if (!p.active || p.life <= 0) continue;

      // Draw particle based on type
      switch (p.type) {
        case ParticleType.EXPLOSION:
        case ParticleType.DEATH_BURST:
          this._renderExplosion(p);
          break;
        case ParticleType.EXHAUST:
          this._renderExhaust(p);
          break;
        case ParticleType.SPARK:
          this._renderSpark(p);
          break;
        case ParticleType.SMOKE:
          this._renderSmoke(p);
          break;
        case ParticleType.SPEED_LINE:
          this._renderSpeedLine(p);
          break;
        case ParticleType.SHIELD:
          this._renderShield(p);
          break;
      }
    }
  }

  /**
   * Render explosion/death burst particle (Retro Blocks)
   */
  private _renderExplosion(p: Particle): void {
    if (!this._graphics) return;

    const size = Math.floor(p.size);
    
    // Core bright center (Square)
    this._graphics.rect(p.x - size, p.y - size, size * 2, size * 2).fill({
      color: 0xffffff,
      alpha: p.alpha * 0.8,
    });

    // Inner colored ring (Hollow Square)
    const innerSize = Math.floor(p.size * 0.7);
    this._graphics.rect(p.x - innerSize, p.y - innerSize, innerSize * 2, innerSize * 2).fill({
      color: p.color,
      alpha: p.alpha * 0.9,
    });

    // Outer glow layers (Pixel Dither)
    if (Math.random() > 0.5) {
        const outerSize = Math.floor(p.size * 1.5);
        this._graphics.rect(p.x - outerSize, p.y - outerSize, outerSize * 2, outerSize * 2).fill({
            color: p.color,
            alpha: p.alpha * 0.4,
        });
    }

    // Spark particles around explosion (Small Rects)
    if (p.size > 6 && Math.random() > 0.5) {
      const sparkCount = Math.floor(Math.random() * 3) + 1;
      for (let i = 0; i < sparkCount; i++) {
        const angle = Math.random() * Math.PI * 2;
        const dist = p.size * (1.5 + Math.random() * 1.5);
        const sparkX = p.x + Math.cos(angle) * dist;
        const sparkY = p.y + Math.sin(angle) * dist;
        
        this._graphics.rect(sparkX - 1, sparkY - 1, 2, 2).fill({
          color: 0xffffff,
          alpha: p.alpha * 0.6,
        });
      }
    }
  }

  /**
   * Render exhaust particle (Retro Square Trail)
   */
  private _renderExhaust(p: Particle): void {
    if (!this._graphics) return;

    // Draw main square
    const size = Math.floor(p.size);
    this._graphics.rect(p.x - size/2, p.y - size/2, size, size).fill({
        color: p.color,
        alpha: p.alpha * 0.6
    });

    // Add inner bright core pixel
    if (size > 2) {
        this._graphics.rect(p.x - 1, p.y - 1, 2, 2).fill({
          color: 0xffffff,
          alpha: p.alpha * 0.4,
        });
    }
  }

  /**
   * Render spark particle (Pixel Spark)
   */
  private _renderSpark(p: Particle): void {
    if (!this._graphics) return;

    const size = Math.max(2, Math.floor(p.size));

    // Bright white core
    this._graphics.rect(p.x - size/2, p.y - size/2, size, size).fill({
      color: 0xffffff,
      alpha: p.alpha,
    });

    // Colored glow (offset pixels)
    this._graphics.rect(p.x - size, p.y - size, size * 2, size * 2).fill({
      color: p.color,
      alpha: p.alpha * 0.3,
    });
  }

  /**
   * Render smoke particle (Dithered Blocks)
   */
  private _renderSmoke(p: Particle): void {
    if (!this._graphics) return;

    const size = Math.floor(p.size);
    // Draw stepped smoke puff
    this._graphics.rect(p.x - size/2, p.y - size/2, size, size).fill({
        color: p.color,
        alpha: p.alpha * 0.4
    });
    
    // Offset block for fluffiness
    this._graphics.rect(p.x - size/2 + 2, p.y - size/2 - 2, size, size).fill({
        color: p.color,
        alpha: p.alpha * 0.2
    });
  }

  /**
   * Render speed line (Thin Rects)
   */
  private _renderSpeedLine(p: Particle): void {
    if (!this._graphics) return;

    const lineLength = p.size;
    const endX = p.x - Math.cos(p.rotation) * lineLength;
    const endY = p.y - Math.sin(p.rotation) * lineLength;
    
    // We can't easily rotate a rect without context transform, 
    // but we can draw a line or use many small rects. 
    // PIXI graphics lines are okay if they are blocky (butt cap).
    // Let's use a simple line for speed lines as they are fleeting.
    
    this._graphics.moveTo(p.x, p.y)
      .lineTo(endX, endY)
      .stroke({
        width: 2, // integer width
        color: 0xffffff,
        alpha: p.alpha * 0.8,
        cap: 'butt' // Blocky ends
      });
  }

  /**
   * Render shield particle (Pixel Hex)
   */
  private _renderShield(p: Particle): void {
    if (!this._graphics) return;

    // Core glow
    const size = Math.floor(p.size);
    this._graphics.rect(p.x - size, p.y - size, size * 2, size * 2).fill({
      color: p.color,
      alpha: p.alpha * 0.7,
    });

    // Orbiting pixels
    if (Math.random() > 0.5) {
        this._graphics.rect(p.x + size + 2, p.y, 2, 2).fill({
            color: p.color,
            alpha: p.alpha * 0.5
        });
    }
  }

  /**
   * Spawn a new particle
   */
  spawn(config: Partial<Particle>): Particle {
    const particle = this._pool.acquire();
    Object.assign(particle, config);
    particle.active = true;
    this._active.push(particle);
    return particle;
  }

  /**
   * Spawn an enhanced explosion burst with multiple particle types
   */
  spawnExplosion(x: number, y: number, color: number, count: number = 20): void {
    // Main explosion particles (colored)
    for (let i = 0; i < count; i++) {
      const angle = (Math.PI * 2 * i) / count + Math.random() * 0.2;
      const speed = 100 + Math.random() * 250;
      this.spawn({
        type: ParticleType.EXPLOSION,
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 1,
        decay: 1.5,
        startSize: 6 + Math.random() * 12,
        endSize: 0,
        size: 6,
        color,
        alpha: 1,
        rotation: Math.random() * Math.PI * 2,
        rotationSpeed: (Math.random() - 0.5) * 12,
        gravity: 0,
        active: true,
      });
    }

    // White hot center particles
    for (let i = 0; i < count / 2; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 50 + Math.random() * 100;
      this.spawn({
        type: ParticleType.EXPLOSION,
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 1,
        decay: 2.5,
        startSize: 8 + Math.random() * 8,
        endSize: 0,
        size: 8,
        color: 0xffffff,
        alpha: 1,
        rotation: Math.random() * Math.PI * 2,
        rotationSpeed: (Math.random() - 0.5) * 15,
        gravity: 0,
        active: true,
      });
    }

    // Spark particles (smaller, faster)
    for (let i = 0; i < count * 1.5; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 150 + Math.random() * 300;
      this.spawn({
        type: ParticleType.SPARK,
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 1,
        decay: 3,
        startSize: 2 + Math.random() * 3,
        endSize: 0,
        size: 2,
        color: 0xffff00,
        alpha: 1,
        rotation: Math.random() * Math.PI * 2,
        rotationSpeed: (Math.random() - 0.5) * 20,
        gravity: 0,
        active: true,
      });
    }
  }

  /**
   * Spawn enhanced exhaust trail with color gradient
   */
  spawnExhaust(x: number, y: number, angle: number, color: number): void {
    const spread = 0.4;
    const spreadAngle = angle + (Math.random() - 0.5) * spread;
    const speed = 40 + Math.random() * 60;

    // Primary exhaust particle
    this.spawn({
      type: ParticleType.EXHAUST,
      x,
      y,
      vx: -Math.cos(spreadAngle) * speed,
      vy: -Math.sin(spreadAngle) * speed,
      life: 1,
      decay: 2.5,
      startSize: 4,
      endSize: 0,
      size: 4,
      color,
      alpha: 0.7,
      rotation: spreadAngle,
      rotationSpeed: (Math.random() - 0.5) * 2,
      gravity: 0,
      active: true,
    });

    // Secondary lighter particle (adds depth)
    if (Math.random() > 0.5) {
      this.spawn({
        type: ParticleType.EXHAUST,
        x,
        y,
        vx: -Math.cos(spreadAngle + 0.1) * speed * 0.7,
        vy: -Math.sin(spreadAngle + 0.1) * speed * 0.7,
        life: 1,
        decay: 3,
        startSize: 2,
        endSize: 0,
        size: 2,
        color: 0xffffff,
        alpha: 0.4,
        rotation: spreadAngle,
        rotationSpeed: 0,
        gravity: 0,
        active: true,
      });
    }
  }

  /**
   * Spawn shield effect
   */
  spawnShield(x: number, y: number, radius: number): void {
    for (let i = 0; i < 8; i++) {
      const angle = (Math.PI * 2 * i) / 8;
      const dist = radius + 5;
      this.spawn({
        type: ParticleType.SHIELD,
        x: x + Math.cos(angle) * dist,
        y: y + Math.sin(angle) * dist,
        vx: Math.cos(angle) * 30,
        vy: Math.sin(angle) * 30,
        life: 1,
        decay: 1.5,
        startSize: 3,
        endSize: 0,
        size: 3,
        color: 0x00ffff,
        alpha: 0.8,
        rotation: angle,
        rotationSpeed: 2,
        gravity: 0,
        active: true,
      });
    }
  }

  /**
   * Spawn speed line effect
   */
  spawnSpeedLine(x: number, y: number, angle: number, speed: number): void {
    this.spawn({
      type: ParticleType.SPEED_LINE,
      x: x - Math.cos(angle) * 50,
      y: y - Math.sin(angle) * 50,
      vx: -Math.cos(angle) * speed * 2,
      vy: -Math.sin(angle) * speed * 2,
      life: 1,
      decay: 4,
      startSize: 20,
      endSize: 50,
      size: 20,
      color: 0xffffff,
      alpha: 0.3,
      rotation: angle,
      rotationSpeed: 0,
      gravity: 0,
      active: true,
    });
  }

  /**
   * Spawn death burst effect (dramatic explosion on death)
   */
  spawnDeathBurst(x: number, y: number, color: number): void {
    // Large explosion particles
    for (let i = 0; i < 30; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 150 + Math.random() * 300;
      this.spawn({
        type: ParticleType.DEATH_BURST,
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 1,
        decay: 1.2,
        startSize: 10 + Math.random() * 15,
        endSize: 0,
        size: 10,
        color,
        alpha: 1,
        rotation: Math.random() * Math.PI * 2,
        rotationSpeed: (Math.random() - 0.5) * 15,
        gravity: 20,
        active: true,
      });
    }

    // Bright core explosion
    for (let i = 0; i < 15; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 80 + Math.random() * 150;
      this.spawn({
        type: ParticleType.DEATH_BURST,
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 1,
        decay: 2,
        startSize: 15 + Math.random() * 10,
        endSize: 0,
        size: 15,
        color: 0xffffff,
        alpha: 1,
        rotation: Math.random() * Math.PI * 2,
        rotationSpeed: (Math.random() - 0.5) * 10,
        gravity: 10,
        active: true,
      });
    }

    // Smoke particles
    for (let i = 0; i < 12; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 40 + Math.random() * 80;
      this.spawn({
        type: ParticleType.SMOKE,
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 1,
        decay: 0.8,
        startSize: 8 + Math.random() * 12,
        endSize: 20,
        size: 8,
        color: 0x444444,
        alpha: 0.5,
        rotation: Math.random() * Math.PI * 2,
        rotationSpeed: (Math.random() - 0.5) * 3,
        gravity: -30,
        active: true,
      });
    }
  }

  /**
   * Spawn spawn effect (birth animation)
   */
  spawnSpawnEffect(x: number, y: number, color: number): void {
    // Inward particles (converging to center)
    for (let i = 0; i < 20; i++) {
      const angle = Math.random() * Math.PI * 2;
      const dist = 100 + Math.random() * 50;
      const speed = 200 + Math.random() * 100;

      this.spawn({
        type: ParticleType.EXPLOSION,
        x: x + Math.cos(angle) * dist,
        y: y + Math.sin(angle) * dist,
        vx: -Math.cos(angle) * speed,
        vy: -Math.sin(angle) * speed,
        life: 1,
        decay: 2.5,
        startSize: 6,
        endSize: 0,
        size: 6,
        color,
        alpha: 0.8,
        rotation: angle + Math.PI,
        rotationSpeed: 5,
        gravity: 0,
        active: true,
      });
    }

    // Bright flash particles at center
    for (let i = 0; i < 10; i++) {
      this.spawn({
        type: ParticleType.SPARK,
        x: x + (Math.random() - 0.5) * 20,
        y: y + (Math.random() - 0.5) * 20,
        vx: (Math.random() - 0.5) * 50,
        vy: (Math.random() - 0.5) * 50,
        life: 1,
        decay: 3,
        startSize: 5,
        endSize: 0,
        size: 5,
        color: 0xffffff,
        alpha: 1,
        rotation: Math.random() * Math.PI * 2,
        rotationSpeed: (Math.random() - 0.5) * 10,
        gravity: 0,
        active: true,
      });
    }
  }

  /**
   * Update all active particles
   * Returns particles that died this frame
   */
  update(dt: number): Particle[] {
    const dead: Particle[] = [];

    for (let i = this._active.length - 1; i >= 0; i--) {
      const p = this._active[i];

      if (!p.active) {
        this._active.splice(i, 1);
        this._pool.release(p);
        continue;
      }

      // Update position
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += p.gravity * dt;

      // Update rotation
      p.rotation += p.rotationSpeed * dt;

      // Update life
      p.life -= p.decay * dt;

      // Update size (lerp between start and end)
      const t = 1 - p.life;
      p.size = p.startSize + (p.endSize - p.startSize) * t;

      // Update alpha (fade out with life)
      p.alpha = p.life;

      // Check if dead
      if (p.life <= 0) {
        p.active = false;
        dead.push(p);
        this._active.splice(i, 1);
        this._pool.release(p);
      }
    }

    return dead;
  }

  /**
   * Get all active particles
   */
  getActive(): ReadonlyArray<Particle> {
    return this._active;
  }

  /**
   * Get count of active particles
   */
  getActiveCount(): number {
    return this._active.length;
  }

  /**
   * Clear all active particles
   */
  clear(): void {
    for (const p of this._active) {
      this._pool.release(p);
    }
    this._active.length = 0;

    // Also clean up the graphics object if set
    if (this._graphics) {
      try {
        this._graphics.clear();
      } catch {
        // Graphics may have been destroyed already (e.g. during teardown)
      }
    }
  }

  /**
   * Destroy the particle pool and release all resources
   */
  destroy(): void {
    // Clear all active particles
    this.clear();

    // Clear the pool
    this._pool.clear();

    // Destroy graphics if we created it
    if (this._graphics) {
      try {
        this._graphics.destroy({ children: true });
      } catch {
        // Ignore errors during cleanup
      }
      this._graphics = null;
    }
  }

  /**
   * Get pool statistics
   */
  getStats() {
    return this._pool.getStats();
  }

  /**
   * Create a new particle instance
   */
  private _createParticle(): Particle {
    return {
      type: ParticleType.EXPLOSION,
      x: 0,
      y: 0,
      vx: 0,
      vy: 0,
      life: 1,
      decay: 1,
      size: 0,
      startSize: 0,
      endSize: 0,
      color: 0xffffff,
      alpha: 1,
      rotation: 0,
      rotationSpeed: 0,
      gravity: 0,
      active: false,
    };
  }

  /**
   * Reset a particle for reuse
   */
  private _resetParticle(p: Particle): void {
    p.type = ParticleType.EXPLOSION;
    p.x = 0;
    p.y = 0;
    p.vx = 0;
    p.vy = 0;
    p.life = 1;
    p.decay = 1;
    p.size = 0;
    p.startSize = 0;
    p.endSize = 0;
    p.color = 0xffffff;
    p.alpha = 1;
    p.rotation = 0;
    p.rotationSpeed = 0;
    p.gravity = 0;
    p.active = false;
  }
}

/**
 * Global particle pool instance
 */
let globalParticlePool: ParticlePool | null = null;

export function getParticlePool(): ParticlePool {
  if (!globalParticlePool) {
    globalParticlePool = new ParticlePool();
  }
  return globalParticlePool;
}

export function setParticlePool(pool: ParticlePool): void {
  globalParticlePool = pool;
}
