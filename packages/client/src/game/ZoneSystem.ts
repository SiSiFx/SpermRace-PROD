import * as PIXI from 'pixi.js';
import type { Car, Zone, Theme, Arena, WsHud, PreStart } from './types';

export interface ZoneSystemConfig {
  arena: Arena;
  theme: Theme;
  worldContainer: PIXI.Container;
  uiContainer: HTMLDivElement;
}

export class ZoneSystem {
  private config: ZoneSystemConfig;
  private zoneGraphics: PIXI.Graphics | null = null;
  private finalSurgeBannerShown = false;
  private finalSurgeTimeout: number | undefined;
  
  public zone: Zone & { currentRadius?: number; targetRadius?: number } = {
    centerX: 0,
    centerY: 0,
    startRadius: 0,
    endRadius: 400,
    startAtMs: 0,
    durationMs: 90000,
    currentRadius: 0,
    targetRadius: 0,
  };

  constructor(config: ZoneSystemConfig) {
    this.config = config;
  }

  setup(wsHud: WsHud | null, preStart: PreStart | null) {
    const now = Date.now();
    const isTournament = !!(wsHud && wsHud.active);
    
    this.zone.centerX = 0;
    this.zone.centerY = 0;
    this.zone.startRadius = Math.min(this.config.arena.width, this.config.arena.height) * 0.48;
    this.zone.currentRadius = this.zone.startRadius;
    this.zone.targetRadius = this.zone.startRadius;
    this.zone.endRadius = 400;

    if (isTournament) {
      this.zone.startAtMs = now;
      this.zone.durationMs = 42000;
    } else {
      const preStartMs = preStart?.durationMs ?? 3000;
      const practiceDelayMs = 7000;
      this.zone.startAtMs = now + preStartMs + practiceDelayMs;
      this.zone.durationMs = 60000;
    }
    
    this.zoneGraphics = new PIXI.Graphics();
    this.config.worldContainer.addChild(this.zoneGraphics);
    this.finalSurgeBannerShown = false;
  }

  update(
    deltaTime: number,
    player: Car | null,
    cars: Car[],
    preStart: PreStart | null,
    onDestroyCar: (car: Car) => void,
    hudManager: { updateZoneTimer: (secs: number) => void } | null
  ) {
    if (!this.zoneGraphics) return;
    
    const now = Date.now();
    const preStartActive = preStart
      ? Math.max(0, preStart.durationMs - (now - preStart.startAt)) > 0
      : false;
    const zoneStart = this.zone.startAtMs || now;
    const elapsed = Math.max(0, now - zoneStart);
    const progress = this.zone.durationMs > 0 ? Math.min(1, Math.max(0, elapsed / this.zone.durationMs)) : 0;
    const tension = Math.pow(progress, 1.35);
    
    // Smooth circular shrinking
    this.zone.targetRadius = this.zone.startRadius - (this.zone.startRadius - this.zone.endRadius) * progress;
    
    // Smooth interpolation
    const lerpSpeed = 2.5;
    this.zone.currentRadius! += (this.zone.targetRadius! - this.zone.currentRadius!) * lerpSpeed * deltaTime;
    
    // Draw zone
    this.drawZone(player, now);
    
    // Update HUD timer
    const remainMs = Math.max(0, this.zone.startAtMs + this.zone.durationMs - now);
    const zoneNotStarted = this.zone.startAtMs ? now < this.zone.startAtMs : false;
    const zoneDamageActive = !preStartActive && !zoneNotStarted;
    
    if (!this.finalSurgeBannerShown && remainMs <= 10000) {
      this.showFinalSurgeBanner();
      this.finalSurgeBannerShown = true;
    }
    
    if (hudManager) {
      const secs = Math.ceil(remainMs / 1000);
      hudManager.updateZoneTimer(secs);
    }

    // Apply zone damage
    if (zoneDamageActive) {
      for (const car of cars) {
        this.applyZoneDamage(car, player, tension, deltaTime, onDestroyCar);
      }
    } else {
      // Reset zone time during countdown
      for (const car of cars) {
        car.outZoneTime = 0;
      }
      this.hideZoneWarning();
    }
  }

