/**
 * SpermClass component
 * Defines 3 distinct playstyles: Sprinter, Tank, Balanced
 * Each class has different speed, size, and tail characteristics
 */

/**
 * Available sperm class types
 */
export enum SpermClassType {
  /** Balanced - default all-rounder */
  BALANCED = 'balanced',

  /** Sprinter - fast and thin, harder to hit but less lethal */
  SPRINTER = 'sprinter',

  /** Tank - slow and chunky, easier to hit but more lethal body */
  TANK = 'tank',
}

/**
 * SpermClass component
 */
export interface SpermClass {
  /** Class type */
  type: SpermClassType;

  /** Speed multiplier (applied to max speed) */
  speedMultiplier: number;

  /** Size multiplier (applied to collision radius and body width) */
  sizeMultiplier: number;

  /** Number of body segments in position history */
  bodySegments: number;

  /** Tail wiggle speed multiplier */
  tailWiggleSpeed: number;

  /** Turn rate multiplier */
  turnRateMultiplier: number;
}

/** Component name for type-safe access */
export const SPERM_CLASS_COMPONENT = 'SpermClass';

/**
 * Class stats configuration
 */
export const CLASS_STATS: Record<SpermClassType, Omit<SpermClass, 'type'>> = {
  [SpermClassType.BALANCED]: {
    speedMultiplier: 1.0,
    sizeMultiplier: 1.0,
    bodySegments: 36,
    tailWiggleSpeed: 5.6,
    turnRateMultiplier: 1.0,
  },
  [SpermClassType.SPRINTER]: {
    speedMultiplier: 1.4,      // 40% faster
    sizeMultiplier: 0.7,       // 30% thinner
    bodySegments: 25,          // Shorter body
    tailWiggleSpeed: 8.0,      // Faster wiggle
    turnRateMultiplier: 1.2,   // Tighter turns
  },
  [SpermClassType.TANK]: {
    speedMultiplier: 0.7,      // 30% slower
    sizeMultiplier: 1.4,       // 40% chunkier
    bodySegments: 50,          // Longer body
    tailWiggleSpeed: 3.5,      // Slower wiggle
    turnRateMultiplier: 0.8,   // Wider turns
  },
};

/**
 * Class display info for UI
 */
export const CLASS_DISPLAY_INFO: Record<SpermClassType, {
  name: string;
  description: string;
  icon: string;
  color: number;
}> = {
  [SpermClassType.BALANCED]: {
    name: 'Balanced',
    description: 'All-rounder. Good at everything, master of none.',
    icon: '⚖️',
    color: 0x22d3ee,
  },
  [SpermClassType.SPRINTER]: {
    name: 'Sprinter',
    description: 'Fast & agile. Hard to catch, but risky to attack.',
    icon: '⚡',
    color: 0xfbbf24,
  },
  [SpermClassType.TANK]: {
    name: 'Tank',
    description: 'Slow & massive. A wall of death that controls space.',
    icon: '🛡️',
    color: 0xef4444,
  },
};

/**
 * Create a sperm class component
 */
export function createSpermClass(type: SpermClassType = SpermClassType.BALANCED): SpermClass {
  const stats = CLASS_STATS[type];
  return {
    type,
    ...stats,
  };
}

/**
 * Get class stats for a given type
 */
export function getClassStats(type: SpermClassType): Omit<SpermClass, 'type'> {
  return CLASS_STATS[type];
}

/**
 * Get display info for a given class type
 */
export function getClassDisplayInfo(type: SpermClassType) {
  return CLASS_DISPLAY_INFO[type];
}

/**
 * Get all class types for UI iteration
 */
export function getAllClassTypes(): SpermClassType[] {
  return [SpermClassType.BALANCED, SpermClassType.SPRINTER, SpermClassType.TANK];
}
