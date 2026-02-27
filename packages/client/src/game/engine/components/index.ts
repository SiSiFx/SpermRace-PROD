/**
 * Component exports
 * Centralized import point for all component types
 */

export * from './Position';
export * from './Velocity';
export * from './Collision';
export * from './Trail';
export * from './Health';
export * from './Abilities';
export * from './Player';
export * from './Boost';
export * from './Renderable';
export * from './Food';
export * from './KillPower';
export * from './SpermClass';

import { getComponentBit } from '../core/Entity';

/**
 * Component names for type-safe access
 */
export const ComponentNames = {
  POSITION: 'Position',
  VELOCITY: 'Velocity',
  COLLISION: 'Collision',
  TRAIL: 'Trail',
  HEALTH: 'Health',
  ABILITIES: 'Abilities',
  PLAYER: 'Player',
  BOOST: 'Boost',
  RENDERABLE: 'Renderable',
  FOOD: 'Food',
  KILL_POWER: 'KillPower',
  SPERM_CLASS: 'SpermClass',
} as const;

/**
 * Component type for type maps
 */
export type ComponentName = typeof ComponentNames[keyof typeof ComponentNames];

/**
 * Helper to create a component map from an array of names
 */
export function createComponentMask(...names: ComponentName[]): number {
  let mask = 0;
  for (const name of names) {
    mask |= getComponentBit(name);
  }
  return mask;
}
