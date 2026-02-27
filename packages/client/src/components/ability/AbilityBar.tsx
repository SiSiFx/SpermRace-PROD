/**
 * Ability Bar Component (PC)
 * Displays ability buttons with cooldown visualization for desktop
 */

import React, { useEffect, useState, memo, useMemo, useCallback } from 'react';
import './AbilityBar.css';

/** Ability types - can be used as both type and value */
export const ABILITY_TYPES = ['dash', 'shield', 'trap', 'overdrive'] as const;
export type AbilityType = typeof ABILITY_TYPES[number];

/** Ability metadata */
export const ABILITIES: Record<AbilityType, {
  name: string;
  description: string;
  icon: string;
  color: number;
  energyCost: number;
  cooldown: number;
  duration: number;
}> = {
  dash: {
    name: 'Dash',
    description: 'Instant burst of speed in facing direction',
    icon: '⚡',
    color: 0x22d3ee,
    energyCost: 0,
    cooldown: 3000,
    duration: 0,
  },
  shield: {
    name: 'Shield',
    description: 'Temporary invincibility for 1.5s',
    icon: '🛡️',
    color: 0x10b981,
    energyCost: 30,
    cooldown: 8000,
    duration: 1500,
  },
  trap: {
    name: 'Trap',
    description: 'Place static trail that kills on contact',
    icon: '🪤',
    color: 0xef4444,
    energyCost: 40,
    cooldown: 5000,
    duration: 0,
  },
  overdrive: {
    name: 'Overdrive',
    description: '2x speed + thick trail for 3s',
    icon: '🔥',
    color: 0xf59e0b,
    energyCost: 50,
    cooldown: 10000,
    duration: 3000,
  },
};

/** Format cooldown time to readable string */
function formatCooldown(ms: number): string {
  if (ms < 1000) return `${Math.ceil(ms / 100) / 10}s`;
  return `${Math.ceil(ms / 1000)}s`;
}

/**
 * Ability bar props
 */
export interface AbilityBarProps {
  /** Ability cooldown states (0-1 progress) */
  cooldowns?: Partial<Record<AbilityType, number>>;

  /** Ability active states (boolean for simple active check) */
  active?: Partial<Record<AbilityType, boolean>>;

  /** Current boost energy (0-100) */
  boostEnergy?: number;

  /** Max boost energy */
  boostMax?: number;

  /** onAbilityActivate callback */
  onActivate?: (ability: AbilityType) => void;

  /** Show keybind hints */
  showKeybinds?: boolean;

  /** Compact mode */
  compact?: boolean;
}

/**
 * Ability bar component
 * Memoized to prevent unnecessary re-renders
 */
