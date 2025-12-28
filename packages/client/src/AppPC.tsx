import { useEffect, useState } from 'react';
// Base URL for backend API.
// For any spermrace.io host (prod/dev/www), always hit same-origin /api so Vercel can proxy
// and we avoid CORS issues with api.spermrace.io.
const API_BASE: string = (() => {
  try {
    const host = (window?.location?.hostname || '').toLowerCase();
    if (host.endsWith('spermrace.io')) return '/api';
  } catch { }

  const env = (import.meta as any).env?.VITE_API_BASE as string | undefined;
  if (env && typeof env === 'string' && env.trim()) return env.trim();

  try {
    const host = (window?.location?.hostname || '').toLowerCase();
    if (host.includes('dev.spermrace.io')) return 'https://dev.spermrace.io/api';
    if (host.includes('spermrace.io')) return 'https://spermrace.io/api';
  } catch { }
  return '/api';
})();
// Solana cluster for links (e.g., Solscan): prefer env, else infer by hostname
const SOLANA_CLUSTER: 'devnet' | 'mainnet' = (() => {
  const env = (import.meta as any).env?.VITE_SOLANA_CLUSTER as string | undefined;
  if (env && /^(devnet|mainnet)$/i.test(env)) return env.toLowerCase() as any;
  try {
    const host = (window?.location?.hostname || '').toLowerCase();
    return host.includes('dev.spermrace.io') ? 'devnet' : 'mainnet';
  } catch { }
  return 'devnet';
})();
import { WalletProvider, useWallet } from './WalletProvider';
import { WsProvider, useWs } from './WsProvider';
import NewGameView from './NewGameView';
import HowToPlayOverlay from './HowToPlayOverlay';
import PracticeFullTutorial from './PracticeFullTutorial';
import { PracticeModeSelection } from './PracticeModeSelection';
import { Leaderboard } from './Leaderboard';
import { CrownSimple, Lightning, Diamond, Atom } from 'phosphor-react';

type AppScreen = 'landing' | 'practice' | 'practice-solo' | 'modes' | 'wallet' | 'lobby' | 'game' | 'results';

export default function AppPC() {
  return (
    <WalletProvider>
      <WsProvider>
        <AppInner />
      </WsProvider>
    </WalletProvider>
  );
}

