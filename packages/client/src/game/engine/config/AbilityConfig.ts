/**
 * Ability Configuration
 * Detailed configuration for all abilities
 */

import { ABILITY_CONFIG as RAW_ABILITY_CONFIG } from './GameConstants';

/**
 * Ability type enum
 */
export enum AbilityType {
  DASH = 'dash',
  SHIELD = 'shield',
  TRAP = 'trap',
  OVERDRIVE = 'overdrive',
}

/**
 * Individual ability configuration
 */
export interface AbilityConfig {
  /** Display name */
  name: string;

  /** Description */
  description: string;

  /** Cooldown in milliseconds */
  cooldown: number;

  /** Duration in milliseconds (0 = instant) */
  duration: number;

  /** Energy cost (0 = none) */
  energyCost: number;

  /** Icon for UI */
  icon: string;

  /** Key binding (PC) */
  keyBinding: string[];

  /** Color for UI */
  color: number;
}

/**
 * All ability configurations
 */
export const ABILITIES: Record<AbilityType, AbilityConfig> = {
  [AbilityType.DASH]: {
    name: 'Dash',
    description: 'Instant burst of speed in facing direction',
    cooldown: RAW_ABILITY_CONFIG.DASH.COOLDOWN_MS,
    duration: RAW_ABILITY_CONFIG.DASH.DURATION_MS,
    energyCost: RAW_ABILITY_CONFIG.DASH.ENERGY_COST,
    icon: '⚡',
    keyBinding: ['Q'],
    color: 0xffff00, // Yellow
  },

  [AbilityType.SHIELD]: {
    name: 'Shield',
    description: 'Invincible for 1.5s, can trail-kill while shielded',
    cooldown: RAW_ABILITY_CONFIG.SHIELD.COOLDOWN_MS,
    duration: RAW_ABILITY_CONFIG.SHIELD.DURATION_MS,
    energyCost: RAW_ABILITY_CONFIG.SHIELD.ENERGY_COST,
    icon: '🛡️',
    keyBinding: ['E'],
    color: 0x00ffff, // Cyan
  },

  [AbilityType.TRAP]: {
    name: 'Trap',
    description: 'Place static trail that kills on contact',
    cooldown: RAW_ABILITY_CONFIG.TRAP.COOLDOWN_MS,
    duration: RAW_ABILITY_CONFIG.TRAP.DURATION_MS,
    energyCost: RAW_ABILITY_CONFIG.TRAP.ENERGY_COST,
    icon: '🪤',
    keyBinding: ['F'],
    color: 0xff00ff, // Magenta
  },

  [AbilityType.OVERDRIVE]: {
    name: 'Overdrive',
    description: '2x speed + thick trail for 3s',
    cooldown: RAW_ABILITY_CONFIG.OVERDRIVE.COOLDOWN_MS,
    duration: RAW_ABILITY_CONFIG.OVERDRIVE.DURATION_MS,
    energyCost: RAW_ABILITY_CONFIG.OVERDRIVE.ENERGY_COST,
    icon: '🔥',
    keyBinding: ['SHIFT'],
    color: 0xff4500, // Orange
  },
};

/**
 * Get ability config by type
 */
export function getAbilityConfig(type: AbilityType): AbilityConfig {
  return ABILITIES[type];
}

/**
 * Get all ability types
 */
export function getAllAbilityTypes(): AbilityType[] {
  return Object.values(AbilityType);
}

/**
 * Format cooldown for display (e.g., "3.0s")
 */
export function formatCooldown(ms: number): string {
  if (ms < 1000) {
    return `${ms}ms`;
  }
  return `${(ms / 1000).toFixed(1)}s`;
}

/**
 * Get ability progress for UI (0-1)
 */
export interface AbilityProgress {
  /** Cooldown progress (0-1, 1 = ready) */
  cooldown: number;

  /** Active progress (0-1, for toggle abilities) */
  active: number;

  /** Is ability ready to use? */
  isReady: boolean;

  /** Is ability currently active? */
  isActive: boolean;

  /** Cooldown remaining (ms) */
  cooldownRemaining: number;

  /** Active time remaining (ms) */
  activeRemaining: number;
}

/**
 * Calculate ability progress from state
 */
export function calculateAbilityProgress(
  cooldownUntil: number,
  activeUntil: number,
  cooldown: number,
  duration: number
): AbilityProgress {
  const now = Date.now();

  const cooldownRemaining = Math.max(0, cooldownUntil - now);
  const activeRemaining = Math.max(0, activeUntil - now);

  const cooldownProgress = cooldown > 0 ? 1 - cooldownRemaining / cooldown : 1;
  const activeProgress = duration > 0 ? activeRemaining / duration : 0;

  return {
    cooldown: cooldownProgress,
    active: activeProgress,
    isReady: cooldownRemaining === 0,
    isActive: activeRemaining > 0,
    cooldownRemaining,
    activeRemaining,
  };
}
