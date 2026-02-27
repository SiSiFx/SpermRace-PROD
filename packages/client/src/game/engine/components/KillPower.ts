/**
 * KillPower component
 * Temporary power-up state after getting a kill (dopamine reward)
 * - 2s speed burst (20% faster)
 * - 7s body growth (50% longer/thicker)
 * - Visual glow effect
 */

/**
 * Kill power state
 */
export interface KillPower {
  /** Whether kill power is currently active */
  active: boolean;

  /** When growth power expires (timestamp ms) */
  growthExpiresAt: number;

  /** When speed burst expires (timestamp ms) */
  speedExpiresAt: number;

  /** Body growth multiplier (1.5 = 50% longer body) */
  growthMultiplier: number;

  /** Speed multiplier for the burst (1.2 = 20% faster) */
  speedMultiplier: number;

  /** Glow intensity (0-1) for visual feedback */
  glowIntensity: number;

  /** Number of stacked kills (affects intensity) */
  stackCount: number;
}

/** Component name for type-safe access */
export const KILL_POWER_COMPONENT = 'KillPower';

/**
 * Default kill power config
 */
export const KILL_POWER_CONFIG = {
  /** Duration of body growth effect (ms) */
  GROWTH_DURATION_MS: 7000,

  /** Duration of speed burst (ms) */
  SPEED_BURST_DURATION_MS: 2000,

  /** Body growth multiplier per kill */
  GROWTH_MULTIPLIER: 1.5,

  /** Speed multiplier per kill */
  SPEED_MULTIPLIER: 1.2,

  /** Maximum stack count */
  MAX_STACKS: 3,

  /** Stack bonus per additional kill */
  STACK_BONUS: 0.15,
} as const;

/**
 * Create a kill power component
 */
export function createKillPower(): KillPower {
  return {
    active: false,
    growthExpiresAt: 0,
    speedExpiresAt: 0,
    growthMultiplier: 1.0,
    speedMultiplier: 1.0,
    glowIntensity: 0,
    stackCount: 0,
  };
}

/**
 * Activate kill power after getting a kill
 */
export function activateKillPower(kp: KillPower, now: number): void {
  const wasActive = kp.active;

  // Stack if already active
  if (wasActive && kp.stackCount < KILL_POWER_CONFIG.MAX_STACKS) {
    kp.stackCount++;
  } else if (!wasActive) {
    kp.stackCount = 1;
  }

  const stackBonus = 1 + (kp.stackCount - 1) * KILL_POWER_CONFIG.STACK_BONUS;

  kp.active = true;
  kp.growthExpiresAt = now + KILL_POWER_CONFIG.GROWTH_DURATION_MS;
  kp.speedExpiresAt = now + KILL_POWER_CONFIG.SPEED_BURST_DURATION_MS;
  kp.growthMultiplier = KILL_POWER_CONFIG.GROWTH_MULTIPLIER * stackBonus;
  kp.speedMultiplier = KILL_POWER_CONFIG.SPEED_MULTIPLIER;
  kp.glowIntensity = Math.min(1.0, 0.7 + kp.stackCount * 0.1);
}

/**
 * Update kill power state (call each frame)
 * Returns true if state changed
 */
export function updateKillPower(kp: KillPower, now: number): boolean {
  if (!kp.active) return false;

  let changed = false;

  // Check speed burst expiry
  if (now >= kp.speedExpiresAt && kp.speedMultiplier > 1.0) {
    kp.speedMultiplier = 1.0;
    changed = true;
  }

  // Check growth expiry
  if (now >= kp.growthExpiresAt) {
    kp.active = false;
    kp.growthMultiplier = 1.0;
    kp.glowIntensity = 0;
    kp.stackCount = 0;
    changed = true;
  } else {
    // Fade glow as effect wears off
    const remaining = kp.growthExpiresAt - now;
    const totalDuration = KILL_POWER_CONFIG.GROWTH_DURATION_MS;
    const fadeStart = totalDuration * 0.3; // Start fading at 30% remaining
    if (remaining < fadeStart) {
      kp.glowIntensity = Math.max(0, remaining / fadeStart) * 0.7;
    }
  }

  return changed;
}

/**
 * Check if speed burst is active
 */
export function hasSpeedBurst(kp: KillPower, now: number): boolean {
  return kp.active && now < kp.speedExpiresAt;
}

/**
 * Check if growth effect is active
 */
export function hasGrowthEffect(kp: KillPower, now: number): boolean {
  return kp.active && now < kp.growthExpiresAt;
}

/**
 * Get current speed multiplier (returns 1.0 if not active)
 */
export function getKillPowerSpeedMult(kp: KillPower, now: number): number {
  return hasSpeedBurst(kp, now) ? kp.speedMultiplier : 1.0;
}

/**
 * Get current growth multiplier (returns 1.0 if not active)
 */
export function getKillPowerGrowthMult(kp: KillPower, now: number): number {
  return hasGrowthEffect(kp, now) ? kp.growthMultiplier : 1.0;
}

/**
 * Reset kill power state
 */
export function resetKillPower(kp: KillPower): void {
  kp.active = false;
  kp.growthExpiresAt = 0;
  kp.speedExpiresAt = 0;
  kp.growthMultiplier = 1.0;
  kp.speedMultiplier = 1.0;
  kp.glowIntensity = 0;
  kp.stackCount = 0;
}
