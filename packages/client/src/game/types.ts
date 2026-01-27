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
  // Drift Charge: builds when turning > 30 degrees for 1+ seconds
  driftCharge?: number;
  maxDriftCharge?: number;
  hardTurnTime?: number; // Time spent turning > 30 degrees
  requiredHardTurnDuration?: number; // Seconds required to build charge
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
