/**
 * Food component
 * Represents edible food items that provide growth when collected
 */

/**
 * Food component
 */
export interface Food {
  /** Nutritional value (how much length is gained) */
  value: number;

  /** Food size for rendering */
  size: number;

  /** Food color */
  color: number;

  /** Pulse phase for animation */
  pulsePhase: number;

  /** Whether this food has been collected */
  collected: boolean;
}

/** Component name for type-safe access */
export const FOOD_COMPONENT = 'Food';

/**
 * Create a food component
 */
export function createFood(config: Partial<Food> = {}): Food {
  return {
    value: config.value ?? 1,
    size: config.size ?? 3,
    color: config.color ?? 0x22d3ee,
    pulsePhase: Math.random() * Math.PI * 2,
    collected: false,
  };
}

/**
 * Get random food color from palette
 */
export function getRandomFoodColor(): number {
  const colors = [
    0x22d3ee, // cyan
    0xff6b6b, // red
    0x4ecdc4, // teal
    0x45b7d1, // blue
    0x96ceb4, // green
    0xffeaa7, // yellow
    0xfd79a8, // pink
    0xa29bfe, // purple
    0x00b894, // emerald
  ];
  return colors[Math.floor(Math.random() * colors.length)];
}
