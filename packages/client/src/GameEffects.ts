/**
 * Game Effects - Visual juice and polish
 * Screen flashes, floating text, etc.
 */

import * as PIXI from 'pixi.js';

export class GameEffects {
  private worldContainer: PIXI.Container;
  private circleTexture: PIXI.Texture;

  constructor(worldContainer: PIXI.Container) {
    this.worldContainer = worldContainer;

    // Pre-rendered radial circle texture for explosion particles
    if (typeof document !== 'undefined') {
      const size = 32;
      const canvas = document.createElement('canvas');
      canvas.width = canvas.height = size;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        const r = size / 2;
        const gradient = ctx.createRadialGradient(r, r, 0, r, r, r);
        gradient.addColorStop(0, 'rgba(255,255,255,1)');
        gradient.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(r, r, r, 0, Math.PI * 2);
        ctx.fill();
      }
      this.circleTexture = PIXI.Texture.from(canvas);
    } else {
      // Fallback for non-DOM environments (tests, SSR)
      this.circleTexture = PIXI.Texture.WHITE;
    }
  }

  /**
   * Flash the screen with a color
   */
  flashScreen(color: string, duration: number = 100) {
    let flash = document.getElementById('screen-flash');
    
    if (!flash) {
      flash = document.createElement('div');
      flash.id = 'screen-flash';
      flash.style.cssText = `
        position: fixed;
        inset: 0;
        pointer-events: none;
        z-index: 9999;
        transition: opacity 0.1s ease-out;
        opacity: 0;
      `;
      document.body.appendChild(flash);
    }

    flash.style.backgroundColor = color;
    flash.style.opacity = '0.6';

    setTimeout(() => {
      if (flash) flash.style.opacity = '0';
    }, duration);
  }

  /**
   * Show big screen text (MEGA KILL!, etc)
   */
  showBigScreenText(text: string, color: string, duration: number = 2000) {
    const textEl = document.createElement('div');
    textEl.textContent = text;
    textEl.style.cssText = `
      position: fixed;
      top: 30%;
      left: 50%;
      transform: translate(-50%, -50%) scale(0.5);
      color: ${color};
      font-size: 72px;
      font-weight: 900;
      text-align: center;
      pointer-events: none;
      z-index: 9998;
      text-shadow: 
        0 0 20px ${color},
        0 0 40px ${color},
        4px 4px 0 #000,
        -4px -4px 0 #000,
        4px -4px 0 #000,
        -4px 4px 0 #000;
      animation: bigTextPulse 0.3s ease-out forwards;
      white-space: nowrap;
    `;

    // Add animation keyframes if not exists
    if (!document.getElementById('bigTextAnimations')) {
      const style = document.createElement('style');
      style.id = 'bigTextAnimations';
      style.textContent = `
        @keyframes bigTextPulse {
          0% { transform: translate(-50%, -50%) scale(0.5); opacity: 0; }
          50% { transform: translate(-50%, -50%) scale(1.2); opacity: 1; }
          100% { transform: translate(-50%, -50%) scale(1); opacity: 1; }
        }
        @keyframes bigTextFade {
          to { opacity: 0; transform: translate(-50%, -50%) scale(1.5); }
        }
      `;
      document.head.appendChild(style);
    }

    document.body.appendChild(textEl);

    // Fade out
    setTimeout(() => {
      textEl.style.animation = `bigTextFade 0.5s ease-out forwards`;
    }, duration - 500);

    // Remove
    setTimeout(() => {
      textEl.remove();
    }, duration);
  }

  /**
   * Show floating text (damage, XP, etc)
   */
  showFloatingText(
    x: number,
    y: number,
    text: string,
    color: string,
    scale: number = 1.0,
    duration: number = 1500
  ) {
    const textObj = new PIXI.Text(text, {
      fontSize: Math.round(28 * scale),
      fill: color,
      fontWeight: 'bold',
      stroke: { color: '#000000', width: 5 },
    } as any);

    textObj.x = x;
    textObj.y = y;
    textObj.anchor.set(0.5);
    textObj.zIndex = 9999;

    this.worldContainer.addChild(textObj);

    const startTime = Date.now();
    const startY = y;

    const animate = () => {
      const elapsed = Date.now() - startTime;
      const progress = elapsed / duration;

      if (progress >= 1) {
        this.worldContainer.removeChild(textObj);
        textObj.destroy();
        return;
      }

      // Move up
      textObj.y = startY - (progress * 80);
      
      // Fade out
      textObj.alpha = 1 - progress;
      
      // Scale up slightly
      const scaleValue = scale * (1 + progress * 0.3);
      textObj.scale.set(scaleValue);

      requestAnimationFrame(animate);
    };

    animate();
  }

  /**
   * Create mega explosion effect
   */
  createMegaExplosion(
    x: number,
    y: number,
    color: number,
    particleCount: number = 50
  ): PIXI.Sprite[] {
    const particles: PIXI.Sprite[] = [];

    for (let i = 0; i < particleCount; i++) {
      const angle = (Math.PI * 2 / particleCount) * i + (Math.random() - 0.5) * 0.5;
      const speed = 200 + Math.random() * 300;
      const size = 3 + Math.random() * 8;

      // Mix of colors for more dynamic explosion
      const explosionColors = [0xFFFFFF, 0xFFFF00, 0xFF6600, 0xFF0000, color];
      const particleColor = explosionColors[Math.floor(Math.random() * explosionColors.length)];

      const particle = new PIXI.Sprite(this.circleTexture);
      particle.anchor.set(0.5);
      particle.x = x;
      particle.y = y;
      particle.alpha = 1;
      particle.tint = particleColor;
      const baseRadius = 16;
      const scale = size / baseRadius;
      particle.scale.set(scale);

      this.worldContainer.addChild(particle);
      particles.push(particle);

      // Animate
      const vx = Math.cos(angle) * speed;
      const vy = Math.sin(angle) * speed;
      const lifetime = 800 + Math.random() * 400;
      const startTime = Date.now();

      const animate = () => {
        const elapsed = Date.now() - startTime;
        const progress = elapsed / lifetime;

        if (progress >= 1) {
        this.worldContainer.removeChild(particle);
        particle.destroy();
          return;
        }

        particle.x += vx * 0.016;
        particle.y += vy * 0.016;
        particle.alpha = 1 - progress;
        particle.scale.set(scale * (1 - progress * 0.5));

        requestAnimationFrame(animate);
      };

      animate();
    }

    return particles;
  }

  /**
   * Create shockwave ring
   */
  createShockwave(x: number, y: number, color: number = 0x00FFFF) {
    const ring = new PIXI.Graphics();
    ring.circle(0, 0, 5).stroke({ width: 4, color });
    ring.x = x;
    ring.y = y;
    ring.alpha = 1;

    this.worldContainer.addChild(ring);

    const startTime = Date.now();
    const duration = 600;
    const maxRadius = 150;

    const animate = () => {
      const elapsed = Date.now() - startTime;
      const progress = elapsed / duration;

      if (progress >= 1) {
        this.worldContainer.removeChild(ring);
        ring.destroy();
        return;
      }

      ring.clear();
      const radius = maxRadius * progress;
      ring.circle(0, 0, radius).stroke({ 
        width: 4 * (1 - progress), 
        color 
      });
      ring.alpha = 1 - progress;

      requestAnimationFrame(animate);
    };

    animate();
  }

  /**
   * Create speed lines (for boost)
   */
  createSpeedLines(playerX: number, playerY: number, angle: number) {
    const lineCount = 12;
    
    for (let i = 0; i < lineCount; i++) {
      const spreadAngle = angle + (Math.random() - 0.5) * 0.8;
      const distance = 80 + Math.random() * 40;
      const length = 20 + Math.random() * 30;

      const startX = playerX - Math.cos(spreadAngle) * distance;
      const startY = playerY - Math.sin(spreadAngle) * distance;

      const line = new PIXI.Graphics();
      line.moveTo(0, 0).lineTo(length, 0).stroke({ 
        width: 2, 
        color: 0x00FFFF, 
        alpha: 0.6 
      });
      line.x = startX;
      line.y = startY;
      line.rotation = spreadAngle;

      this.worldContainer.addChild(line);

      // Animate
      const startTime = Date.now();
      const duration = 400;

      const animate = () => {
        const elapsed = Date.now() - startTime;
        const progress = elapsed / duration;

        if (progress >= 1) {
          this.worldContainer.removeChild(line);
          line.destroy();
          return;
        }

        line.alpha = 0.6 * (1 - progress);
        line.x = startX - Math.cos(spreadAngle) * (progress * 200);
        line.y = startY - Math.sin(spreadAngle) * (progress * 200);

        requestAnimationFrame(animate);
      };

      animate();
    }
  }

  /**
   * Create confetti burst
   */
  createConfetti(x: number, y: number, count: number = 30) {
    const colors = [0xFF0000, 0x00FF00, 0x0000FF, 0xFFFF00, 0xFF00FF, 0x00FFFF];

    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 150 + Math.random() * 200;
      const size = 4 + Math.random() * 6;
      const color = colors[Math.floor(Math.random() * colors.length)];

      const particle = new PIXI.Graphics();
      particle.rect(0, 0, size, size).fill(color);
      particle.x = x;
      particle.y = y;
      particle.rotation = Math.random() * Math.PI * 2;

      this.worldContainer.addChild(particle);

      const vx = Math.cos(angle) * speed;
      const vy = Math.sin(angle) * speed - 200; // Initial upward velocity
      const rotationSpeed = (Math.random() - 0.5) * 0.3;
      const gravity = 600;

      const startTime = Date.now();
      const duration = 1500;

      const animate = () => {
        const elapsed = Date.now() - startTime;
        const progress = elapsed / duration;
        const delta = 0.016;

        if (progress >= 1) {
          this.worldContainer.removeChild(particle);
          particle.destroy();
          return;
        }

        particle.x += vx * delta;
        particle.y += (vy + gravity * (elapsed / 1000)) * delta;
        particle.rotation += rotationSpeed;
        particle.alpha = 1 - progress;

        requestAnimationFrame(animate);
      };

      animate();
    }
  }
}

export default GameEffects;
