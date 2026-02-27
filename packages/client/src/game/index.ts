// Game module exports
// Legacy systems have been removed - use ECS engine from src/game/engine/ instead

export * from './engine';

// Re-export specific types from types.ts that aren't in engine
export type {
  GameState as LegacyGameState,
  Player,
  Trail,
  TrailPoint,
  Particle,
} from './types';

// Export InputState from integration to avoid conflicts
export type { InputState } from './engine/integration/InputHandler';