function AppInner() {
  const [screen, setScreen] = useState<AppScreen>('landing');
  const [solPrice, setSolPrice] = useState<number | null>(null);
  const { state: wsState, signAuthentication, leave } = useWs() as any;
  const { publicKey } = useWallet() as any;
  const [toast, setToast] = useState<string | null>(null);
  const showToast = (msg: string, duration = 1800) => {
    setToast(msg);
    window.setTimeout(() => setToast(null), duration);
  };
  const [showHelp] = useState<boolean>(false);
  const [showHowTo, setShowHowTo] = useState<boolean>(false);
  const [showLeaderboard, setShowLeaderboard] = useState<boolean>(false);

  // Loading progress for overlay (indefinite fill)
  const [loadProg, setLoadProg] = useState<number>(0);
  const overlayActive = (wsState.phase === 'connecting' || wsState.phase === 'authenticating' || wsState.entryFee.pending);

  useEffect(() => {
    let id: any;
    if (overlayActive) {
      setLoadProg(0);
      id = setInterval(() => {
        setLoadProg(p => (p >= 100 ? 0 : p + 2));
      }, 120);
    } else {
      setLoadProg(0);
    }
    return () => { if (id) clearInterval(id); };
  }, [overlayActive]);

  // Scope background animation to Landing only
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const bg = await import('./spermBackground');
      if (cancelled) return;
      if (screen === 'landing') bg.startSpermBackground?.();
      else bg.stopSpermBackground?.();
    })();
    return () => { cancelled = true; };
  }, [screen]);

  // Map wallet adapter errors to toast
  useEffect(() => {
    const onWalletError = (e: any) => {
      const msg = e?.detail?.userMessage || e?.detail?.error?.message || 'Wallet error';
      showToast(msg, 2600);
    };
    window.addEventListener('wallet-error', onWalletError as any);
    return () => window.removeEventListener('wallet-error', onWalletError as any);
  }, []);

  const statusText = (() => {
    if (wsState.phase === 'authenticating') return 'Authenticating…';
    if (wsState.phase === 'lobby') return 'Lobby';
    if (wsState.phase === 'game') return 'In Game';
    if (wsState.phase === 'ended') return 'Ended';
    if (wsState.phase === 'connecting') return 'Connecting…';
    return publicKey ? 'Connected' : 'Not Connected';
  })();

  useEffect(() => {
    const fetchSol = async () => {
      try {
        const r = await fetch(`${API_BASE}/sol-price`);
        const j = await r.json();
        setSolPrice(Number(j.usd) || null);
      } catch { }
    };
    fetchSol();
    const id = setInterval(fetchSol, 30000);
    return () => clearInterval(id);
  }, []);

  const onPractice = () => setScreen('practice');
  const onTournament = () => setScreen('modes');
  const onWallet = () => setScreen('wallet');
  const openLeaderboard = () => setShowLeaderboard(true);
  const openHowTo = () => setShowHowTo(true);

  useEffect(() => {
    if (wsState.phase === 'lobby') setScreen('lobby');
    else if (wsState.phase === 'game') setScreen('game');
  }, [wsState.phase]);

  // PC Keyboard shortcuts
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      // ESC to go back
      if (e.key === 'Escape') {
        if (screen === 'modes') setScreen('landing');
        else if (screen === 'practice') setScreen('landing');
        else if (screen === 'practice-solo') setScreen('practice' as any);
        else if (screen === 'wallet') setScreen('modes');
      }
      // P for practice
      if (e.key === 'p' && screen === 'landing') {
        onPractice();
      }
      // T for tournament
      if (e.key === 't' && screen === 'landing') {
        onTournament();
      }
    };
    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [screen]);

  return (
    <div id="app-root" className="pc-optimized">
      {/* PC top bar: brand + nav + wallet - hide during gameplay */}
      {screen !== 'game' && screen !== 'practice' && screen !== 'practice-solo' && (
        <HeaderWallet
          screen={screen}
          status={statusText}
          solPrice={solPrice}
          onPractice={onPractice}
          onTournament={onTournament}
          onLeaderboard={openLeaderboard}
          onShowHowTo={openHowTo}
        />
      )}
      <div id="bg-particles" />



      {/* UNIFIED OVERLAY SYSTEM - Only ONE overlay shows at a time, priority: Error > Payment > Auth > Connecting */}
      {wsState.lastError ? (
        <div className="loading-overlay" style={{ display: 'flex', background: 'rgba(0,0,0,0.92)', backdropFilter: 'blur(8px)', zIndex: 10000 }}>
          <div className="modal-card pc-modal" style={{
            padding: '28px 24px',
            maxWidth: '440px',
            background: 'linear-gradient(135deg, rgba(239,68,68,0.12) 0%, rgba(251,146,60,0.12) 100%)',
            border: '2px solid rgba(239,68,68,0.3)',
            boxShadow: '0 20px 60px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.1)'
          }}>
            <div style={{ textAlign: 'center', marginBottom: '16px' }}>
              <div className="modal-title" style={{ fontSize: '26px', fontWeight: 800 }}>
                {wsState.lastError.toLowerCase().includes('insufficient') ? 'Insufficient Funds' : 'Something Went Wrong'}
              </div>
            </div>

            <div style={{
              background: 'rgba(0,0,0,0.3)',
              padding: '14px 16px',
              borderRadius: '12px',
              marginBottom: '16px',
              border: '1px solid rgba(255,255,255,0.1)'
            }}>
              <div className="modal-subtitle" style={{ fontSize: '14px', lineHeight: '1.5', color: 'rgba(255,255,255,0.9)' }}>
                {wsState.lastError}
              </div>
            </div>

            {wsState.lastError.toLowerCase().includes('insufficient') && (
              <div style={{
                fontSize: '14px',
                color: 'rgba(255,255,255,0.7)',
                textAlign: 'center',
                marginBottom: '16px',
                lineHeight: '1.5'
              }}>
                {publicKey
                  ? 'Top up your wallet with SOL to continue racing'
                  : 'Connect a wallet or buy SOL to get started'}
              </div>
            )}

            <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
              {wsState.lastError.toLowerCase().includes('insufficient') ? (
                <>
                  <button
                    className="btn-primary"
                    style={{
                      flex: '1',
                      minWidth: '150px',
                      padding: '14px 24px',
                      fontSize: '16px',
                      fontWeight: 700,
                      background: 'linear-gradient(90deg, #22d3ee 0%, #6366f1 100%)',
                      boxShadow: '0 8px 20px rgba(34,211,238,0.3)',
                      transition: 'all 0.2s ease'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.transform = 'translateY(-2px)';
                      e.currentTarget.style.boxShadow = '0 12px 28px rgba(34,211,238,0.4)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.transform = 'translateY(0)';
                      e.currentTarget.style.boxShadow = '0 8px 20px rgba(34,211,238,0.3)';
                    }}
                    onClick={() => {
                      if (publicKey && (window as any).phantom?.solana?.isPhantom) {
                        window.open('https://phantom.app/buy', '_blank');
                      } else if (publicKey) {
                        window.open('https://www.coinbase.com/buy-solana', '_blank');
                      } else {
                        window.open('https://www.moonpay.com/buy/sol', '_blank');
                      }
                    }}
                  >Buy SOL</button>
                  <button
                    className="btn-secondary"
                    style={{
                      flex: '0.7',
                      minWidth: '110px',
                      padding: '14px 20px',
                      fontSize: '16px',
                      fontWeight: 600
                    }}
                    onClick={() => location.reload()}
                  >Reload</button>
                </>
              ) : (
                <button
                  className="btn-primary"
                  style={{
                    width: '100%',
                    padding: '14px 24px',
                    fontSize: '16px',
                    fontWeight: 700
                  }}
                  onClick={() => location.reload()}
                >Reload App</button>
              )}
            </div>
          </div>
        </div>
      ) : (wsState.phase === 'connecting' || wsState.phase === 'authenticating' || wsState.entryFee.pending) ? (
        <div className="loading-overlay" style={{ display: 'flex', zIndex: 9999 }}>
          <div className="loading-spinner"></div>
          <div className="loading-text">{
            wsState.entryFee.pending ? 'Verifying entry fee transaction on Solana…'
              : wsState.phase === 'authenticating' ? 'Approve signature in your wallet to continue…'
                : 'Opening WebSocket connection…'
          }</div>
          <div style={{ fontSize: '13px', color: 'rgba(255,255,255,0.5)', marginTop: '8px', maxWidth: '340px', textAlign: 'center' }}>
            {wsState.entryFee.pending
              ? 'Waiting for transaction confirmation (finalized commitment)'
              : wsState.phase === 'authenticating'
                ? 'Check your wallet extension for the signature request'
                : 'Establishing secure connection to game server'
            }
          </div>
          {/* Smooth loading bar */}
          <div style={{ width: 320, height: 10, borderRadius: 6, overflow: 'hidden', marginTop: 10, border: '1px solid rgba(255,255,255,0.15)', background: 'rgba(255,255,255,0.08)' }}>
            <div style={{ width: `${loadProg}%`, height: '100%', background: 'linear-gradient(90deg, #22d3ee, #14b8a6)', transition: 'width 100ms linear' }}></div>
          </div>
          {/* Only show auth buttons when ACTUALLY in auth phase (not during payment) */}
          {wsState.phase === 'authenticating' && !wsState.entryFee.pending && (
            <div style={{ marginTop: 16, display: 'flex', gap: 8 }}>
              <button className="btn-primary" onClick={() => signAuthentication?.()}>Request signature again</button>
              <button className="btn-secondary" onClick={() => { leave?.(); setScreen('landing'); }}>Cancel</button>
            </div>
          )}
        </div>
      ) : null}

      {screen === 'landing' && (
        <Landing
          solPrice={solPrice}
          onPractice={onPractice}
          onTournament={onTournament}
          onWallet={onWallet}
          onLeaderboard={openLeaderboard}
        />
      )}
      {screen === 'practice' && (
        <PracticeModeSelection
          onSelectSolo={() => setScreen('practice-solo' as any)}
          onBack={() => setScreen('landing')}
          onNotify={showToast}
        />
      )}
      {screen === 'practice-solo' && (
        <Practice onFinish={() => setScreen('results')} onBack={() => setScreen('practice' as any)} />
      )}
      {screen === 'modes' && (
        <TournamentModesScreen onSelect={() => setScreen('wallet')} onClose={() => setScreen('landing')} onNotify={showToast} solPrice={solPrice} />
      )}
      {screen === 'wallet' && (
        <Wallet onConnected={() => setScreen('lobby')} onClose={() => setScreen('modes')} />
      )}
      {screen === 'lobby' && (
        <Lobby
          onStart={() => setScreen('game')}
          onBack={() => setScreen(wsState.lobby?.entryFee === 0 ? 'landing' : 'modes')}
        />
      )}
      {screen === 'game' && (
        <Game onEnd={() => setScreen('results')} onRestart={() => setScreen('game')} />
      )}
      {screen === 'results' && (
        <Results onPlayAgain={() => setScreen('practice')} onChangeTier={() => setScreen('modes')} />
      )}



      {/* Toast - appears ABOVE overlays for visibility */}
      {toast && (
        <div className="pc-toast" style={{ zIndex: 10001 }}>
          {toast}
        </div>
      )}

      {showHowTo && (
        <HowToPlayOverlay
          mode="pc"
          onClose={() => {
            setShowHowTo(false);
            try {
              localStorage.setItem('sr_howto_seen_v2', '1');
            } catch { }
          }}
        />
      )}

      {showLeaderboard && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 11000 }}>
          <Leaderboard
            onClose={() => setShowLeaderboard(false)}
            apiBase={API_BASE}
            myWallet={publicKey || null}
            isMobile={false}
          />
        </div>
      )}
    </div>
  );
}

