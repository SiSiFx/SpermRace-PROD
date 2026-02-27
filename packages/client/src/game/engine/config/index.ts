/**
 * Configuration exports
 * Centralized import point for all game configuration
 */

export * from './GameConstants';
export * from './AbilityConfig';

export {
  MATCH_CONFIG,
  SPAWN_CONFIG,
  BOT_AI_TUNING,
  CAR_PHYSICS,
  BOOST_CONFIG,
  TRAIL_CONFIG,
  COLLISION_CONFIG,
  ARENA_CONFIG,
  ABILITY_CONFIG as RAW_ABILITY_CONFIG,
  POWERUP_CONFIG,
  NETWORK_CONFIG,
  RENDER_CONFIG,
  PERFORMANCE_CONFIG,
  INPUT_CONFIG,
  PLAYER_VISUAL_CONFIG,
  getArenaSize,
  getTargetFPS,
  getDefaultZoom,
} from './GameConstants';

export {
  ABILITIES,
  AbilityType,
  getAbilityConfig,
  getAllAbilityTypes,
  formatCooldown,
  calculateAbilityProgress,
  type AbilityConfig,
  type AbilityProgress,
} from './AbilityConfig';
