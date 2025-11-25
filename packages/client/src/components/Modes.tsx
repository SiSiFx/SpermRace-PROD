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
    <div
      className="mode-grid"
      style={{
        maxWidth: 1080,
        margin: '32px auto 24px',
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
        gap: 24,
        padding: '0 16px',
      }}
    >
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
              background: 'rgba(3,3,5,0.9)',
              borderRadius: 20,
              border: `2px solid ${disabled ? 'var(--border-dim)' : 'transparent'}`,
              padding: 0,
              cursor: disabled ? 'not-allowed' : 'pointer',
              textAlign: 'left',
              boxShadow: disabled ? 'none' : '0 20px 60px rgba(0,0,0,0.8)',
              transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
              opacity: disabled ? 0.6 : 1,
              overflow: 'hidden',
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
            {/* Accent gradient bar at top */}
            <div
              style={{
                height: 4,
                background: theme.gradient,
                boxShadow: `0 0 20px ${theme.glowColor}`,
              }}
            />

            {/* Recommended badge */}
            {tier.recommended && (
              <div
                style={{
                  position: 'absolute',
                  top: 16,
                  right: 16,
                  background: theme.gradient,
                  color: '#000',
                  fontSize: 10,
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  letterSpacing: 1.2,
                  padding: '4px 12px',
                  borderRadius: 20,
                  zIndex: 2,
                  boxShadow: `0 4px 12px ${theme.glowColor}`,
                }}
              >
                Popular
              </div>
            )}

            <div style={{ padding: '24px 24px 20px' }}>
              {/* Icon + Tier Name */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  marginBottom: 16,
                }}
              >
                <div
                  style={{
                    width: 56,
                    height: 56,
                    borderRadius: 16,
                    background: `linear-gradient(135deg, ${theme.accentColor}20, ${theme.accentColor}10)`,
                    border: `2px solid ${theme.accentColor}40`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                  }}
                >
                  <TierIcon size={32} weight="fill" color={theme.accentColor} />
                </div>
                <div style={{ flex: 1 }}>
                  <div
                    style={{
                      fontSize: 20,
                      fontWeight: 800,
                      color: 'var(--text-primary)',
                      marginBottom: 4,
                      letterSpacing: 0.5,
                    }}
                  >
                    {tier.name}
                  </div>
                  <div
                    style={{
                      fontSize: 12,
                      color: 'var(--text-secondary)',
                      opacity: 0.9,
                    }}
                  >
                    {tier.description}
                  </div>
                </div>
              </div>

              {/* Prize Pool - Main focal point */}
              <div
                style={{
                  background: `linear-gradient(135deg, ${theme.accentColor}15, ${theme.accentColor}08)`,
                  border: `1px solid ${theme.accentColor}30`,
                  borderRadius: 14,
                  padding: '16px 20px',
                  marginBottom: 16,
                  textAlign: 'center',
                }}
              >
                <div
                  style={{
                    fontSize: 11,
                    textTransform: 'uppercase',
                    letterSpacing: 2,
                    color: 'var(--text-muted)',
                    marginBottom: 6,
                    fontWeight: 600,
                  }}
                >
                  Prize Pool
                </div>
                <div
                  style={{
                    fontSize: 36,
                    fontWeight: 900,
                    background: theme.gradient,
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent',
                    backgroundClip: 'text',
                    fontFamily:
                      '"JetBrains Mono", ui-monospace, SFMono-Regular, Menlo, monospace',
                    letterSpacing: -1,
                  }}
                >
                  ${estPrizeUsd}
                </div>
                <div
                  style={{
                    fontSize: 11,
                    color: 'var(--text-secondary)',
                    marginTop: 4,
                    opacity: 0.8,
                  }}
                >
                  85% distributed to winners
                </div>
              </div>

              {/* Stats row */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr 1fr',
                  gap: 10,
                  marginBottom: 16,
                }}
              >
                <div
                  style={{
                    background: 'rgba(255,255,255,0.04)',
                    borderRadius: 10,
                    padding: '10px 8px',
                    textAlign: 'center',
                  }}
                >
                  <div
                    style={{
                      fontSize: 9,
                      textTransform: 'uppercase',
                      color: 'var(--text-muted)',
                      marginBottom: 4,
                      letterSpacing: 0.5,
                    }}
                  >
                    Entry
                  </div>
                  <div
                    style={{
                      fontSize: 14,
                      fontWeight: 700,
                      color: 'var(--text-primary)',
                    }}
                  >
                    ${tier.usd}
                  </div>
                </div>
                <div
                  style={{
                    background: 'rgba(255,255,255,0.04)',
                    borderRadius: 10,
                    padding: '10px 8px',
                    textAlign: 'center',
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 4,
                      marginBottom: 4,
                    }}
                  >
                    <Users size={10} weight="fill" color="var(--text-muted)" />
                    <div
                      style={{
                        fontSize: 9,
                        textTransform: 'uppercase',
                        color: 'var(--text-muted)',
                        letterSpacing: 0.5,
                      }}
                    >
                      Players
                    </div>
                  </div>
                  <div
                    style={{
                      fontSize: 14,
                      fontWeight: 700,
                      color: 'var(--text-primary)',
                    }}
                  >
                    {tier.maxPlayers}
                  </div>
                </div>
                <div
                  style={{
                    background: 'rgba(255,255,255,0.04)',
                    borderRadius: 10,
                    padding: '10px 8px',
                    textAlign: 'center',
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 4,
                      marginBottom: 4,
                    }}
                  >
                    <Clock size={10} weight="fill" color="var(--text-muted)" />
                    <div
                      style={{
                        fontSize: 9,
                        textTransform: 'uppercase',
                        color: 'var(--text-muted)',
                        letterSpacing: 0.5,
                      }}
                    >
                      Time
                    </div>
                  </div>
                  <div
                    style={{
                      fontSize: 14,
                      fontWeight: 700,
                      color: 'var(--text-primary)',
                    }}
                  >
                    {tier.duration}
                  </div>
                </div>
              </div>

              {/* CTA / Status */}
              {preflightError ? (
                <div
                  style={{
                    padding: '14px 20px',
                    background: 'rgba(239, 68, 68, 0.15)',
                    border: '1px solid rgba(239, 68, 68, 0.4)',
                    borderRadius: 12,
                    fontSize: 12,
                    color: '#ef4444',
                    textAlign: 'center',
                    fontWeight: 500,
                  }}
                >
                  Service temporarily unavailable
                </div>
              ) : busy && !preflightError ? (
                <div
                  style={{
                    padding: '14px 20px',
                    background: `linear-gradient(135deg, ${theme.accentColor}25, ${theme.accentColor}15)`,
                    border: `1px solid ${theme.accentColor}40`,
                    borderRadius: 12,
                    fontSize: 12,
                    color: theme.accentColor,
                    textAlign: 'center',
                    fontWeight: 500,
                  }}
                >
                  {wsState.entryFee?.pending
                    ? 'Verifying on Solana…'
                    : wsState.phase === 'authenticating'
                    ? 'Sign with wallet…'
                    : 'Connecting…'}
                </div>
              ) : (
                <div
                  style={{
                    padding: '14px 20px',
                    background: theme.gradient,
                    borderRadius: 12,
                    fontSize: 14,
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    letterSpacing: 1,
                    textAlign: 'center',
                    color: tier.id === 'championship' || tier.id === 'micro' ? '#000' : '#fff',
                    boxShadow: `0 8px 20px ${theme.glowColor}`,
                  }}
                >
                  Join Race
                </div>
              )}
            </div>
          </button>
        );
      })}
    </div>
  );
}

export default Modes;
export { Modes };