function HeaderWallet({
  screen,
  status,
  solPrice,
  onPractice,
  onTournament,
  onLeaderboard,
  onShowHowTo,
}: {
  screen: string;
  status: string;
  solPrice: number | null;
  onPractice: () => void;
  onTournament: () => void;
  onLeaderboard?: () => void;
  onShowHowTo?: () => void;
}) {
  const { publicKey, disconnect, connect } = useWallet() as any;
  const short = publicKey ? `${publicKey.slice(0, 4)}…${publicKey.slice(-4)}` : null;
  const isLanding = screen === 'landing';
  const showStatusPill = status && status !== 'Not Connected' && status !== 'Connected';

  return (
    <header style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      height: 50,
      zIndex: 60,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '0 20px',
      background: 'rgba(0,0,0,0.85)',
      borderBottom: '1px solid rgba(0,245,255,0.2)',
    }}>
      {/* Left: Logo */}
      <button
        type="button"
        onClick={() => { if (screen !== 'landing') window.location.href = '/'; }}
        style={{
          display: 'flex',
          alignItems: 'baseline',
          gap: 6,
          background: 'none',
          border: 'none',
          cursor: 'pointer',
        }}
      >
        <span style={{ fontSize: 16, fontWeight: 800, color: '#fff', letterSpacing: '0.1em' }}>SPERM</span>
        <span style={{ fontSize: 16, fontWeight: 800, color: '#00f5ff', letterSpacing: '0.1em' }}>RACE</span>
      </button>

      {/* Center: SOL Price */}
      <div style={{
        position: 'absolute',
        left: '50%',
        transform: 'translateX(-50%)',
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: '6px 16px',
        background: 'rgba(0,245,255,0.1)',
        border: '1px solid rgba(0,245,255,0.3)',
        borderRadius: 4,
      }}>
        <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)' }}>SOL</span>
        <span style={{ fontSize: 16, fontWeight: 700, color: '#00f5ff' }}>
          ${solPrice?.toFixed(2) ?? '--'}
        </span>
      </div>

      {/* Right: Nav + Wallet */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        {isLanding && (
          <>
            <button
              onClick={onTournament}
              style={{
                padding: '6px 12px',
                background: 'none',
                border: '1px solid rgba(255,255,255,0.2)',
                borderRadius: 4,
                color: 'rgba(255,255,255,0.8)',
                fontSize: 11,
                fontWeight: 600,
                letterSpacing: '0.1em',
                cursor: 'pointer',
              }}
            >
              PLAY
            </button>
            {onLeaderboard && (
              <button
                onClick={onLeaderboard}
                style={{
                  padding: '6px 12px',
                  background: 'none',
                  border: '1px solid rgba(255,255,255,0.2)',
                  borderRadius: 4,
                  color: 'rgba(255,255,255,0.8)',
                  fontSize: 11,
                  fontWeight: 600,
                  letterSpacing: '0.1em',
                  cursor: 'pointer',
                }}
              >
                RANKS
              </button>
            )}
          </>
        )}
        {showStatusPill && (
          <span style={{
            padding: '4px 10px',
            background: 'rgba(0,245,255,0.15)',
            borderRadius: 4,
            fontSize: 11,
            color: '#00f5ff',
          }}>{status}</span>
        )}
        {short ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 12, color: '#00f5ff', fontFamily: 'monospace' }}>{short}</span>
            <button
              onClick={() => disconnect?.()}
              style={{
                padding: '6px 12px',
                background: 'rgba(255,100,100,0.2)',
                border: '1px solid rgba(255,100,100,0.4)',
                borderRadius: 4,
                color: '#ff6b6b',
                fontSize: 11,
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              EXIT
            </button>
          </div>
        ) : (
          <button
            onClick={() => connect?.()}
            style={{
              padding: '6px 14px',
              background: 'linear-gradient(135deg, #00f5ff, #00ff88)',
              border: 'none',
              borderRadius: 4,
              color: '#000',
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: '0.1em',
              cursor: 'pointer',
            }}
          >
            CONNECT
          </button>
        )}
      </div>
    </header>
  );
}

interface LandingProps {
  solPrice: number | null;
  onPractice: () => void;
  onTournament?: () => void;
  onWallet: () => void;
  onLeaderboard?: () => void;
}

