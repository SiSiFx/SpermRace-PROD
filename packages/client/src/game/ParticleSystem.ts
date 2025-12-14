import * as PIXI from 'pixi.js';
import type { Particle } from './types';
import { isMobileDevice } from './types';

export interface ParticleSystemConfig {
  worldContainer: PIXI.Container;
  maxPoolSize?: number;
}

export interface ParticleEffect {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  color: number;
  size: number;
  alpha: number;
  gravity?: number;
  friction?: number;
  shape: 'circle' | 'triangle' | 'diamond' | 'star';
  graphics: PIXI.Graphics;
  rotation?: number;
  rotationSpeed?: number;
}

export class ParticleSystem {
  private config: ParticleSystemConfig;
  private particles: Particle[] = [];
  private particlePool: PIXI.Graphics[] = [];
  private maxPoolSize: number;
  private screenShakeIntensity = 0;
  private screenShakeDecay = 0.92;

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

    // Enhanced explosion with shockwave effect
    this.createShockwave(x, y, color);
    this.triggerScreenShake(8);

    if (onShake) onShake();
  }

  createCollisionEffect(x: number, y: number, impactForce: number) {
    const isMobile = isMobileDevice();
    if (isMobile) return;
    
    const particleCount = Math.min(12, Math.floor(impactForce / 2));
    const colors = [0xff4444, 0xff6666, 0xffaa00, 0xffff00];
    
    for (let i = 0; i < particleCount; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 80 + Math.random() * 120;
      const life = 0.6 + Math.random() * 0.4;
      
      const particle = this.getParticle();
      const size = 2 + Math.random() * 4;
      const color = colors[Math.floor(Math.random() * colors.length)];
      
      // Create diamond shape for collision effect
      particle.moveTo(0, -size)
        .lineTo(size * 0.7, 0)
        .lineTo(0, size)
        .lineTo(-size * 0.7, 0)
        .closePath()
        .fill(color);
      
      particle.x = x;
      particle.y = y;
      
      this.config.worldContainer.addChild(particle);
      
      const particleData: ParticleEffect = {
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life,
        maxLife: life,
        color,
        size,
        alpha: 1,
        gravity: 0.3,
        friction: 0.98,
        shape: 'diamond',
        graphics: particle,
        rotation: Math.random() * Math.PI * 2,
        rotationSpeed: (Math.random() - 0.5) * 0.3
      };
      
      this.particles.push(particleData as any);
    }
  }

  createBoostTrail(x: number, y: number, direction: number, isPlayer: boolean) {
    const isMobile = isMobileDevice();
    if (isMobile && !isPlayer) return; // Skip for performance on mobile
    
    const particleCount = isPlayer ? 8 : 4;
    const trailColors = [0x00ffff, 0x00aaaa, 0x0088ff];
    
    for (let i = 0; i < particleCount; i++) {
      const spread = (Math.random() - 0.5) * 0.8;
      const angle = direction + spread;
      const speed = 60 + Math.random() * 80;
      const life = 0.4 + Math.random() * 0.3;
      const size = 3 + Math.random() * 2;
      
      const particle = this.getParticle();
      const color = trailColors[Math.floor(Math.random() * trailColors.length)];
      
      particle.circle(0, 0, size).fill(color);
      particle.x = x;
      particle.y = y;
      particle.alpha = 0.8;
      
      this.config.worldContainer.addChild(particle);
      
      const particleData: ParticleEffect = {
        x,
        y,
        vx: -Math.cos(angle) * speed,
        vy: -Math.sin(angle) * speed,
        life,
        maxLife: life,
        color,
        size,
        alpha: 0.8,
        friction: 0.96,
        shape: 'circle',
        graphics: particle
      };
      
      this.particles.push(particleData as any);
    }
  }

  createShockwave(x: number, y: number, color: number) {
    const isMobile = isMobileDevice();
    if (isMobile) return;
    
    const graphics = new PIXI.Graphics();
    graphics.x = x;
    graphics.y = y;
    
    this.config.worldContainer.addChild(graphics);
    
    const maxRadius = 80;
    const duration = 500; // ms
    const startTime = Date.now();
    
    const animate = () => {
      const elapsed = Date.now() - startTime;
      const progress = elapsed / duration;
      
      if (progress >= 1) {
        try {
          this.config.worldContainer.removeChild(graphics);
          graphics.destroy();
        } catch {}
        return;
      }
      
      graphics.clear();
      const radius = progress * maxRadius;
      const alpha = (1 - progress) * 0.6;
      
      graphics.circle(0, 0, radius)
        .stroke({ width: 3, color, alpha });
      
      requestAnimationFrame(animate);
    };
    
    animate();
  }

  createTrailSpark(x: number, y: number, isPlayer: boolean) {
    const isMobile = isMobileDevice();
    if (isMobile && !isPlayer) return;
    
    const particle = this.getParticle();
    const size = 1 + Math.random() * 2;
    const color = 0x00ffff;
    
    particle.circle(0, 0, size).fill(color);
    particle.x = x;
    particle.y = y;
    particle.alpha = 0.6;
    
    this.config.worldContainer.addChild(particle);
    
    const particleData: ParticleEffect = {
      x,
      y,
      vx: (Math.random() - 0.5) * 40,
      vy: (Math.random() - 0.5) * 40,
      life: 0.3 + Math.random() * 0.2,
      maxLife: 0.5,
      color,
      size,
      alpha: 0.6,
      friction: 0.95,
      shape: 'circle',
      graphics: particle
    };
    
    this.particles.push(particleData as any);
  }

  triggerScreenShake(intensity: number) {
    this.screenShakeIntensity = Math.min(this.screenShakeIntensity + intensity, 20);
  }

  getScreenShake(): { x: number; y: number } {
    if (this.screenShakeIntensity <= 0) return { x: 0, y: 0 };
    
    const shake = {
      x: (Math.random() - 0.5) * this.screenShakeIntensity,
      y: (Math.random() - 0.5) * this.screenShakeIntensity
    };
    
    this.screenShakeIntensity *= this.screenShakeDecay;
    if (this.screenShakeIntensity < 0.1) this.screenShakeIntensity = 0;
    
    return shake;
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
      
      // Update physics
      particle.x += particle.vx * deltaTime;
      particle.y += particle.vy * deltaTime;
      
      // Apply gravity
      if ((particle as any).gravity) {
        particle.vy += (particle as any).gravity * deltaTime;
      }
      
      // Apply friction
      if ((particle as any).friction) {
        particle.vx *= Math.pow((particle as any).friction, deltaTime * 60);
        particle.vy *= Math.pow((particle as any).friction, deltaTime * 60);
      }
      
      // Update rotation
      if ((particle as any).rotation !== undefined && (particle as any).rotationSpeed !== undefined) {
        (particle as any).rotation += (particle as any).rotationSpeed * deltaTime;
        particle.graphics.rotation = (particle as any).rotation;
      }
      
      // Update life
      particle.life -= deltaTime;
      
      // Update graphics
      particle.graphics.x = particle.x;
      particle.graphics.y = particle.y;
      
      if ((particle as any).maxLife) {
        // Enhanced particle with fade based on life ratio
        const lifeRatio = particle.life / (particle as any).maxLife;
        const alpha = (particle as any).alpha ?? 1;
        particle.graphics.alpha = Math.max(0, alpha * lifeRatio);
        
        // Scale effect based on life
        const scale = 0.5 + lifeRatio * 0.5;
        particle.graphics.scale.set(scale);
      } else {
        // Original simple fade
        particle.graphics.alpha = Math.max(0, particle.life);
      }
      
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
