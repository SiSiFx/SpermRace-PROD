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
  ZONE_WARNING_DURATION_MS: 4000,

  /** Zone shrink duration (ms) */
  ZONE_SHRINK_DURATION_MS: 28000,

  /** Minimum zone size (pixels) */
  ZONE_MIN_SIZE: 500,

  /** Zone shrink speed (pixels/second) */
  ZONE_SHRINK_RATE: 30,

  /** Spawn grace period (ms) - invincibility on spawn (extended for soft velocity burst) */
  SPAWN_GRACE_MS: 1500,

  /** Self-trail collision grace period (ms) */
  SELF_COLLISION_GRACE_MS: 300,
} as const;

/**
 * Spawn tuning configuration
 * Keeps practice rounds combat-first by biasing spawns toward center/mid-range.
 */
export const SPAWN_CONFIG = {
  /** Local player random spawn jitter around arena center (pixels) */
  LOCAL_PLAYER_CENTER_JITTER: 300,

  /** First clean bot ring distance from local player (pixels) */
  BOT_FIRST_RING_DISTANCE: 500,

  /** Second clean bot ring distance from local player (pixels) */
  BOT_SECOND_RING_DISTANCE: 900,

  /** Third ring for higher bot counts (pixels) */
  BOT_THIRD_RING_DISTANCE: 1400,

  /** Radial jitter per bot so the layout feels alive, not perfectly robotic */
  BOT_RING_RADIUS_JITTER: 80,

  /** Angular jitter in radians */
  BOT_ANGLE_JITTER: 0.1,

  /** Padding from world edges for bot spawns (pixels) */
  EDGE_PADDING: 320,
} as const;

/**
 * Bot AI tuning for core gameplay
 */
export const BOT_AI_TUNING = {
  /** How often bots reconsider decisions (ms) */
  REACTION_DELAY_MS: 120,

  /** Steering precision (0..1) */
  ACCURACY: 0.85,

  /** How often bots choose to pressure players (0..1) */
  AGGRESSION: 0.60,

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
  BASE_SPEED: 500,

  /** Boost speed (pixels/second) */
  BOOST_SPEED: 930,

  /** Maximum speed cap */
  MAX_SPEED: 1000,

  /** Acceleration rate */
  ACCELERATION: 520,

  /** Longitudinal drag (velocity preservation) */
  LONGITUDINAL_DRAG: 0.989,

  /** Lateral drag */
  LATERAL_DRAG: 0.91,

  /** Turn speed (rad/second) */
  TURN_SPEED: 7,

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
  MIN_ENERGY: 25,

  /** Speed multiplier while boosting */
  SPEED_MULTIPLIER: 1.8,

  /** Energy regeneration rate (energy/second) */
  REGEN_RATE: 12,

  /** Energy consumption rate (energy/second) */
  CONSUMPTION_RATE: 40,

  /** Instant boost energy reward for securing a kill */
  KILL_REWARD_ENERGY: 30,

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
  /** Trail lifetime (ms) — how long a trail segment stays lethal */
  LIFETIME_MS: 5500,

  /** Final circle trail lifetime (ms) */
  FINAL_LIFETIME_MS: 3000,

  /** Trail emit interval (ms) */
  EMIT_INTERVAL_MS: 12,

  /** Minimum distance between trail points (pixels) */
  EMIT_DISTANCE: 4,

  /** Base trail width — wide enough to see and die on */
  BASE_WIDTH: 5,

  /** Boosted trail width */
  BOOSTED_WIDTH: 9,

  /** Maximum trail points per car — 5.5s at 500px/s ÷ 4px per point */
  MAX_POINTS: 688,

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

  /** Trail collision radius — matches BASE_WIDTH so hitbox = visual */
  TRAIL_RADIUS: 5,

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
    COOLDOWN_MS: 7000,
    DURATION_MS: 4000,
    ENERGY_COST: 50,
    SPEED_MULTIPLIER: 2,
    TRAIL_WIDTH_MULTIPLIER: 5,
    TRAIL_LIFETIME_BONUS: 6000,
    /** Instant wall stamp on activation — points placed backward from player */
    WALL_POINTS: 50,
    WALL_SPACING: 8,
  },
} as const;

/**
 * Powerup configuration
 */
