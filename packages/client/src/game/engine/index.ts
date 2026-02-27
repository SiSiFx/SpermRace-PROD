/**
 * SpermRace Game Engine
 * ECS-based game engine with spatial partitioning and object pooling
 *
 * Architecture:
 * - Entity Component System (ECS) for flexible game logic
 * - Spatial grid for O(1) collision detection
 * - Object pooling for reduced GC pressure
 * - Fixed timestep game loop for deterministic physics
 * - Modular system architecture
 *
 * @example
 * ```ts
 * import { createGame } from './engine';
 *
 * const game = await createGame({
 *   container: document.getElementById('game-container')!,
 *   isMobile: false,
 *   playerName: 'Player',
 *   botCount: 5,
 * });
 * ```
 */

// Core
export * from './core';
export { GameEngine, GameState, getGameEngine, destroyGameEngine } from './core/GameEngine';

// Components - types
export type { Position } from './components/Position';
export type { Velocity } from './components/Velocity';
export type { Collision } from './components/Collision';
export type { Trail, TrailPoint } from './components/Trail';
export type { Health } from './components/Health';
export type { Player } from './components/Player';
export type { Boost } from './components/Boost';
export type { Abilities } from './components/Abilities';
export type { Renderable } from './components/Renderable';
export type { Food } from './components/Food';
export type { KillPower } from './components/KillPower';
export type { SpermClass } from './components/SpermClass';

// Components - values
export { ComponentNames, createComponentMask } from './components';
export { createPosition, copyPosition, distance, distanceSquared, POSITION_COMPONENT } from './components/Position';
export { createVelocity, calculateVelocityComponents, calculateSpeedAndAngle, angularDistance, lerpAngle, VELOCITY_COMPONENT, DEFAULT_VELOCITY } from './components/Velocity';
export { createCollision, CollisionLayer, COLLISION_COMPONENT, DEFAULT_COLLISION } from './components/Collision';
export { createTrail, addTrailPoint, getTrailAlpha, cleanupExpiredTrailPoints, TRAIL_COMPONENT, DEFAULT_TRAIL } from './components/Trail';
export { createHealth, killEntity, hasSpawnProtection, EntityState, HEALTH_COMPONENT, DEFAULT_HEALTH } from './components/Health';
export { createPlayer, EntityType, PLAYER_COMPONENT, DEFAULT_PLAYER } from './components/Player';
export { createBoost, startBoost, stopBoost, refillBoost, setBoostEnergy, BOOST_COMPONENT, DEFAULT_BOOST } from './components/Boost';
export { createAbilities, ABILITIES_COMPONENT, DEFAULT_ABILITIES } from './components/Abilities';
export { createRenderable, RenderLayer, RENDERABLE_COMPONENT, DEFAULT_RENDERABLE } from './components/Renderable';
export { createFood, FOOD_COMPONENT, DEFAULT_FOOD } from './components/Food';
export { createKillPower, KILL_POWER_COMPONENT, DEFAULT_KILL_POWER } from './components/KillPower';
export { createSpermClass, SpermClassName, SPERM_CLASS_COMPONENT, DEFAULT_SPERM_CLASS } from './components/SpermClass';

// Systems
export * from './systems';

// Spatial
export * from './spatial';

// Pooling
export * from './pooling';

// Network
export { ClientPrediction, createClientPrediction, type PlayerInput, type PredictedState, ServerReconciliation, createServerReconciliation, type ServerSnapshot, type ServerEntityState } from './network';

// Config
export { MATCH_CONFIG, CAR_PHYSICS, BOOST_CONFIG, TRAIL_CONFIG, COLLISION_CONFIG, ARENA_CONFIG, ABILITY_CONFIG, POWERUP_CONFIG, NETWORK_CONFIG, RENDER_CONFIG, PERFORMANCE_CONFIG, INPUT_CONFIG, getArenaSize, getTargetFPS, getDefaultZoom } from './config/GameConstants';
export { ABILITIES, AbilityType, getAbilityConfig, getAllAbilityTypes, formatCooldown, calculateAbilityProgress } from './config/AbilityConfig';
export type { AbilityConfig, AbilityProgress } from './config/AbilityConfig';

// Main game
export { Game, createGame } from './Game';
export type { GameConfig } from './Game';

// React Components
export { NewGameViewECS } from './NewGameViewECS';
export { NewGameView } from './NewGameView';
export type { GameStats } from './NewGameViewECS';

// Integration
export * from './integration';

// Factories
export { createPlayerEntity, createBotEntity, createTrailPointEntity, createEntityFactory } from './factories/EntityFactory';
export type { EntityFactoryConfig, CreatePlayerOptions, CreateBotOptions } from './factories/EntityFactory';

// Re-exports for convenience
export { Entity, EntityManager, System, SystemManager, SystemPriority } from './core';
export { SpatialGrid, Query, SpatialUtils } from './spatial';
export {
  ObjectPool,
  ParticlePool,
  GraphicsPool,
  getParticlePool,
  getGraphicsPool,
} from './pooling';
