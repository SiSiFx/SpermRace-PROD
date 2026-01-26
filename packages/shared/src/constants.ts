// Shared game constants to keep server and client in sync

export const WORLD = {
  WIDTH: 3500,
  HEIGHT: 2500,
  ARENA_SHRINK_START_S: 10,  // Start shrinking at 10s for fast 42s rounds
  ARENA_SHRINK_DURATION_S: 32,  // Complete shrink by 42s (10+32)
};

export const PHYSICS = {
  ACCELERATION: 220,
  LONGITUDINAL_DRAG: 0.988,
  LATERAL_DRAG: 0.975,
  TURN_SPEED: 4.4,
  MAX_SPEED: 480,
  SPEED_TURN_SCALE: 0.18,
  MAX_TURN_RATE_RAD_PER_S: 4.8,
  LOW_SPEED_TURN_BONUS: 0.35,
};

export const TRAIL = {
  BASE_LIFETIME_MS: 8000,
  FINAL_CIRCLE_LIFETIME_MS: 5000,
  EMIT_INTERVAL_MS: 40, // denser trails to reduce tunneling
  FADE_OUT_DURATION_MS: 2000,
};

export const COLLISION = {
  GRID_CELL_SIZE: 100,
  SPERM_COLLISION_RADIUS: 8,
  TRAIL_COLLISION_RADIUS: 7,
  SELF_IGNORE_RECENT_MS: 300, // ignore last 300ms of own trail
  SPAWN_SELF_COLLISION_GRACE_MS: 2200,
  POST_BOUNCE_GRACE_MS: 700,
};

export const TICK = {
  RATE: 66, // Hz
  INTERVAL_MS: Math.floor(1000 / 66),
};

export const INPUT = {
  RATE: 60, // Hz - target input rate for sub-16ms response
  INTERVAL_MS: Math.floor(1000 / 60), // ~16ms
  MAX_BURST_INTERVAL_MS: 16, // Maximum time between inputs for burst limiting
};

