/**
 * Collision component
 * Defines collision properties for an entity
 */
export interface Collision {
  /** Collision radius for circle collision */
  radius: number;

  /** Collision layer (for filtering) */
  layer: CollisionLayer;

  /** Collision mask (which layers to collide with) */
  mask: number;

  /** Whether collision is currently enabled */
  enabled: boolean;

  /** Whether this entity is a trigger (no physical response) */
  isTrigger: boolean;

  /** Cache of last collision frame (for preventing double-collision) */
  lastCollisionFrame: number;
}

/**
 * Collision layers for filtering
 * Powers of 2 for bitmask operations
 */
export enum CollisionLayer {
  NONE = 0,
  PLAYER = 1 << 0,
  BOT = 1 << 1,
  TRAIL = 1 << 2,
  POWERUP = 1 << 3,
  ZONE_WALL = 1 << 4,
  TRAP = 1 << 5,
  ALL = (1 << 6) - 1,
}

/**
 * Default collision masks
 */
export class CollisionMask {
  static readonly NONE = 0;
  static readonly ALL = CollisionLayer.ALL;

  /** Cars collide with other cars, trails, zone walls, and traps */
  static readonly CAR = CollisionLayer.PLAYER | CollisionLayer.BOT | CollisionLayer.TRAIL | CollisionLayer.ZONE_WALL | CollisionLayer.TRAP;

  /** Trails don't collide with anything (they ARE the collision) */
  static readonly TRAIL = CollisionLayer.NONE;

  /** Powerups are collected by cars */
  static readonly POWERUP = CollisionLayer.PLAYER | CollisionLayer.BOT;

  /** Traps collide with cars */
  static readonly TRAP = CollisionLayer.PLAYER | CollisionLayer.BOT;
}

/** Component name for type-safe access */
export const COLLISION_COMPONENT = 'Collision';

/**
 * Default collision values for different entity types
 */
export const COLLISION_DEFAULTS = {
  /** Player car collision */
  PLAYER: {
    radius: 8,
    layer: CollisionLayer.PLAYER,
    mask: CollisionMask.CAR,
    enabled: true,
    isTrigger: false,
    lastCollisionFrame: 0,
  },

  /** Bot car collision */
  BOT: {
    radius: 8,
    layer: CollisionLayer.BOT,
    mask: CollisionMask.CAR,
    enabled: true,
    isTrigger: false,
    lastCollisionFrame: 0,
  },

  /** Trail collision */
  TRAIL: {
    radius: 3,
    layer: CollisionLayer.TRAIL,
    mask: CollisionMask.TRAIL,
    enabled: true,
    isTrigger: false,
    lastCollisionFrame: 0,
  },

  /** Powerup collision */
  POWERUP: {
    radius: 15,
    layer: CollisionLayer.POWERUP,
    mask: CollisionMask.POWERUP,
    enabled: true,
    isTrigger: true,
    lastCollisionFrame: 0,
  },

  /** Trap collision */
  TRAP: {
    radius: 5,
    layer: CollisionLayer.TRAP,
    mask: CollisionMask.TRAP,
    enabled: true,
    isTrigger: false,
    lastCollisionFrame: 0,
  },
};

/**
 * Create a collision component
 */
export function createCollision(config?: Partial<Collision>): Collision {
  return {
    ...COLLISION_DEFAULTS.PLAYER,
    ...config,
  };
}

/**
 * Check if two collision components should collide
 */
export function shouldCollide(a: Collision, b: Collision): boolean {
  if (!a.enabled || !b.enabled) return false;
  return (a.mask & b.layer) !== 0 && (b.mask & a.layer) !== 0;
}

/**
 * Circle-circle collision test
 */
export function circleCollisionTest(
  ax: number,
  ay: number,
  aRadius: number,
  bx: number,
  by: number,
  bRadius: number
): boolean {
  const dx = ax - bx;
  const dy = ay - by;
  const combinedRadius = aRadius + bRadius;
  return dx * dx + dy * dy < combinedRadius * combinedRadius;
}