  private drawZone(player: Car | null, now: number) {
    this.zoneGraphics!.clear();
    
    const cx = this.zone.centerX;
    const cy = this.zone.centerY;
    const safeRadius = this.zone.currentRadius!;
    
    // Check player proximity for border color
    let borderColor = this.config.theme.accent;
    let borderAlpha = 0.9;
    
    if (player && !player.destroyed) {
      const dx = player.x - cx;
      const dy = player.y - cy;
      const distFromCenter = Math.sqrt(dx * dx + dy * dy);
      const distToEdge = safeRadius - distFromCenter;
      
      if (distToEdge < 100) {
        borderColor = 0xef4444;
        borderAlpha = 1.0;
      } else if (distToEdge < 250) {
        borderColor = 0xf97316;
        borderAlpha = 0.95;
      } else if (distToEdge < 400) {
        borderColor = 0xfbbf24;
        borderAlpha = 0.92;
      }
    }
    
    // Safe zone circle
    this.zoneGraphics!
      .circle(cx, cy, safeRadius)
      .fill({ color: 0x020617, alpha: 0.4 })
      .stroke({ width: 8, color: borderColor, alpha: borderAlpha });
    
    // Inner ring
    this.zoneGraphics!
      .circle(cx, cy, Math.max(0, safeRadius - 8))
      .stroke({ width: 2, color: 0xffffff, alpha: 0.7 });
    
    // Outer danger zone with toxic gas effect
    this.drawToxicGas(cx, cy, safeRadius, now);
  }

  private drawToxicGas(cx: number, cy: number, safeRadius: number, now: number) {
    const dangerPulse = 0.3 + 0.2 * Math.sin(now * 0.003);
    const outerAlpha = 0.16 + dangerPulse * 0.16;
    const maxRadius = Math.sqrt(Math.pow(this.config.arena.width / 2, 2) + Math.pow(this.config.arena.height / 2, 2));
    
    for (let i = 0; i < 5; i++) {
      const baseR = safeRadius + (maxRadius - safeRadius) * ((i + 1) / 5);
      const alpha = outerAlpha * (1 - i / 5) * 0.7;
      
      const points: Array<{ x: number; y: number }> = [];
      const segments = 32;
      
      for (let j = 0; j < segments; j++) {
        const angle = (j / segments) * Math.PI * 2;
        
        const noise1 = Math.sin(angle * 3 + now * 0.0005 + i * 0.5) * 0.15;
        const noise2 = Math.sin(angle * 8 + now * 0.0008 + i * 0.3) * 0.08;
        const noise3 = Math.sin(angle * 16 + now * 0.001 + i * 0.2) * 0.04;
        
        const totalNoise = noise1 + noise2 + noise3;
        const irregularR = baseR * (1 + totalNoise);
        
        const px = cx + Math.cos(angle) * irregularR;
        const py = cy + Math.sin(angle) * irregularR;
        points.push({ x: px, y: py });
      }
      
      this.zoneGraphics!.poly(points.flatMap(p => [p.x, p.y]));
      this.zoneGraphics!.fill({ color: 0x450a0a, alpha });
    }
  }

  private applyZoneDamage(
    car: Car,
    player: Car | null,
    tension: number,
    deltaTime: number,
    onDestroyCar: (car: Car) => void
  ) {
    if (car.destroyed) return;
    
    const cx = this.zone.centerX;
    const cy = this.zone.centerY;
    const safeRadius = this.zone.currentRadius!;
    
    const dx = car.x - cx;
    const dy = car.y - cy;
    const distFromCenter = Math.sqrt(dx * dx + dy * dy);
    const inside = distFromCenter <= safeRadius;
    
    if (!inside) {
      if (car === player) {
        this.showZoneWarning();
      }
      
      // Push toward center
      const dist = distFromCenter || 1;
      const dirX = -dx / dist;
      const dirY = -dy / dist;
      const pushStrength = 20 + tension * 50;
      car.vx += dirX * pushStrength * deltaTime;
      car.vy += dirY * pushStrength * deltaTime;
      car.outZoneTime = (car.outZoneTime || 0) + deltaTime;
      
      // Eliminate after grace period
      const grace = Math.max(4, 8 - tension * 4);
      if (car.outZoneTime > grace) {
        onDestroyCar(car);
      }
    } else {
      car.outZoneTime = 0;
      if (car === player) {
        this.hideZoneWarning();
      }
    }
  }

