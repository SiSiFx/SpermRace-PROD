/**
 * Game Constants
 * Centralized configuration for all game balance values
 */

/**
 * Match pacing configuration
 */
export const MATCH_CONFIG = {
  /** Match duration in seconds (target, can vary) */
  TARGET_DURATION_SEC: 30,

  /** Zone shrink start delay (ms) */
  ZONE_START_DELAY_MS: 6000,

  /** Zone warning duration before shrinking begins (ms) */
  ZONE_WARNING_DURATION_MS: 1400,

  /** Zone shrink duration (ms) */
  ZONE_SHRINK_DURATION_MS: 19000,

  /** Minimum zone size (pixels) */
  ZONE_MIN_SIZE: 500,

  /** Zone shrink speed (pixels/second) */
  ZONE_SHRINK_RATE: 30,

  /** Spawn grace period (ms) - invincibility on spawn */
  SPAWN_GRACE_MS: 1200,

  /** Self-trail collision grace period (ms) */
  SELF_COLLISION_GRACE_MS: 500,
} as const;

/**
 * Spawn tuning configuration
 * Keeps practice rounds combat-first by biasing spawns toward center/mid-range.
 */
export const SPAWN_CONFIG = {
  /** Local player random spawn jitter around arena center (pixels) */
  LOCAL_PLAYER_CENTER_JITTER: 260,

  /** Bot spawn ring min distance from local player (pixels) */
  BOT_MIN_DISTANCE: 280,

  /** Bot spawn ring max distance from local player (pixels) */
  BOT_MAX_DISTANCE: 760,

  /** Padding from world edges for bot spawns (pixels) */
  EDGE_PADDING: 200,
} as const;

/**
 * Bot AI tuning for core gameplay
 */
export const BOT_AI_TUNING = {
  /** How often bots reconsider decisions (ms) */
  REACTION_DELAY_MS: 72,

  /** Steering precision (0..1) */
  ACCURACY: 0.9,

  /** How often bots choose to pressure players (0..1) */
  AGGRESSION: 0.82,

  /** Probability of ability usage checks resulting in casts (0..1) */
  ABILITY_USAGE_CHANCE: 0.45,

  /** Forward prediction distance when steering/chasing (pixels) */
  PREDICTION_DISTANCE: 300,
} as const;

/**
 * Car physics configuration
 */
export const CAR_PHYSICS = {
  /** Base movement speed (pixels/second) */
  BASE_SPEED: 315,

  /** Boost speed (pixels/second) */
  BOOST_SPEED: 620,

  /** Maximum speed cap */
  MAX_SPEED: 680,

  /** Acceleration rate */
  ACCELERATION: 300,

  /** Longitudinal drag (velocity preservation) */
  LONGITUDINAL_DRAG: 0.989,

  /** Lateral drag */
  LATERAL_DRAG: 0.82,

  /** Turn speed (rad/second) */
  TURN_SPEED: 4.8,

  /** Turn rate with speed scaling */
  SPEED_TURN_SCALE: 0.18,

  /** Maximum turn rate */
  MAX_TURN_RATE_RAD_PER_S: 5.3,

  /** Low speed turn bonus */
  LOW_SPEED_TURN_BONUS: 0.35,

  /** Drift factor */
  DRIFT_FACTOR: 0.7,

  /** Maximum drift factor */
  MAX_DRIFT_FACTOR: 1.5,
} as const;

/**
 * Boost configuration
 */
export const BOOST_CONFIG = {
  /** Maximum boost energy */
  MAX_ENERGY: 100,

  /** Minimum energy to start boosting */
  MIN_ENERGY: 20,

  /** Speed multiplier while boosting */
  SPEED_MULTIPLIER: 1.8,

  /** Energy regeneration rate (energy/second) */
  REGEN_RATE: 13,

  /** Energy consumption rate (energy/second) */
  CONSUMPTION_RATE: 22,

  /** Instant boost energy reward for securing a kill */
  KILL_REWARD_ENERGY: 24,

  /** Boost trail width multiplier */
  TRAIL_WIDTH_MULTIPLIER: 2,

  /** Boost trail lifetime bonus (ms) */
  TRAIL_LIFETIME_BONUS: 2000,

  /** Burst multiplier on turn release */
  BURST_MULTIPLIER: 1.35,

  /** Burst duration (ms) */
  BURST_DURATION_MS: 700,
} as const;

