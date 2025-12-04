import * as PIXI from 'pixi.js';
import { Particle, isMobileDevice } from './types';

export interface ParticleSystemConfig {
  worldContainer: PIXI.Container;
  maxPoolSize?: number;
}

export class ParticleSystem {
  private config: ParticleSystemConfig;
  private particles: Particle[] = [];
  private particlePool: PIXI.Graphics[] = [];
  private maxPoolSize: number;

  constructor(config: ParticleSystemConfig) {
    this.config = config;
    this.maxPoolSize = config.maxPoolSize || 100;
  }

  createExplosion(x: number, y: number, color: number, onShake?: () => void) {
    const isMobile = isMobileDevice();
    const particleCount = isMobile ? 15 : 30;
    
    for (let i = 0; i < particleCount; i++) {
      const angle = (Math.PI * 2 / particleCount) * i + (Math.random() - 0.5) * 0.3;
      const speed = 150 + Math.random() * 200;
      
      const explosionColors = [0xFFFFFF, 0xFFFF00, 0xFF6600, color];
      const particleColor = explosionColors[Math.floor(Math.random() * explosionColors.length)];
      
      const graphics = this.getParticle();
      const size = 5 + Math.random() * 3;
      graphics.circle(0, 0, size).fill(particleColor);
      graphics.x = x;
      graphics.y = y;
      
      const particle: Particle = {
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 1.2,
        color: particleColor,
        graphics,
      };
      
      this.config.worldContainer.addChild(graphics);
      this.particles.push(particle);
    }

    if (onShake) onShake();
  }

  createBoostEffect(x: number, y: number) {
    const isMobile = isMobileDevice();
    if (isMobile) return; // Skip on mobile for performance
    
    const particleCount = 12;
    
    for (let i = 0; i < particleCount; i++) {
      const angle = (Math.PI * 2 * i) / particleCount;
      const speed = 300 + Math.random() * 150;
      const lifetime = 0.8;
      
      const particle = this.getParticle();
      particle.circle(0, 0, 4).fill(0x00ffff);
      particle.x = x;
      particle.y = y;
      
      this.config.worldContainer.addChild(particle);
      
      const startTime = Date.now();
      const vx = Math.cos(angle) * speed;
      const vy = Math.sin(angle) * speed;
      
      const animate = () => {
        const elapsed = (Date.now() - startTime) / 1000;
        if (elapsed >= lifetime) {
          try {
            this.config.worldContainer.removeChild(particle);
            this.returnParticle(particle);
          } catch {}
          return;
        }
        
        particle.x += vx * 0.016;
        particle.y += vy * 0.016;
        particle.alpha = 1 - (elapsed / lifetime);
        
        requestAnimationFrame(animate);
      };
      animate();
    }
  }

  update(deltaTime: number) {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const particle = this.particles[i];
      
      particle.x += particle.vx * deltaTime;
      particle.y += particle.vy * deltaTime;
      particle.life -= deltaTime * 2;
      
      particle.graphics.x = particle.x;
      particle.graphics.y = particle.y;
      particle.graphics.alpha = Math.max(0, particle.life);
      
      if (particle.life <= 0) {
        try {
          this.config.worldContainer.removeChild(particle.graphics);
          this.returnParticle(particle.graphics);
        } catch {}
        this.particles.splice(i, 1);
      }
    }
  }

  private getParticle(): PIXI.Graphics {
    const particle = this.particlePool.pop() || new PIXI.Graphics();
    particle.visible = true;
    particle.alpha = 1;
    particle.clear();
    return particle;
  }

  private returnParticle(particle: PIXI.Graphics) {
    particle.clear();
    particle.visible = false;
    particle.alpha = 0;
    
    if (this.particlePool.length < this.maxPoolSize) {
      this.particlePool.push(particle);
    } else {
      try { particle.destroy(); } catch {}
    }
  }

  destroy() {
    for (const particle of this.particles) {
      try {
        if (particle.graphics.parent) {
          particle.graphics.parent.removeChild(particle.graphics);
        }
        particle.graphics.destroy();
      } catch {}
    }
    this.particles = [];
    
    for (const p of this.particlePool) {
      try { p.destroy(); } catch {}
    }
    this.particlePool = [];
  }
}
