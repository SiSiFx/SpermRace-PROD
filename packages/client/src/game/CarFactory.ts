import * as PIXI from 'pixi.js';
import { Car, BOT_COLORS, isMobileDevice } from './types';

export interface CarFactoryConfig {
  theme: { text: string };
  uiContainer: HTMLDivElement | null;
}

export class CarFactory {
  private config: CarFactoryConfig;

  constructor(config: CarFactoryConfig) {
    this.config = config;
  }

  createCar(x: number, y: number, color: number, type: string): Car {
    const id = `${type}_${Math.random().toString(36).slice(2, 8)}`;
    const name = type === 'player' ? 'YOU' : (type || 'BOT').toUpperCase();
    const isMobile = isMobileDevice();
    
    const car: Car = {
      x, y, color, type,
      id,
      name,
      kills: 0,
      angle: 0,
      targetAngle: 0,
      speed: 220,
      baseSpeed: 220,
      boostSpeed: 850,
      targetSpeed: 220,
      speedTransitionRate: 18.0,
      driftFactor: 0,
      maxDriftFactor: type === 'bot' ? 0.8 : 0.7,
      vx: 0,
      vy: 0,
      destroyed: false,
      respawnTimer: 0,
      isBoosting: false,
      boostTimer: 0,
      boostCooldown: 0,
      boostEnergy: 100,
      maxBoostEnergy: 100,
      boostRegenRate: 24,
      boostConsumptionRate: 55,
      minBoostEnergy: 20,
      spawnTime: Date.now(),
      killBoostUntil: 0,
      trailPoints: [],
      trailGraphics: null,
      lastTrailTime: 0,
      turnTimer: 0,
      boostAITimer: 0,
      currentTrailId: null,
      lastTrailBoostStatus: undefined,
      sprite: new PIXI.Container(),
      headGraphics: new PIXI.Graphics(),
      tailGraphics: new PIXI.Graphics(),
      tailWaveT: 0,
      tailLength: 34,
      tailSegments: isMobile ? 4 : 10,
      tailAmplitude: 5,
      turnResponsiveness: type === 'player' ? 10.0 : 6.5,
      lateralDragScalar: 1.15,
      accelerationScalar: type === 'player' ? 24 : 18,
      handlingAssist: type === 'player' ? 0.65 : 0.35,
      impactMitigation: type === 'player' ? 0.75 : 0.6,
      hotspotBuffExpiresAt: undefined,
      spotlightUntil: 0,
      contactCooldown: 0
    };

    this.buildSpermVisuals(car, color, type);
    this.createNameplate(car, name);

    car.sprite.x = x;
    car.sprite.y = y;
    car.sprite.rotation = car.angle;
    car.sprite.visible = true;
    try { (car.sprite as any).zIndex = 50; } catch {}

    return car;
  }

  private buildSpermVisuals(car: Car, color: number, type: string) {
    car.headGraphics!.clear();
    const headSize = type === 'player' ? 8 : 10;
    const strokeWidth = type === 'player' ? 2 : 3;
    car.headGraphics!.circle(0, 0, headSize).fill(color).stroke({ width: strokeWidth, color, alpha: 0.5 });
    
    if (type !== 'player') {
      car.headGraphics!.circle(0, 0, headSize + 4).fill({ color, alpha: 0.15 });
    }
    
    if (car.tailGraphics) {
      car.tailGraphics!.clear();
      (car.tailGraphics as any).zIndex = 1;
      car.sprite.addChild(car.tailGraphics!);
    }
    (car.headGraphics as any).zIndex = 2;
    car.sprite.addChild(car.headGraphics!);
  }

  private createNameplate(car: Car, name: string) {
    if (!this.config.uiContainer) return;
    
    const nameplate = document.createElement('div');
    nameplate.textContent = name;
    Object.assign(nameplate.style, {
      position: 'absolute',
      color: this.config.theme.text,
      fontSize: '12px',
      textShadow: '',
      fontWeight: 'bold',
      pointerEvents: 'none',
      zIndex: '10',
      transform: 'translate(-50%, -120%)',
      background: 'rgba(0,0,0,0.35)',
      padding: '2px 6px',
      borderRadius: '8px',
      border: '1px solid rgba(255,255,255,0.08)',
      whiteSpace: 'nowrap'
    });
    this.config.uiContainer.appendChild(nameplate);
    (car as any).nameplate = nameplate;
  }

  createBot(index: number): { color: number } {
    const color = BOT_COLORS[index % BOT_COLORS.length] || 0xff00ff;
    return { color };
  }