function Landing({
  solPrice,
  onPractice,
  onTournament,
  onWallet,
  onLeaderboard,
}: LandingProps) {

  const getPlayerStats = () => {
    try {
      const stored = localStorage.getItem('spermrace_stats');
      if (stored) {
        return JSON.parse(stored) as { totalGames?: number; wins?: number; totalKills?: number };
      }
    } catch { }
    return { totalGames: 0, wins: 0, totalKills: 0 };
  };

  const stats = getPlayerStats();
  const totalGames = stats.totalGames || 0;
  const totalKills = stats.totalKills || 0;
  const winRate = totalGames > 0 ? ((stats.wins || 0) / totalGames * 100).toFixed(1) : '0.0';

  return (
    <div className="screen active pc-landing" id="landing-screen">
      <div
        className="landing-container"
        style={{
          maxWidth: 1200,
          margin: '0 auto',
          minHeight: '100vh',
          padding: '140px 40px 64px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 48,
        }}
      >
        <header style={{ textAlign: 'center' }}>
          <div style={{ marginBottom: 20 }}>
            <Atom
              size={72}
              weight="duotone"
              color="#00f5ff"
              style={{
                filter: 'drop-shadow(0 0 16px rgba(0, 245, 255, 0.7))',
              }}
            />
          </div>
          <div
            style={{
              fontFamily: 'Orbitron, system-ui, -apple-system, BlinkMacSystemFont, sans-serif',
              letterSpacing: '0.35em',
              fontSize: 13,
              textTransform: 'uppercase',
              color: '#00f5ff',
              marginBottom: 24,
              textShadow: '0 0 15px rgba(0, 245, 255, 0.6)',
            }}
          >
            BATTLE ROYALE STARTS AT BIRTH
          </div>
          <h1
            style={{
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'baseline',
              gap: 24,
              fontSize: 96,
              lineHeight: 1,
              marginBottom: 28,
              textShadow: '0 0 40px rgba(0, 245, 255, 0.4), 0 0 80px rgba(0, 245, 255, 0.2)',
            }}
          >
            <span style={{ color: '#fff', fontWeight: 800 }}>SPERM</span>
            <span
              style={{
                fontWeight: 800,
                background: 'linear-gradient(135deg, #00f5ff, #00ff88)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                filter: 'drop-shadow(0 0 12px rgba(0, 245, 255, 0.7))',
              }}
            >
              RACE
            </span>
          </h1>
          <p
            style={{
              fontSize: 15,
              letterSpacing: '0.18em',
              textTransform: 'uppercase',
              color: 'rgba(255,255,255,0.7)',
            }}
          >
            SURVIVE. ELIMINATE. WIN CRYPTO.
          </p>
        </header>

        <main>
          {/* Hero CTAs */}
          <section
            style={{
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center', // Changed from stretch to center
              gap: 24, // Increased gap slightly for separation
              flexWrap: 'wrap',
              width: '100%',
              maxWidth: 800, // Constrain width so they don't spread too far
            }}
          >
            <button
              type="button"
              className="cta-primary"
              style={{
                minWidth: 280,
                position: 'relative',
                fontSize: 14,
                padding: '16px 36px',
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                textAlign: 'center'
              }}
              onClick={() => onTournament?.()}
            >
              <span className="cta-text">Enter Tournament</span>
              <div className="cta-glow" />
            </button>

            <button
              type="button"
              className="cta-primary"
              style={{
                minWidth: 280,
                position: 'relative',
                fontSize: 14,
                padding: '16px 36px',
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                textAlign: 'center'
              }}
              onClick={onPractice}
            >
              <span className="cta-text">Practice Mode (Free)</span>
              <div className="cta-glow" />
            </button>
          </section>

          <div
            style={{
              marginTop: 12,
              fontSize: 12,
              textAlign: 'center',
              color: 'rgba(148,163,184,0.7)',
            }}
          >
            Tournament entry from $1 • Instant crypto payouts
          </div>

          {totalGames > 0 && (
            <section style={{ marginTop: 32 }}>
              <div className="pc-stats-grid">
                <div className="pc-stat-card">
                  <div className="stat-label">Games</div>
                  <div className="stat-value">{totalGames}</div>
                </div>
                <div className="pc-stat-card highlight">
                  <div className="stat-label">Win%</div>
                  <div className="stat-value">{winRate}%</div>
                </div>
                <div className="pc-stat-card">
                  <div className="stat-label">Kills</div>
                  <div className="stat-value">{totalKills}</div>
                </div>
              </div>
            </section>
          )}
        </main>
      </div>

    </div>
  );
}

function Practice({ onFinish: _onFinish, onBack }: { onFinish: () => void; onBack: () => void }) {
  const [step, setStep] = useState<'lobby' | 'game'>(() => {
    try {
      return localStorage.getItem('sr_practice_full_tuto_seen') ? 'game' : 'lobby';
    } catch {
      return 'lobby';
    }
  });
  const [meId] = useState<string>('PLAYER_' + Math.random().toString(36).slice(2, 8));
  const [players, setPlayers] = useState<string[]>([]);
  const [countdown, setCountdown] = useState<number>(5);
  const countdownTotal = 5;

  const [showPracticeIntro, setShowPracticeIntro] = useState<boolean>(() => {
    try {
      return !localStorage.getItem('sr_practice_full_tuto_seen');
    } catch {
      return true;
    }
  });

  useEffect(() => {
    if (step === 'lobby') {
      const base = [meId];
      const bots = Array.from({ length: 7 }, (_, i) => `BOT_${i.toString(36)}${Math.random().toString(36).slice(2, 4)}`);
      setPlayers([...base, ...bots]);
      setCountdown(countdownTotal);
      if (showPracticeIntro) return;
      let currentCountdown = countdownTotal;

      const t = setInterval(() => {
        currentCountdown -= 1;
        setCountdown(currentCountdown);

        if (currentCountdown <= 0) {
          clearInterval(t);
          setStep('game');
        }
      }, 1000);

      return () => clearInterval(t);
    }
  }, [step, meId, showPracticeIntro]);

  if (step === 'lobby') {
    const maxPlayers = 8;
    const progressPct = Math.max(0, Math.min(100, Math.floor(((countdownTotal - countdown) / countdownTotal) * 100)));
    return (
      <div className="screen active pc-lobby" id="lobby-screen">
        <div className="lobby-container pc-lobby-container">
          <div className="lobby-header">
            <div className="lobby-title">Practice Lobby</div>
            <div className="lobby-status">{players.length}/{maxPlayers}</div>
          </div>
          <div className="queue-bar pc-queue">
            <div className="queue-left"><span className="queue-dot" /><span>{players.length} Players</span></div>
            <div className="queue-center"><span>Ready</span></div>
            <div className="queue-right"><span>Starting in {countdown}s</span></div>
          </div>
          <div className="lobby-orbit">
            <div className="orbit-center" />
            <div className="orbit-ring">
              {players.map((p: string, i: number) => (
                <div key={p} className="orbit-sperm" style={{ '--i': i, '--n': players.length } as any} />
              ))}
            </div>
            <div className="countdown-halo">
              <div className="halo-ring" />
              <div className="halo-timer">{countdown}s</div>
            </div>
          </div>
          <div style={{ display: 'flex', justifyContent: 'center', marginTop: 20 }}>
            <div className="pc-progress-bar">
              <div className="pc-progress-fill" style={{ width: `${progressPct}%` }}></div>
            </div>
          </div>
          <div className="lobby-footer">
            <button className="btn-secondary pc-btn" onClick={onBack}>← Back to Menu</button>
          </div>
        </div>
        <PracticeFullTutorial
          visible={showPracticeIntro}
          onDone={() => {
            setShowPracticeIntro(false);
            try {
              localStorage.setItem('sr_practice_full_tuto_seen', '1');
            } catch { }
            // After the first tutorial, jump straight into the game and skip lobby on PC
            setStep('game');
          }}
        />
      </div>
    );
  }

  if (step === 'game') {
    return (
      <div className="screen active" style={{ padding: 0 }}>
        <NewGameView
          meIdOverride={meId || 'YOU'}
          onReplay={() => setStep('lobby')}
          onExit={onBack}
        />
      </div>
    );
  }

  return null;
}