/**
 * Trail configuration
 */
export const TRAIL_CONFIG = {
  /** Trail lifetime (ms) */
  LIFETIME_MS: 880,

  /** Final circle trail lifetime (ms) */
  FINAL_LIFETIME_MS: 760,

  /** Trail emit interval (ms) */
  EMIT_INTERVAL_MS: 12,

  /** Minimum distance between trail points (pixels) */
  EMIT_DISTANCE: 5,

  /** Base trail width */
  BASE_WIDTH: 1.7,

  /** Boosted trail width */
  BOOSTED_WIDTH: 2.8,

  /** Maximum trail points per car */
  MAX_POINTS: 500,

  /** Trail fade out duration (ms) */
  FADE_OUT_DURATION_MS: 500,
} as const;

/**
 * Trail effect configuration
 */
export const TRAIL_EFFECTS = {
  default: {
    color: '#00FFFF',
    width: 3,
    glow: true,
    particles: false,
    pattern: 'solid',
  },
  gold: {
    color: '#FFD700',
    width: 4,
    glow: true,
    particles: true, // Gold sparkles
    pattern: 'sparkle',
  },
  fire: {
    color: '#FF4500',
    width: 5,
    glow: true,
    particles: true, // Fire particles
    pattern: 'fire',
  },
  lightning: {
    color: '#FFFF00',
    width: 3,
    glow: true,
    particles: true,
    pattern: 'lightning', // Jagged trail
  },
} as const;

/**
 * Collision configuration
 */
export const COLLISION_CONFIG = {
  /** Grid cell size for spatial partitioning */
  GRID_CELL_SIZE: 100,

  /** Car collision radius */
  CAR_RADIUS: 8,

  /** Trail collision radius */
  TRAIL_RADIUS: 3,

  /** Powerup collision radius */
  POWERUP_RADIUS: 20,

  /** Self-trail ignore duration (ms) */
  SELF_IGNORE_MS: 300,

  /** Post-bounce grace period (ms) */
  POST_BOUNCE_GRACE_MS: 700,
} as const;

/**
 * Body collision configuration (slither.io-style body kills)
 * Trail points ARE the body - recent points = body, older points = lethal trail
 */
export const BODY_COLLISION_CONFIG = {
  /** Age threshold (ms) to consider trail point as "body" vs "old trail" */
  BODY_SEGMENT_AGE_MS: 300,

  /** Number of newest segments to skip for self-collision (head grace period) */
  SELF_COLLISION_GRACE_SEGMENTS: 8,

  /** Body segment collision radius multiplier */
  SEGMENT_RADIUS_MULT: 1.2,

  /** Near-miss threshold (pixels) for dopamine feedback */
  NEAR_MISS_THRESHOLD_PX: 15,
} as const;

/**
 * Arena configuration
 */
export const ARENA_CONFIG = {
  /** Desktop arena width */
  DESKTOP_WIDTH: 8000,

  /** Desktop arena height */
  DESKTOP_HEIGHT: 6000,

  /** Mobile arena width (portrait) */
  MOBILE_WIDTH: 3500,

  /** Mobile arena height (portrait) */
  MOBILE_HEIGHT: 7700,

  /** Boundary margin */
  BOUNDARY_MARGIN: 50,
} as const;

/**
 * Ability configuration
 */
export const ABILITY_CONFIG = {
  /** Dash ability */
  DASH: {
    COOLDOWN_MS: 3000,
    DURATION_MS: 150,
    ENERGY_COST: 0,
    SPEED_BOOST: 600,
  },

  /** Shield ability */
  SHIELD: {
    COOLDOWN_MS: 8000,
    DURATION_MS: 1500,
    ENERGY_COST: 30,
    INVINCIBLE: true,
  },

  /** Trap ability */
  TRAP: {
    COOLDOWN_MS: 5000,
    DURATION_MS: 0,
    ENERGY_COST: 40,
    TRAIL_LENGTH: 10,
    TRAIL_SPACING: 15,
    LIFETIME_MS: 8000,
  },

  /** Overdrive ability */
  OVERDRIVE: {
    COOLDOWN_MS: 10000,
    DURATION_MS: 3000,
    ENERGY_COST: 50,
    SPEED_MULTIPLIER: 2,
    TRAIL_WIDTH_MULTIPLIER: 3,
    TRAIL_LIFETIME_BONUS: 3000,
  },
} as const;

