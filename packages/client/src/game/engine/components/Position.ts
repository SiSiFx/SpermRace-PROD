/**
 * Position component
 * Stores entity position in 2D space
 */
export interface Position {
  /** X coordinate in world space (pixels) */
  x: number;

  /** Y coordinate in world space (pixels) */
  y: number;
}

/** Component name for type-safe access */
export const POSITION_COMPONENT = 'Position';

/**
 * Create a position component
 */
export function createPosition(x: number, y: number): Position {
  return { x, y };
}

/**
 * Copy a position component
 */
export function copyPosition(pos: Position): Position {
  return { x: pos.x, y: pos.y };
}

/**
 * Calculate distance between two positions
 */
export function distance(a: Position, b: Position): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return Math.sqrt(dx * dx + dy * dy);
}

/**
 * Calculate squared distance (faster, use for comparisons)
 */
export function distanceSquared(a: Position, b: Position): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return dx * dx + dy * dy;
}
