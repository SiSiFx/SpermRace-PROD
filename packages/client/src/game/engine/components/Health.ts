/**
 * Health component
 * Tracks entity health and survival state
 */

/**
 * Entity state enum
 */
export enum EntityState {
  /** Entity is spawning (invincible) */
  SPAWNING = 'spawning',

  /** Entity is alive and vulnerable */
  ALIVE = 'alive',

  /** Entity is dying (playing death animation) */
  DYING = 'dying',

  /** Entity is dead (waiting for respawn) */
  DEAD = 'dead',

  /** Entity is permanently removed */
  DESTROYED = 'destroyed',
}

/**
 * Health component
 */
export interface Health {
  /** Current state */
  state: EntityState;

  /** Whether entity is currently alive (can be targeted) */
  isAlive: boolean;

  /** Spawn protection end timestamp (ms) */
  spawnGraceUntil: number;

  /** Respawn timestamp (ms) - 0 if not respawning */
  respawnTime: number;

  /** Number of kills this entity has scored */
  kills: number;

  /** Number of deaths */
  deaths: number;

  /** Whether entity was eliminated by trail collision */
  eliminatedByTrail: boolean;

  /** ID of entity that killed this one */
  killerId: string | null;

  /** Whether entity was alive last frame (for detecting deaths) */
  wasAlive: boolean;
}

/** Component name for type-safe access */
export const HEALTH_COMPONENT = 'Health';

/**
 * Default health values
 */
export const DEFAULT_HEALTH: Omit<Health, 'spawnGraceUntil' | 'respawnTime' | 'killerId' | 'wasAlive'> = {
  state: EntityState.SPAWNING,
  isAlive: true,
  kills: 0,
  deaths: 0,
  eliminatedByTrail: false,
};

/**
 * Create a health component
 */
export function createHealth(config?: Partial<Health>): Health {
  const now = Date.now();
  return {
    ...DEFAULT_HEALTH,
    spawnGraceUntil: now + 1000, // 1 second spawn protection by default
    respawnTime: 0,
    killerId: null,
    wasAlive: true,
    ...config,
  };
}

/**
 * Check if entity has spawn protection
 */
export function hasSpawnProtection(health: Health): boolean {
  return Date.now() < health.spawnGraceUntil;
}

/**
 * Check if entity can be respawned
 */
export function canRespawn(health: Health): boolean {
  return health.state === EntityState.DEAD && health.respawnTime > 0;
}

/**
 * Check if entity is ready to respawn
 */
export function isReadyToRespawn(health: Health): boolean {
  return canRespawn(health) && Date.now() >= health.respawnTime;
}

/**
 * Kill an entity
 */
export function killEntity(health: Health, killerId: string | null = null, byTrail: boolean = true): void {
  // Don't process if already dead/dying (prevent double-counting deaths)
  if (!health.isAlive || health.state === EntityState.DYING || health.state === EntityState.DEAD) {
    // Still update killer info if this was a new kill
    if (health.killerId === null) {
      health.killerId = killerId;
      health.eliminatedByTrail = byTrail;
    }
    return;
  }
  health.state = EntityState.DYING;
  health.isAlive = false;
  health.killerId = killerId;
  health.eliminatedByTrail = byTrail;
  health.deaths++;
}

/**
 * Mark entity as destroyed (no respawn)
 */
export function destroyEntity(health: Health): void {
  health.state = EntityState.DESTROYED;
  health.isAlive = false;
}

/**
 * Set entity to alive state
 */
export function setEntityAlive(health: Health, spawnGraceMs: number = 1000): void {
  health.state = EntityState.ALIVE;
  health.isAlive = true;
  health.spawnGraceUntil = Date.now() + spawnGraceMs;
  health.respawnTime = 0;
  health.killerId = null;
  health.eliminatedByTrail = false;
}

/**
 * Set entity to spawning state
 */
export function setEntitySpawning(health: Health, spawnGraceMs: number = 1000): void {
  health.state = EntityState.SPAWNING;
  health.isAlive = false;
  health.spawnGraceUntil = Date.now() + spawnGraceMs;
}

/**
 * Schedule respawn
 */
export function scheduleRespawn(health: Health, delayMs: number): void {
  health.state = EntityState.DEAD;
  health.respawnTime = Date.now() + delayMs;
}

/**
 * Add a kill to the entity's count
 */
export function addKill(health: Health): void {
  health.kills++;
}

/**
 * Get time remaining in spawn protection
 */
export function getSpawnProtectionRemaining(health: Health): number {
  return Math.max(0, health.spawnGraceUntil - Date.now());
}

/**
 * Get time until respawn
 */
export function getRespawnTimeRemaining(health: Health): number {
  if (health.respawnTime === 0) return 0;
  return Math.max(0, health.respawnTime - Date.now());
}
