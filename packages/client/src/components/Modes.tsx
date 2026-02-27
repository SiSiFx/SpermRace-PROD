/**
 * Tournament/Modes Screen
 * Professional tier selection with clear pricing
 */

import { useEffect, useState, useMemo, memo, useCallback } from 'react';
import { useWallet } from '../WalletProvider';
import { useWs } from '../WsProvider';
import { Trophy, Users, Clock, TrendUp, Lock } from 'phosphor-react';
import { fetchWithRetry } from '../network/fetchWithTimeoutAndRetry';

// Base URL for backend API.
const API_BASE: string = (() => {
  try {
    const host = (window?.location?.hostname || '').toLowerCase();
    if (host.endsWith('spermrace.io')) return '/api';
  } catch {}

  const env = (import.meta as any).env?.VITE_API_BASE as string | undefined;
  if (env && typeof env === 'string' && env.trim()) return env.trim();

  try {
    const host = (window?.location?.hostname || '').toLowerCase();
    if (host.includes('dev.spermrace.io')) return 'https://dev.spermrace.io/api';
    if (host.includes('spermrace.io')) return 'https://spermrace.io/api';
  } catch {}
  return '/api';
})();

type Tier = {
  id: 'micro' | 'nano' | 'mega' | 'championship';
  name: string;
  shortName: string;
  usd: number;
  maxPlayers: number;
  duration: string;
  badge?: string;
  color: string;
  gradient: string;
};

type PrizePreflight = {
  address: string | null;
  sol: number | null;
  configured: boolean;
} | null;

// Professional Tier Configuration
const TIERS: Tier[] = [
  {
    id: 'micro',
    name: 'Micro Arena',
    shortName: 'Micro',
    usd: 1,
    maxPlayers: 16,
    duration: '2-3 min',
    color: '#22c55e',
    gradient: 'linear-gradient(135deg, #22c55e 0%, #16a34a 100%)',
  },
  {
    id: 'nano',
    name: 'Nano Circuit',
    shortName: 'Nano',
    usd: 5,
    maxPlayers: 32,
    duration: '3-4 min',
    badge: 'Popular',
    color: '#3b82f6',
    gradient: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
  },
  {
    id: 'mega',
    name: 'Mega Championship',
    shortName: 'Mega',
    usd: 25,
    maxPlayers: 32,
    duration: '4-6 min',
    color: '#f59e0b',
    gradient: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
  },
  {
    id: 'championship',
    name: 'Grand Championship',
    shortName: 'Grand',
    usd: 100,
    maxPlayers: 16,
    duration: '5-8 min',
    badge: 'Premium',
    color: '#8b5cf6',
    gradient: 'linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)',
  },
];

type ExposedJoinApi = {
  joinTier: (usd: number) => void;
  busy: boolean;
  disabled: boolean;
};

type ModesProps = {
  exposeJoin?: (api: ExposedJoinApi) => void;
};

