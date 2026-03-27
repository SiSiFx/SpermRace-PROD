import type { Application, Container, Graphics } from 'pixi.js';

export type GameStatus = 'playing' | 'dead' | 'won';

export interface RuntimeStats {
  placement: number;
  kills: number;
  duration: number;
  distance: number;
}

export interface RuntimeSnapshot {
  aliveCount: number;
  kills: number;
  boostPct: number;
  elapsed: number;
  status: GameStatus;
  placement: number;
  killer: string | null;
}

export interface RuntimeConfig {
  host: HTMLElement;
  isMobile: boolean;
  playerName: string;
  playerColor: number;
  botCount: number;
  onSnapshot: (snapshot: RuntimeSnapshot) => void;
  onEnd: (snapshot: RuntimeSnapshot, stats: RuntimeStats) => void;
  onError?: (error: Error) => void;
}

export type Vec2 = { x: number; y: number };

export type Actor = {
  id: string;
  name: string;
  isPlayer: boolean;
  color: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  alive: boolean;
  kills: number;
  boostEnergy: number;
  boosting: boolean;
  trail: Vec2[];
  trailAccumulator: number;
  trailMaxLength: number;
  zoneExposure: number;
  aiDecisionTimer: number;
  aiTargetAngle: number;
  lastHitBy: string | null;
  trailDirty: boolean;
  visualAlive: boolean;
  visualBoosting: boolean;
  body: Graphics;
  trailG: Graphics;
};

export type Runtime = {
  app: Application;
  world: Container;
  actors: Actor[];
  player: Actor;
  arenaG: Graphics;
  zoneG: Graphics;
  worldWidth: number;
  worldHeight: number;
  zoneCenter: Vec2;
  zoneRadius: number;
  minZoneRadius: number;
  elapsed: number;
  camera: Vec2;
  finished: boolean;
  playerDistance: number;
  aliveCount: number;
  lastUiPush: number;
  lastZoneDrawRadius: number;
};
