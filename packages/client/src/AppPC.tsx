import { useEffect, useState, lazy, Suspense } from 'react';
import { LoadingSpinner } from './components/LoadingSpinner';
import { AnimatedCounter } from './components/AnimatedCounter';

// Base URL for backend API.
// For any spermrace.io host (prod/dev/www), always hit same-origin /api so Vercel can proxy
// and we avoid CORS issues with api.spermrace.io.
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
// Solana cluster for links (e.g., Solscan): prefer env, else infer by hostname
const SOLANA_CLUSTER: 'devnet' | 'mainnet' = (() => {
  const env = (import.meta as any).env?.VITE_SOLANA_CLUSTER as string | undefined;
  if (env && /^(devnet|mainnet)$/i.test(env)) return env.toLowerCase() as any;
  try {
    const host = (window?.location?.hostname || '').toLowerCase();
    return host.includes('dev.spermrace.io') ? 'devnet' : 'mainnet';
  } catch {}
  return 'devnet';
})();
import { WalletProvider, useWallet } from './WalletProvider';
import { WsProvider, useWs } from './WsProvider';
import { CrownSimple, Lightning, Diamond, Atom } from 'phosphor-react';

// Lazy load heavy components for code splitting
const NewGameView = lazy(() => import('./NewGameView'));
const HowToPlayOverlay = lazy(() => import('./HowToPlayOverlay'));
const PracticeFullTutorial = lazy(() => import('./PracticeFullTutorial'));
const Leaderboard = lazy(() => import('./Leaderboard').then(module => ({ default: module.Leaderboard })));

