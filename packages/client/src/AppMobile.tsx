import { useEffect, useState, lazy, Suspense } from 'react';
import { OrientationWarning } from './OrientationWarning';
import { MobileTouchControls } from './MobileTouchControls';
import { LoadingSpinner } from './components/LoadingSpinner';
import { AnimatedCounter } from './components/AnimatedCounter';
import { SpermLoadingAnimation } from './components/SpermLoadingAnimation';

// Lazy load heavy components
const MobileTutorial = lazy(() => import('./MobileTutorial'));
const PracticeFullTutorial = lazy(() => import('./PracticeFullTutorial'));
// Base URL for backend API. For any spermrace.io host (prod/dev/www), always use same-origin /api
// so Vercel can proxy and we avoid CORS with separate api.* origins.
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
import { getWalletDeepLink, isMobileDevice } from './walletUtils';
import { useWallet as useAdapterWallet } from '@solana/wallet-adapter-react';
import { WsProvider, useWs } from './WsProvider';

// Lazy load heavy components
const NewGameView = lazy(() => import('./NewGameView'));
const Leaderboard = lazy(() => import('./Leaderboard').then(module => ({ default: module.Leaderboard })));
const HowToPlayOverlay = lazy(() => import('./HowToPlayOverlay'));
import {
  GameController,
  Trophy,
  Skull,
  LinkSimple,
  ArrowClockwise,
  House,
  CheckCircle,
  Atom,
} from 'phosphor-react';
import { ConnectionOverlay } from './components/ConnectionOverlay';
import { Toast } from './components/Toast';
import './leaderboard.css';

type AppScreen = 'landing' | 'practice' | 'tournament' | 'wallet' | 'lobby' | 'game' | 'results';