function TournamentModesScreen({ onSelect: _onSelect, onClose, onNotify, solPrice }: { onSelect: () => void; onClose: () => void; onNotify: (msg: string, duration?: number) => void; solPrice: number | null }) {
  const { publicKey, connect } = useWallet();
  const { connectAndJoin, state: wsState } = useWs();
  const [isJoining, setIsJoining] = useState<boolean>(false);
  const [preflight, setPreflight] = useState<{ address: string | null; sol: number | null; configured: boolean } | null>(null);
  const [preflightError, setPreflightError] = useState<boolean>(false);
  const [selectedIndex, setSelectedIndex] = useState(0);

  useEffect(() => {
    (async () => {
      try {
        const r = await fetch(`${API_BASE}/prize-preflight`);
        if (!r.ok) throw new Error(`preflight ${r.status}`);
        const j = await r.json();
        setPreflight(j);
        setPreflightError(!j?.configured || !j?.address || j?.sol == null);
      } catch {
        setPreflightError(true);
      }
    })();
  }, []);

  useEffect(() => {
    if (wsState.phase === 'lobby' || wsState.phase === 'game') setIsJoining(false);
  }, [wsState.phase]);

  const tiers = [
    { name: 'MICRO', usd: 1, max: 16, prize: 10, popular: true, desc: 'Perfect for beginners' },
    { name: 'NANO', usd: 5, max: 32, prize: 50, popular: false, desc: 'Most competitive' },
    { name: 'MEGA', usd: 25, max: 32, prize: 250, popular: false, desc: 'High stakes action' },
    { name: 'ELITE', usd: 100, max: 16, prize: 1000, popular: false, desc: 'Ultimate challenge' },
  ];

  const selected = tiers[selectedIndex];
  const isDisabled = isJoining || wsState.phase === 'connecting' || wsState.phase === 'authenticating' || preflightError;

  const handleJoin = async () => {
    if (isDisabled) return;
    setIsJoining(true);
    if (!publicKey && !(await connect())) {
      setIsJoining(false);
      onNotify('Connect wallet to enter tournament');
      return;
    }
    await connectAndJoin({ entryFeeTier: selected.usd as any, mode: 'tournament' });
  };

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      background: 'linear-gradient(180deg, #030712 0%, #0a1628 100%)',
      overflowY: 'auto',
      padding: '120px 40px 40px',
    }}>
      <div style={{ maxWidth: 1000, width: '100%', margin: '0 auto' }}>
        {/* Hero Header */}
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{
            fontSize: 12,
            letterSpacing: '0.3em',
            color: 'rgba(255,255,255,0.5)',
            marginBottom: 8,
            textTransform: 'uppercase',
          }}>
            Choose Your Battle
          </div>
          <h1 style={{
            fontSize: 48,
            fontWeight: 900,
            color: '#fff',
            margin: 0,
            marginBottom: 10,
            textShadow: '0 0 40px rgba(0,245,255,0.3)',
          }}>
            TOURNAMENT
          </h1>
          <p style={{
            fontSize: 18,
            color: 'rgba(0,245,255,0.9)',
            margin: 0,
            fontWeight: 700,
            letterSpacing: '0.02em',
          }}>
            Win Real Cryptocurrency in Minutes ⚡
          </p>
        </div>

        {/* Tier Cards Grid */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          gap: 16,
          marginBottom: 20
        }}>
          {tiers.map((tier, i) => {
            const isActive = i === selectedIndex;
            const roi = ((tier.prize / tier.usd - 1) * 100).toFixed(0);

            return (
              <button
                key={tier.name}
                onClick={() => setSelectedIndex(i)}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: '22px 16px',
                  borderRadius: 20,
                  border: isActive ? '2px solid #00f5ff' : '1px solid rgba(255,255,255,0.1)',
                  background: isActive
                    ? 'linear-gradient(135deg, rgba(0,245,255,0.2) 0%, rgba(0,200,255,0.08) 100%)'
                    : 'rgba(255,255,255,0.03)',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                  boxShadow: isActive ? '0 0 50px rgba(0,245,255,0.4), inset 0 1px 0 rgba(255,255,255,0.15)' : 'none',
                  opacity: preflightError ? 0.5 : 1,
                  position: 'relative',
                }}
              >
                {/* Popular Badge */}
                {tier.popular && (
                  <div style={{
                    position: 'absolute',
                    top: -8,
                    right: -8,
                    background: 'linear-gradient(135deg, #ff6b00, #ff8c00)',
                    color: '#fff',
                    fontSize: 9,
                    fontWeight: 900,
                    padding: '4px 12px',
                    borderRadius: 14,
                    textTransform: 'uppercase',
                    letterSpacing: '0.1em',
                    boxShadow: '0 3px 12px rgba(255,107,0,0.5)',
                  }}>
                    🔥 HOT
                  </div>
                )}

                {/* Entry Fee */}
                <div style={{
                  padding: '6px 18px',
                  borderRadius: 20,
                  background: isActive
                    ? 'linear-gradient(135deg, #00f5ff, #00ff88)'
                    : 'rgba(255,255,255,0.1)',
                  fontSize: 20,
                  fontWeight: 900,
                  color: isActive ? '#000' : '#fff',
                  marginBottom: 12,
                }}>
                  ${tier.usd}
                </div>

                {/* Tier Name */}
                <div style={{
                  fontSize: 16,
                  fontWeight: 700,
                  color: isActive ? '#00f5ff' : 'rgba(255,255,255,0.7)',
                  marginBottom: 12,
                  letterSpacing: '0.08em'
                }}>
                  {tier.name}
                </div>

                {/* Prize - Huge */}
                <div style={{
                  fontSize: 40,
                  fontWeight: 900,
                  color: isActive ? '#00ff88' : 'rgba(255,255,255,0.6)',
                  textShadow: isActive ? '0 0 35px rgba(0,255,136,0.7)' : 'none',
                  lineHeight: 1,
                  marginBottom: 8,
                }}>
                  ${tier.prize}
                </div>

                {/* ROI Badge */}
                <div style={{
                  fontSize: 11,
                  color: isActive ? '#00ff88' : 'rgba(255,255,255,0.4)',
                  letterSpacing: '0.1em',
                  fontWeight: 800,
                  marginBottom: 10,
                  textTransform: 'uppercase',
                }}>
                  {roi}% ROI
                </div>

                {/* Description */}
                <div style={{
                  fontSize: 12,
                  color: 'rgba(255,255,255,0.5)',
                  textAlign: 'center',
                }}>
                  {tier.desc}
                </div>
              </button>
            );
          })}
        </div>

        {/* Feature Highlights Row */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          gap: 12,
          marginBottom: 20,
        }}>
          {[
            { icon: '⚡', title: 'Instant Payouts', desc: 'Win SOL immediately' },
            { icon: '🏆', title: 'Winner Takes All', desc: '85% to #1 place' },
            { icon: '🔒', title: 'Provably Fair', desc: 'Blockchain verified' },
            { icon: '⏱️', title: 'Fast Rounds', desc: '3-5 minute matches' },
          ].map((feature, i) => (
            <div key={i} style={{
              background: 'rgba(255,255,255,0.03)',
              border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: 14,
              padding: '14px',
              textAlign: 'center',
            }}>
              <div style={{ fontSize: 24, marginBottom: 8 }}>{feature.icon}</div>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#fff', marginBottom: 4 }}>{feature.title}</div>
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)' }}>{feature.desc}</div>
            </div>
          ))}
        </div>

        {/* Selected Panel with Social Proof */}
        <div style={{
          background: 'linear-gradient(135deg, rgba(0,245,255,0.15) 0%, rgba(0,255,136,0.12) 100%)',
          borderRadius: 20,
          padding: '24px',
          marginBottom: 20,
          border: '1px solid rgba(0,245,255,0.3)',
          textAlign: 'center',
          boxShadow: '0 8px 32px rgba(0,245,255,0.2)',
        }}>
          <div style={{
            fontSize: 13,
            color: 'rgba(255,255,255,0.6)',
            letterSpacing: '0.2em',
            marginBottom: 10,
            textTransform: 'uppercase',
          }}>
            Turn ${selected.usd} into
          </div>
          <div style={{
            fontSize: 64,
            fontWeight: 900,
            color: '#00ff88',
            textShadow: '0 0 50px rgba(0,255,136,0.7)',
            lineHeight: 1,
            marginBottom: 12,
          }}>
            ${selected.prize}
          </div>
          <div style={{
            fontSize: 16,
            color: '#00f5ff',
            fontWeight: 700,
            letterSpacing: '0.05em',
            marginBottom: 16,
          }}>
            Winner Takes 85% • Instant Crypto Payout
          </div>
          <div style={{
            fontSize: 13,
            color: 'rgba(255,255,255,0.6)',
            fontWeight: 600,
          }}>
            🎯 Join {selected.max} players racing for the prize pool
          </div>
        </div>

        {/* Action Buttons */}
        <div style={{ display: 'flex', gap: 16 }}>
          <button
            onClick={onClose}
            style={{
              flex: '0 0 140px',
              padding: '20px 24px',
              borderRadius: 14,
              border: '1px solid rgba(255,255,255,0.15)',
              background: 'transparent',
              color: 'rgba(255,255,255,0.6)',
              fontSize: 16,
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'all 0.2s ease',
            }}
          >
            ← BACK
          </button>
          <button
            onClick={handleJoin}
            disabled={isDisabled}
            style={{
              flex: 1,
              padding: '20px',
              borderRadius: 14,
              border: 'none',
              background: isDisabled
                ? 'rgba(255,255,255,0.1)'
                : 'linear-gradient(135deg, #00f5ff 0%, #00ff88 100%)',
              color: isDisabled ? 'rgba(255,255,255,0.4)' : '#000',
              fontSize: 20,
              fontWeight: 900,
              letterSpacing: '0.05em',
              cursor: isDisabled ? 'not-allowed' : 'pointer',
              boxShadow: isDisabled ? 'none' : '0 0 60px rgba(0,245,255,0.6), 0 6px 30px rgba(0,0,0,0.3)',
              transition: 'all 0.2s ease',
              textTransform: 'uppercase',
            }}
          >
            {isJoining ? '⏳ JOINING TOURNAMENT...' : preflightError ? '❌ UNAVAILABLE' : '🚀 JOIN TOURNAMENT NOW'}
          </button>
        </div>

        {preflightError && (
          <div style={{
            textAlign: 'center',
            marginTop: 16,
            fontSize: 14,
            color: 'rgba(255,100,100,0.9)',
            fontWeight: 700,
          }}>
            ⚠️ Tournaments temporarily unavailable
          </div>
        )}

      </div>

      {/* SOL Price - Fixed badge */}

    </div>
  );
}

