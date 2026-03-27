export interface GameStats {
  placement: number;
  kills: number;
  duration: number;
  distance: number;
  winner: boolean;
  killerName: string | null;
  totalPlayers: number;
}

export type TouchState = {
  moveTouchId: number | null;
  boostTouchId: number | null;
  moveOrigin: { x: number; y: number };
};

export type ViewStatus = 'playing' | 'dead' | 'won';

export type ViewSnapshot = {
  aliveCount: number;
  kills: number;
  boostPct: number;
  elapsed: number;
  status: ViewStatus;
  placement: number;
  killer: string | null;
  zonePhase: 'idle' | 'warning' | 'shrinking' | 'final';
  isPlayerOutside: boolean;
  isPlayerInDanger: boolean;
  timeUntilShrink: number;
  /** Ability cooldown 0-1 (0=ready, >0=on cooldown, counts down) */
  abilityCooldownPct: number;
  /** Whether ability is currently active */
  abilityActive: boolean;
};