export const AbilityBar = memo(function AbilityBar({
  cooldowns = {},
  active = {},
  boostEnergy = 100,
  boostMax = 100,
  onActivate,
  showKeybinds = true,
  compact = false,
}: AbilityBarProps) {
  const [localCooldowns, setLocalCooldowns] = useState<Record<AbilityType, number>>({
    dash: 1,
    shield: 1,
    trap: 1,
    overdrive: 1,
  });

  const [localActive, setLocalActive] = useState<Record<AbilityType, boolean>>({
    dash: false,
    shield: false,
    trap: false,
    overdrive: false,
  });

  // Update from props
  useEffect(() => {
    setLocalCooldowns((prev) => {
      const updated = { ...prev };
      for (const [key, value] of Object.entries(cooldowns)) {
        if (typeof value === 'number') {
          updated[key as AbilityType] = value;
        }
      }
      return updated;
    });
  }, [cooldowns]);

  useEffect(() => {
    setLocalActive((prev) => {
      const updated = { ...prev };
      for (const [key, value] of Object.entries(active)) {
        if (typeof value === 'boolean') {
          updated[key as AbilityType] = value;
        }
      }
      return updated;
    });
  }, [active]);

  const abilities: AbilityType[] = useMemo(() => ['dash', 'shield', 'trap', 'overdrive'], []);

  const handleClick = useCallback((ability: AbilityType, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    // Check if ready
    const cooldown = localCooldowns[ability] ?? 1;
    if (cooldown < 1) return; // On cooldown

    onActivate?.(ability);
  }, [localCooldowns, onActivate]);

  const getAbilityStyle = useCallback((ability: AbilityType): React.CSSProperties => {
    const config = ABILITIES[ability];
    const cooldown = localCooldowns[ability] ?? 1;
    const isActive = localActive[ability] ?? false;

    return {
      '--ability-color': `#${config.color.toString(16).padStart(6, '0')}`,
      '--cooldown-progress': `${(1 - cooldown) * 100}%`,
      opacity: cooldown < 1 ? 0.6 : 1,
    } as React.CSSProperties;
  }, [localCooldowns, localActive]);

  const getKeybind = useCallback((ability: AbilityType): string => {
    switch (ability) {
      case 'dash': return 'Q';
      case 'shield': return 'E';
      case 'trap': return 'F';
      case 'overdrive': return '⇧⌫';
    }
  }, []);

  const getEnergyCost = useCallback((ability: AbilityType): number => {
    return ABILITIES[ability].energyCost;
  }, []);

  const boostPercent = useMemo(() =>
    boostMax > 0 ? (boostEnergy / boostMax) * 100 : 0,
    [boostEnergy, boostMax]
  );

  return (
    <div className={`ability-bar ${compact ? 'compact' : ''}`}>
      {/* Boost meter */}
      <div className="boost-meter">
        <div className="boost-icon">⚡</div>
        <div className="boost-bar-container">
          <div
            className="boost-bar-fill"
            style={{
              width: `${boostPercent}%`,
              background: boostPercent < 30
                ? 'linear-gradient(90deg, #ef4444 0%, #dc2626 100%)'
                : 'linear-gradient(90deg, #22d3ee 0%, #06b6d4 100%)',
            }}
          />
        </div>
        <span className="boost-text">{Math.round(boostEnergy)}</span>
      </div>

      {/* Ability buttons */}
      {abilities.map((ability) => {
        const config = ABILITIES[ability];
        const cooldown = localCooldowns[ability] ?? 1;
        const isActive = localActive[ability] ?? false;
        const energyCost = getEnergyCost(ability);
        const hasEnoughEnergy = (boostEnergy ?? 100) >= energyCost;

        return (
          <button
            key={ability}
            className={`ability-slot ${cooldown < 1 ? 'on-cooldown' : ''} ${isActive ? 'active' : ''} ${!hasEnoughEnergy ? 'not-enough-energy' : ''}`}
            style={getAbilityStyle(ability)}
            onClick={(e) => handleClick(ability, e)}
            title={`${config.name}: ${config.description}`}
            disabled={cooldown < 1 || !hasEnoughEnergy}
            aria-label={`${config.name}: ${config.description}`}
            aria-describedby={cooldown < 1 ? `ability-cooldown-${ability}` : undefined}
          >
            <span className="ability-icon">{config.icon}</span>

            {showKeybinds && <span className="ability-keybind">{getKeybind(ability)}</span>}

            {cooldown < 1 && (
              <div className="ability-cooldown-overlay" id={`ability-cooldown-${ability}`}>
                <span className="ability-cooldown-text">
                  {formatCooldown((1 - cooldown) * config.cooldown)}
                </span>
              </div>
            )}

            {isActive && (
              <div className="ability-active-indicator" />
            )}

            {energyCost > 0 && (
              <span className="ability-energy-cost">{energyCost}</span>
            )}
          </button>
        );
      })}
    </div>
  );
});

/**
 * Mobile ability bar component
 * Larger buttons with touch-friendly layout
 */
export const MobileAbilityBar = memo(function MobileAbilityBar(props: AbilityBarProps) {
  return (
    <div className="mobile-ability-bar">
      <AbilityBar {...props} showKeybinds={false} compact={false} />
    </div>
  );
});

export default AbilityBar;