/**
 * Powerup configuration
 */
export const POWERUP_CONFIG = {
  /** Spawn interval (ms) */
  SPAWN_INTERVAL_MS: 2000,

  /** Maximum powerups on map */
  MAX_POWERUPS: 20,

  /** Energy value */
  ENERGY_VALUE: 30,

  /** Powerup lifetime (ms) */
  LIFETIME_MS: 15000,

  /** Spawn margin from edges */
  SPAWN_MARGIN: 200,
} as const;

/**
 * Network configuration
 */
export const NETWORK_CONFIG = {
  /** Server tick rate (Hz) */
  TICK_RATE: 66,

  /** Tick interval (ms) */
  TICK_INTERVAL_MS: Math.floor(1000 / 66),

  /** Input rate (Hz) */
  INPUT_RATE: 60,

  /** Input interval (ms) */
  INPUT_INTERVAL_MS: Math.floor(1000 / 60),

  /** State broadcast rate (Hz) */
  BROADCAST_RATE: 15,

  /** Client-side prediction enabled */
  CLIENT_PREDICTION: true,

  /** Lag compensation window (ms) */
  LAG_COMPENSATION_WINDOW_MS: 200,
} as const;

/**
 * Render configuration
 */
export const RENDER_CONFIG = {
  /** Target FPS */
  TARGET_FPS: 60,

  /** Mobile target FPS */
  MOBILE_TARGET_FPS: 45,

  /** Camera smooth follow factor */
  CAMERA_SMOOTH_FACTOR: 0.1,

  /** Default zoom */
  DEFAULT_ZOOM: 1,

  /** Mobile zoom */
  MOBILE_ZOOM: 0.8,

  /** Maximum zoom */
  MAX_ZOOM: 2,

  /** Minimum zoom */
  MIN_ZOOM: 0.3,
} as const;

/**
 * Player visual configuration
 * All visual settings for player appearance in one place
 * Validated visual design parameters
 */

/**
 * PICO-8 Color Palette
 * 16-color palette for retro aesthetic
 */
export const PIXEL_PALETTE = {
  BLACK: 0x000000,
  DARK_BLUE: 0x1d2b53,
  DARK_PURPLE: 0x7e2553,
  DARK_GREEN: 0x008751,
  BROWN: 0xab5236,
  DARK_GRAY: 0x5f574f,
  LIGHT_GRAY: 0xc2c3c7,
  WHITE: 0xfff1e8,
  RED: 0xff004d,
  ORANGE: 0xffa300,
  YELLOW: 0xffec27,
  GREEN: 0x00e436,
  BLUE: 0x29adff,
  INDIGO: 0x83769c,
  PINK: 0xff77a8,
  PEACH: 0xffccaa,
} as const;