export const POWERUP_CONFIG = {
  /** Spawn interval (ms) */
  SPAWN_INTERVAL_MS: 4000,

  /** Maximum powerups on map */
  MAX_POWERUPS: 12,

  /** Energy value */
  ENERGY_VALUE: 45,

  /** Powerup lifetime (ms) */
  LIFETIME_MS: 15000,

  /** Spawn margin from edges */
  SPAWN_MARGIN: 200,

  /** Speed powerup multiplier (65% faster) */
  SPEED_MULTIPLIER: 1.65,

  /** Speed powerup duration (ms) */
  SPEED_DURATION_MS: 3500,
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
  DEFAULT_ZOOM: 0.72,

  /** Mobile zoom — zoomed out vs PC to compensate for smaller screen.
   *  Math: 390px / 0.50 = 780px visible ≈ 22% of 3500px arena (matches PC's 22%). */
  MOBILE_ZOOM: 0.50,

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
 * MICROSCOPE LAB Color Palette
 * Clinical, scientific aesthetic - like viewing cells under a microscope
 */
export const MICROSCOPE_PALETTE = {
  // Core backgrounds
  DEEP_BLACK: 0x0a0e1a,      // Deep microscope blue-black
  SLIDE_DARK: 0x0f172a,      // Slightly lighter slide background

  // Ambient lighting
  AMBIENT_CYAN: 0x67e8f9,    // Clinical cyan light
  AMBIENT_SOFT: 0x38bdf8,    // Softer blue light

  // Cell/organism colors
  MEMBRANE: 0xe0f2fe,        // Translucent cell membrane (white-blue)
  CYTOPLASM: 0xbae6fd,       // Inner cell material
  NUCLEUS: 0xfda4af,         // Pink stained nucleus
  NUCLEUS_DARK: 0xf87171,    // Darker nucleus center

  // Trail/bioluminescence
  BIOLUM_CYAN: 0x22d3ee,     // Primary bioluminescent cyan
  BIOLUM_TEAL: 0x14b8a6,     // Teal variant
  BIOLUM_GREEN: 0x34d399,    // Green bioluminescence

  // Zone/danger
  ZONE_SAFE: 0x22d3ee,       // Safe zone cyan
  ZONE_WARNING: 0xfbbf24,    // Warning amber
  ZONE_DANGER: 0xf87171,     // Danger red

  // Arena elements
  PETRI_RIM: 0x334155,       // Petri dish rim
  GRID_DOT: 0x1e293b,        // Measurement grid dots
  RETICLE: 0x475569,         // Microscope reticle lines

  // Particles/debris
  DEBRIS_LIGHT: 0x94a3b8,    // Floating light particles
  DEBRIS_DARK: 0x64748b,     // Darker debris
  BUBBLE: 0xe0f2fe,          // Air bubbles

  // Player colors (for multiplayer differentiation)
  PLAYER_CYAN: 0x22d3ee,
  PLAYER_PINK: 0xf472b6,
  PLAYER_GREEN: 0x34d399,
  PLAYER_AMBER: 0xfbbf24,
  PLAYER_VIOLET: 0xa78bfa,
  PLAYER_ROSE: 0xfb7185,
  PLAYER_TEAL: 0x2dd4bf,
  PLAYER_ORANGE: 0xfb923c,
} as const;

// Backwards compatibility alias
export const PIXEL_PALETTE = {
  BLACK: MICROSCOPE_PALETTE.DEEP_BLACK,
  DARK_BLUE: MICROSCOPE_PALETTE.SLIDE_DARK,
  DARK_PURPLE: 0x7e2553,
  DARK_GREEN: MICROSCOPE_PALETTE.BIOLUM_TEAL,
  BROWN: 0xab5236,
  DARK_GRAY: MICROSCOPE_PALETTE.GRID_DOT,
  LIGHT_GRAY: MICROSCOPE_PALETTE.DEBRIS_LIGHT,
  WHITE: MICROSCOPE_PALETTE.MEMBRANE,
  RED: MICROSCOPE_PALETTE.ZONE_DANGER,
  ORANGE: MICROSCOPE_PALETTE.ZONE_WARNING,
  YELLOW: 0xfde047,
  GREEN: MICROSCOPE_PALETTE.BIOLUM_GREEN,
  BLUE: MICROSCOPE_PALETTE.BIOLUM_CYAN,
  INDIGO: MICROSCOPE_PALETTE.PLAYER_VIOLET,
  PINK: MICROSCOPE_PALETTE.PLAYER_PINK,
  PEACH: 0xfed7aa,
} as const;

/**
 * Microscope visual effects configuration
 */
export const MICROSCOPE_VISUALS = {
  // Background
  BACKGROUND_COLOR: MICROSCOPE_PALETTE.DEEP_BLACK,
  VIGNETTE_INTENSITY: 0.4,
  VIGNETTE_RADIUS: 0.7,

  // Grid/reticle
  GRID_SPACING: 100,
  GRID_DOT_SIZE: 2,
  GRID_COLOR: MICROSCOPE_PALETTE.GRID_DOT,
  RETICLE_COLOR: MICROSCOPE_PALETTE.RETICLE,

  // Floating particles (debris in fluid)
  PARTICLE_COUNT: 80,
  PARTICLE_SIZE_MIN: 1,
  PARTICLE_SIZE_MAX: 4,
  PARTICLE_SPEED: 0.3,
  PARTICLE_ALPHA: 0.15,

  // Caustic light patterns
  CAUSTIC_ENABLED: true,
  CAUSTIC_INTENSITY: 0.08,
  CAUSTIC_SPEED: 0.5,

  // Cell rendering
  MEMBRANE_ALPHA: 0.85,
  MEMBRANE_GLOW: 0.2,
  NUCLEUS_VISIBLE: true,
  NUCLEUS_SIZE_RATIO: 0.4,

  // Trail glow
  TRAIL_GLOW_RADIUS: 8,
  TRAIL_GLOW_ALPHA: 0.3,
  TRAIL_BIOLUM_PULSE: true,

  // Arena
  ARENA_GLOW_COLOR: MICROSCOPE_PALETTE.PETRI_RIM,
  ARENA_GLOW_WIDTH: 6,
} as const;

export const PLAYER_VISUAL_CONFIG = {
  /** === BODY (CELL MEMBRANE) === */
  /** Body radius (size of the cell) */
  BODY_RADIUS: 10,

  /** Body width multiplier (elongation for oval shape) */
  BODY_WIDTH_MULT: 1.42,

  /** Body height multiplier */
  BODY_HEIGHT_MULT: 1.06,

  /** === TAIL (FLAGELLUM) === */
  /** Tail length when not boosting */
  TAIL_LENGTH: 160,

  /** Tail length when boosting */
  TAIL_LENGTH_BOOST: 240,

  /** Number of tail segments - more segments for smoother organic motion */
  TAIL_SEGMENTS: 42,

  /** Tail segments when boosting */
  TAIL_SEGMENTS_BOOST: 60,

  /** Tail wave amplitude (side-to-side motion) - organic undulation */
  TAIL_AMPLITUDE: 7,

  /** Tail amplitude when boosting */
  TAIL_AMPLITUDE_BOOST: 11,

  /** Tail wave speed - smooth organic motion */
  TAIL_WAVE_SPEED: 18.0,

  /** Tail wave speed when boosting */
  TAIL_WAVE_SPEED_BOOST: 26.0,

  /** Base tail width (thickness at body) */
  TAIL_BASE_WIDTH: 8,

  /** Max dynamic tail stretch multiplier while boosting at high speed */
  BOOST_TAIL_STRETCH_MAX: 1.4,

  /** Turn-driven tail bend strength */
  TAIL_TURN_BEND: 5.5,

  /** === COLORS (MICROSCOPE) === */
  /** Default player color (bioluminescent cyan) */
  DEFAULT_COLOR: MICROSCOPE_PALETTE.BIOLUM_CYAN,

  /** Default alpha for cell body (translucent membrane) */
  DEFAULT_ALPHA: 0.85,

  /** Nucleus color (pink stained) */
  NUCLEUS_COLOR: MICROSCOPE_PALETTE.NUCLEUS,

  /** Nucleus darkness factor */
  NUCLEUS_DARKEN_FACTOR: 0.15,

  /** Membrane edge glow */
  MEMBRANE_GLOW_ALPHA: 0.25,

  /** === EFFECTS === */
  /** Shield radius */
  SHIELD_RADIUS: 24,

  /** Boost glow radius (bioluminescence) */
  GLOW_RADIUS: 34,

  /** Spawn effect duration (ms) */
  SPAWN_EFFECT_DURATION: 600,

  /** Death burst particle count */
  DEATH_BURST_PARTICLES: 20,

  /** === NAMEPLATE === */
  /** Show player names above cells */
  SHOW_NAMEPLATES: true,

  /** Nameplate offset Y (pixels above player) */
  NAMEPLATE_OFFSET_Y: 35,

  /** === CELL MEMBRANE POLISH === */
  /** Corner softness for organic cell shape */
  HEAD_CORNER_INSET: 0,

  /** Acrosome cap size (front tip) */
  ACROSOME_SIZE: 5,

  /** Boost glow padding around cell */
  BOOST_GLOW_PADDING: 6,

  /** === TAIL POLISH === */
  /** Inset from cell back edge for tail attachment */
  TAIL_ATTACHMENT_INSET: 1,

  /** Inner highlight width as ratio of segment width */
  TAIL_HIGHLIGHT_WIDTH_RATIO: 0.4,

  /** Alpha for tail inner highlight (bioluminescent core) */
  TAIL_HIGHLIGHT_ALPHA: 0.35,

  /** Boost tip outer ring radius */
  BOOST_TIP_RING_RADIUS: 4,

  /** Number of energy trail dots behind boost tip */
  BOOST_ENERGY_TRAIL_DOTS: 4,
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
    OVERDRIVE: ['KeyR'],
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
