/**
 * Boost component
 * Manages boost energy and state for cars
 */

/**
 * Boost component
 */
export interface Boost {
  /** Current boost energy (0-100) */
  energy: number;

  /** Maximum boost energy */
  maxEnergy: number;

  /** Minimum energy required to start boosting */
  minEnergy: number;

  /** Is currently boosting */
  isBoosting: boolean;

  /** Speed multiplier while boosting */
  speedMultiplier: number;

  /** Energy regeneration rate (energy/second) */
  regenRate: number;

  /** Energy consumption rate (energy/second) */
  consumptionRate: number;

  /** Trail width multiplier while boosting */
  trailWidthMultiplier: number;

  /** Trail lifetime bonus while boosting (ms) */
  trailLifetimeBonus: number;
}

/** Component name for type-safe access */
export const BOOST_COMPONENT = 'Boost';

/**
 * Default boost values
 */
export const DEFAULT_BOOST: Omit<Boost, 'energy'> = {
  maxEnergy: 100,    // BOOST_CONFIG.MAX_ENERGY
  minEnergy: 25,     // BOOST_CONFIG.MIN_ENERGY
  isBoosting: false,
  speedMultiplier: 1.8,  // BOOST_CONFIG.SPEED_MULTIPLIER
  regenRate: 12,         // BOOST_CONFIG.REGEN_RATE
  consumptionRate: 40,   // BOOST_CONFIG.CONSUMPTION_RATE
  trailWidthMultiplier: 2,    // BOOST_CONFIG.TRAIL_WIDTH_MULTIPLIER
  trailLifetimeBonus: 2000,   // BOOST_CONFIG.TRAIL_LIFETIME_BONUS
};

/**
 * Create a boost component
 */
export function createBoost(config?: Partial<Boost>): Boost {
  return {
    energy: 100,
    ...DEFAULT_BOOST,
    ...config,
  };
}

/**
 * Start boosting
 * Returns true if boost was started
 */
export function startBoost(boost: Boost): boolean {
  if (boost.energy < boost.minEnergy) {
    return false;
  }
  boost.isBoosting = true;
  return true;
}

/**
 * Stop boosting
 */
export function stopBoost(boost: Boost): void {
  boost.isBoosting = false;
}

/**
 * Update boost energy
 * Returns energy consumed this frame
 */
export function updateBoost(boost: Boost, dt: number): number {
  if (boost.isBoosting && boost.energy >= boost.minEnergy) {
    // Consume energy
    const consumed = boost.consumptionRate * dt;
    boost.energy = Math.max(0, boost.energy - consumed);

    // Auto-stop if out of energy
    if (boost.energy < boost.minEnergy) {
      boost.isBoosting = false;
    }

    return consumed;
  } else {
    // Regenerate energy
    boost.energy = Math.min(boost.maxEnergy, boost.energy + boost.regenRate * dt);
    boost.isBoosting = false;
    return 0;
  }
}

/**
 * Get current speed multiplier
 */
export function getSpeedMultiplier(boost: Boost): number {
  return boost.isBoosting ? boost.speedMultiplier : 1;
}

/**
 * Get boost energy ratio (0-1)
 */
export function getBoostRatio(boost: Boost): number {
  return boost.energy / boost.maxEnergy;
}

/**
 * Refill boost energy completely
 */
export function refillBoost(boost: Boost): void {
  boost.energy = boost.maxEnergy;
}

/**
 * Set boost energy to a specific value
 */
export function setBoostEnergy(boost: Boost, energy: number): void {
  boost.energy = Math.max(0, Math.min(boost.maxEnergy, energy));
}
