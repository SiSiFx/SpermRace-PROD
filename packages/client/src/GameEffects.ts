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

      // Inject cinematic VFX styles once (system-warning aesthetic)
      if (!document.getElementById('vfx-message-styles')) {
        const style = document.createElement('style');
        style.id = 'vfx-message-styles';
        style.textContent = `
          .vfx-message {
            position: fixed;
            top: 32%;
            left: 50%;
            transform: translate(-50%, -50%);
            text-align: center;
            pointer-events: none;
            z-index: 9998;
            font-family: 'Orbitron', system-ui, -apple-system, BlinkMacSystemFont, 'SF Mono', monospace;
            text-transform: uppercase;
            letter-spacing: 0.16em;
            color: #f9fafb;
            text-shadow: 0 0 12px rgba(248, 250, 252, 0.6);
          }
          .vfx-title {
            font-size: 64px;
            font-weight: 800;
            animation: glitch-skew 0.24s ease-in-out infinite alternate;
          }
          .vfx-subtitle {
            margin-top: 8px;
            font-size: 24px;
            opacity: 0.9;
          }
          @keyframes glitch-skew {
            0% { transform: translate3d(0,0,0) skewX(0deg); }
            25% { transform: translate3d(0,0,0) skewX(-4deg); }
            50% { transform: translate3d(0,0,0) skewX(3deg); }
            75% { transform: translate3d(0,0,0) skewX(-2deg); }
            100% { transform: translate3d(0,0,0) skewX(0deg); }
          }
          @keyframes blink-warning {
            0%, 100% { opacity: 1; }
            50% { opacity: 0.3; }
          }
        `;
        document.head.appendChild(style);
      }
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
   * Trigger impact haptics for mobile
   */
  triggerImpact(intensity: 'light' | 'medium' | 'heavy') {
    if (typeof navigator === 'undefined' || !navigator.vibrate) return;
    
    switch (intensity) {
      case 'light':
        navigator.vibrate(10);
        break;
      case 'medium':
        navigator.vibrate(30);
        break;
      case 'heavy':
        // Double pulse for heavy hits (kills/crashes)
        navigator.vibrate([50, 30, 50]);
        break;
    }
  }

  /**
   * Show big screen text (MEGA KILL!, etc)
   */
  showBigScreenText(text: string, color: string, duration: number = 2000) {
    if (typeof document === 'undefined') return;

    const wrapper = document.createElement('div');
    wrapper.className = 'vfx-message';

    const title = document.createElement('div');
    title.className = 'vfx-title';
    title.textContent = text;
    title.style.color = color;

    wrapper.appendChild(title);
    document.body.appendChild(wrapper);

    // Simple fade-out at the end of duration
    setTimeout(() => {
      wrapper.style.transition = 'opacity 0.4s ease-out, transform 0.4s ease-out';
      wrapper.style.opacity = '0';
      wrapper.style.transform = 'translate(-50%, -50%) scale(1.06)';
    }, Math.max(0, duration - 400));

    setTimeout(() => {
      wrapper.remove();
    }, duration);
  }

  /**
   * Show critical system failure effect on player death
   */
  showCriticalFailure() {
    if (typeof document === 'undefined') return;

    // Create red flash overlay
    this.flashScreen('rgba(255, 0, 0, 0.4)', 150);

    // Create glitch text effect
    const wrapper = document.createElement('div');
    wrapper.style.cssText = `
      position: fixed;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      text-align: center;
      pointer-events: none;
      z-index: 9999;
      font-family: 'Orbitron', monospace;
      animation: critical-glitch 0.3s ease-in-out, screen-shake 0.5s ease-out;
    `;

    const title = document.createElement('div');
    title.textContent = 'CRITICAL FAILURE';
    title.style.cssText = `
      font-size: 72px;
      font-weight: 900;
      color: #ff0000;
      text-transform: uppercase;
      letter-spacing: 0.1em;
      text-shadow:
        2px 0 #ff0000,
        -2px 0 #00ffff,
        0 0 30px rgba(255, 0, 0, 0.8);
      animation: rgb-split 0.2s ease-in-out infinite;
    `;

    wrapper.appendChild(title);
    document.body.appendChild(wrapper);

    // Fade out and remove
    setTimeout(() => {
      wrapper.style.transition = 'opacity 0.3s ease-out';
      wrapper.style.opacity = '0';
    }, 800);

    setTimeout(() => {
      try { wrapper.remove(); } catch {}
    }, 1200);
  }

  /**
   * Show cinematic zone warning when the arena begins collapsing.
   * Early stages are yellow; late stages red.
   */
  showZoneWarning(stage: number = 1) {
    if (typeof document === 'undefined') return;

    const isFinal = stage >= 2;
    const accentColor = isFinal ? '#ff4b4b' : '#facc15';

    const wrapper = document.createElement('div');
    wrapper.className = 'vfx-message';
    wrapper.style.animation = 'blink-warning 0.9s ease-in-out infinite';

    const title = document.createElement('div');
    title.className = 'vfx-title';
    title.textContent = 'ZONE UNSTABLE';
    title.style.color = accentColor;

    const subtitle = document.createElement('div');
    subtitle.className = 'vfx-subtitle';
    subtitle.textContent = 'COLLAPSE IMMINENT';
    subtitle.style.color = isFinal ? '#fecaca' : '#fef9c3';

    wrapper.appendChild(title);
    wrapper.appendChild(subtitle);
    document.body.appendChild(wrapper);

    // Subtle red flash overlay
    this.flashScreen('rgba(255,0,0,0.3)', 200);

    setTimeout(() => {
      wrapper.style.transition = 'opacity 0.3s ease-out';
      wrapper.style.opacity = '0';
    }, 1200);

    setTimeout(() => {
      try { wrapper.remove(); } catch {}
    }, 1600);
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
    // Optimize particle count for mobile (if detected or generally safer default)
    // Since we don't have direct isMobile flag here, we'll be conservative
    // The caller can pass a lower count if needed
    const finalCount = Math.min(particleCount, 30); 
    const particles: PIXI.Sprite[] = [];

    for (let i = 0; i < finalCount; i++) {
      const angle = (Math.PI * 2 / finalCount) * i + (Math.random() - 0.5) * 0.5;
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
    const finalCount = Math.min(count, 20);
    const colors = [0xFF0000, 0x00FF00, 0x0000FF, 0xFFFF00, 0xFF00FF, 0x00FFFF];

    for (let i = 0; i < finalCount; i++) {
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
