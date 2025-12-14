import * as PIXI from 'pixi.js';

export interface Car {
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
  id: string;
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
  lastTrailBoostStatus: boolean | undefined;
  sprite: PIXI.Container;
  // Sperm visuals
  headGraphics?: PIXI.Graphics;
  tailGraphics?: PIXI.Graphics | null;
  tailWaveT?: number;
  tailLength?: number;
  tailSegments?: number;
  tailAmplitude?: number;
  nameplate?: HTMLDivElement;
  outZoneTime?: number;
  elimAtMs?: number;
  turnResponsiveness?: number;
  lateralDragScalar?: number;
  tailColor?: number;
  accelerationScalar?: number;
  handlingAssist?: number;
  impactMitigation?: number;
  hotspotBuffExpiresAt?: number;
  spotlightUntil?: number;
  contactCooldown?: number;
  spawnTime?: number;
  killBoostUntil?: number;
}

export interface TrailPoint {
  x: number;
  y: number;
  time: number;
  isBoosting: boolean;
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
  alpha?: number;
  maxLife?: number;
  gravity?: number;
  friction?: number;
  rotation?: number;
  rotationSpeed?: number;
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
  source?: 'ambient' | 'hotspot';
}

export interface RadarPing {
  x: number;
  y: number;
  timestamp: number;
  playerId: string;
  kind?: 'sweep' | 'echo' | 'bounty';
  ttlMs?: number;
}

export interface BoostPad {
  x: number;
  y: number;
  radius: number;
  cooldownMs: number;
  lastTriggeredAt: number;
  graphics: PIXI.Graphics;
}

export interface Hotspot {
  id: string;
  x: number;
  y: number;
  radius: number;
  state: 'telegraph' | 'active';
  spawnAtMs: number;
  activateAtMs: number;
  expiresAtMs: number;
  graphics: PIXI.Graphics;
  label?: HTMLDivElement;
  hasSpawnedLoot: boolean;
}

export interface Arena {
  width: number;
  height: number;
}

export interface Camera {
  x: number;
  y: number;
  zoom: number;
  targetZoom: number;
  minZoom: number;
  maxZoom: number;
  shakeX: number;
  shakeY: number;
  shakeDecay: number;
}

export interface RectZone {
  left: number;
  right: number;
  top: number;
  bottom: number;
  nextSliceAt: number;
  sliceIntervalMs: number;
  telegraphMs: number;
  pendingSide: 'left' | 'right' | 'top' | 'bottom' | null;
  lastSide: 'left' | 'right' | 'top' | 'bottom' | null;
  minWidth: number;
  minHeight: number;
  sliceStep: number;
}

export interface Zone {
  centerX: number;
  centerY: number;
  startRadius: number;
  endRadius: number;
  startAtMs: number;
  durationMs: number;
}

export interface Theme {
  accent: number;
  grid: number;
  gridAlpha: number;
  border: number;
  borderAlpha: number;
  enemy: number;
  enemyGlow: number;
  text: string;
}

export interface WsHud {
  active: boolean;
  kills: Record<string, number>;
  killFeed: Array<{ killerId?: string; victimId: string; ts: number }>;
  playerId?: string | null;
  idToName: Record<string, string>;
  aliveSet: Set<string>;
  eliminationOrder: string[];
}

export interface SpawnPoint {
  x: number;
  y: number;
  angle: number;
}

export interface DebugCollision {
  victimId: string;
  killerId?: string;
  hit: { x: number; y: number };
  segment?: { from: { x: number; y: number }; to: { x: number; y: number } };
  ts: number;
}

export interface KillRecord {
  killer: string;
  victim: string;
  time: number;
}

export interface NearMiss {
  text: string;
  time: number;
  x: number;
  y: number;
}

export interface KillStreakNotification {
  text: string;
  time: number;
  x: number;
  y: number;
}

export interface Emote {
  el: HTMLDivElement;
  car: Car;
  expiresAt: number;
}

export interface PreStart {
  startAt: number;
  durationMs: number;
}

// Bot color palette
export const BOT_COLORS: number[] = [
  0xff6b6b, 0x4ecdc4, 0x45b7d1, 0x96ceb4, 0xfeca57,
  0xff9ff3, 0x54a0ff, 0x5f27cd, 0x00d2d3, 0xff9f43
];

// Helper functions
export function normalizeAngle(a: number): number {
  while (a > Math.PI) a -= Math.PI * 2;
  while (a < -Math.PI) a += Math.PI * 2;
  return a;
}

export function isPortraitMobile(): boolean {
  return typeof window !== 'undefined' && 
         window.innerHeight > window.innerWidth && 
         window.innerWidth < 768;
}

export function isMobileDevice(): boolean {
  return /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
}

export function isAndroidDevice(): boolean {
  return /Android/i.test(navigator.userAgent);
}
