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

  /**
   * Create exhaust particles when boosting/drifting
   * Creates a trail of particles behind the car
   */
  createBoostExhaust(x: number, y: number, angle: number, color: number): void {
    const count = 2; // Particles per frame
    for (let i = 0; i < count; i++) {
      // Emit in opposite direction of car movement (behind the car)
      const spread = (Math.random() - 0.5) * 0.5; // Slight spread
      const emitAngle = angle + Math.PI + spread;
      const speed = 30 + Math.random() * 50;

      const g = this.getParticle();
      g.clear();

      // Exhaust particles are smaller and have different colors
      const exhaustColor = Math.random() < 0.5 ? 0x22d3ee : 0x6366f1;
      const size = 2 + Math.random() * 2;
      g.circle(0, 0, size).fill({ color: exhaustColor, alpha: 0.7 });

      // Offset slightly behind the car
      g.x = x - Math.cos(angle) * 15;
      g.y = y - Math.sin(angle) * 15;
      this.container.addChild(g);

      this.particles.push({
        x: g.x,
        y: g.y,
        vx: Math.cos(emitAngle) * speed,
        vy: Math.sin(emitAngle) * speed,
        life: 0.3 + Math.random() * 0.2,
        color: exhaustColor,
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
