/**
 * Game Constants - All tunable values in one place
 *
 * This makes it easy to tweak game feel without hunting through 6000 lines.
 */

// =============================================================================
// PLAYER PHYSICS
// =============================================================================

export const PLAYER = {
  // Movement
  BASE_SPEED: 220,
  BOOST_SPEED: 850,
  SPEED_TRANSITION_RATE: 18.0,  // How fast speed changes

  // Drifting
  MAX_DRIFT_FACTOR: 0.7,
  DRIFT_BUILD_RATE: 2.0,        // How fast drift builds
  DRIFT_DECAY_RATE: 1.5,        // How fast drift decays

  // Turning
  TURN_RESPONSIVENESS: 10.0,    // Higher = snappier turns
  LATERAL_DRAG: 1.15,
  ACCELERATION: 24,
  HANDLING_ASSIST: 0.65,
  IMPACT_MITIGATION: 0.75,

  // Boost
  MAX_BOOST_ENERGY: 100,
  BOOST_REGEN_RATE: 24,         // Energy per second
  BOOST_CONSUMPTION_RATE: 55,   // Energy per second while boosting
  MIN_BOOST_ENERGY: 20,         // Minimum to start boosting

  // Visuals
  HEAD_SIZE: 8,
  STROKE_WIDTH: 2,
  TAIL_LENGTH: 34,
  TAIL_SEGMENTS_DESKTOP: 10,
  TAIL_SEGMENTS_MOBILE: 6,
  TAIL_AMPLITUDE: 5,
} as const;

// =============================================================================
// BOT PHYSICS (slightly different from player)
// =============================================================================

export const BOT = {
  BASE_SPEED: 220,
  BOOST_SPEED: 850,
  MAX_DRIFT_FACTOR: 0.8,
  TURN_RESPONSIVENESS: 6.5,
  ACCELERATION: 18,
  HANDLING_ASSIST: 0.35,
  IMPACT_MITIGATION: 0.6,

  // Visuals (bigger than player for visibility)
  HEAD_SIZE: 10,
  STROKE_WIDTH: 3,
} as const;

// =============================================================================
// TRAIL SYSTEM
// =============================================================================

export const TRAIL = {
  // Timing
  POINT_INTERVAL_MS: 30,        // Add trail point every N ms
  EXPIRATION_MS: 8000,          // Trail points expire after this
  BOOST_EXPIRATION_BONUS: 2000, // Extra time for boost trails

  // Collision
  SELF_COLLISION_SKIP: 3,       // Skip last N points for self-collision
  COLLISION_DISTANCE: 8,        // Hit detection radius
  NEAR_MISS_DISTANCE: 25,       // Near miss detection radius

  // Visuals
  WIDTH_NORMAL: 3,
  WIDTH_BOOST: 5,
} as const;

// =============================================================================
// CAMERA
// =============================================================================

export const CAMERA = {
  // Zoom
  DEFAULT_ZOOM_DESKTOP: 0.55,
  DEFAULT_ZOOM_MOBILE: 0.45,
  MIN_ZOOM: 0.2,
  MAX_ZOOM: 1.5,
  BOOST_ZOOM_OUT: 0.85,         // Zoom multiplier when boosting

  // Smoothing
  FOLLOW_SMOOTHING: 0.10,
  ZOOM_SMOOTHING: 0.05,

  // Screen shake
  SHAKE_DECAY: 0.85,
  SHAKE_INTENSITY_KILL: 0.6,
  SHAKE_INTENSITY_DEATH: 0.8,
  SHAKE_INTENSITY_NEAR_MISS: 0.25,
  SHAKE_INTENSITY_BOOST: 0.3,
} as const;

// =============================================================================
// ARENA
// =============================================================================

export const ARENA = {
  // Sizes
  WIDTH_DESKTOP: 8000,
  HEIGHT_DESKTOP: 6000,
  WIDTH_MOBILE: 3500,
  HEIGHT_MOBILE: 7700,

  // Shrinking
  SHRINK_START_PRACTICE: 8,     // Seconds before shrink starts
  SHRINK_START_TOURNAMENT: 12,
  SHRINK_DURATION_PRACTICE: 30,
  SHRINK_DURATION_TOURNAMENT: 45,
  MIN_SIZE: 1200,
} as const;

// =============================================================================
// GAME FEEL / JUICE
// =============================================================================

export const JUICE = {
  // Near-miss rewards
  NEAR_MISS_SPEED_BOOST: 1.03,  // 3% speed boost
  NEAR_MISS_INSANE_BOOST: 1.05, // 5% for really close calls
  NEAR_MISS_ENERGY_REWARD: 3,   // Boost energy gained

  // Kill rewards
  KILL_SPEED_BOOST_DURATION: 2000,  // ms
  KILL_SPEED_MULTIPLIER: 1.1,       // 10% faster after kill

  // Streak system
  STREAK_SPEED_BONUS_PER_KILL: 0.05,  // 5% per streak level
  STREAK_MAX_BONUS: 0.20,             // Cap at 20%

  // Haptics (mobile)
  HAPTIC_LIGHT: 'light',
  HAPTIC_MEDIUM: 'medium',
  HAPTIC_HEAVY: 'heavy',
} as const;

// =============================================================================
// PICKUPS
// =============================================================================

export const PICKUPS = {
  ENERGY_AMOUNT: 30,
  OVERDRIVE_AMOUNT: 100,
  SPAWN_INTERVAL: 5000,
  MAX_COUNT: 10,
} as const;

// =============================================================================
// HELPER: Get arena size based on device
// =============================================================================

export function getArenaSize(): { width: number; height: number } {
  if (typeof window === 'undefined') {
    return { width: ARENA.WIDTH_DESKTOP, height: ARENA.HEIGHT_DESKTOP };
  }
  const isPortraitMobile = window.innerHeight > window.innerWidth && window.innerWidth < 768;
  return isPortraitMobile
    ? { width: ARENA.WIDTH_MOBILE, height: ARENA.HEIGHT_MOBILE }
    : { width: ARENA.WIDTH_DESKTOP, height: ARENA.HEIGHT_DESKTOP };
}

export function getDefaultZoom(): number {
  if (typeof window === 'undefined') return CAMERA.DEFAULT_ZOOM_DESKTOP;
  const isPortraitMobile = window.innerHeight > window.innerWidth && window.innerWidth < 768;
  return isPortraitMobile ? CAMERA.DEFAULT_ZOOM_MOBILE : CAMERA.DEFAULT_ZOOM_DESKTOP;
}

export function isMobile(): boolean {
  if (typeof navigator === 'undefined') return false;
  return /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
}