export const PLAYER_VISUAL_CONFIG = {
  /** === BODY === */
  /** Body radius (size of the sperm head) */
  BODY_RADIUS: 10,

  /** Body width multiplier (elongation for oval shape) */
  BODY_WIDTH_MULT: 1.4,

  /** Body height multiplier */
  BODY_HEIGHT_MULT: 1.0,

  /** === TAIL === */
  /** Tail length when not boosting */
  TAIL_LENGTH: 146,

  /** Tail length when boosting */
  TAIL_LENGTH_BOOST: 232,

  /** Number of tail segments - more segments for smoother motion */
  TAIL_SEGMENTS: 36,

  /** Tail segments when boosting */
  TAIL_SEGMENTS_BOOST: 54,

  /** Tail wave amplitude (side-to-side motion) */
  TAIL_AMPLITUDE: 1.9,

  /** Tail amplitude when boosting */
  TAIL_AMPLITUDE_BOOST: 2.7,

  /** Tail wave speed */
  TAIL_WAVE_SPEED: 5.6,

  /** Tail wave speed when boosting */
  TAIL_WAVE_SPEED_BOOST: 7.0,

  /** Base tail width (thickness at body) - should match body for smooth connection */
  TAIL_BASE_WIDTH: 14,

  /** Max dynamic tail stretch multiplier while boosting at high speed */
  BOOST_TAIL_STRETCH_MAX: 1.38,

  /** Turn-driven tail bend strength (higher = more readable directional bend) */
  TAIL_TURN_BEND: 6.8,

  /** === COLORS === */
  /** Default player color (cyan) */
  DEFAULT_COLOR: PIXEL_PALETTE.BLUE,

  /** Default alpha for sperm body */
  DEFAULT_ALPHA: 1.0,

  /** Nucleus darkness factor (0-1, higher = darker) */
  NUCLEUS_DARKEN_FACTOR: 0.25,

  /** === EFFECTS === */
  /** Shield radius */
  SHIELD_RADIUS: 22,

  /** Boost glow radius */
  GLOW_RADIUS: 25,

  /** Spawn effect duration (ms) */
  SPAWN_EFFECT_DURATION: 500,

  /** Death burst particle count */
  DEATH_BURST_PARTICLES: 16,

  /** === NAMEPLATE === */
  /** Show player names above cars */
  SHOW_NAMEPLATES: true,

  /** Nameplate offset Y (pixels above player) */
  NAMEPLATE_OFFSET_Y: 30,

  /** === HEAD POLISH === */
  /** Corner inset for smooth pixel-rounded head */
  HEAD_CORNER_INSET: 2,

  /** Acrosome cap size in pixels */
  ACROSOME_SIZE: 4,

  /** Boost glow padding around head */
  BOOST_GLOW_PADDING: 4,

  /** === TAIL POLISH === */
  /** Inset from head back edge for tail attachment */
  TAIL_ATTACHMENT_INSET: 2,

  /** Inner highlight width as ratio of segment width */
  TAIL_HIGHLIGHT_WIDTH_RATIO: 0.35,

  /** Alpha for tail inner highlight */
  TAIL_HIGHLIGHT_ALPHA: 0.25,

  /** Boost tip outer ring radius */
  BOOST_TIP_RING_RADIUS: 3,

  /** Number of energy trail dots behind boost tip */
  BOOST_ENERGY_TRAIL_DOTS: 3,
} as const;

/**
 * Performance configuration
 */
export const PERFORMANCE_CONFIG = {
  /** Object pool initial sizes */
  POOL_SIZES: {
    CONTAINER: 100,
    GRAPHICS: 200,
    SPRITE: 50,
    TEXT: 20,
    TRAIL_POINT: 500,
    PARTICLE: 200,
  },

  /** Maximum entities */
  MAX_ENTITIES: 10000,

  /** Frame time cap (ms) - prevents spiral of death */
  MAX_FRAME_TIME_MS: 250,
} as const;

/**
 * Input configuration
 */
export const INPUT_CONFIG = {
  /** Keyboard key bindings */
  KEY_BINDINGS: {
    DASH: ['KeyQ'],
    SHIELD: ['KeyE'],
    TRAP: ['KeyF'],
    OVERDRIVE: ['ShiftLeft', 'ShiftRight'],
  },

  /** Mouse deadzone */
  MOUSE_DEADZONE: 10,

  /** Touch joystick size */
  JOYSTICK_SIZE: 100,

  /** Ability button size (mobile) */
  ABILITY_BUTTON_SIZE: 60,
} as const;

/**
 * Get arena size for platform
 */
export function getArenaSize(isMobile: boolean): { width: number; height: number } {
  if (isMobile) {
    return {
      width: ARENA_CONFIG.MOBILE_WIDTH,
      height: ARENA_CONFIG.MOBILE_HEIGHT,
    };
  }
  return {
    width: ARENA_CONFIG.DESKTOP_WIDTH,
    height: ARENA_CONFIG.DESKTOP_HEIGHT,
  };
}

/**
 * Get target FPS for platform
 */
export function getTargetFPS(isMobile: boolean): number {
  return isMobile ? RENDER_CONFIG.MOBILE_TARGET_FPS : RENDER_CONFIG.TARGET_FPS;
}

/**
 * Get default zoom for platform
 */
export function getDefaultZoom(isMobile: boolean): number {
  return isMobile ? RENDER_CONFIG.MOBILE_ZOOM : RENDER_CONFIG.DEFAULT_ZOOM;
}
