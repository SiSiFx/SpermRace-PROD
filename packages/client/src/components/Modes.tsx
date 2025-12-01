import { useEffect, useState } from 'react';
import { useWallet } from '../WalletProvider';
import { useWs } from '../WsProvider';

// Base URL for backend API.
// For any spermrace.io host (prod/dev/www), always use same-origin /api so hosting can proxy
// and we avoid CORS when VITE_API_BASE points at api.spermrace.io.
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
  usd: number;
  maxPlayers: number;
  duration: string;
};

type PrizePreflight = {
  address: string | null;
  sol: number | null;
  configured: boolean;
} | null;

const TIERS: Tier[] = [
  { id: 'micro', name: 'Micro Race', usd: 1, maxPlayers: 16, duration: '2–3 min' },
  { id: 'nano', name: 'Nano Race', usd: 5, maxPlayers: 32, duration: '3–4 min' },
  { id: 'mega', name: 'Mega Race', usd: 25, maxPlayers: 32, duration: '4–6 min' },
  { id: 'championship', name: 'Championship', usd: 100, maxPlayers: 16, duration: '5–8 min' },
];

// Tier-specific styling
const getTierTheme = (tierId: string) => {
  switch (tierId) {
    case 'micro':
      return {
        accent: '#10b981', // Emerald - beginner friendly
        glow: 'rgba(16, 185, 129, 0.35)',
        border: 'rgba(16, 185, 129, 0.8)',
      };
    case 'nano':
      return {
        accent: '#00F0FF', // Electric Cyan - recommended 
        glow: 'rgba(0, 240, 255, 0.35)',
        border: 'rgba(0, 240, 255, 0.8)',
      };
    case 'mega':
      return {
        accent: '#a855f7', // Purple - mid-stakes
        glow: 'rgba(168, 85, 247, 0.35)',
        border: 'rgba(168, 85, 247, 0.8)',
      };
    case 'championship':
      return {
        accent: '#f59e0b', // Amber - high roller
        glow: 'rgba(245, 158, 11, 0.35)',
        border: 'rgba(245, 158, 11, 0.8)',
      };
    default:
      return {
        accent: '#00F0FF',
        glow: 'rgba(0, 240, 255, 0.35)',
        border: 'rgba(0, 240, 255, 0.8)',
      };
  }
};

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

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const r = await fetch(`${API_BASE}/prize-preflight`);
        if (!r.ok) throw new Error(`preflight ${r.status}`);
        const j = await r.json();
        if (cancelled) return;
        setPreflight(j);
        const misconfigured = !j?.configured || !j?.address || j?.sol == null;
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

  const globalDisabled =
    preflightError ||
    !!(
      preflight &&
      (!preflight.configured || !preflight.address || preflight.sol == null)
    );

  const busy =
    isJoining || wsState.phase === 'connecting' || wsState.phase === 'authenticating';

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

  const handleJoin = async (tierUsd: number) => {
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
  };

  return (
    <div
      className="mode-grid"
      style={{
        maxWidth: 960,
        margin: '32px auto 24px',
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
        gap: 20,
      }}
    >
      {TIERS.map((tier) => {
        const estPrizeUsd = (tier.usd * tier.maxPlayers * 0.85).toFixed(2);
        const disabled = busy || globalDisabled;
        const theme = getTierTheme(tier.id);

        return (
          <button
            key={tier.id}
            type="button"
            disabled={disabled}
            className="mode-card"
            style={{
              position: 'relative',
              background: 'rgba(3,3,5,0.85)',
              borderRadius: 18,
              border: '1px solid var(--border-dim)',
              padding: '18px 18px',
              cursor: disabled ? 'not-allowed' : 'pointer',
              textAlign: 'left',
              boxShadow: disabled ? 'none' : 'var(--shadow-premium)',
              transition:
                'border-color 0.15s ease, background-color 0.15s ease, box-shadow 0.15s ease, transform 0.12s ease',
              opacity: disabled ? 0.6 : 1,
              overflow: 'hidden',
            }}
            onClick={() => handleJoin(tier.usd)}
            onMouseEnter={(e) => {
              if (disabled) return;
              e.currentTarget.style.borderColor = theme.border;
              e.currentTarget.style.boxShadow =
                `0 0 24px ${theme.glow}, 0 16px 40px rgba(0,0,0,0.9)`;
              e.currentTarget.style.backgroundColor = 'rgba(14,14,18,0.98)';
              e.currentTarget.style.transform = 'translateY(-2px)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = 'var(--border-dim)';
              e.currentTarget.style.boxShadow = disabled
                ? 'none'
                : 'var(--shadow-premium)';
              e.currentTarget.style.backgroundColor = 'rgba(3,3,5,0.85)';
              e.currentTarget.style.transform = 'translateY(0)';
            }}
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'flex-start',
                marginBottom: 10,
              }}
            >
              <div style={{ flex: 1 }}>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    marginBottom: 6,
                  }}
                >
                  <div
                    style={{
                      fontSize: 12,
                      letterSpacing: 4,
                      textTransform: 'uppercase',
                      color: 'var(--text-muted)',
                      fontFamily:
                        'Orbitron, system-ui, -apple-system, BlinkMacSystemFont, sans-serif',
                    }}
                  >
                    {tier.name}
                  </div>
                  {tier.id === 'nano' && (
                    <div
                      style={{
                        padding: '2px 8px',
                        backgroundColor: theme.accent,
                        color: '#000',
                        fontSize: 9,
                        fontWeight: 800,
                        borderRadius: 4,
                        letterSpacing: 1,
                        textTransform: 'uppercase',
                      }}
                    >
                      Hot
                    </div>
                  )}
                </div>
                <div
                  style={{
                    fontSize: 18,
                    fontWeight: 700,
                    color: 'var(--text-primary)',
                    letterSpacing: 0.5,
                  }}
                >
                  {tier.usd.toFixed(2)} USD entry • {tier.maxPlayers} players
                </div>
              </div>
            </div>

            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginTop: 12,
                fontFamily:
                  '"JetBrains Mono", ui-monospace, SFMono-Regular, Menlo, monospace',
                fontSize: 11,
                color: 'var(--text-secondary)',
              }}
            >
              <div>
                <div style={{ opacity: 0.7 }}>Est. Prize Pool</div>
                <div style={{ color: 'var(--accent)', marginTop: 2 }}>
                  ${estPrizeUsd}
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ opacity: 0.7 }}>Round Length</div>
                <div style={{ color: 'var(--text-primary)', marginTop: 2 }}>
                  {tier.duration}
                </div>
              </div>
            </div>

            {/* Tier-specific accent bar */}
            <div
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                height: 2,
                background: `linear-gradient(90deg, ${theme.accent}, transparent)`,
                borderRadius: '18px 18px 0 0',
              }}
            />

            {preflightError && (
              <div
                style={{
                  marginTop: 10,
                  fontSize: 11,
                  color: 'var(--danger)',
                  opacity: 0.9,
                }}
              >
                Tournament service temporarily unavailable.
              </div>
            )}

            {busy && !preflightError && (
              <div
                style={{
                  marginTop: 10,
                  fontSize: 11,
                  color: 'var(--text-secondary)',
                }}
              >
                {wsState.entryFee?.pending
                  ? 'Verifying entry fee on Solana…'
                  : wsState.phase === 'authenticating'
                  ? 'Waiting for wallet signature…'
                  : 'Connecting…'}
              </div>
            )}
          </button>
        );
      })}
    </div>
  );
}

export default Modes;
export { Modes };
