/**
 * Abilities component
 * Tracks active abilities state for car entities
 */

/**
 * Available abilities
 */
export enum AbilityType {
  /** Dash - instant speed boost in facing direction */
  DASH = 'dash',

  /** Shield - temporary invincibility */
  SHIELD = 'shield',

  /** Trap - place static hazardous trail */
  TRAP = 'trap',

  /** Overdrive - speed boost + thick trail */
  OVERDRIVE = 'overdrive',
}

/**
 * Individual ability state
 */
export interface AbilityState {
  /** Whether ability is ready to use */
  ready: boolean;

  /** Cooldown end timestamp (ms) */
  cooldownUntil: number;

  /** Active ability end timestamp (ms) - 0 if not active */
  activeUntil: number;

  /** Energy cost (0 = no cost) */
  energyCost: number;

  /** Base cooldown in milliseconds */
  cooldown: number;

  /** Duration in milliseconds (for toggle abilities) */
  duration: number;
}

/**
 * Complete abilities component
 */
export interface Abilities {
  /** Dash ability state */
  dash: AbilityState;

  /** Shield ability state */
  shield: AbilityState;

  /** Trap ability state */
  trap: AbilityState;

  /** Overdrive ability state */
  overdrive: AbilityState;

  /** Currently active abilities (set) */
  active: Set<AbilityType>;
}

/** Component name for type-safe access */
export const ABILITIES_COMPONENT = 'Abilities';

/**
 * Default ability configurations
 */
export const ABILITY_CONFIG: Record<AbilityType, Omit<AbilityState, 'ready' | 'cooldownUntil' | 'activeUntil'>> = {
  [AbilityType.DASH]: {
    energyCost: 0,
    cooldown: 3000,
    duration: 150,
  },
  [AbilityType.SHIELD]: {
    energyCost: 30,
    cooldown: 8000,
    duration: 1500,
  },
  [AbilityType.TRAP]: {
    energyCost: 40,
    cooldown: 5000,
    duration: 0,
  },
  [AbilityType.OVERDRIVE]: {
    energyCost: 50,
    cooldown: 7000,
    duration: 4000,
  },
};

/**
 * Create an ability state
 */
export function createAbilityState(type: AbilityType): AbilityState {
  const config = ABILITY_CONFIG[type];
  return {
    ready: true,
    cooldownUntil: 0,
    activeUntil: 0,
    ...config,
  };
}

/**
 * Create abilities component
 */
export function createAbilities(config?: Partial<{ [K in AbilityType]?: Partial<AbilityState> }>): Abilities {
  const dash = createAbilityState(AbilityType.DASH);
  const shield = createAbilityState(AbilityType.SHIELD);
  const trap = createAbilityState(AbilityType.TRAP);
  const overdrive = createAbilityState(AbilityType.OVERDRIVE);

  // Apply custom config
  if (config?.dash) Object.assign(dash, config.dash);
  if (config?.shield) Object.assign(shield, config.shield);
  if (config?.trap) Object.assign(trap, config.trap);
  if (config?.overdrive) Object.assign(overdrive, config.overdrive);

  return {
    dash,
    shield,
    trap,
    overdrive,
    active: new Set(),
  };
}

/**
 * Check if an ability is ready
 */
export function isAbilityReady(abilities: Abilities, type: AbilityType): boolean {
  const state = abilities[type];
  return state.ready && Date.now() >= state.cooldownUntil;
}

/**
 * Check if an ability is currently active
 */
export function isAbilityActive(abilities: Abilities, type: AbilityType): boolean {
  const state = abilities[type];
  return abilities.active.has(type) && Date.now() < state.activeUntil;
}

/**
 * Get cooldown remaining for an ability (ms)
 */
export function getCooldownRemaining(abilities: Abilities, type: AbilityType): number {
  const state = abilities[type];
  return Math.max(0, state.cooldownUntil - Date.now());
}

/**
 * Get ability active time remaining (ms)
 */
export function getActiveTimeRemaining(abilities: Abilities, type: AbilityType): number {
  if (!isAbilityActive(abilities, type)) return 0;
  const state = abilities[type];
  return Math.max(0, state.activeUntil - Date.now());
}

/**
 * Activate an ability
 * Returns true if activation was successful
 */
export function activateAbility(
  abilities: Abilities,
  type: AbilityType,
  currentEnergy: number
): { success: boolean; energyCost: number } {
  if (!isAbilityReady(abilities, type)) {
    return { success: false, energyCost: 0 };
  }

  const state = abilities[type];

  // Check energy cost
  if (state.energyCost > 0 && currentEnergy < state.energyCost) {
    return { success: false, energyCost: state.energyCost };
  }

  // Activate ability
  if (state.duration > 0) {
    state.activeUntil = Date.now() + state.duration;
    abilities.active.add(type);
  }

  // Set cooldown
  state.cooldownUntil = Date.now() + state.cooldown;
  state.ready = false;

  return { success: true, energyCost: state.energyCost };
}

/**
 * Update abilities (call each frame)
 * Returns set of abilities that expired this frame
 */
export function updateAbilities(abilities: Abilities, _dt: number): Set<AbilityType> {
  const now = Date.now();
  const expired: AbilityType[] = [];

  // Check for expired active abilities
  for (const type of abilities.active) {
    const state = abilities[type];
    if (now >= state.activeUntil) {
      expired.push(type);
    }
  }

  // Remove expired abilities
  for (const type of expired) {
    abilities.active.delete(type);
  }

  // Update ready states
  for (const type of Object.values(AbilityType)) {
    const state = abilities[type];
    if (!state.ready && now >= state.cooldownUntil) {
      state.ready = true;
    }
  }

  return new Set(expired);
}

/**
 * Reset all abilities (for respawn)
 */
export function resetAbilities(abilities: Abilities): void {
  for (const type of Object.values(AbilityType)) {
    const state = abilities[type];
    state.ready = true;
    state.cooldownUntil = 0;
    state.activeUntil = 0;
  }
  abilities.active.clear();
}

/**
 * Get ability progress (0-1) for UI
 */
export function getAbilityProgress(abilities: Abilities, type: AbilityType): {
  cooldown: number; // 0-1, 1 = ready
  active: number; // 0-1, for active abilities
} {
  const state = abilities[type];
  const now = Date.now();

  const cooldown = Math.max(0, 1 - (state.cooldownUntil - now) / state.cooldown);
  const active = state.duration > 0
    ? Math.max(0, (state.activeUntil - now) / state.duration)
    : 0;

  return { cooldown, active };
}

/**
 * Key bindings for abilities (PC)
 */
export const ABILITY_KEYBINDINGS: Record<AbilityType, string[]> = {
  [AbilityType.DASH]: ['KeyQ'],
  [AbilityType.SHIELD]: ['KeyE'],
  [AbilityType.TRAP]: ['KeyF'],
  [AbilityType.OVERDRIVE]: ['KeyR'],
};
