// SYNCED WITH SERVER - DO NOT CHANGE WITHOUT UPDATING server/src/Player.ts & GameWorld.ts
export const WORLD_WIDTH = 3500;  // Balanced size for 16-32 players
export const WORLD_HEIGHT = 2500;

// Physics - matches server Player.ts PHYSICS_CONSTANTS
export const MAX_SPEED = 480;
export const ACCELERATION = 220;
export const BOOST_MULTIPLIER = 1.8;

// Boost - matches server Player.ts BOOST constants
export const BOOST_DRAIN_PER_SEC = 0.55; // 55 energy/s while boosting
export const BOOST_REGEN_PER_SEC = 0.28; // 28 energy/s when not boosting
export const BOOST_COOLDOWN_MS = 2500; // matches server 2500ms cooldown
export const BOOST_DURATION_MS = 1400;
export const BOOST_MIN_START_ENERGY = 20;

// Trail - matches server Player.ts TRAIL_CONSTANTS
export const TRAIL_INTERVAL_MS = 50;
export const TRAIL_MAX_POINTS = 160; // 8s * 1000ms / 50ms = 160 points
export const TRAIL_LIFETIME_MS = 8000; // 8s base (matches server)
export const TRAIL_FINAL_CIRCLE_LIFETIME_MS = 5000; // 5s in final circle
export const TRAIL_ALPHA_MIN = 0.1;
export const TRAIL_WIDTH_NORMAL = 2;
export const TRAIL_WIDTH_BOOST = 6;

// Collision - matches server CollisionSystem.ts
export const COLLISION_RADIUS_NORMAL = 8; // SPERM_COLLISION_RADIUS
export const COLLISION_RADIUS_BOOST = 8;  // same hitbox when boosting
export const SELF_COLLISION_GRACE_MS = 2200; // SPAWN_SELF_COLLISION_GRACE_MS

export const CAMERA_ZOOM_OUT = 0.8; // pre-start overview
export const CAMERA_ZOOM_GAME = 1.2; // gameplay zoom

export const KILLFEED_MAX = 6;
export const KILLFEED_LIFETIME_MS = 6000;

export const COLOR_LOCAL = 0x00ffff; // cyan
export const COLOR_OTHER = 0xff00ff; // magenta
export const COLOR_ARENA_BG = 0x0b0b12; // dark


