  private showFinalSurgeBanner() {
    let banner = document.getElementById('final-surge-banner') as HTMLDivElement | null;
    if (!banner) {
      banner = document.createElement('div');
      banner.id = 'final-surge-banner';
      Object.assign(banner.style, {
        position: 'absolute',
        top: '35%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        padding: '20px 32px',
        borderRadius: '18px',
        background: 'rgba(15, 23, 42, 0.9)',
        border: '2px solid rgba(250,204,21,0.6)',
        color: '#facc15',
        fontSize: '28px',
        fontWeight: '800',
        letterSpacing: '0.14em',
        textShadow: '0 0 18px rgba(250,204,21,0.45)',
        opacity: '0',
        transition: 'opacity 200ms ease-out',
        pointerEvents: 'none',
        zIndex: '50',
        textAlign: 'center'
      });
      banner.textContent = 'FINAL SURGE • ZONE CRUSHING';
      this.config.uiContainer.appendChild(banner);
    }

    banner.style.opacity = '1';
    if (this.finalSurgeTimeout) window.clearTimeout(this.finalSurgeTimeout);
    this.finalSurgeTimeout = window.setTimeout(() => {
      try { banner!.style.opacity = '0'; } catch {}
    }, 2200);
  }

  showZoneWarning() {
    let warning = document.getElementById('zone-warning');
    if (!warning && this.config.uiContainer) {
      warning = document.createElement('div');
      warning.id = 'zone-warning';
      
      const isMobile = window.innerWidth <= 768;
      Object.assign(warning.style, {
        position: 'absolute',
        top: isMobile ? '30%' : '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        color: '#ef4444',
        fontSize: isMobile ? '20px' : '32px',
        fontWeight: '900',
        textAlign: 'center',
        textShadow: '0 0 20px rgba(239, 68, 68, 0.8)',
        animation: 'pulse 0.5s infinite',
        pointerEvents: 'none',
        zIndex: '100'
      });
      warning.innerHTML = '⚠️ OUTSIDE ZONE ⚠️<br><span style="font-size: 0.6em">Return to safety!</span>';
      this.config.uiContainer.appendChild(warning);
    }
    if (warning) {
      warning.style.display = 'block';
    }
  }

  hideZoneWarning() {
    const warning = document.getElementById('zone-warning');
    if (warning) {
      warning.style.display = 'none';
    }
  }

  getZone() {
    return this.zone;
  }

  isInsideZone(x: number, y: number): boolean {
    const dx = x - this.zone.centerX;
    const dy = y - this.zone.centerY;
    const dist = Math.sqrt(dx * dx + dy * dy);
    return dist <= (this.zone.currentRadius || this.zone.startRadius);
  }

  destroy() {
    if (this.zoneGraphics) {
      try {
        if (this.zoneGraphics.parent) {
          this.zoneGraphics.parent.removeChild(this.zoneGraphics);
        }
        this.zoneGraphics.destroy();
      } catch {}
      this.zoneGraphics = null;
    }
    
    try {
      const banner = document.getElementById('final-surge-banner');
      if (banner) banner.remove();
      const warning = document.getElementById('zone-warning');
      if (warning) warning.remove();
    } catch {}
    
    if (this.finalSurgeTimeout) {
      window.clearTimeout(this.finalSurgeTimeout);
    }
  }
}