function Wallet({ onConnected, onClose }: { onConnected: () => void; onClose: () => void }) {
  const { connect, publicKey } = useWallet();
  const tryConnect = async () => {
    if (await connect()) onConnected();
  };

  return (
    <div className="screen active pc-wallet" id="wallet-screen">
      <div className="pc-wallet-container">
        <div className="modal-header">
          <h2 className="modal-title">Connect Wallet</h2>
          <p className="modal-subtitle">Sign in with Solana to continue</p>
        </div>

        <div className="pc-wallet-options">
          <button className="pc-wallet-btn" onClick={tryConnect}>
            <div className="wallet-icon">
              <CrownSimple size={18} weight="fill" />
            </div>
            <div className="wallet-text">
              <div className="wallet-title">Connect Wallet</div>
              <div className="wallet-subtitle">Phantom / Solflare / Coinbase • build wallet-refactor</div>
            </div>
          </button>
          {publicKey && (
            <div className="pc-connected-badge">
              Connected: {publicKey.slice(0, 6)}…{publicKey.slice(-6)}
            </div>
          )}
        </div>

        <button className="btn-secondary pc-btn" onClick={onClose}>← Back</button>
      </div>
    </div>
  );
}

function Lobby({ onStart: _onStart, onBack }: { onStart: () => void; onBack: () => void }) {
  const { state } = useWs();
  const players = state.lobby?.players || [];
  const realPlayers = players.filter(p => !String(p).startsWith('BOT_'));
  const estimatedPrizeUsd = state.lobby ? Math.max(0, Math.floor(realPlayers.length * (state.lobby.entryFee as number) * 0.85)) : 0;

  return (
    <div className="screen active pc-lobby" id="lobby-screen" style={{ 
      background: "#030712",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      minHeight: "100vh"
    }}>
      <div className="lobby-container pc-lobby-container" style={{
        maxWidth: "600px",
        width: "100%",
        background: "rgba(10, 20, 35, 0.6)",
        backdropFilter: "blur(20px)",
        border: "1px solid rgba(0, 245, 255, 0.2)",
        borderRadius: "24px",
        padding: "40px",
        textAlign: "center"
      }}>
        <div style={{ marginBottom: 20 }}>
          <Atom size={48} weight="duotone" color="#00f5ff" />
        </div>
        <h1 style={{ fontSize: "32px", fontWeight: 900, color: "#fff", marginBottom: "32px", fontFamily: "Orbitron, sans-serif" }}>LOBBY</h1>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "20px", marginBottom: "24px" }}>
          <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "16px", padding: "16px" }}>
            <div style={{ fontSize: "11px", color: "rgba(255,255,255,0.4)", textTransform: "uppercase" }}>Pilots</div>
            <div style={{ fontSize: "24px", fontWeight: 900, color: "#00f5ff" }}>{players.length} / {state.lobby?.maxPlayers ?? 32}</div>
          </div>
          <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "16px", padding: "16px" }}>
            <div style={{ fontSize: "11px", color: "rgba(255,255,255,0.4)", textTransform: "uppercase" }}>Prize</div>
            <div style={{ fontSize: "24px", fontWeight: 900, color: "#00ff88" }}>${estimatedPrizeUsd}</div>
          </div>
        </div>

        <div style={{
          display: "flex",
          flexWrap: "wrap",
          gap: "8px",
          justifyContent: "center",
          marginBottom: "32px",
          padding: "12px",
          background: "rgba(0,0,0,0.2)",
          borderRadius: "12px"
        }}>
          {players.map((pid: string) => {
            const name = state.lobby?.playerNames?.[pid] || (pid.startsWith("guest-") ? "Guest" : pid.slice(0, 4) + "…" + pid.slice(-4));
            const isMe = pid === state.playerId;
            return (
              <div key={pid} style={{
                fontSize: "12px",
                padding: "4px 12px",
                borderRadius: "6px",
                background: isMe ? "rgba(0, 245, 255, 0.15)" : "rgba(255, 255, 255, 0.05)",
                border: isMe ? "1px solid rgba(0, 245, 255, 0.3)" : "1px solid rgba(255, 255, 255, 0.1)",
                color: isMe ? "#00f5ff" : "rgba(255, 255, 255, 0.7)",
                fontWeight: 800
              }}>
                {name}
              </div>
            );
          })}
        </div>

        <div style={{ minHeight: "120px", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
          {state.countdown ? (
            <div>
              <div style={{ fontSize: "14px", fontWeight: 800, color: "#00f5ff", letterSpacing: "0.3em" }}>STARTING IN</div>
              <div style={{ fontSize: "80px", fontWeight: 900, color: "#fff", lineHeight: 1 }}>
                {state.countdown.remaining}
              </div>
            </div>
          ) : (
            <div style={{ fontSize: "16px", color: "rgba(255,255,255,0.5)", fontWeight: 700 }}>
              WAITING FOR RIVALS...
            </div>
          )}
        </div>

        <button 
          className="btn-secondary pc-btn" 
          onClick={onBack}
          style={{
            marginTop: "40px",
            padding: "14px 40px",
            borderRadius: "12px",
            fontSize: "14px",
            fontWeight: 800,
            color: "rgba(255,255,255,0.4)",
            background: "rgba(255,255,255,0.03)",
            border: "1px solid rgba(255,255,255,0.1)",
            cursor: "pointer"
          }}
        >
          ← ABORT MISSION
        </button>
      </div>
    </div>
  );
}