function Modes({ exposeJoin }: ModesProps = {}) {
  const { publicKey, connect } = useWallet() as any;
  const { connectAndJoin, state: wsState } = useWs() as any;
  const [isJoining, setIsJoining] = useState(false);
  const [preflight, setPreflight] = useState<PrizePreflight>(null);
  const [preflightError, setPreflightError] = useState(false);
  const [hoveredTier, setHoveredTier] = useState<string | null>(null);

  // Memoize derived state to prevent unnecessary recalculations
  const globalDisabled = useMemo(() => {
    return preflightError || !!(
      preflight &&
      (!preflight.configured || !preflight.address || preflight.sol == null)
    );
  }, [preflightError, preflight]);

  const busy = useMemo(() => {
    return isJoining || wsState.phase === 'connecting' || wsState.phase === 'authenticating';
  }, [isJoining, wsState.phase]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const result = await fetchWithRetry<{ address: string | null; sol: number | null; configured: boolean }>(`${API_BASE}/prize-preflight`, {
          timeout: 5000,
          maxRetries: 2,
        });
        if (cancelled) return;
        setPreflight(result.data);
        const misconfigured = !result.data?.configured || !result.data?.address || result.data?.sol == null;
        setPreflightError(!!misconfigured);
      } catch {
        if (!cancelled) setPreflightError(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (wsState.phase === 'lobby' || wsState.phase === 'game') setIsJoining(false);
  }, [wsState.phase]);

  useEffect(() => {
    if (!exposeJoin) return;
    exposeJoin({
      joinTier: (usd: number) => {
        void handleJoin(usd);
      },
      busy,
      disabled: globalDisabled,
    });
  }, [exposeJoin, busy, globalDisabled]);

  const handleJoin = useCallback(async (tierUsd: number) => {
    if (globalDisabled) return;
    setIsJoining(true);
    try {
      const ok = publicKey ? true : await connect();
      if (!ok) {
        setIsJoining(false);
        return;
      }
      await connectAndJoin({ entryFeeTier: tierUsd as any, mode: 'tournament' });
    } catch {
      setIsJoining(false);
    }
  }, [globalDisabled, publicKey, connect, connectAndJoin]);

  const getStatusMessage = () => {
    if (preflightError) return 'Tournament service temporarily unavailable';
    if (!busy) return null;
    if (wsState.entryFee?.pending) return 'Verifying entry fee…';
    if (wsState.phase === 'authenticating') return 'Waiting for wallet signature…';
    return 'Connecting…';
  };

  const statusMessage = getStatusMessage();

  return (
    <div className="sr-modes">
      {/* Header */}
      <div className="sr-modes-header">
        <h2 className="sr-modes-title">Choose Your Arena</h2>
        <p className="sr-modes-subtitle">Higher stakes, bigger rewards. Winner gets a fixed 10x payout.</p>
      </div>

      {/* Error message */}
      {preflightError && (
        <div className="sr-error-banner">
          <Lock size={18} weight="fill" />
          <span>{statusMessage}</span>
        </div>
      )}

      {/* Tier grid */}
      <div className="sr-tiers">
        {TIERS.map((tier) => {
          const estPrizeUsd = (tier.usd * 10).toFixed(0);
          const disabled = busy || globalDisabled;
          const isHovered = hoveredTier === tier.id;
          const isBusy = busy && !preflightError;

          return (
            <button
              key={tier.id}
              type="button"
              disabled={disabled}
              className={`mode-card sr-tier-card ${isHovered ? 'sr-tier-hovered' : ''} ${disabled ? 'sr-tier-disabled' : ''}`}
              style={{
                '--tier-color': tier.color,
                '--tier-gradient': tier.gradient,
              } as React.CSSProperties}
              onClick={() => handleJoin(tier.usd)}
              onMouseEnter={() => setHoveredTier(tier.id)}
              onMouseLeave={() => setHoveredTier(null)}
              aria-label={`Join ${tier.name}. Entry fee: $${tier.usd}. Maximum players: ${tier.maxPlayers}. Winner payout: $${estPrizeUsd}. Duration: ${tier.duration}. ${disabled ? statusMessage : 'Click to join'}`}
            >
              {/* Badge */}
              {tier.badge && (
                <div className="sr-tier-badge" style={{ background: tier.gradient }}>
                  {tier.badge}
                </div>
              )}

              {/* Color bar */}
              <div className="sr-tier-bar" style={{ background: tier.gradient }} />

              {/* Content */}
              <div className="sr-tier-content">
                {/* Header */}
                <div className="sr-tier-header">
                  <div className="sr-tier-name">{tier.shortName}</div>
                  <div className="sr-tier-fullname">{tier.name}</div>
                </div>

                {/* Entry fee */}
                <div className="sr-tier-entry">
                  <span className="sr-tier-entry-amount">${tier.usd}</span>
                  <span className="sr-tier-entry-label">entry</span>
                </div>

                {/* Stats */}
                <div className="sr-tier-stats">
                  <div className="sr-tier-stat">
                    <Trophy size={16} weight="duotone" aria-hidden="true" />
                    <div>
                      <span className="sr-tier-stat-value">${estPrizeUsd}</span>
                      <span className="sr-tier-stat-label">Winner Payout</span>
                    </div>
                  </div>
                  <div className="sr-tier-stat">
                    <Users size={16} weight="duotone" aria-hidden="true" />
                    <div>
                      <span className="sr-tier-stat-value">{tier.maxPlayers}</span>
                      <span className="sr-tier-stat-label">Players</span>
                    </div>
                  </div>
                  <div className="sr-tier-stat">
                    <Clock size={16} weight="duotone" aria-hidden="true" />
                    <div>
                      <span className="sr-tier-stat-value">{tier.duration}</span>
                      <span className="sr-tier-stat-label">Duration</span>
                    </div>
                  </div>
                </div>

                {/* Winner takes all indicator */}
                <div className="sr-tier-winner">
                  <TrendUp size={14} weight="fill" aria-hidden="true" />
                  <span>Winner takes <strong>${Math.floor(tier.usd * 10)}</strong></span>
                </div>

                {/* Busy state */}
                {isBusy && isHovered && (
                  <div className="sr-tier-status">
                    <div className="sr-tier-spinner" />
                    <span>{statusMessage}</span>
                  </div>
                )}
              </div>
            </button>
          );
        })}
      </div>

      {/* Info footer */}
      <div className="sr-modes-footer">
        <div className="sr-modes-info">
          <Trophy size={18} weight="duotone" aria-hidden="true" />
          <span>All prizes are paid instantly in SOL. Winner payout is fixed at 10x the selected tier.</span>
        </div>
      </div>
    </div>
  );
}

// Memoize to prevent unnecessary re-renders when parent state changes
const MemoizedModes = memo(Modes);
export default MemoizedModes;
export { Modes };
