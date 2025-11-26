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
    trailPoints: any[];
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
}

export interface Trail {
    carId: string;
    car: Car;
    points: Array<{ x: number; y: number; time: number; isBoosting: boolean }>;
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
    amount: number; // boost energy restored
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
    x: number; y: number; radius: number;
    cooldownMs: number; lastTriggeredAt: number;
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
