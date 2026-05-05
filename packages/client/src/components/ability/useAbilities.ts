/**
 * Ability Hooks
 * React hooks for ability state management
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import type { AbilityType } from './AbilityBar';
import { ABILITY_TYPES, ABILITIES } from './AbilityBar';

// Re-export AbilityType for convenience
export type { AbilityType };

/**
 * Ability state hook
 */
export interface AbilityState {
  /** Cooldown progress (0-1, 1 = ready) */
  cooldown: number;

  /** Active progress (0-1) */
  active: number;

  /** Is ready to use */
  isReady: boolean;

  /** Is currently active */
  isActive: boolean;

  /** Cooldown remaining (ms) */
  cooldownRemaining: number;

  /** Active time remaining (ms) */
  activeRemaining: number;
}

/**
 * Use abilities hook
 * Manages ability cooldowns and activation state
 */
export function useAbilities() {
  const [abilityStates, setAbilityStates] = useState<Record<AbilityType, AbilityState>>({
    dash: { cooldown: 1, active: 0, isReady: true, isActive: false, cooldownRemaining: 0, activeRemaining: 0 },
    shield: { cooldown: 1, active: 0, isReady: true, isActive: false, cooldownRemaining: 0, activeRemaining: 0 },
    trap: { cooldown: 1, active: 0, isReady: true, isActive: false, cooldownRemaining: 0, activeRemaining: 0 },
    overdrive: { cooldown: 1, active: 0, isReady: true, isActive: false, cooldownRemaining: 0, activeRemaining: 0 },
  });

  const lastUpdateRef = useRef<number>(Date.now());

  /**
   * Activate an ability
   */
  const activate = useCallback((ability: AbilityType, currentEnergy: number): boolean => {
    const state = abilityStates[ability];
    const config = ABILITIES[ability];

    if (!state.isReady) return false;

    // Check energy cost
    if (config.energyCost > 0 && currentEnergy < config.energyCost) {
      return false;
    }

    // Set cooldown
    setAbilityStates((prev) => ({
      ...prev,
      [ability]: {
        cooldown: 0,
        active: config.duration > 0 ? 1 : 0,
        isReady: false,
        isActive: config.duration > 0,
        cooldownRemaining: config.cooldown,
        activeRemaining: config.duration,
      },
    }));

    return true;
  }, [abilityStates]);

  /**
   * Update abilities (call each frame)
   */
  const update = useCallback((_dt: number) => {
    const now = Date.now();
    const elapsed = now - lastUpdateRef.current;
    lastUpdateRef.current = now;

    setAbilityStates((prev) => {
      const updated = { ...prev };

      for (const type of ABILITY_TYPES) {
        const state = prev[type];
        const config = ABILITIES[type];

        let newCooldown = state.cooldown;
        let newActive = state.active;

        // Update cooldown
        if (state.cooldownRemaining > 0) {
          newCooldown = Math.min(1, state.cooldown + elapsed / config.cooldown);
        }

        // Update active
        if (state.activeRemaining > 0) {
          newActive = Math.max(0, state.activeRemaining - elapsed) / config.duration;
        }

        updated[type] = {
          cooldown: newCooldown,
          active: newActive,
          isReady: newCooldown >= 1,
          isActive: newActive > 0,
          cooldownRemaining: Math.max(0, config.cooldown - state.cooldownRemaining),
          activeRemaining: Math.max(0, state.activeRemaining - elapsed),
        };
      }

      return updated;
    });
  }, []);

  /**
   * Reset all abilities
   */
  const reset = useCallback(() => {
    setAbilityStates({
      dash: { cooldown: 1, active: 0, isReady: true, isActive: false, cooldownRemaining: 0, activeRemaining: 0 },
      shield: { cooldown: 1, active: 0, isReady: true, isActive: false, cooldownRemaining: 0, activeRemaining: 0 },
      trap: { cooldown: 1, active: 0, isReady: true, isActive: false, cooldownRemaining: 0, activeRemaining: 0 },
      overdrive: { cooldown: 1, active: 0, isReady: true, isActive: false, cooldownRemaining: 0, activeRemaining: 0 },
    });
  }, []);

  /**
   * Sync from server state
   */
  const syncFromServer = useCallback((serverAbilities: any) => {
    if (!serverAbilities) return;

    setAbilityStates((prev) => {
      const updated = { ...prev };

      for (const type of Object.keys(serverAbilities)) {
        if (type in ABILITIES) {
          const ability = serverAbilities[type];
          const now = Date.now();

          updated[type as AbilityType] = {
            cooldown: ability.ready ? 1 : 0,
            active: 0,
            isReady: ability.ready,
            isActive: false,
            cooldownRemaining: ability.cooldownUntil ? Math.max(0, ability.cooldownUntil - now) : 0,
            activeRemaining: ability.activeUntil ? Math.max(0, ability.activeUntil - now) : 0,
          };
        }
      }

      return updated;
    });
  }, []);

  return {
    abilityStates,
    activate,
    update,
    reset,
    syncFromServer,
  };
}

/**
 * Use ability cooldown hook (single ability)
 */
export function useAbilityCooldown(ability: AbilityType, cooldownUntil: number | null, activeUntil: number | null) {
  const [state, setState] = useState<AbilityState>({
    cooldown: 1,
    active: 0,
    isReady: true,
    isActive: false,
    cooldownRemaining: 0,
    activeRemaining: 0,
  });

  const config = ABILITIES[ability];
  const isMountedRef = useRef<boolean>(true);

  useEffect(() => {
    isMountedRef.current = true;
    return () => { isMountedRef.current = false; };
  }, []);

  // Update state periodically
  // PERFORMANCE: Uses 50ms interval for smooth UI updates
  useEffect(() => {
    const interval = setInterval(() => {
      if (!isMountedRef.current) return;

      const now = Date.now();

      setState({
        cooldown: cooldownUntil ? Math.min(1, 1 - Math.max(0, cooldownUntil - now) / config.cooldown) : 1,
        active: activeUntil ? Math.max(0, activeUntil - now) / config.duration : 0,
        isReady: !cooldownUntil || cooldownUntil <= now,
        isActive: !!(activeUntil && activeUntil > now),
        cooldownRemaining: Math.max(0, (cooldownUntil ?? now) - now),
        activeRemaining: Math.max(0, (activeUntil ?? now) - now),
      });
    }, 50);

    return () => clearInterval(interval);
  }, [cooldownUntil, activeUntil, config.cooldown, config.duration]);

  return state;
}
