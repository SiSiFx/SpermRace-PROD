/**
 * Trail component
 * Manages trail points and lifetime for car entities
 */

/**
 * Individual trail point
 */
export interface TrailPoint {
  /** X coordinate */
  x: number;

  /** Y coordinate */
  y: number;

  /** Creation timestamp (ms) */
  timestamp: number;

  /** Trail width at this point */
  width: number;

  /** Owner entity ID */
  ownerId: string;

  /** Whether this is from a boosted trail (thicker) */
  isBoosted: boolean;
}

/**
 * Trail component
 */
export interface Trail {
  /** Array of trail points */
  points: TrailPoint[];

  /** Maximum trail length (number of points) */
  maxLength: number;

  /** Trail lifetime in milliseconds */
  lifetime: number;

  /** Minimum distance between trail points (pixels) */
  emitDistance: number;

  /** Minimum time between trail emissions (ms) */
  emitInterval: number;

  /** Last trail point position (for distance check) */
  lastX: number;

  /** Last trail point position (for distance check) */
  lastY: number;

  /** Last trail emission timestamp */
  lastEmitTime: number;

  /** Trail color (for rendering) */
  color: number;

  /** Trail width (non-boosted) */
  baseWidth: number;

  /** Trail width (boosted) */
  boostedWidth: number;

  /** Whether trail is currently active */
  active: boolean;
}

/** Component name for type-safe access */
export const TRAIL_COMPONENT = 'Trail';

/**
 * Default trail values
 */
export const DEFAULT_TRAIL: Omit<Trail, 'points' | 'lastX' | 'lastY' | 'lastEmitTime'> = {
  maxLength: 688,    // TRAIL_CONFIG.MAX_POINTS
  lifetime: 5500,    // TRAIL_CONFIG.LIFETIME_MS
  emitDistance: 4,   // TRAIL_CONFIG.EMIT_DISTANCE
  emitInterval: 12,  // TRAIL_CONFIG.EMIT_INTERVAL_MS
  color: 0xffffff,
  baseWidth: 5,      // TRAIL_CONFIG.BASE_WIDTH
  boostedWidth: 9,   // TRAIL_CONFIG.BOOSTED_WIDTH
  active: true,
};

/**
 * Create a trail component
 */
export function createTrail(config?: Partial<Trail>): Trail {
  return {
    points: [],
    lastX: 0,
    lastY: 0,
    lastEmitTime: 0,
    ...DEFAULT_TRAIL,
    ...config,
  };
}

/**
 * Add a point to the trail
 */
export function addTrailPoint(trail: Trail, x: number, y: number, ownerId: string, isBoosted: boolean): void {
  const now = Date.now();

  // Check time interval
  if (now - trail.lastEmitTime < trail.emitInterval) {
    return;
  }

  // Check distance (if we have a previous point)
  const dx = x - trail.lastX;
  const dy = y - trail.lastY;
  const distSq = dx * dx + dy * dy;
  const minDist = trail.emitDistance;
  if (trail.points.length > 0 && distSq < minDist * minDist) {
    return;
  }

  // Create new trail point
  const point: TrailPoint = {
    x,
    y,
    timestamp: now,
    width: isBoosted ? trail.boostedWidth : trail.baseWidth,
    ownerId,
    isBoosted,
  };

  trail.points.push(point);
  trail.lastX = x;
  trail.lastY = y;
  trail.lastEmitTime = now;

  // Enforce max length
  if (trail.points.length > trail.maxLength) {
    trail.points.shift();
  }
}

/**
 * Remove expired trail points
 */
export function cleanupExpiredTrailPoints(trail: Trail, now: number): TrailPoint[] {
  const expireTime = now - trail.lifetime;
  const expiredPoints: TrailPoint[] = [];

  // Remove expired points from the front
  while (trail.points.length > 0 && trail.points[0].timestamp < expireTime) {
    expiredPoints.push(trail.points.shift()!);
  }

  return expiredPoints;
}

/**
 * Get all active (non-expired) trail points
 */
export function getActiveTrailPoints(trail: Trail, now: number): TrailPoint[] {
  const expireTime = now - trail.lifetime;
  return trail.points.filter(p => p.timestamp >= expireTime);
}

/**
 * Check if a point collides with any trail point
 */
export function checkTrailCollision(
  trail: Trail,
  x: number,
  y: number,
  radius: number,
  ignoreOwnerId: string,
  ignoreTimeMs: number
): TrailPoint | null {
  const now = Date.now();
  const ignoreTime = now - ignoreTimeMs;

  for (const point of trail.points) {
    // Ignore recent points from same owner
    if (point.ownerId === ignoreOwnerId && point.timestamp > ignoreTime) {
      continue;
    }

    // Ignore expired points
    if (now - point.timestamp > trail.lifetime) {
      continue;
    }

    // Check collision
    const dx = x - point.x;
    const dy = y - point.y;
    const combinedRadius = radius + point.width;
    if (dx * dx + dy * dy < combinedRadius * combinedRadius) {
      return point;
    }
  }

  return null;
}

/**
 * Calculate trail alpha based on age — fades over the last 50% of lifetime for a long smooth gradient
 */
export function getTrailAlpha(point: TrailPoint, lifetime: number, now: number): number {
  const age = now - point.timestamp;
  if (age >= lifetime) return 0;
  const fadeStart = lifetime * 0.5;
  if (age > fadeStart) {
    return 1 - (age - fadeStart) / (lifetime - fadeStart);
  }
  return 1;
}

/**
 * Reset trail for reuse
 */
export function resetTrail(trail: Trail): void {
  trail.points = [];
  trail.lastX = 0;
  trail.lastY = 0;
  trail.lastEmitTime = 0;
}
