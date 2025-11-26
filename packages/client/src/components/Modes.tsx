import { useEffect, useState } from 'react';
import { useWallet } from '../WalletProvider';
import { useWs } from '../WsProvider';
import { Lightning, Diamond, CrownSimple, Trophy, Users, Clock } from 'phosphor-react';

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

type TierId = 'micro' | 'nano' | 'mega' | 'championship';

type Tier = {
  id: TierId;
  name: string;
  usd: number;
  maxPlayers: number;
  duration: string;
  description: string;
  recommended?: boolean;
};

type PrizePreflight = {
  address: string | null;
  sol: number | null;
  configured: boolean;
} | null;

const TIERS: Tier[] = [
  { 
    id: 'micro', 
    name: 'Micro Race', 
    usd: 1, 
    maxPlayers: 16, 
    duration: '2–3 min',
    description: 'Quick battles, perfect for beginners'
  },
  { 
    id: 'nano', 
    name: 'Nano Race', 
    usd: 5, 
    maxPlayers: 32, 
    duration: '3–4 min',
    description: 'Balanced competition with bigger pools',
    recommended: true
  },
  { 
    id: 'mega', 
    name: 'Mega Race', 
    usd: 25, 
    maxPlayers: 32, 
    duration: '4–6 min',
    description: 'High stakes, intense gameplay'
  },
  { 
    id: 'championship', 
    name: 'Championship', 
    usd: 100, 
    maxPlayers: 16, 
    duration: '5–8 min',
    description: 'Elite tournament for champions only'
  },
];

