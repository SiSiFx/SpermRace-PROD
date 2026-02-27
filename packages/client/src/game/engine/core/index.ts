/**
 * Core ECS exports
 * Centralized import point for core ECS classes
 */

export * from './Entity';
export * from './EntityManager';
export * from './System';
export * from './GameEngine';

/**
 * Re-export for convenience
 */
export { Entity, generateEntityId, EntityFactory, getComponentBit, type ComponentTypeMap } from './Entity';
export { EntityManager, getEntityManager, setEntityManager, type EntityQuery, type EntityFilter } from './EntityManager';
export { System, SystemManager, SystemPriority, getSystemManager, setSystemManager } from './System';
export {
  GameEngine,
  GameState,
  getGameEngine,
  setGameEngine,
  destroyGameEngine,
  type GameEngineConfig,
  type TimeStats,
} from './GameEngine';