export default function AppMobile() {
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
  const [practiceReplay, setPracticeReplay] = useState<boolean>(false);
  const [walletReturnScreen, setWalletReturnScreen] = useState<AppScreen>('landing');
  const [solPrice, setSolPrice] = useState<number | null>(null);
  const { state: wsState, signAuthentication, leave } = useWs() as any;
  const [toast, setToast] = useState<string | null>(null);
  const [showSpermLoading, setShowSpermLoading] = useState(false);
  const [pendingScreen, setPendingScreen] = useState<AppScreen | null>(null);
  const showToast = (msg: string, duration = 2000) => {
    setToast(msg);
    window.setTimeout(() => setToast(null), duration);
  };

  const handleLoadingComplete = () => {
    if (pendingScreen) {
      setScreen(pendingScreen);
      setPendingScreen(null);
    }
    setShowSpermLoading(false);
  };
  const wallet = useWallet();
  const { publicKey } = wallet;
  const [showLeaderboard, setShowLeaderboard] = useState<boolean>(false);
  const [showHowTo, setShowHowTo] = useState<boolean>(false);
  
  // Loading progress for overlay
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

  const onPractice = () => {
    setPracticeReplay(false);
    setScreen('practice');
  };
  const onTournament = () => setScreen('tournament');
  const onWallet = () => {
    setWalletReturnScreen(screen);
    setScreen('wallet');
  };

  useEffect(() => {
    if (wsState.phase === 'lobby') setScreen('lobby');
    else if (wsState.phase === 'game') setScreen('game');
  }, [wsState.phase]);

  // Map wallet adapter errors to toast
  useEffect(() => {
    const onWalletError = (e: any) => {
      const msg = e?.detail?.userMessage || e?.detail?.error?.message || 'Wallet error';
      showToast(msg, 2600);
    };
    window.addEventListener('wallet-error', onWalletError as any);
    return () => window.removeEventListener('wallet-error', onWalletError as any);
  }, []);

  // Mobile: Prevent accidental back navigation
  useEffect(() => {
    const preventBack = (e: PopStateEvent) => {
      if (screen !== 'landing') {
        e.preventDefault();
        // Handle back with our screen logic
        if (screen === 'tournament') setScreen('landing');
        else if (screen === 'practice') setScreen('landing');
        else if (screen === 'wallet') setScreen(walletReturnScreen);
      }
    };
    window.addEventListener('popstate', preventBack);
    return () => window.removeEventListener('popstate', preventBack);
  }, [screen, walletReturnScreen]);

  return (
    <div id="app-root" className="mobile-optimized">
      {/* Portrait-only orientation enforcement */}
      <OrientationWarning />
      
      {/* Mobile: Compact header wallet */}
      <HeaderWallet screen={screen} />
      
      <div id="bg-particles" />
      
      {/* Status chip + Help toggle - hide during game to avoid HUD clutter */}
      {screen !== 'game' && screen !== 'practice' && (
        <>
          <div style={{ position: 'fixed', top: 8, right: 8, zIndex: 60, padding: '6px 10px', borderRadius: 8, background: 'rgba(0,0,0,0.55)', color: '#c7d2de', border: '1px solid rgba(255,255,255,0.12)', fontSize: 11 }}>
            {wsState.phase === 'authenticating' ? 'Authenticating…' : wsState.phase === 'lobby' ? 'Lobby' : wsState.phase === 'game' ? 'In Game' : wsState.phase === 'connecting' ? 'Connecting…' : (publicKey ? 'Connected' : 'Not Connected')}
          </div>
          
          <button
            onClick={() => setShowHowTo(true)}
            title="How to play"
            style={{ position: 'fixed', top: 8, left: 8, zIndex: 60, padding: '6px 8px', borderRadius: 8, background: 'rgba(0,0,0,0.55)', color: '#c7d2de', border: '1px solid rgba(255,255,255,0.12)', fontSize: 12, cursor: 'pointer' }}
          >
            ?
          </button>
        </>
      )}

      {/* Connection overlay - handles error, loading, and auth states */}
      <ConnectionOverlay
        wsState={wsState}
        publicKey={publicKey}
        loadProg={loadProg}
        signAuthentication={signAuthentication}
        leave={leave}
        onBack={() => setScreen('landing')}
        variant="mobile"
      />

      {screen === 'landing' && (
        <Landing
          solPrice={solPrice}
          onPractice={onPractice}
          onTournament={onTournament}
          onWallet={onWallet}
          onLeaderboard={() => setShowLeaderboard(true)}
          onShowLoading={(callback) => {
            setShowSpermLoading(true);
            setTimeout(() => {
              setShowSpermLoading(false);
              callback();
            }, 800);
          }}
        />
      )}
      {screen === 'practice' && (
        <Suspense fallback={<div style={{ position: 'fixed', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.95)' }}><LoadingSpinner message="Loading Practice..." size="large" /></div>}>
          <Practice onFinish={() => setScreen('results')} onBack={() => setScreen('landing')} skipLobby={practiceReplay} />
        </Suspense>
      )}
      {screen === 'tournament' && (
        <TournamentModesScreen
          onSelect={() => {
            setWalletReturnScreen('tournament');
            setScreen('wallet');
          }}
          onClose={() => setScreen('landing')}
          onNotify={showToast}
        />
      )}
      {screen === 'wallet' && (
        <Wallet onConnected={() => setScreen('lobby')} onClose={() => setScreen(walletReturnScreen)} />
      )}
      {screen === 'lobby' && (
        <Lobby 
          onStart={() => setScreen('game')} 
          onBack={() => setScreen('tournament')}
          onRefund={() => setScreen('tournament')}
        />
      )}
      {screen === 'game' && (
        <Suspense fallback={<div style={{ position: 'fixed', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.95)' }}><LoadingSpinner message="Loading Game..." size="large" /></div>}>
          <Game onEnd={() => setScreen('results')} onRestart={() => setScreen('game')} />
        </Suspense>
      )}
      {screen === 'results' && (
        <Results onPlayAgain={() => { setPracticeReplay(true); setScreen('practice'); }} onChangeTier={() => setScreen('tournament')} />
      )}
      
      {/* Toast notification */}
      <Toast message={toast} variant="mobile" />

      {showHowTo && (
        <Suspense fallback={<div style={{ position: 'fixed', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.9)', zIndex: 10000 }}><LoadingSpinner message="Loading..." size="large" /></div>}>
          <HowToPlayOverlay
            mode="mobile"
            onClose={() => {
              setShowHowTo(false);
              try {
              localStorage.setItem('sr_howto_seen_v2', '1');
            } catch {}
          }}
          />
        </Suspense>
      )}

      {/* Leaderboard Modal */}
      {/* Sperm Loading Animation */}
      {showSpermLoading && (
        <SpermLoadingAnimation onComplete={handleLoadingComplete} />
      )}

      {showLeaderboard && (
        <Suspense fallback={<div style={{ position: 'fixed', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.9)', zIndex: 10000 }}><LoadingSpinner message="Loading Leaderboard..." size="large" /></div>}>
          <Leaderboard
            onClose={() => setShowLeaderboard(false)}
            apiBase={API_BASE}
            myWallet={publicKey || null}
            isMobile={true}
          />
        </Suspense>
      )}
    </div>
  );
}

function HeaderWallet({ screen }: { screen: string }) {
  const { publicKey, disconnect } = useWallet() as any;
  
  if (publicKey) {
    const short = `${publicKey.slice(0,4)}…${publicKey.slice(-4)}`;
    return (
      <div className="mobile-wallet-badge">
        <span className="wallet-address">{short}</span>
        <button className="wallet-disconnect" onClick={() => disconnect?.()}>✕</button>
      </div>
    );
  }
  if (screen === 'game') {
    return (
      <div className="mobile-wallet-badge">
        <GameController size={16} weight="fill" style={{ marginRight: 6 }} />
        <span>Practice</span>
      </div>
    );
  }
  return null;
}

interface LandingProps {
  solPrice: number | null;
  onPractice: () => void;
  onTournament?: () => void;
  onWallet: () => void;
  onLeaderboard?: () => void;
  onShowLoading?: (callback: () => void) => void;
}

function Landing({
  solPrice,
  onPractice,
  onTournament,
  onWallet,
  onLeaderboard,
  onShowLoading,
}: LandingProps) {

  const getPlayerStats = () => {
    try {
      const stored = localStorage.getItem('spermrace_stats');
      if (stored) return JSON.parse(stored) as { totalGames?: number; wins?: number; totalKills?: number };
    } catch {}
    return { totalGames: 0, wins: 0, totalKills: 0 };
  };

  const stats = getPlayerStats();
  const totalGames = stats.totalGames || 0;
  const totalKills = stats.totalKills || 0;
  const winRate = totalGames > 0 ? ((stats.wins || 0) / totalGames * 100).toFixed(1) : '0.0';

  return (
    <div className="screen active mobile-landing" id="landing-screen">
      <div
        className="mobile-landing-container"
        style={{
          maxWidth: 960,
          margin: '0 auto',
          minHeight: '100dvh',
          padding: '0 20px',
          paddingBottom: 'max(40px, env(safe-area-inset-bottom))',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center',
          gap: 20,
        }}
      >
        <header style={{ textAlign: 'center', width: '100%' }}>
          <div style={{ marginBottom: 16 }}>
            <Atom 
              size={56} 
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
              letterSpacing: '0.3em',
              fontSize: 9,
              textTransform: 'uppercase',
              color: '#00f5ff',
              marginBottom: 12,
              textShadow: '0 0 10px rgba(0, 245, 255, 0.5)',
            }}
          >
            BATTLE ROYALE STARTS AT BIRTH
          </div>
          <h1
            style={{
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'baseline',
              gap: 10,
              fontSize: 42,
              lineHeight: 1,
              textShadow: '0 0 30px rgba(0, 245, 255, 0.4), 0 0 60px rgba(0, 245, 255, 0.2)',
            }}
          >
            <span style={{ color: '#fff', fontWeight: 800 }}>SPERM</span>
            <span
              style={{
                fontWeight: 800,
                background: 'linear-gradient(135deg, #00f5ff, #00ff88)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                filter: 'drop-shadow(0 0 8px rgba(0, 245, 255, 0.6))',
              }}
            >
              RACE
            </span>
          </h1>
          <p
            style={{
              marginTop: 10,
              fontSize: 10,
              letterSpacing: '0.12em',
              textTransform: 'uppercase',
              color: 'rgba(255,255,255,0.7)',
            }}
          >
            SURVIVE. ELIMINATE. WIN CRYPTO.
          </p>
          <div
            style={{
              marginTop: 6,
              fontSize: 10,
              color: 'rgba(148,163,184,0.78)',
              fontFamily: 'JetBrains Mono, ui-monospace, SFMono-Regular, Menlo, monospace',
            }}
          >
            SOL: {solPrice != null ? `$${solPrice.toFixed(2)}` : '--.--'}
          </div>

          {totalGames > 0 && (
            <div
              style={{
                marginTop: 10,
                display: 'flex',
                justifyContent: 'center',
              }}
            >
              <div
                style={{
                  padding: '10px 12px',
                  borderRadius: 12,
                  background: 'rgba(15,23,42,0.9)',
                  border: '1px solid rgba(148,163,184,0.45)',
                  display: 'flex',
                  gap: 10,
                  minWidth: 0,
                }}
              >
                <div className="mobile-stat">
                  <div className="label">Practice Games</div>
                  <div className="value">
                    <AnimatedCounter value={totalGames} duration={1000} />
                  </div>
                </div>
                <div className="mobile-stat">
                  <div className="label">Practice Win%</div>
                  <div className="value">
                    <AnimatedCounter value={parseFloat(winRate)} duration={1200} decimals={1} suffix="%" />
                  </div>
                </div>
                <div className="mobile-stat">
                  <div className="label">Practice Kills</div>
                  <div className="value">
                    <AnimatedCounter value={totalKills} duration={1400} />
                  </div>
                </div>
              </div>
            </div>
          )}
        </header>

        <main>
          <section
            style={{
              width: '100%',
              maxWidth: '400px',
              marginTop: '32px',
              display: 'flex',
              flexDirection: 'column',
              gap: '16px',
            }}
          >
            {/* Primary CTA - Tournament */}
            <button
              type="button"
              className="btn-primary"
              onClick={() => {
                if (onShowLoading && onTournament) {
                  onShowLoading(onTournament);
                } else {
                  onTournament?.();
                }
              }}
              style={{
                width: '100%',
                maxWidth: '400px',
                padding: '18px 28px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '12px',
                position: 'relative',
                overflow: 'hidden',
              }}
              onTouchStart={(e) => {
                e.currentTarget.style.transform = 'scale(0.98)';
              }}
              onTouchEnd={(e) => {
                e.currentTarget.style.transform = 'scale(1)';
              }}
            >
              <Trophy size={22} weight="fill" />
              <span>Enter Tournament</span>
            </button>

            {/* Secondary CTA - Practice */}
            <button
              type="button"
              className="btn-secondary"
              onClick={() => {
                if (onShowLoading) {
                  onShowLoading(onPractice);
                } else {
                  onPractice();
                }
              }}
              style={{
                width: '100%',
                maxWidth: '400px',
                padding: '14px 24px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '10px',
              }}
              onTouchStart={(e) => {
                e.currentTarget.style.transform = 'scale(0.98)';
              }}
              onTouchEnd={(e) => {
                e.currentTarget.style.transform = 'scale(1)';
              }}
            >
              <GameController size={20} weight="fill" />
              <span>Practice Mode (Free)</span>
            </button>

            {/* Sentry Test Button (Remove after testing) */}
            {import.meta.env.DEV && (
              <button
                type="button"
                style={{
                  padding: '8px 12px',
                  background: '#ef4444',
                  border: '2px solid #dc2626',
                  borderRadius: '8px',
                  color: '#fff',
                  fontSize: '12px',
                  fontWeight: '600',
                  cursor: 'pointer',
                }}
                onClick={() => {
                  throw new Error('🧪 Sentry Test Error - This is your first error!');
                }}
              >
                🧪 Test Sentry Error
              </button>
            )}
          </section>

          <div
            style={{
              marginTop: 8,
              fontSize: 10,
              textAlign: 'center',
              color: 'rgba(0, 245, 255, 0.6)',
              letterSpacing: '0.1em',
            }}
          >
            TOURNAMENTS FROM $1 • WINNER TAKES ALL
          </div>
        </main>

        <footer
          style={{
            width: '100%',
            maxWidth: '400px',
            marginTop: '32px',
            display: 'flex',
            justifyContent: 'center',
            gap: '16px',
            flexWrap: 'wrap',
          }}
        >
          {onLeaderboard && (
            <button
              type="button"
              className="btn-secondary"
              onClick={onLeaderboard}
              style={{
                flex: '1',
                minWidth: '140px',
                padding: '12px 20px',
              }}
              onTouchStart={(e) => {
                e.currentTarget.style.transform = 'scale(0.98)';
              }}
              onTouchEnd={(e) => {
                e.currentTarget.style.transform = 'scale(1)';
              }}
            >
              Ranks
            </button>
          )}
          <button
            type="button"
            className="btn-secondary"
            onClick={onWallet}
            style={{
              flex: '1',
              minWidth: '140px',
              padding: '12px 20px',
            }}
            onTouchStart={(e) => {
              e.currentTarget.style.transform = 'scale(0.98)';
            }}
            onTouchEnd={(e) => {
              e.currentTarget.style.transform = 'scale(1)';
            }}
          >
            Wallet
          </button>
        </footer>
      </div>
    </div>
  );
}

function Practice({ onFinish: _onFinish, onBack, skipLobby = false }: { onFinish: () => void; onBack: () => void; skipLobby?: boolean }) {
  const [step, setStep] = useState<'lobby' | 'game'>(skipLobby ? 'game' : 'lobby');
  const [meId] = useState<string>('PLAYER_' + Math.random().toString(36).slice(2, 8));
  const [players, setPlayers] = useState<string[]>([]);
  const [showPracticeIntro, setShowPracticeIntro] = useState<boolean>(() => {
    try {
      return !localStorage.getItem('sr_practice_full_tuto_seen');
    } catch {
      return true;
    }
  });
  
  // Mobile control state (MUST be at top level, not inside conditionals!)
  const [gameCountdown, setGameCountdown] = useState<number>(6); // 6 seconds to account for game engine preStart
  
  const handleTouch = (x: number, y: number) => {
    const event = new CustomEvent('mobile-joystick', { detail: { x, y } });
    window.dispatchEvent(event);
  };
  
  const handleBoost = () => {
    console.log('[AppMobile] Boost button clicked, countdown:', gameCountdown);
    const event = new CustomEvent('mobile-boost');
    window.dispatchEvent(event);
  };

  useEffect(() => {
    if (step === 'lobby') {
      if (showPracticeIntro) return;
      setGameCountdown(3); // 3-second on-field countdown
      const base = [meId];
      const bots = Array.from({ length: 7 }, (_, i) => `BOT_${i.toString(36)}${Math.random().toString(36).slice(2,4)}`);
      setPlayers([...base, ...bots]);
      setStep('game');
    }
    
    if (step === 'game') {
      setGameCountdown(3); // Practice: 3-second pre-start countdown on field
      const timer = setInterval(() => {
        setGameCountdown(prev => Math.max(0, prev - 1));
      }, 1000);
      return () => clearInterval(timer);
    }
  }, [step, meId, showPracticeIntro]);

  if (step === 'lobby') {
    const maxPlayers = 8;
    const progressPct = 0;
    return (
      <div className="screen active mobile-lobby-screen">
        <div className="mobile-lobby-container">
          <div className="mobile-lobby-header">
            <h2 className="mobile-lobby-title" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <GameController size={18} weight="fill" />
              <span>Practice Lobby</span>
            </h2>
            <div className="mobile-lobby-count">{players.length}/{maxPlayers}</div>
          </div>
          
          <div className="mobile-queue-status">
            <div className="status-item">
              <span className="dot"></span>
              <span>{players.length} Ready</span>
            </div>
            <div className="status-item">
              <span>Tutorial</span>
            </div>
          </div>
          
          <div className="mobile-lobby-orbit">
            <div className="orbit-center" />
            <div className="orbit-ring">
              {players.map((p: string, i: number) => (
                <div key={p} className="orbit-sperm" style={{ '--i': i, '--n': players.length } as any} />
              ))}
            </div>
            <div className="mobile-countdown"></div>
          </div>
          
          <div className="mobile-progress-bar">
            <div className="mobile-progress-fill" style={{ width: `${progressPct}%` }}></div>
          </div>
          
          <div className="mobile-lobby-footer">
            <button className="mobile-btn-back" onClick={onBack}>← Back</button>
          </div>
        </div>
        <PracticeFullTutorial
          visible={showPracticeIntro}
          onDone={() => {
            setShowPracticeIntro(false);
            try {
              localStorage.setItem('sr_practice_full_tuto_seen', '1');
            } catch {}
          }}
        />
      </div>
    );
  }

  if (step === 'game') {
    return (
      <div className="screen active" style={{ padding: 0, position: 'fixed', inset: 0, width: '100vw', height: '100vh', zIndex: 100 }}>
        {/* Back button - top left, safe area aware */}
        <button 
          onClick={onBack}
          style={{
            position: 'fixed',
            top: 'calc(12px + env(safe-area-inset-top, 0px))',
            left: 'calc(12px + env(safe-area-inset-left, 0px))',
            zIndex: 2001,
            padding: '10px 16px',
            background: 'rgba(0, 0, 0, 0.7)',
            border: '1.5px solid rgba(255, 255, 255, 0.3)',
            borderRadius: '12px',
            color: '#fff',
            fontSize: '16px',
            fontWeight: 600,
            cursor: 'pointer',
            backdropFilter: 'blur(10px)',
            WebkitTapHighlightColor: 'transparent'
          }}
        >
          ✕
        </button>
        <NewGameView 
          meIdOverride={meId || 'YOU'}
          onReplay={() => setStep('lobby')}
          onExit={onBack}
        />
        <MobileTouchControls 
          onTouch={handleTouch}
          onBoost={handleBoost}
          canBoost={true}
          boostCooldownPct={1}
        />
        {/* Practice: continue quick tips during pre-start countdown */}
        <MobileTutorial countdown={gameCountdown} context="practice" />
      </div>
    );
  }

  return null;
}

function TournamentModesScreen({ onSelect: _onSelect, onClose, onNotify }: { onSelect: () => void; onClose: () => void; onNotify: (msg: string, duration?: number) => void }) {
  const { publicKey, connect } = useWallet();
  const { connectAndJoin, state: wsState } = useWs();
  const [isJoining, setIsJoining] = useState<boolean>(false);
  const [preflightError, setPreflightError] = useState<boolean>(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  
  useEffect(() => {
    (async () => {
      try {
        const r = await fetch(`${API_BASE}/prize-preflight`);
        if (!r.ok) throw new Error(`preflight ${r.status}`);
        const j = await r.json();
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
      display: 'flex',
      flexDirection: 'column',
      padding: '20px 16px',
      paddingTop: 'calc(20px + env(safe-area-inset-top, 0px))',
      paddingBottom: 'calc(20px + env(safe-area-inset-bottom, 0px))',
    }}>
      {/* Header */}
      <div style={{ textAlign: 'center', marginBottom: 24 }}>
        <div style={{ 
          fontSize: 11, 
          letterSpacing: '0.3em', 
          color: '#00f5ff',
          marginBottom: 8,
          textShadow: '0 0 10px rgba(0,245,255,0.5)'
        }}>
          SELECT YOUR ARENA
        </div>
        <h1 style={{ 
          fontSize: 28, 
          fontWeight: 800, 
          color: '#fff',
          margin: 0 
        }}>
          TOURNAMENT
        </h1>
      </div>

      {/* Tier Cards - 2x2 Grid */}
      <div style={{ 
        flex: 1, 
        display: 'grid',
        gridTemplateColumns: 'repeat(2, 1fr)',
        gap: 10,
        overflow: 'auto',
        marginBottom: 16
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
                padding: '14px 10px',
                borderRadius: 16,
                border: isActive ? '2px solid #00f5ff' : '1px solid rgba(255,255,255,0.1)',
                background: isActive 
                  ? 'linear-gradient(135deg, rgba(0,245,255,0.15) 0%, rgba(0,200,255,0.05) 100%)'
                  : 'rgba(255,255,255,0.03)',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                boxShadow: isActive ? '0 0 25px rgba(0,245,255,0.3)' : 'none',
                opacity: preflightError ? 0.5 : 1,
              }}
            >
              {/* Entry Fee Badge */}
              <div style={{
                padding: '4px 12px',
                borderRadius: 20,
                background: isActive 
                  ? 'linear-gradient(135deg, #00f5ff, #00ff88)'
                  : 'rgba(255,255,255,0.1)',
                fontSize: 14,
                fontWeight: 800,
                color: isActive ? '#000' : '#fff',
                marginBottom: 6,
              }}>
                ${tier.usd}
              </div>
              
              {/* Tier Name */}
              <div style={{ 
                fontSize: 13, 
                fontWeight: 600, 
                color: isActive ? '#00f5ff' : 'rgba(255,255,255,0.7)',
                marginBottom: 8,
                letterSpacing: '0.1em'
              }}>
                {tier.name}
              </div>

              {/* Prize - Big & Engaging */}
              <div style={{ 
                fontSize: 28, 
                fontWeight: 900, 
                color: isActive ? '#00ff88' : 'rgba(255,255,255,0.6)',
                textShadow: isActive ? '0 0 20px rgba(0,255,136,0.6)' : 'none',
                lineHeight: 1,
              }}>
                ${tier.prize}
              </div>
              <div style={{ 
                fontSize: 9, 
                color: 'rgba(255,255,255,0.4)', 
                letterSpacing: '0.15em',
                marginTop: 4
              }}>
                WIN 10X
              </div>
            </button>
          );
        })}
      </div>

      {/* Selected Info - More Engaging */}
      <div style={{
        background: 'linear-gradient(135deg, rgba(0,245,255,0.1) 0%, rgba(0,255,136,0.08) 100%)',
        borderRadius: 16,
        padding: '16px 20px',
        marginBottom: 16,
        border: '1px solid rgba(0,245,255,0.25)',
        textAlign: 'center',
      }}>
        <div style={{ 
          fontSize: 11, 
          color: 'rgba(255,255,255,0.5)', 
          letterSpacing: '0.2em',
          marginBottom: 8
        }}>
          PAY ${selected.usd} TO WIN
        </div>
        <div style={{ 
          fontSize: 40, 
          fontWeight: 900, 
          color: '#00ff88',
          textShadow: '0 0 30px rgba(0,255,136,0.5)',
          lineHeight: 1,
        }}>
          ${selected.prize}
        </div>
        <div style={{ 
          fontSize: 12, 
          color: '#00f5ff', 
          marginTop: 8,
          fontWeight: 600
        }}>
          10X YOUR ENTRY
        </div>
      </div>

      {/* Action Buttons */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <button
          onClick={handleJoin}
          disabled={isDisabled}
          style={{
            width: '100%',
            padding: '16px',
            borderRadius: 14,
            border: 'none',
            background: isDisabled 
              ? 'rgba(255,255,255,0.1)' 
              : 'linear-gradient(135deg, #00f5ff 0%, #00ff88 100%)',
            color: isDisabled ? 'rgba(255,255,255,0.4)' : '#000',
            fontSize: 16,
            fontWeight: 800,
            letterSpacing: '0.1em',
            cursor: isDisabled ? 'not-allowed' : 'pointer',
            boxShadow: isDisabled ? 'none' : '0 0 30px rgba(0,245,255,0.4)',
            transition: 'all 0.2s ease',
          }}
        >
          {isJoining ? 'JOINING...' : preflightError ? 'UNAVAILABLE' : 'ENTER RACE'}
        </button>
        
        <button
          onClick={onClose}
          style={{
            width: '100%',
            padding: '14px',
            borderRadius: 14,
            border: '1px solid rgba(255,255,255,0.15)',
            background: 'transparent',
            color: 'rgba(255,255,255,0.6)',
            fontSize: 14,
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          BACK
        </button>
      </div>

      {preflightError && (
        <div style={{ 
          textAlign: 'center', 
          marginTop: 12, 
          fontSize: 11, 
          color: 'rgba(255,100,100,0.8)' 
        }}>
          Tournaments temporarily unavailable
        </div>
      )}
    </div>
  );
}

function Wallet({ onConnected, onClose }: { onConnected: () => void; onClose: () => void; }) {
  const { connect, publicKey } = useWallet();
  const { select } = useAdapterWallet();
  const [wcError, setWcError] = useState<string | null>(null);
  const tryConnect = async () => {
    if (await connect()) onConnected();
  };
  const tryWalletConnect = async () => {
    try {
      await select('WalletConnect' as any);
      const ok = await connect();
      if (ok) { setWcError(null); onConnected(); return; }
      setWcError('Could not open WalletConnect.');
    } catch (e) {
      console.warn('[WALLET] WalletConnect selection failed', e);
      setWcError('WalletConnect is unavailable. Try a direct deep link below.');
    }
  };
  
  return (
    <div className="screen active mobile-wallet-screen">
      <div className="mobile-wallet-container">
        <h2 className="mobile-wallet-title">Connect Wallet</h2>
        <p className="mobile-wallet-subtitle">Sign in with Solana</p>
        
        <button className="mobile-wallet-connect-btn" onClick={tryConnect}>
          <div className="icon"> </div>
          <div className="content">
            <div className="title">Connect Wallet</div>
            <div className="subtitle">Phantom / Solflare / Coinbase • build wallet-refactor</div>
          </div>
        </button>

        <button className="mobile-wallet-connect-btn" style={{ marginTop: 12 }} onClick={tryWalletConnect}>
          <div className="icon"> </div>
          <div className="content">
            <div className="title">WalletConnect</div>
            <div className="subtitle">Use QR or open your mobile wallet</div>
          </div>
        </button>
        
        {publicKey && (
          <div className="mobile-connected-status">
            <CheckCircle size={16} weight="fill" style={{ marginRight: 6 }} />
            Connected: {publicKey.slice(0,8)}...{publicKey.slice(-8)}
          </div>
        )}

        {/* WalletConnect fallback deep-links on mobile */}
        {isMobileDevice() && wcError && (
          <div style={{ marginTop: 12, padding: 12, borderRadius: 12, background: 'rgba(0,0,0,0.55)', border: '1px solid rgba(255,255,255,0.12)', color: '#c7d2de', fontSize: 13 }}>
            <div style={{ marginBottom: 8 }}>{wcError}</div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {['phantom','solflare','backpack'].map(name => {
                const link = getWalletDeepLink(name);
                if (!link) return null;
                return <a key={name} href={link} style={{ padding: '8px 10px', borderRadius: 8, background: 'rgba(34,211,238,0.15)', color: '#22d3ee', textDecoration: 'none', border: '1px solid rgba(34,211,238,0.35)' }}>{name.charAt(0).toUpperCase()+name.slice(1)}</a>;
              })}
            </div>
          </div>
        )}
        
        <button className="mobile-btn-back" onClick={onClose}>← Back</button>
      </div>
    </div>
  );
}

function Lobby({ onStart: _onStart, onBack, onRefund }: { onStart: () => void; onBack: () => void; onRefund?: () => void }) {
  const { state } = useWs();
  const players = state.lobby?.players || [];
  const realPlayers = players.filter(p => !String(p).startsWith('BOT_'));
  const estimatedPrizeUsd = state.lobby ? Math.max(0, Math.floor(realPlayers.length * (state.lobby.entryFee as number) * 0.85)) : 0;
  
  // Auto-return to menu on refund
  useEffect(() => {
    // Check for refund flag
    const refunded = (state as any).refundReceived;
    console.log('[Lobby] State check:', { 
      hasLobby: !!state.lobby, 
      hasError: !!state.lastError,
      refunded,
      phase: state.phase 
    });
    
    if (refunded && !state.lobby && onRefund) {
      console.log('[Lobby] Refund detected, auto-returning to menu immediately');
      onRefund();
    }
  }, [(state as any).refundReceived, state.lobby, onRefund]);
  
  const refundCountdown = (state.lobby as any)?.refundCountdown;
  const isSolo = players.length === 1;
  const isRefunding = refundCountdown !== undefined && refundCountdown <= 1;
  
  return (
    <div className="screen active mobile-lobby-screen">
      <div className="mobile-lobby-container">
        <div className="mobile-lobby-header">
          <h2 className="mobile-lobby-title" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <Trophy size={18} weight="fill" />
            <span>Lobby</span>
          </h2>
          <div className="mobile-lobby-count">{players.length}/{state.lobby?.maxPlayers ?? 16}</div>
        </div>
        
        {state.lobby && (
          <div className="mobile-prize-display">
            <span className="label">Prize Pool:</span>
            <span className="amount">${estimatedPrizeUsd}</span>
          </div>
        )}
        
        <div className="mobile-queue-status">
          <div className="status-item">
            <span className="dot"></span>
            <span>{players.length} Joined</span>
          </div>
          <div className="status-item">
            <span>Target: {state.lobby?.maxPlayers ?? 16}</span>
          </div>
        </div>
        
        <div className="mobile-lobby-orbit">
          <div className="orbit-center">
            <div className="mobile-lobby-spinner"></div>
          </div>
          <div className="orbit-ring">
            {players.map((p: string, i: number) => (
              <div key={p} className="orbit-sperm" style={{ '--i': i, '--n': players.length } as any} />
            ))}
          </div>
          
          {/* Status Messages */}
          <div className="mobile-lobby-status-text">
            {isRefunding ? (
              <>
                <div className="refund-processing">
                  <div className="spinner-small"></div>
                  <span>Processing refund...</span>
                </div>
              </>
            ) : isSolo && refundCountdown && refundCountdown <= 20 ? (
              <>
                <div className="waiting-text">Waiting for players...</div>
                <div className="refund-warning">Auto-refund in {refundCountdown}s</div>
              </>
            ) : isSolo ? (
              <div className="waiting-text">Waiting for players...</div>
            ) : state.countdown ? (
              <div className="starting-text">Starting in {state.countdown.remaining}s</div>
            ) : (
              <div className="waiting-text">Waiting for more players...</div>
            )}
          </div>
        </div>
        
        <div className="mobile-lobby-footer">
          <button className="mobile-btn-back" onClick={onBack}>← Leave</button>
        </div>
      </div>
    </div>
  );
}

function Game({ onEnd, onRestart }: { onEnd: () => void; onRestart: () => void; }) {
  const [gameCountdown, setGameCountdown] = useState<number>(6); // 6 seconds to match game engine preStart
  
  useEffect(() => {
    const timer = setInterval(() => {
      setGameCountdown(prev => Math.max(0, prev - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, []);
  
  const handleTouch = (x: number, y: number) => {
    const event = new CustomEvent('mobile-joystick', { detail: { x, y } });
    window.dispatchEvent(event);
  };
  
  const handleBoost = () => {
    // console.log('[AppMobile] Boost button clicked, countdown:', gameCountdown);
    const event = new CustomEvent('mobile-boost');
    window.dispatchEvent(event);
    
    // Check cooldown locally for immediate feedback if needed
    // But better to rely on NewGameView's state if possible or just fire the event.
    // We added a listener in NewGameView to catch this event and trigger screenshake.
  };
  
  return (
    <div className="screen active" style={{ padding: 0, position: 'fixed', inset: 0, width: '100vw', height: '100vh', zIndex: 100 }}>
      {/* X button removed from tournament - players must finish to maintain competitive integrity */}
      <NewGameView 
        onReplay={onRestart}
        onExit={onEnd}
      />
      <MobileTouchControls 
        onTouch={handleTouch}
        onBoost={handleBoost}
        canBoost={true}
        boostCooldownPct={1}
      />
      <MobileTutorial countdown={gameCountdown} />
    </div>
  );
}

function Results({ onPlayAgain, onChangeTier }: { onPlayAgain: () => void; onChangeTier: () => void; }) {
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
      const duration = 1500; // 1.5s animation
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
      
      // Build top 3
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
    <div className="screen active mobile-results-screen" style={{
      background: 'linear-gradient(180deg, #030712 0%, #0a1628 100%)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '20px 16px',
      overflowY: 'auto',
    }}>
      <div style={{
        maxWidth: 480,
        width: '100%',
        display: 'flex',
        flexDirection: 'column',
        gap: 20,
      }}>
        {/* Victory/Defeat Banner */}
        <div style={{
          textAlign: 'center',
          padding: '24px 16px',
          borderRadius: 16,
          background: isWinner 
            ? 'linear-gradient(135deg, rgba(16,185,129,0.2), rgba(34,211,238,0.2))'
            : 'linear-gradient(135deg, rgba(239,68,68,0.15), rgba(168,85,247,0.15))',
          border: `2px solid ${isWinner ? 'rgba(16,185,129,0.5)' : 'rgba(239,68,68,0.4)'}`,
          boxShadow: `0 8px 32px ${isWinner ? 'rgba(16,185,129,0.3)' : 'rgba(239,68,68,0.2)'}`,
        }}>
          {isWinner ? (
            <Trophy size={48} weight="fill" color="#10b981" style={{ marginBottom: 12 }} />
          ) : (
            <Skull size={48} weight="fill" color="#ef4444" style={{ marginBottom: 12 }} />
          )}
          <h1 style={{
            fontSize: 32,
            fontWeight: 900,
            color: '#fff',
            margin: 0,
            marginBottom: 8,
            textShadow: `0 0 20px ${isWinner ? 'rgba(16,185,129,0.6)' : 'rgba(239,68,68,0.6)'}`,
          }}>
            {isWinner ? 'VICTORY!' : 'ELIMINATED'}
          </h1>
          <div style={{
            fontSize: 14,
            color: 'rgba(255,255,255,0.7)',
            marginBottom: 16,
          }}>
            #{myRank} of {totalPlayers} players
          </div>
          
          {/* Animated Prize */}
          {typeof prize === 'number' && prize > 0 && isWinner && (
            <div style={{
              padding: '16px 24px',
              background: 'rgba(0,0,0,0.4)',
              borderRadius: 12,
              border: '1px solid rgba(16,185,129,0.3)',
            }}>
              <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)', marginBottom: 4 }}>
                Prize Won
              </div>
              <div style={{
                fontSize: 36,
                fontWeight: 900,
                color: '#10b981',
                fontFamily: '"JetBrains Mono", monospace',
                textShadow: '0 0 20px rgba(16,185,129,0.8)',
              }}>
                +{animatedPrize.toFixed(4)} SOL
              </div>
            </div>
          )}
        </div>
        
        {/* Podium - Top 3 */}
        {topThree.length > 0 && (
          <div style={{
            background: 'rgba(15,23,42,0.6)',
            borderRadius: 16,
            padding: '20px 16px',
            border: '1px solid rgba(255,255,255,0.1)',
          }}>
            <div style={{
              fontSize: 12,
              letterSpacing: 2,
              textTransform: 'uppercase',
              color: 'rgba(255,255,255,0.5)',
              marginBottom: 16,
              textAlign: 'center',
            }}>
              Top Performers
            </div>
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'flex-end', gap: 8 }}>
              {topThree.map((player, idx) => {
                const medals = ['🥇', '🥈', '🥉'];
                const heights = [80, 64, 52];
                const colors = ['#ffd700', '#c0c0c0', '#cd7f32'];
                const isMe = player.id === selfId;
                return (
                  <div key={player.id} style={{
                    flex: 1,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                  }}>
                    <div style={{ fontSize: 24, marginBottom: 4 }}>{medals[idx]}</div>
                    <div style={{
                      width: '100%',
                      height: heights[idx],
                      background: isMe 
                        ? `linear-gradient(135deg, ${colors[idx]}50, ${colors[idx]}30)`
                        : 'rgba(255,255,255,0.05)',
                      borderRadius: '8px 8px 0 0',
                      border: isMe ? `2px solid ${colors[idx]}` : '1px solid rgba(255,255,255,0.1)',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      padding: 8,
                    }}>
                      <div style={{
                        fontSize: 10,
                        color: 'rgba(255,255,255,0.6)',
                        marginBottom: 2,
                        fontFamily: '"JetBrains Mono", monospace',
                      }}>
                        {player.id.slice(0,4)}…
                      </div>
                      <div style={{
                        fontSize: 11,
                        fontWeight: 700,
                        color: '#fff',
                      }}>
                        {player.kills} kills
                      </div>
                      {isMe && (
                        <div style={{
                          marginTop: 4,
                          padding: '2px 6px',
                          background: colors[idx],
                          color: '#000',
                          fontSize: 8,
                          fontWeight: 800,
                          borderRadius: 4,
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
          background: 'rgba(15,23,42,0.6)',
          borderRadius: 16,
          padding: '20px 16px',
          border: '1px solid rgba(255,255,255,0.1)',
        }}>
          <div style={{
            fontSize: 12,
            letterSpacing: 2,
            textTransform: 'uppercase',
            color: 'rgba(255,255,255,0.5)',
            marginBottom: 16,
            textAlign: 'center',
          }}>
            Your Performance
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12 }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 24, fontWeight: 900, color: '#00f5ff', fontFamily: '"JetBrains Mono", monospace' }}>
                #{myRank}
              </div>
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.6)', marginTop: 4 }}>
                Final Rank
              </div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 24, fontWeight: 900, color: '#00f5ff', fontFamily: '"JetBrains Mono", monospace' }}>
                {myKills}
              </div>
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.6)', marginTop: 4 }}>
                Eliminations
              </div>
            </div>
          </div>
        </div>
        
        {/* Solscan Link */}
        {solscan && (
          <a
            href={solscan}
            target="_blank"
            rel="noreferrer"
            className="mobile-solscan-btn"
          >
            <LinkSimple size={18} weight="bold" />
            <span>View Transaction on Solscan</span>
          </a>
        )}

        {/* Action Buttons */}
        <div className="mobile-result-actions">
          <button
            onClick={onPlayAgain}
            className="mobile-btn-primary"
          >
            <ArrowClockwise size={20} weight="bold" />
            <span>Play Again</span>
          </button>
          <button
            onClick={onChangeTier}
            className="mobile-btn-secondary"
          >
            <House size={20} weight="fill" />
            <span>Menu</span>
          </button>
        </div>
      </div>
    </div>
  );
}

