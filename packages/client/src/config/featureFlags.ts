/**
 * Feature Flags
 * Control experimental features and rollout
 */

export interface FeatureFlags {
  /** Enable ECS game engine (experimental) */
  enableECSEngine: boolean;

  /** Enable active abilities system */
  enableAbilities: boolean;

  /** Enable faster gameplay (30s matches vs 60s) */
  enableFastGameplay: boolean;

  /** Enable spatial partitioning for performance */
  enableSpatialPartitioning: boolean;

  /** Enable client-side prediction for multiplayer */
  enableClientPrediction: boolean;
}

/**
 * Get feature flags from environment or local storage
 */
export function getFeatureFlags(): FeatureFlags {
  // Check environment variable (for Vercel deployments)
  if (import.meta.env.VITE_ENABLE_ECS_ENGINE === 'true') {
    return {
      enableECSEngine: true,
      enableAbilities: false,
      enableFastGameplay: true,
      enableSpatialPartitioning: true,
      enableClientPrediction: false, // Still experimental
    };
  }

  // Check local storage for user preference
  try {
    const stored = localStorage.getItem('sr_feature_flags');
    if (stored) {
      return { ...defaultFlags, ...JSON.parse(stored) } as FeatureFlags;
    }
  } catch {
    // Ignore parse errors
  }

  return defaultFlags;
}

/**
 * Set feature flags (persists to local storage)
 */
export function setFeatureFlags(flags: Partial<FeatureFlags>): void {
  try {
    const current = getFeatureFlags();
    const updated = { ...current, ...flags };
    localStorage.setItem('sr_feature_flags', JSON.stringify(updated));
  } catch {
    // Ignore storage errors
  }
}

/**
 * Default feature flags
 */
const defaultFlags: FeatureFlags = {
  enableECSEngine: true,      // ECS engine is now enabled
  enableAbilities: false,     // Abilities disabled
  enableFastGameplay: true,   // Faster matches (30s)
  enableSpatialPartitioning: true, // Performance optimization enabled
  enableClientPrediction: false, // Requires more testing
};

/**
 * Check if a specific feature is enabled
 */
export function isFeatureEnabled(flag: keyof FeatureFlags): boolean {
  const flags = getFeatureFlags();
  return flags[flag];
}