type AppScreen = 'landing' | 'practice' | 'modes' | 'wallet' | 'lobby' | 'game' | 'results';

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
      } catch {}
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
      {/* PC top bar: brand + nav + wallet */}
      <HeaderWallet
        screen={screen}
        status={statusText}
        solPrice={solPrice}
        onPractice={onPractice}
        onTournament={onTournament}
        onLeaderboard={openLeaderboard}
        onShowHowTo={openHowTo}
      />
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
        <Suspense fallback={<div style={{ position: 'fixed', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.95)' }}><LoadingSpinner message="Loading Practice..." size="large" /></div>}>
          <Practice onFinish={() => setScreen('results')} onBack={() => setScreen('landing')} />
        </Suspense>
      )}
      {screen === 'modes' && (
        <TournamentModesScreen onSelect={() => setScreen('wallet')} onClose={() => setScreen('landing')} onNotify={showToast} solPrice={solPrice} />
      )}
      {screen === 'wallet' && (
        <Wallet onConnected={() => setScreen('lobby')} onClose={() => setScreen('modes')} />
      )}
      {screen === 'lobby' && (
        <Lobby onStart={() => setScreen('game')} onBack={() => setScreen('modes')} />
      )}
      {screen === 'game' && (
        <Suspense fallback={<div style={{ position: 'fixed', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.95)' }}><LoadingSpinner message="Loading Game..." size="large" /></div>}>
          <Game onEnd={() => setScreen('results')} onRestart={() => setScreen('game')} />
        </Suspense>
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
            } catch {}
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
              className="btn-secondary"
              onClick={onTournament}
            >
              Play
            </button>
            {onLeaderboard && (
              <button
                className="btn-secondary"
                onClick={onLeaderboard}
              >
                Ranks
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
    } catch {}
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
              alignItems: 'stretch',
              gap: 20,
              flexWrap: 'wrap',
            }}
          >
            {/* Primary: Tournament */}
            <button
              type="button"
              className="btn-primary pc-btn-large"
              onClick={() => onTournament?.()}
              style={{ minWidth: 320 }}
            >
              Enter Tournament
            </button>

            {/* Secondary: Practice */}
            <button
              type="button"
              className="btn-secondary pc-btn-large pc-btn-secondary"
              onClick={onPractice}
              style={{ minWidth: 280 }}
            >
              Practice Mode (Free)
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
                  <div className="stat-value">
                    <AnimatedCounter value={totalGames} duration={1000} />
                  </div>
                </div>
                <div className="pc-stat-card highlight">
                  <div className="stat-label">Win%</div>
                  <div className="stat-value">
                    <AnimatedCounter value={parseFloat(winRate)} duration={1200} decimals={1} suffix="%" />
                  </div>
                </div>
                <div className="pc-stat-card">
                  <div className="stat-label">Kills</div>
                  <div className="stat-value">
                    <AnimatedCounter value={totalKills} duration={1400} />
                  </div>
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
      const bots = Array.from({ length: 7 }, (_, i) => `BOT_${i.toString(36)}${Math.random().toString(36).slice(2,4)}`);
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
            } catch {}
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
    { name: 'MICRO', usd: 1, max: 16, prize: 10 },
    { name: 'NANO', usd: 5, max: 32, prize: 50 },
    { name: 'MEGA', usd: 25, max: 32, prize: 250 },
    { name: 'ELITE', usd: 100, max: 16, prize: 1000 },
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
      padding: '30px 40px',
    }}>
      <div style={{ maxWidth: 900, width: '100%', margin: '0 auto' }}>
        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <div style={{ 
            fontSize: 14, 
            letterSpacing: '0.3em', 
            color: '#00f5ff',
            marginBottom: 12,
            textShadow: '0 0 10px rgba(0,245,255,0.5)'
          }}>
            SELECT YOUR ARENA
          </div>
          <h1 style={{ 
            fontSize: 40, 
            fontWeight: 800, 
            color: '#fff',
            margin: 0 
          }}>
            TOURNAMENT
          </h1>
        </div>

        {/* Tier Cards Grid */}
        <div style={{ 
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          gap: 14,
          marginBottom: 24
        }}>
          {tiers.map((tier, i) => {
            const isActive = i === selectedIndex;
            return (
              <button
                key={tier.name}
                onClick={() => setSelectedIndex(i)}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: '20px 14px',
                  borderRadius: 20,
                  border: isActive ? '2px solid #00f5ff' : '1px solid rgba(255,255,255,0.1)',
                  background: isActive 
                    ? 'linear-gradient(135deg, rgba(0,245,255,0.15) 0%, rgba(0,200,255,0.05) 100%)'
                    : 'rgba(255,255,255,0.03)',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                  boxShadow: isActive ? '0 0 40px rgba(0,245,255,0.3)' : 'none',
                  opacity: preflightError ? 0.5 : 1,
                }}
              >
                {/* Entry Fee Badge */}
                <div style={{
                  padding: '6px 16px',
                  borderRadius: 20,
                  background: isActive 
                    ? 'linear-gradient(135deg, #00f5ff, #00ff88)'
                    : 'rgba(255,255,255,0.1)',
                  fontSize: 18,
                  fontWeight: 800,
                  color: isActive ? '#000' : '#fff',
                  marginBottom: 10,
                }}>
                  ${tier.usd}
                </div>
                
                {/* Tier Name */}
                <div style={{ 
                  fontSize: 16, 
                  fontWeight: 600, 
                  color: isActive ? '#00f5ff' : 'rgba(255,255,255,0.7)',
                  marginBottom: 12,
                  letterSpacing: '0.1em'
                }}>
                  {tier.name}
                </div>

                {/* Prize - Big & Engaging */}
                <div style={{ 
                  fontSize: 36, 
                  fontWeight: 900, 
                  color: isActive ? '#00ff88' : 'rgba(255,255,255,0.6)',
                  textShadow: isActive ? '0 0 25px rgba(0,255,136,0.6)' : 'none',
                  lineHeight: 1,
                }}>
                  ${tier.prize}
                </div>
                <div style={{ 
                  fontSize: 10, 
                  color: 'rgba(255,255,255,0.4)', 
                  letterSpacing: '0.15em',
                  marginTop: 6
                }}>
                  WIN 10X
                </div>
              </button>
            );
          })}
        </div>

        {/* Selected Info Panel - More Engaging */}
        <div style={{
          background: 'linear-gradient(135deg, rgba(0,245,255,0.1) 0%, rgba(0,255,136,0.08) 100%)',
          borderRadius: 20,
          padding: '20px 28px',
          marginBottom: 20,
          border: '1px solid rgba(0,245,255,0.25)',
          textAlign: 'center',
        }}>
          <div style={{ 
            fontSize: 14, 
            color: 'rgba(255,255,255,0.5)', 
            letterSpacing: '0.25em',
            marginBottom: 10
          }}>
            PAY ${selected.usd} TO WIN
          </div>
          <div style={{ 
            fontSize: 48, 
            fontWeight: 900, 
            color: '#00ff88',
            textShadow: '0 0 40px rgba(0,255,136,0.5)',
            lineHeight: 1,
          }}>
            ${selected.prize}
          </div>
          <div style={{ 
            fontSize: 16, 
            color: '#00f5ff', 
            marginTop: 12,
            fontWeight: 600
          }}>
            10X YOUR ENTRY
          </div>
        </div>

        {/* Action Buttons */}
        <div style={{ display: 'flex', gap: 16 }}>
          <button
            onClick={onClose}
            style={{
              flex: '0 0 140px',
              padding: '18px 24px',
              borderRadius: 14,
              border: '1px solid rgba(255,255,255,0.15)',
              background: 'transparent',
              color: 'rgba(255,255,255,0.6)',
              fontSize: 16,
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            BACK
          </button>
          <button
            onClick={handleJoin}
            disabled={isDisabled}
            style={{
              flex: 1,
              padding: '18px',
              borderRadius: 14,
              border: 'none',
              background: isDisabled 
                ? 'rgba(255,255,255,0.1)' 
                : 'linear-gradient(135deg, #00f5ff 0%, #00ff88 100%)',
              color: isDisabled ? 'rgba(255,255,255,0.4)' : '#000',
              fontSize: 18,
              fontWeight: 800,
              letterSpacing: '0.1em',
              cursor: isDisabled ? 'not-allowed' : 'pointer',
              boxShadow: isDisabled ? 'none' : '0 0 40px rgba(0,245,255,0.4)',
              transition: 'all 0.2s ease',
            }}
          >
            {isJoining ? 'JOINING...' : preflightError ? 'UNAVAILABLE' : 'ENTER RACE'}
          </button>
        </div>

        {preflightError && (
          <div style={{ 
            textAlign: 'center', 
            marginTop: 16, 
            fontSize: 13, 
            color: 'rgba(255,100,100,0.8)' 
          }}>
            Tournaments temporarily unavailable
          </div>
        )}

      </div>

      {/* SOL Price - Fixed square */}
      <div style={{ 
        position: 'fixed',
        bottom: 20,
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 9999,
        background: 'rgba(0,0,0,0.8)',
        padding: '12px 28px',
        borderRadius: 4,
        border: '2px solid #00f5ff',
        boxShadow: '0 0 20px rgba(0,245,255,0.5)',
      }}>
        <span style={{ fontSize: 16, color: '#fff' }}>SOL </span>
        <span style={{ fontSize: 22, fontWeight: 800, color: '#00f5ff' }}>
          ${solPrice?.toFixed(2) ?? '--'}
        </span>
      </div>
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
              Connected: {publicKey.slice(0,6)}…{publicKey.slice(-6)}
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
    <div className="screen active pc-lobby" id="lobby-screen">
      <div className="lobby-container pc-lobby-container">
        <div className="lobby-header">
          <div className="lobby-title">Tournament Lobby</div>
          <div className="lobby-status">{players.length}/{state.lobby?.maxPlayers ?? 16}</div>
        </div>
        
        {state.lobby && (
          <div className="pc-prize-info">
            <span className="label">Estimated Prize Pool:</span>
            <span className="amount">${estimatedPrizeUsd}</span>
            <span className="note">(85% to winner)</span>
          </div>
        )}
        
        <div className="queue-bar pc-queue">
          <div className="queue-left"><span className="queue-dot" /><span>{players.length} Joined</span></div>
          <div className="queue-center"><span>Waiting for Players</span></div>
          <div className="queue-right"><span>Target: {state.lobby?.maxPlayers ?? 16}</span></div>
        </div>
        
        <div className="lobby-orbit">
          <div className="orbit-center" />
          <div className="orbit-ring">
            {players.map((p: string, i: number) => (
              <div key={p} className="orbit-sperm" style={{ '--i': i, '--n': players.length } as any} />
            ))}
          </div>
          {state.countdown && (
            <div className="countdown-halo">
              <div className="halo-ring" />
              <div className="halo-timer">{state.countdown.remaining}s</div>
            </div>
          )}
        </div>
        
        <div className="lobby-footer">
          <button className="btn-secondary pc-btn" onClick={onBack}>← Leave Lobby</button>
        </div>
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
  const smoothRef = (function(){
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
      return () => { try { cancelAnimationFrame(smoothRef.raf); } catch {} smoothRef.running = false; };
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
  useEffect(() => { try { localStorage.setItem('sr_debug', debugOn ? '1' : '0'); } catch {} }, [debugOn]);
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
  const { state: wsState } = useWs();
  const { publicKey } = useWallet();
  const tx = wsState.lastRound?.txSignature;
  const winner = wsState.lastRound?.winnerId;
  const prize = wsState.lastRound?.prizeAmount;
  const solscan = tx ? `https://solscan.io/tx/${tx}${SOLANA_CLUSTER === 'devnet' ? '?cluster=devnet' : ''}` : null;
  const selfId = wsState.playerId || publicKey || '';
  const isWinner = !!winner && winner === selfId;
  const [animatedPrize, setAnimatedPrize] = useState(0);
  
  // Animated prize counter
  useEffect(() => {
    if (typeof prize === 'number' && prize > 0) {
      const duration = 1500;
      const steps = 60;
      const increment = prize / steps;
      let current = 0;
      const timer = setInterval(() => {
        current += increment;
        if (current >= prize) {
          setAnimatedPrize(prize);
          clearInterval(timer);
        } else {
          setAnimatedPrize(current);
        }
      }, duration / steps);
      return () => clearInterval(timer);
    }
  }, [prize]);
  
  // Calculate rank and top 3
  let myRank = 0;
  let totalPlayers = 0;
  let topThree: Array<{ id: string; rank: number; kills: number }> = [];
  try {
    const initial = wsState.initialPlayers || [];
    const order = wsState.eliminationOrder || [];
    totalPlayers = initial.length;
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
      myRank = rankMap[selfId] || 0;
      
      const ranked = Object.entries(rankMap)
        .sort((a, b) => a[1] - b[1])
        .slice(0, 3);
      topThree = ranked.map(([id, rank]) => ({
        id,
        rank,
        kills: wsState.kills?.[id] || 0,
      }));
    }
  } catch {}
  
  const myKills = wsState.kills?.[selfId] || 0;
  
  return (
    <div className="screen active pc-results" id="round-end" style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'rgba(0,0,0,0.95)',
    }}>
      <div style={{
        maxWidth: 700,
        width: '100%',
        display: 'flex',
        flexDirection: 'column',
        gap: 24,
        padding: 40,
      }}>
        {/* Victory/Defeat Banner */}
        <div style={{
          textAlign: 'center',
          padding: '32px 24px',
          borderRadius: 20,
          background: isWinner 
            ? 'linear-gradient(135deg, rgba(16,185,129,0.25), rgba(34,211,238,0.25))'
            : 'linear-gradient(135deg, rgba(239,68,68,0.2), rgba(168,85,247,0.2))',
          border: `3px solid ${isWinner ? 'rgba(16,185,129,0.6)' : 'rgba(239,68,68,0.5)'}`,
          boxShadow: `0 12px 48px ${isWinner ? 'rgba(16,185,129,0.4)' : 'rgba(239,68,68,0.3)'}`,
        }}>
          <CrownSimple size={64} weight="fill" color={isWinner ? '#10b981' : '#ef4444'} style={{ marginBottom: 16 }} />
          <h1 style={{
            fontSize: 48,
            fontWeight: 900,
            color: '#fff',
            margin: 0,
            marginBottom: 12,
            textShadow: `0 0 30px ${isWinner ? 'rgba(16,185,129,0.8)' : 'rgba(239,68,68,0.8)'}`,
          }}>
            {isWinner ? 'VICTORY ROYALE!' : 'ELIMINATED'}
          </h1>
          <div style={{
            fontSize: 18,
            color: 'rgba(255,255,255,0.8)',
            marginBottom: 20,
            fontWeight: 600,
          }}>
            Rank #{myRank} of {totalPlayers} Players
          </div>
          
          {/* Animated Prize */}
          {typeof prize === 'number' && prize > 0 && isWinner && (
            <div style={{
              padding: '20px 32px',
              background: 'rgba(0,0,0,0.5)',
              borderRadius: 16,
              border: '2px solid rgba(16,185,129,0.4)',
              display: 'inline-block',
            }}>
              <div style={{ fontSize: 14, color: 'rgba(255,255,255,0.6)', marginBottom: 6 }}>
                PRIZE WON
              </div>
              <div style={{
                fontSize: 48,
                fontWeight: 900,
                color: '#10b981',
                fontFamily: '"JetBrains Mono", monospace',
                textShadow: '0 0 30px rgba(16,185,129,1)',
              }}>
                +{animatedPrize.toFixed(4)} SOL
              </div>
            </div>
          )}
        </div>
        
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
          {/* Podium - Top 3 */}
          {topThree.length > 0 && (
            <div style={{
              background: 'rgba(15,23,42,0.8)',
              borderRadius: 20,
              padding: '24px 20px',
              border: '1px solid rgba(255,255,255,0.12)',
            }}>
              <div style={{
                fontSize: 13,
                letterSpacing: 3,
                textTransform: 'uppercase',
                color: 'rgba(255,255,255,0.5)',
                marginBottom: 20,
                textAlign: 'center',
                fontWeight: 700,
              }}>
                Top Performers
              </div>
              <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'flex-end', gap: 12 }}>
                {topThree.map((player, idx) => {
                  const medals = ['🥇', '🥈', '🥉'];
                  const heights = [100, 80, 64];
                  const colors = ['#ffd700', '#c0c0c0', '#cd7f32'];
                  const isMe = player.id === selfId;
                  return (
                    <div key={player.id} style={{
                      flex: 1,
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                    }}>
                      <div style={{ fontSize: 32, marginBottom: 8 }}>{medals[idx]}</div>
                      <div style={{
                        width: '100%',
                        height: heights[idx],
                        background: isMe 
                          ? `linear-gradient(135deg, ${colors[idx]}60, ${colors[idx]}40)`
                          : 'rgba(255,255,255,0.06)',
                        borderRadius: '10px 10px 0 0',
                        border: isMe ? `3px solid ${colors[idx]}` : '1px solid rgba(255,255,255,0.12)',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        padding: 12,
                      }}>
                        <div style={{
                          fontSize: 11,
                          color: 'rgba(255,255,255,0.7)',
                          marginBottom: 4,
                          fontFamily: '"JetBrains Mono", monospace',
                        }}>
                          {player.id.slice(0,5)}…
                        </div>
                        <div style={{
                          fontSize: 14,
                          fontWeight: 800,
                          color: '#fff',
                        }}>
                          {player.kills} kills
                        </div>
                        {isMe && (
                          <div style={{
                            marginTop: 6,
                            padding: '3px 10px',
                            background: colors[idx],
                            color: '#000',
                            fontSize: 10,
                            fontWeight: 900,
                            borderRadius: 6,
                          }}>
                            YOU
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
          
          {/* Performance Stats */}
          <div style={{
            background: 'rgba(15,23,42,0.8)',
            borderRadius: 20,
            padding: '24px 20px',
            border: '1px solid rgba(255,255,255,0.12)',
          }}>
            <div style={{
              fontSize: 13,
              letterSpacing: 3,
              textTransform: 'uppercase',
              color: 'rgba(255,255,255,0.5)',
              marginBottom: 20,
              textAlign: 'center',
              fontWeight: 700,
            }}>
              Your Performance
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 36, fontWeight: 900, color: '#00f5ff', fontFamily: '"JetBrains Mono", monospace' }}>
                  #{myRank}
                </div>
                <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.6)', marginTop: 6 }}>
                  Final Rank
                </div>
              </div>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 36, fontWeight: 900, color: '#00f5ff', fontFamily: '"JetBrains Mono", monospace' }}>
                  {myKills}
                </div>
                <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.6)', marginTop: 6 }}>
                  Eliminations
                </div>
              </div>
            </div>
          </div>
        </div>
        
        {/* Solscan Link */}
        {solscan && (
          <a href={solscan} target="_blank" rel="noreferrer" style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 10,
            padding: '14px 24px',
            background: 'rgba(0,245,255,0.12)',
            border: '1px solid rgba(0,245,255,0.35)',
            borderRadius: 14,
            color: '#00f5ff',
            fontSize: 15,
            fontWeight: 600,
            textDecoration: 'none',
            transition: 'all 0.2s',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = 'rgba(0,245,255,0.18)';
            e.currentTarget.style.borderColor = 'rgba(0,245,255,0.6)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'rgba(0,245,255,0.12)';
            e.currentTarget.style.borderColor = 'rgba(0,245,255,0.35)';
          }}>
            <LinkSimple size={20} weight="bold" />
            <span>View Transaction on Solscan</span>
          </a>
        )}
        
        {/* Action Buttons */}
        <div style={{ display: 'flex', gap: 16, marginTop: 12 }}>
          <button
            onClick={onPlayAgain}
            style={{
              flex: 1,
              padding: '18px 32px',
              background: 'linear-gradient(135deg, #00f5ff, #00ff88)',
              border: 'none',
              borderRadius: 14,
              color: '#000',
              fontSize: 18,
              fontWeight: 900,
              cursor: 'pointer',
              textTransform: 'uppercase',
              letterSpacing: 1,
              boxShadow: '0 10px 30px rgba(0,245,255,0.4)',
              transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'translateY(-3px)';
              e.currentTarget.style.boxShadow = '0 16px 40px rgba(0,245,255,0.6)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.boxShadow = '0 10px 30px rgba(0,245,255,0.4)';
            }}
          >
            🔄 Play Again
          </button>
          <button
            onClick={onChangeTier}
            style={{
              padding: '18px 32px',
              background: 'rgba(255,255,255,0.06)',
              border: '1px solid rgba(255,255,255,0.18)',
              borderRadius: 14,
              color: '#fff',
              fontSize: 15,
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'all 0.2s',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'rgba(255,255,255,0.12)';
              e.currentTarget.style.borderColor = 'rgba(255,255,255,0.3)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'rgba(255,255,255,0.06)';
              e.currentTarget.style.borderColor = 'rgba(255,255,255,0.18)';
            }}
          >
            Main Menu
          </button>
        </div>
      </div>
    </div>
  );
}