const TIER_THEMES: Record<TierId, {
  icon: any;
  gradient: string;
  accentColor: string;
  glowColor: string;
}> = {
  micro: {
    icon: Lightning,
    gradient: 'linear-gradient(135deg, #00F0FF 0%, #0EA5E9 100%)',
    accentColor: '#00F0FF',
    glowColor: 'rgba(0, 240, 255, 0.4)',
  },
  nano: {
    icon: Diamond,
    gradient: 'linear-gradient(135deg, #6366F1 0%, #8B5CF6 100%)',
    accentColor: '#8B5CF6',
    glowColor: 'rgba(139, 92, 246, 0.4)',
  },
  mega: {
    icon: CrownSimple,
    gradient: 'linear-gradient(135deg, #F43F5E 0%, #FB923C 100%)',
    accentColor: '#FB923C',
    glowColor: 'rgba(251, 146, 60, 0.4)',
  },
  championship: {
    icon: Trophy,
    gradient: 'linear-gradient(135deg, #FFD700 0%, #FFA500 100%)',
    accentColor: '#FFD700',
    glowColor: 'rgba(255, 215, 0, 0.4)',
  },
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
    <>
      <style>{`
        .mode-grid {
          max-width: 680px;
          margin: 16px auto;
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 12px;
          padding: 0 12px;
        }
        
        @media (max-width: 640px) {
          .mode-grid {
            gap: 10px;
            padding: 0 10px;
            max-width: 100%;
          }
        }
      `}</style>
      <div className="mode-grid">
      {TIERS.map((tier) => {
        const estPrizeUsd = (tier.usd * tier.maxPlayers * 0.85).toFixed(2);
        const disabled = busy || globalDisabled;
        const theme = TIER_THEMES[tier.id];
        const TierIcon = theme.icon;

        return (
          <button
            key={tier.id}
            type="button"
            disabled={disabled}
            className="mode-card"
            style={{
              position: 'relative',
              background: 'rgba(3,3,5,0.92)',
              borderRadius: 24,
              border: `2px solid ${disabled ? 'var(--border-dim)' : 'transparent'}`,
              padding: 0,
              cursor: disabled ? 'not-allowed' : 'pointer',
              textAlign: 'center',
              boxShadow: disabled ? 'none' : '0 24px 80px rgba(0,0,0,0.9)',
              transition: 'all 0.35s cubic-bezier(0.4, 0, 0.2, 1)',
              opacity: disabled ? 0.6 : 1,
              overflow: 'hidden',
              aspectRatio: '1 / 1',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
            }}
            onClick={() => handleJoin(tier.usd)}
            onMouseEnter={(e) => {
              if (disabled) return;
              e.currentTarget.style.borderColor = theme.accentColor;
              e.currentTarget.style.boxShadow = `0 0 40px ${theme.glowColor}, 0 24px 70px rgba(0,0,0,0.9)`;
              e.currentTarget.style.transform = 'translateY(-4px) scale(1.02)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = 'transparent';
              e.currentTarget.style.boxShadow = disabled
                ? 'none'
                : '0 20px 60px rgba(0,0,0,0.8)';
              e.currentTarget.style.transform = 'translateY(0) scale(1)';
            }}
          >
            {/* Background gradient overlay */}
            <div
              style={{
                position: 'absolute',
                inset: 0,
                background: theme.gradient,
                opacity: 0.08,
                pointerEvents: 'none',
              }}
            />

            {/* Recommended badge */}
            {tier.recommended && (
              <div
                style={{
                  position: 'absolute',
                  top: 8,
                  right: 8,
                  background: theme.gradient,
                  color: '#000',
                  fontSize: 8,
                  fontWeight: 800,
                  textTransform: 'uppercase',
                  letterSpacing: 1,
                  padding: '3px 8px',
                  borderRadius: 999,
                  zIndex: 2,
                  boxShadow: `0 2px 12px ${theme.glowColor}`,
                }}
              >
                Hot
              </div>
            )}

            <div style={{ padding: '16px 14px 12px', display: 'flex', flexDirection: 'column', gap: 8, flex: 1, position: 'relative', zIndex: 1 }}>
              {/* Icon - Compact */}
              <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 4 }}>
                <div
                  style={{
                    width: 48,
                    height: 48,
                    borderRadius: '50%',
                    background: `radial-gradient(circle at 30% 30%, ${theme.accentColor}25, ${theme.accentColor}08)`,
                    border: `2px solid ${theme.accentColor}40`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    boxShadow: `0 4px 20px ${theme.glowColor}`,
                  }}
                >
                  <TierIcon size={28} weight="fill" color={theme.accentColor} />
                </div>
              </div>

              {/* Tier Name - Compact */}
              <div>
                <div
                  style={{
                    fontSize: 15,
                    fontWeight: 900,
                    color: 'var(--text-primary)',
                    marginBottom: 2,
                    letterSpacing: 0.2,
                  }}
                >
                  {tier.name}
                </div>
                <div
                  style={{
                    fontSize: 9,
                    color: 'var(--text-secondary)',
                    opacity: 0.8,
                    textTransform: 'uppercase',
                    letterSpacing: 0.5,
                  }}
                >
                  {tier.description}
                </div>
              </div>

              {/* Prize Pool - Compact */}
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', paddingTop: 4, paddingBottom: 4 }}>
                <div
                  style={{
                    fontSize: 8,
                    textTransform: 'uppercase',
                    letterSpacing: 1,
                    color: 'var(--text-muted)',
                    marginBottom: 4,
                    fontWeight: 700,
                  }}
                >
                  Win
                </div>
                <div
                  style={{
                    fontSize: 32,
                    fontWeight: 900,
                    background: theme.gradient,
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent',
                    backgroundClip: 'text',
                    fontFamily:
                      '"JetBrains Mono", ui-monospace, SFMono-Regular, Menlo, monospace',
                    letterSpacing: -1.5,
                    lineHeight: 1,
                  }}
                >
                  ${estPrizeUsd}
                </div>
                <div
                  style={{
                    fontSize: 8,
                    color: 'var(--text-secondary)',
                    marginTop: 4,
                    opacity: 0.7,
                    textTransform: 'uppercase',
                    letterSpacing: 0.3,
                  }}
                >
                  85%
                </div>
              </div>

              {/* Stats row - Ultra compact */}
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-around',
                  alignItems: 'center',
                  padding: '8px 6px',
                  background: 'rgba(255,255,255,0.03)',
                  borderRadius: 10,
                  gap: 6,
                }}
              >
                <div style={{ textAlign: 'center', flex: 1 }}>
                  <div
                    style={{
                      fontSize: 7,
                      textTransform: 'uppercase',
                      color: 'var(--text-muted)',
                      marginBottom: 3,
                      letterSpacing: 0.5,
                      fontWeight: 600,
                    }}
                  >
                    Entry
                  </div>
                  <div
                    style={{
                      fontSize: 13,
                      fontWeight: 800,
                      color: 'var(--text-primary)',
                    }}
                  >
                    ${tier.usd}
                  </div>
                </div>
                <div style={{ width: 1, height: 24, background: 'rgba(255,255,255,0.1)' }} />
                <div style={{ textAlign: 'center', flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 2, marginBottom: 3 }}>
                    <Users size={7} weight="fill" color="var(--text-muted)" />
                    <div
                      style={{
                        fontSize: 7,
                        textTransform: 'uppercase',
                        color: 'var(--text-muted)',
                        letterSpacing: 0.5,
                        fontWeight: 600,
                      }}
                    >
                      Max
                    </div>
                  </div>
                  <div
                    style={{
                      fontSize: 13,
                      fontWeight: 800,
                      color: 'var(--text-primary)',
                    }}
                  >
                    {tier.maxPlayers}
                  </div>
                </div>
                <div style={{ width: 1, height: 24, background: 'rgba(255,255,255,0.1)' }} />
                <div style={{ textAlign: 'center', flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 2, marginBottom: 3 }}>
                    <Clock size={7} weight="fill" color="var(--text-muted)" />
                    <div
                      style={{
                        fontSize: 7,
                        textTransform: 'uppercase',
                        color: 'var(--text-muted)',
                        letterSpacing: 0.5,
                        fontWeight: 600,
                      }}
                    >
                      Time
                    </div>
                  </div>
                  <div
                    style={{
                      fontSize: 11,
                      fontWeight: 800,
                      color: 'var(--text-primary)',
                    }}
                  >
                    {tier.duration}
                  </div>
                </div>
              </div>

              {/* Status overlay - only show if busy or error */}
              {(preflightError || (busy && !preflightError)) && (
                <div
                  style={{
                    padding: '6px 10px',
                    background: preflightError ? 'rgba(239, 68, 68, 0.2)' : `linear-gradient(135deg, ${theme.accentColor}30, ${theme.accentColor}20)`,
                    border: preflightError ? '1px solid rgba(239, 68, 68, 0.5)' : `1px solid ${theme.accentColor}50`,
                    borderRadius: 8,
                    fontSize: 9,
                    color: preflightError ? '#ef4444' : theme.accentColor,
                    textAlign: 'center',
                    fontWeight: 600,
                    textTransform: 'uppercase',
                    letterSpacing: 0.5,
                  }}
                >
                  {preflightError
                    ? 'Unavailable'
                    : wsState.entryFee?.pending
                    ? 'Verifying…'
                    : wsState.phase === 'authenticating'
                    ? 'Sign'
                    : 'Connecting…'}
                </div>
              )}
            </div>
          </button>
        );
      })}
      </div>
    </>
  );
}

export default Modes;
export { Modes };