function Game({ onEnd, onRestart }: { onEnd: () => void; onRestart: () => void }) {
  const { state } = useWs();
  const meId = state.playerId;
  const me = meId && state.game?.players ? (state.game.players as any[]).find(p => p.id === meId) : null;
  const cdMsRaw = me?.status?.boostCooldownMs ?? 0;
  const srvTs = (state.game as any)?.timestamp as number | undefined;
  const cdMs = Math.max(0, cdMsRaw - Math.max(0, Date.now() - (srvTs || Date.now())));
  const cdMax = me?.status?.boostMaxCooldownMs ?? 2500;
  const [boostPct, setBoostPct] = useState<number>(cdMax > 0 ? 1 - cdMs / cdMax : 1);
  const smoothRef = (function () {
    const r = (window as any).__SR_PC_BOOST_SMOOTH__ || { running: false, lastMs: cdMs, lastAt: performance.now(), raf: 0 };
    (window as any).__SR_PC_BOOST_SMOOTH__ = r;
    return r;
  })();
  useEffect(() => {
    // On new server value, reset baseline and (re)start RAF smoothing
    smoothRef.lastMs = cdMs;
    smoothRef.lastAt = performance.now();
    if (!smoothRef.running) {
      smoothRef.running = true;
      const tick = () => {
        const now = performance.now();
        const elapsed = now - smoothRef.lastAt;
        const pred = Math.max(0, smoothRef.lastMs - elapsed);
        const max = cdMax > 0 ? cdMax : 2500;
        const pct = 1 - pred / max; // 0..1 fill
        setBoostPct(Math.max(0, Math.min(1, pct)));
        // Stop when fully ready and no recent change
        if (pred <= 0 && cdMs === 0) {
          smoothRef.running = false;
          smoothRef.raf = 0;
          return;
        }
        smoothRef.raf = requestAnimationFrame(tick);
      };
      smoothRef.raf = requestAnimationFrame(tick);
      return () => { try { cancelAnimationFrame(smoothRef.raf); } catch { } smoothRef.running = false; };
    }
  }, [cdMs, cdMax]);
  // Simple pre-start tips countdown for early players (first few games)
  const [prestartCountdown, setPrestartCountdown] = useState<number>(() => {
    try {
      const stored = localStorage.getItem('spermrace_stats');
      if (!stored) return 5;
      const stats = JSON.parse(stored) as { totalGames?: number };
      return (stats.totalGames ?? 0) < 5 ? 5 : 0;
    } catch {
      return 5;
    }
  });
  const [tipIndex, setTipIndex] = useState(0);
  useEffect(() => {
    if (prestartCountdown <= 0) return;
    const id = window.setInterval(() => {
      setPrestartCountdown((v) => (v <= 1 ? 0 : v - 1));
    }, 1000);
    return () => window.clearInterval(id);
  }, [prestartCountdown]);
  useEffect(() => {
    if (prestartCountdown <= 0) return;
    const id = window.setInterval(() => {
      setTipIndex((i) => (i + 1) % 3);
    }, 2000);
    return () => window.clearInterval(id);
  }, [prestartCountdown]);
  const [debugOn, setDebugOn] = useState<boolean>(() => {
    try { const v = localStorage.getItem('sr_debug'); return v === '1'; } catch { return false; }
  });
  useEffect(() => { try { localStorage.setItem('sr_debug', debugOn ? '1' : '0'); } catch { } }, [debugOn]);
  const isProd = (import.meta as any).env?.PROD === true;

  return (
    <div className="screen active" style={{ padding: 0 }}>
      <NewGameView
        onReplay={onRestart}
        onExit={onEnd}
      />
      {prestartCountdown > 0 && (
        <div
          style={{
            position: 'fixed',
            top: 90,
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 30,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            pointerEvents: 'none',
          }}
        >
          <div
            style={{
              background: 'rgba(0,0,0,0.78)',
              borderRadius: 999,
              border: '1px solid rgba(148,163,184,0.6)',
              padding: '6px 14px',
              fontSize: 13,
              color: '#e5e7eb',
              whiteSpace: 'nowrap',
            }}
          >
            {tipIndex === 0 && 'Your trail kills on contact  even you after a short grace.'}
            {tipIndex === 1 && 'Stay inside the shrinking zone as the arena slices in.'}
            {tipIndex === 2 && 'Collect energy orbs to refill boost and chase kills.'}
          </div>
        </div>
      )}
      {/* Simple boost cooldown bar (server authoritative) */}
      <div style={{ position: 'fixed', bottom: 18, left: '50%', transform: 'translateX(-50%)', width: 220, height: 10, borderRadius: 8, border: '1px solid rgba(255,255,255,0.15)', background: 'rgba(255,255,255,0.08)', overflow: 'hidden', zIndex: 20 }}>
        <div style={{ height: '100%', width: `${Math.round(boostPct * 100)}%`, background: 'linear-gradient(90deg, #22d3ee, #14b8a6)', transition: 'width 60ms linear' }} />
      </div>
      {/* PC: Debug toggle */}
      {!isProd && (
        <div className="pc-debug-panel">
          <button onClick={() => setDebugOn(v => !v)} className="btn-secondary pc-debug-btn">
            Debug {debugOn ? 'ON' : 'OFF'}
          </button>
          {debugOn && (
            <div className="pc-debug-info">
              Collisions: {(state.debugCollisions || []).length}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function Results({ onPlayAgain, onChangeTier }: { onPlayAgain: () => void; onChangeTier: () => void }) {
  const { state: wsState, connectAndJoin } = useWs();
  const { publicKey } = useWallet();
  const tx = wsState.lastRound?.txSignature;
  const winner = wsState.lastRound?.winnerId;
  const prize = wsState.lastRound?.prizeAmount;
  const solscan = tx ? `https://solscan.io/tx/${tx}${SOLANA_CLUSTER === 'devnet' ? '?cluster=devnet' : ''}` : null;
  const selfId = wsState.playerId || publicKey || '';
  const isWinner = !!winner && winner === selfId;
  const [playAgainBusy, setPlayAgainBusy] = useState(false);

  const handlePlayAgain = async () => {
    if (playAgainBusy) return;
    // Only auto-requeue for real online matches; fallback for solo/offline flows.
    if (wsState.phase !== 'ended') { onPlayAgain(); return; }
    setPlayAgainBusy(true);
    try {
      let last: any = null;
      try { last = JSON.parse(localStorage.getItem('sr_last_join') || 'null'); } catch { }
      const lobby: any = wsState.lobby || null;
      const entryFeeTier = (lobby?.entryFee ?? last?.entryFeeTier ?? 0) as any;
      const mode = (lobby?.mode ?? last?.mode ?? (entryFeeTier === 0 ? 'practice' : 'tournament')) as any;
      const guestName =
        mode === 'practice'
          ? (last?.guestName || localStorage.getItem('sr_guest_name') || lobby?.playerNames?.[wsState.playerId || ''] || 'Guest')
          : undefined;
      await connectAndJoin({ entryFeeTier, mode, ...(guestName ? { guestName } : {}) });
    } catch {
      onPlayAgain();
    } finally {
      setPlayAgainBusy(false);
    }
  };

  let rankText: string | null = null;
  try {
    const initial = wsState.initialPlayers || [];
    const order = wsState.eliminationOrder || [];
    if (initial.length) {
      const uniqueOrder: string[] = [];
      for (const pid of order) { if (pid && !uniqueOrder.includes(pid)) uniqueOrder.push(pid); }
      const rankMap: Record<string, number> = {};
      if (winner) rankMap[winner] = 1;
      let r = 2;
      for (let i = uniqueOrder.length - 1; i >= 0; i--) {
        const pid = uniqueOrder[i];
        if (pid && !rankMap[pid]) { rankMap[pid] = r; r++; }
      }
      const myRank = rankMap[selfId];
      if (myRank) rankText = `Your rank: #${myRank}`;
    }
  } catch { }

  return (
    <div className="screen active pc-results" id="round-end">
      <div className="modal-card pc-results-card">
        <div className="modal-header">
          <h2 className={`round-result ${isWinner ? 'victory' : 'defeat'}`}>
            {isWinner ? 'Victory! Fertilization!' : 'Eliminated'}
          </h2>
          <p className="round-description">
            Winner: {winner ? `${winner.slice(0, 6)}…${winner.slice(-6)}` : '—'}
            {typeof prize === 'number' ? ` • Prize: ${prize.toFixed(4)} SOL` : ''}
          </p>
        </div>

        {solscan && (
          <div className="pc-solscan-link">
            <a href={solscan} target="_blank" rel="noreferrer">
              View payout on Solscan →
            </a>
          </div>
        )}

        {rankText && (
          <div className="pc-stats-summary">
            <div className="stat">{rankText}</div>
            <div className="stat">Kills: {wsState.kills?.[selfId] || 0}</div>
          </div>
        )}

        <div className="round-actions pc-actions">
          <button className="btn-primary pc-btn-large" onClick={handlePlayAgain} disabled={playAgainBusy}>
            {playAgainBusy ? 'Joining…' : 'Play Again'}
          </button>
          <button className="btn-secondary pc-btn" onClick={onChangeTier}>
            Main Menu
          </button>
        </div>
      </div>
    </div>
  );
}