  destroyNameplate(car: Car) {
    try {
      if ((car as any).nameplate) {
        (car as any).nameplate.remove();
        (car as any).nameplate = null;
      }
    } catch {}
  }
}

export interface SpawnPoint {
  x: number;
  y: number;
  angle: number;
}

export class SpawnManager {
  private arena: { width: number; height: number };
  private spawnQueue: SpawnPoint[] = [];
  private spawnQueueIndex = 0;

  constructor(arena: { width: number; height: number }) {
    this.arena = arena;
  }

  randomEdgeSpawn(): SpawnPoint {
    const left = -this.arena.width / 2;
    const right = this.arena.width / 2;
    const top = -this.arena.height / 2;
    const bottom = this.arena.height / 2;
    const margin = 120;
    const side = Math.floor(Math.random() * 4);
    
    if (side === 0) {
      const y = top + margin + Math.random() * (this.arena.height - 2 * margin);
      return { x: left + margin, y, angle: 0 + (Math.random() - 0.5) * 0.6 };
    } else if (side === 1) {
      const y = top + margin + Math.random() * (this.arena.height - 2 * margin);
      return { x: right - margin, y, angle: Math.PI + (Math.random() - 0.5) * 0.6 };
    } else if (side === 2) {
      const x = left + margin + Math.random() * (this.arena.width - 2 * margin);
      return { x, y: top + margin, angle: Math.PI / 2 + (Math.random() - 0.5) * 0.6 };
    } else {
      const x = left + margin + Math.random() * (this.arena.width - 2 * margin);
      return { x, y: bottom - margin, angle: -Math.PI / 2 + (Math.random() - 0.5) * 0.6 };
    }
  }

  buildSpawnQueue(count: number) {
    const spacing = 420;
    const margin = 220;
    const perSide = Math.ceil(count / 4);
    const left = -this.arena.width / 2 + margin;
    const right = this.arena.width / 2 - margin;
    const top = -this.arena.height / 2 + margin;
    const bottom = this.arena.height / 2 - margin;
    const q: SpawnPoint[] = [];
    const spanY = this.arena.height - 2 * margin;
    const spanX = this.arena.width - 2 * margin;
    const stepY = Math.max(spacing, spanY / perSide);
    const stepX = Math.max(spacing, spanX / perSide);
    
    // Left side
    for (let i = 0; i < perSide && q.length < count; i++) {
      const y = top + (i + 0.5) * stepY;
      q.push({ x: left, y: Math.min(bottom, Math.max(top, y)), angle: 0 + (Math.random() - 0.5) * 0.4 });
    }
    // Right side
    for (let i = 0; i < perSide && q.length < count; i++) {
      const y = top + (i + 0.5) * stepY;
      q.push({ x: right, y: Math.min(bottom, Math.max(top, y)), angle: Math.PI + (Math.random() - 0.5) * 0.4 });
    }
    // Top side
    for (let i = 0; i < perSide && q.length < count; i++) {
      const x = left + (i + 0.5) * stepX;
      q.push({ x: Math.min(right, Math.max(left, x)), y: top, angle: Math.PI / 2 + (Math.random() - 0.5) * 0.4 });
    }
    // Bottom side
    for (let i = 0; i < perSide && q.length < count; i++) {
      const x = left + (i + 0.5) * stepX;
      q.push({ x: Math.min(right, Math.max(left, x)), y: bottom, angle: -Math.PI / 2 + (Math.random() - 0.5) * 0.4 });
    }
    
    // Shuffle
    for (let i = q.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [q[i], q[j]] = [q[j], q[i]];
    }
    
    this.spawnQueue = q;
    this.spawnQueueIndex = 0;
  }

  getNextSpawn(): SpawnPoint {
    const spawn = this.spawnQueue[this.spawnQueueIndex] || this.randomEdgeSpawn();
    this.spawnQueueIndex++;
    return spawn;
  }

  clampToZone(spawn: SpawnPoint, zone: { centerX: number; centerY: number; startRadius: number }): SpawnPoint {
    if (!zone || !zone.startRadius) return spawn;
    
    let { x, y } = spawn;
    const dx = x - zone.centerX;
    const dy = y - zone.centerY;
    const dist = Math.sqrt(dx * dx + dy * dy) || 0;
    const maxRadius = zone.startRadius * 0.8;
    
    if (dist > maxRadius && dist > 0) {
      const scale = maxRadius / dist;
      x = zone.centerX + dx * scale;
      y = zone.centerY + dy * scale;
    }
    
    return { x, y, angle: spawn.angle };
  }
}
