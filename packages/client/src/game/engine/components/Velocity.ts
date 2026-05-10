/**
 * Velocity component
 * Stores entity velocity and speed properties
 */
export interface Velocity {
  /** X velocity component (pixels/second) */
  vx: number;

  /** Y velocity component (pixels/second) */
  vy: number;

  /** Current speed (pixels/second) */
  speed: number;

  /** Movement angle in radians */
  angle: number;

  /** Target angle for smooth turning */
  targetAngle: number;

  /** Maximum speed allowed */
  maxSpeed: number;

  /** Acceleration rate */
  acceleration: number;

  /** Drag coefficient (0-1, lower = more drag) */
  drag: number;
}

/** Component name for type-safe access */
export const VELOCITY_COMPONENT = 'Velocity';

/**
 * Default velocity values
 */
export const DEFAULT_VELOCITY: Omit<Velocity, 'vx' | 'vy'> = {
  speed: 0,
  angle: 0,
  targetAngle: 0,
  maxSpeed: 500,    // CAR_PHYSICS.BASE_SPEED
  acceleration: 520, // CAR_PHYSICS.ACCELERATION
  drag: 0.989,      // CAR_PHYSICS.LONGITUDINAL_DRAG
};

/**
 * Create a velocity component
 */
export function createVelocity(config?: Partial<Velocity>): Velocity {
  return {
    vx: 0,
    vy: 0,
    ...DEFAULT_VELOCITY,
    ...config,
  };
}

/**
 * Calculate velocity components from speed and angle
 */
export function calculateVelocityComponents(speed: number, angle: number): { vx: number; vy: number } {
  return {
    vx: Math.cos(angle) * speed,
    vy: Math.sin(angle) * speed,
  };
}

/**
 * Calculate speed and angle from velocity components
 */
export function calculateSpeedAndAngle(vx: number, vy: number): { speed: number; angle: number } {
  return {
    speed: Math.sqrt(vx * vx + vy * vy),
    angle: Math.atan2(vy, vx),
  };
}

/**
 * Get shortest angular distance (handles wrapping)
 */
export function angularDistance(from: number, to: number): number {
  let diff = to - from;
  while (diff < -Math.PI) diff += Math.PI * 2;
  while (diff > Math.PI) diff -= Math.PI * 2;
  return diff;
}

/**
 * Interpolate angle towards target (smooth turning)
 */
export function lerpAngle(current: number, target: number, factor: number): number {
  const diff = angularDistance(current, target);
  return current + diff * factor;
}
