import { useEffect, useState } from 'react';
import { OrientationWarning } from './OrientationWarning';
import { MobileTouchControls } from './MobileTouchControls';
import MobileTutorial from './MobileTutorial';
import { PracticeModeSelection } from './PracticeModeSelection';
import PracticeFullTutorial from './PracticeFullTutorial';
// Base URL for backend API. For any spermrace.io host (prod/dev/www), always use same-origin /api
// so Vercel can proxy and we avoid CORS with separate api.* origins.
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
import { getWalletDeepLink, isMobileDevice } from './walletUtils';
import { useWallet as useAdapterWallet } from '@solana/wallet-adapter-react';
import { WsProvider, useWs } from './WsProvider';
import NewGameView from './NewGameView';
import { Leaderboard } from './Leaderboard';
import HowToPlayOverlay from './HowToPlayOverlay';
import {
  CrownSimple,
  Lightning,
  Diamond,
  WarningCircle,
  GameController,
  Trophy,
  Skull,
  LinkSimple,
  ArrowClockwise,
  House,
  CheckCircle,
  Atom,
  Question,
} from 'phosphor-react';
import './leaderboard.css';

type AppScreen = 'landing' | 'practice' | 'practice-solo' | 'modes' | 'wallet' | 'lobby' | 'game' | 'results';

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
  const [returnScreen, setReturnScreen] = useState<AppScreen>('landing'); // Track where to go back to
  const [solPrice, setSolPrice] = useState<number | null>(null);
  const { state: wsState, signAuthentication, leave } = useWs() as any;
  const [toast, setToast] = useState<string | null>(null);
  const showToast = (msg: string, duration = 2000) => {
    setToast(msg);
    window.setTimeout(() => setToast(null), duration);
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
      } catch { }
    };
    fetchSol();
    const id = setInterval(fetchSol, 30000);
    return () => clearInterval(id);
  }, []);

  const onPractice = () => setScreen('practice');
  const onTournament = () => setScreen('modes');
  const onWallet = () => {
    setReturnScreen(screen); // dynamically set return point
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
        if (screen === 'modes') setScreen('landing');
        else if (screen === 'practice') setScreen('landing');
        else if (screen === 'practice-solo') setScreen('practice');
        else if (screen === 'wallet') setScreen(returnScreen); // Use dynamic return
      }
    };
    window.addEventListener('popstate', preventBack);
    return () => window.removeEventListener('popstate', preventBack);
  }, [screen, returnScreen]);

  return (
    <div id="app-root" className="mobile-optimized">
      {/* Portrait-only orientation enforcement */}
      <OrientationWarning />

      {/* Mobile: Header Utilities - hide during gameplay */}
      {screen !== "game" && screen !== "practice" && (
        <>
          <HeaderWallet screen={screen} wsState={wsState} publicKey={publicKey} />
          <button
            className="mobile-help-btn"
            onClick={() => setShowHowTo(true)}
            title="How to play"
          >
            <Question size={20} weight="bold" />
          </button>
        </>
      )}

      {wsState.lastError && (
        <div className="loading-overlay mobile-overlay" style={{ display: "flex", background: "rgba(0,0,0,0.85)" }}>
          <div className="modal-card mobile-modal">
            <div
              className="modal-title"
              style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}
            >
              <WarningCircle size={20} weight="fill" />
              <span>Error</span>
            </div>
            <div className="modal-subtitle" style={{ marginTop: 8 }}>{wsState.lastError}</div>
            <button className="btn-primary mobile-btn-large" style={{ marginTop: 16 }} onClick={() => location.reload()}>
              Reload App
            </button>
          </div>
        </div>
      )}

      {(wsState.phase === 'connecting' || wsState.phase === 'authenticating' || wsState.entryFee.pending) && (
        <div className="loading-overlay mobile-overlay" style={{ display: 'flex' }}>
          <div className="loading-spinner mobile-spinner"></div>
          <div className="loading-text mobile-loading-text">{
            wsState.entryFee.pending ? 'Verifying entry fee transaction on Solana…'
              : wsState.phase === 'authenticating' ? 'Approve signature in your wallet to continue…'
                : 'Opening WebSocket connection…'
          }</div>
          <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.5)', marginTop: '8px', maxWidth: '280px', textAlign: 'center', padding: '0 16px' }}>
            {wsState.entryFee.pending
              ? 'Waiting for transaction confirmation (finalized commitment)'
              : wsState.phase === 'authenticating'
                ? 'Check your wallet app for the signature request'
                : 'Establishing secure connection to game server'
            }
          </div>
          <div className="mobile-progress-bar">
            <div className="mobile-progress-fill" style={{ width: `${loadProg}%` }}></div>
          </div>
          {wsState.phase === 'authenticating' && (
            <div className="mobile-action-buttons">
              <button className="btn-primary mobile-btn" onClick={() => signAuthentication?.()}>Request signature again</button>
              <button className="btn-secondary mobile-btn" onClick={() => { leave?.(); setScreen('landing'); }}>Cancel</button>
            </div>
          )}
        </div>
      )}

      {screen === 'landing' && (
        <Landing
          solPrice={solPrice}
          onPractice={onPractice}
          onTournament={onTournament}
          onWallet={onWallet}
          onLeaderboard={() => setShowLeaderboard(true)}
        />
      )}
      {screen === 'practice' && (
        <PracticeModeSelection
          onSelectSolo={() => setScreen('practice-solo')}
          onBack={() => setScreen('landing')}
          onNotify={showToast}
        />
      )}
      {screen === 'practice-solo' && (
        <PracticeFullTutorial onFinish={() => setScreen('results')} onBack={() => setScreen('practice')} />
      )}
      {screen === 'modes' && (
        <TournamentModesScreen
          onSelect={() => { setReturnScreen('modes'); setScreen('wallet'); }}
          onClose={() => setScreen('landing')}
          onNotify={showToast}
        />
      )}
      {screen === 'wallet' && (
        <Wallet onConnected={() => setScreen('lobby')} onClose={() => setScreen(returnScreen)} />
      )}
      {screen === 'lobby' && (
        <Lobby
          onStart={() => setScreen('game')}
          onBack={() => setScreen(wsState.lobby?.entryFee === 0 ? 'landing' : 'modes')}
          onRefund={() => setScreen(wsState.lobby?.entryFee === 0 ? 'landing' : 'modes')}
        />
      )}
      {screen === 'game' && (
        <Game onEnd={() => setScreen('results')} onRestart={() => setScreen('game')} />
      )}
      {screen === 'results' && (
        <Results onPlayAgain={() => setScreen('practice')} onChangeTier={() => setScreen('modes')} />
      )}

      {toast && (
        <div className="mobile-toast">
          {toast}
        </div>
      )}

      {showHowTo && (
        <HowToPlayOverlay
          mode="mobile"
          onClose={() => {
            setShowHowTo(false);
            try {
              localStorage.setItem('sr_howto_seen_v2', '1');
            } catch { }
          }}
        />
      )}

      {/* Leaderboard Modal */}
      {showLeaderboard && (
        <Leaderboard
          onClose={() => setShowLeaderboard(false)}
          apiBase={API_BASE}
          myWallet={publicKey || null}
          isMobile={true}
        />
      )}
    </div>
  );
}

function HeaderWallet({ screen, wsState, publicKey }: { screen: string; wsState: any; publicKey: any }) {
  const { disconnect } = useWallet() as any;

  if (!publicKey) return null;

  const short = `${publicKey.slice(0, 4)}…${publicKey.slice(-4)}`;

  return (
    <div 
      className="mobile-wallet-badge" 
      style={{ 
        border: "1px solid rgba(0, 245, 255, 0.3)",
        background: "linear-gradient(135deg, rgba(0, 245, 255, 0.1), rgba(0, 255, 136, 0.05))",
        boxShadow: "0 0 15px rgba(0, 245, 255, 0.1)",
        padding: "6px 12px",
        borderRadius: "12px",
        display: "flex",
        alignItems: "center",
        gap: "8px"
      }}
    >
      <span style={{ 
        fontSize: "10px", 
        fontWeight: 800, 
        letterSpacing: "0.05em",
        color: "#00f5ff",
        textTransform: "uppercase"
      }}>
        {short}
      </span>
      <button 
        style={{ 
          background: "rgba(255,255,255,0.1)", 
          border: "none", 
          color: "#fff", 
          width: "18px", 
          height: "18px", 
          borderRadius: "50%", 
          fontSize: "10px",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          cursor: "pointer"
        }} 
        onClick={() => disconnect?.()}
      >✕</button>
    </div>
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
      if (stored) return JSON.parse(stored) as { totalGames?: number; wins?: number; totalKills?: number };
    } catch { }
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
          width: '100%',
          maxWidth: 600,
          margin: '0 auto',
          height: '100dvh',
          // Top padding clears wallet badge, bottom padding handled by footer
          padding: '20px 24px 0',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center', // Center everything horizontally
          gap: 16,
          boxSizing: 'border-box',
        }}
      >
        <header style={{ textAlign: 'center', width: '100%' }}>
          <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'center' }}>
            <Atom
              size={56}
              weight="duotone"
              color="#00f5ff"
              style={{
                filter: 'drop-shadow(0 0 12px rgba(0, 245, 255, 0.6))',
              }}
            />
          </div>
          <div
            style={{
              fontFamily: 'Orbitron, system-ui, -apple-system, BlinkMacSystemFont, sans-serif',
              letterSpacing: '0.3em',
              fontSize: 10,
              textTransform: 'uppercase',
              color: '#00f5ff',
              marginBottom: 16,
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
              fontSize: 36,
              lineHeight: 1,
              textShadow: '0 0 30px rgba(0, 245, 255, 0.4), 0 0 60px rgba(0, 245, 255, 0.2)',
              margin: 0,
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
              marginTop: 14,
              fontSize: 11,
              letterSpacing: '0.12em',
              textTransform: 'uppercase',
              color: 'rgba(255,255,255,0.7)',
              margin: '14px 0 0',
            }}
          >
            SURVIVE. ELIMINATE. WIN CRYPTO.
          </p>
          <div
            style={{
              marginTop: 8,
              fontSize: 11,
              color: 'rgba(148,163,184,0.78)',
              fontFamily: 'JetBrains Mono, ui-monospace, SFMono-Regular, Menlo, monospace',
            }}
          >
            SOL: {solPrice != null ? `$${solPrice.toFixed(2)}` : '--.--'}
          </div>

          {totalGames > 0 && (
            <div
              style={{
                marginTop: 24,
                display: 'flex',
                justifyContent: 'center',
                width: '100%',
              }}
            >
              <div
                style={{
                  padding: '12px 16px',
                  borderRadius: 16,
                  background: 'rgba(15,23,42,0.6)',
                  border: '1px solid rgba(148,163,184,0.2)',
                  display: 'flex',
                  gap: 16,
                  minWidth: 0,
                  backdropFilter: 'blur(10px)',
                  boxShadow: '0 4px 20px rgba(0,0,0,0.2)',
                }}
              >
                <div className="mobile-stat">
                  <div className="label">Games</div>
                  <div className="value">{totalGames}</div>
                </div>
                <div className="mobile-stat">
                  <div className="label">Win%</div>
                  <div className="value">{winRate}%</div>
                </div>
                <div className="mobile-stat">
                  <div className="label">Kills</div>
                  <div className="value">{totalKills}</div>
                </div>
              </div>
            </div>
          )}
        </header>

        <main style={{ width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <section
            style={{
              marginTop: 10,
              display: 'flex', alignItems: 'center',
              flexDirection: 'column',
              gap: 12,
              width: '100%',
              maxWidth: 400, // Restrict max width for better aesthetic on tablets
            }}
          >
            <button
              type="button"
              className="mobile-cta-primary"
              onClick={() => onTournament?.()}
              style={{
                width: '100%',
                justifyContent: 'center',
              }}
            >
              <span className="icon">
                <Trophy size={18} weight="fill" />
              </span>
              <span>Enter Tournament</span>
            </button>

            <button
              type="button"
              className="mobile-btn-secondary"
              onClick={onPractice}
              style={{
                width: '100%',
                justifyContent: 'center',
              }}
            >
              <span className="icon">
                <GameController size={18} weight="fill" />
              </span>
              <span>Practice Mode (Free)</span>
            </button>
          </section>

          <div
            style={{
              marginTop: 16,
              fontSize: 10,
              textAlign: 'center',
              color: 'rgba(0, 245, 255, 0.6)',
              letterSpacing: '0.1em',
              fontWeight: 600,
            }}
          >
            TOURNAMENTS FROM $1 • WINNER TAKES ALL
          </div>
        </main>

        <footer
          style={{
            display: 'flex',
            justifyContent: 'center', // Center navigation buttons
            alignItems: 'center',
            marginTop: 20, // Bring closer to main content, avoid "too low" feeling
            paddingBottom: 'calc(40px + env(safe-area-inset-bottom, 0px))', // Safe area respect
            gap: 16,
            width: '100%',
            maxWidth: 400,
          }}
        >
          <button
            type="button"
            className="mobile-btn-secondary"
            style={{
              padding: '8px 16px',
              fontSize: 11,
              textTransform: 'uppercase',
              letterSpacing: '0.12em',
              flex: 1, // Distribute space evenly
              justifyContent: 'center'
            }}
            onClick={onPractice}
          >
            Practice
          </button>
          {onLeaderboard && (
            <button
              type="button"
              className="mobile-btn-secondary"
              style={{
                padding: '8px 16px',
                fontSize: 11,
                textTransform: 'uppercase',
                letterSpacing: '0.12em',
                flex: 1,
                justifyContent: 'center'
              }}
              onClick={onLeaderboard}
            >
              Leaders
            </button>
          )}
          <button
            type="button"
            className="mobile-btn-secondary"
            style={{
              padding: '8px 16px',
              fontSize: 11,
              textTransform: 'uppercase',
              letterSpacing: '0.12em',
              flex: 1,
              justifyContent: 'center'
            }}
            onClick={onWallet}
          >
            Wallet
          </button>
        </footer>
      </div>
    </div>
  );
}

function Practice({ onFinish: _onFinish, onBack }: { onFinish: () => void; onBack: () => void; }) {
  const [step, setStep] = useState<'lobby' | 'game'>('lobby');
  const [meId] = useState<string>('PLAYER_' + Math.random().toString(36).slice(2, 8));
  const [players, setPlayers] = useState<string[]>([]);
  const [showPracticeIntro, setShowPracticeIntro] = useState<boolean>(true); // Always show tutorial

  // Mobile control state (MUST be at top level, not inside conditionals!)
  const [gameCountdown, setGameCountdown] = useState<number>(6); // 6 seconds to account for game engine preStart

  const handleTouch = (x: number, y: number) => {
    const event = new CustomEvent('mobile-joystick', { detail: { x, y } });
    window.dispatchEvent(event);
  };

  const handleBoost = () => {
    console.log('[AppMobile] Boost button clicked, countdown:', gameCountdown);
    if ('vibrate' in navigator) navigator.vibrate(15);
    const event = new CustomEvent('mobile-boost');
    window.dispatchEvent(event);
  };

  useEffect(() => {
    if (step === 'lobby') {
      if (showPracticeIntro) return;
      setGameCountdown(3); // 3-second on-field countdown
      const base = [meId];
      const bots = Array.from({ length: 7 }, (_, i) => `BOT_${i.toString(36)}${Math.random().toString(36).slice(2, 4)}`);
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
      {showTutorial && <PracticeFullTutorial onDone={() => setShowTutorial(false)} />}
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
          
          onDone={() => {
            setShowPracticeIntro(false);

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
      display: 'flex',
      flexDirection: 'column',
      padding: '20px 16px',
      paddingTop: 'calc(20px + env(safe-area-inset-top, 0px))',
      paddingBottom: 'calc(40px + env(safe-area-inset-bottom, 0px))',
      overflowY: 'auto',
      WebkitOverflowScrolling: 'touch',
    }}>

      {/* Header */}
      <div style={{ textAlign: 'center', marginBottom: 20 }}>
        <div style={{
          fontSize: 10,
          letterSpacing: '0.3em',
          color: 'rgba(255,255,255,0.5)',
          marginBottom: 6,
        }}>
          CHOOSE YOUR BATTLE
        </div>
        <h1 style={{
          fontSize: 22,
          fontWeight: 900,
          color: '#fff',
          margin: 0,
          marginBottom: 6,
        }}>
          TOURNAMENT
        </h1>
        <p style={{
          fontSize: 13,
          color: 'rgba(0,245,255,0.8)',
          margin: 0,
          fontWeight: 600,
        }}>
          Win Real Crypto in 3 Minutes ⚡
        </p>
      </div>

      {/* Tier Cards - 2x2 Grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(2, 1fr)',
        gap: 10,
        marginBottom: 16
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
                padding: '12px 8px',
                borderRadius: 16,
                border: isActive ? '2px solid #00f5ff' : '1px solid rgba(255,255,255,0.1)',
                background: isActive
                  ? 'linear-gradient(135deg, rgba(0,245,255,0.2) 0%, rgba(0,200,255,0.08) 100%)'
                  : 'rgba(255,255,255,0.03)',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                boxShadow: isActive ? '0 0 30px rgba(0,245,255,0.4), inset 0 1px 0 rgba(255,255,255,0.1)' : 'none',
                opacity: preflightError ? 0.5 : 1,
                position: 'relative',
              }}
            >
              {/* Popular Badge */}
              {tier.popular && (
                <div style={{
                  position: 'absolute',
                  top: -6,
                  right: -6,
                  background: 'linear-gradient(135deg, #ff6b00, #ff8c00)',
                  color: '#fff',
                  fontSize: 8,
                  fontWeight: 800,
                  padding: '3px 8px',
                  borderRadius: 12,
                  textTransform: 'uppercase',
                  letterSpacing: '0.1em',
                  boxShadow: '0 2px 8px rgba(255,107,0,0.4)',
                }}>
                  🔥 HOT
                </div>
              )}

              {/* Entry Fee */}
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
                fontSize: 12,
                fontWeight: 700,
                color: isActive ? '#00f5ff' : 'rgba(255,255,255,0.7)',
                marginBottom: 6,
                letterSpacing: '0.08em'
              }}>
                {tier.name}
              </div>

              {/* Prize - Huge & Glowing */}
              <div style={{
                fontSize: 26,
                fontWeight: 900,
                color: isActive ? '#00ff88' : 'rgba(255,255,255,0.6)',
                textShadow: isActive ? '0 0 25px rgba(0,255,136,0.7)' : 'none',
                lineHeight: 1,
                marginBottom: 4,
              }}>
                ${tier.prize}
              </div>

              {/* ROI Badge */}
              <div style={{
                fontSize: 8,
                color: isActive ? '#00ff88' : 'rgba(255,255,255,0.4)',
                letterSpacing: '0.12em',
                fontWeight: 700,
                marginBottom: 6,
              }}>
                {roi}% ROI
              </div>

              {/* Description */}
              <div style={{
                fontSize: 9,
                color: 'rgba(255,255,255,0.5)',
                textAlign: 'center',
              }}>
                {tier.desc}
              </div>
            </button>
          );
        })}
      </div>

      {/* Selected Tier Details - Enhanced */}
      <div style={{
        background: 'linear-gradient(135deg, rgba(0,245,255,0.12) 0%, rgba(0,255,136,0.1) 100%)',
        borderRadius: 16,
        padding: '16px',
        marginBottom: 14,
        border: '1px solid rgba(0,245,255,0.3)',
        textAlign: 'center',
        boxShadow: '0 4px 20px rgba(0,245,255,0.15)',
      }}>
        <div style={{
          fontSize: 10,
          color: 'rgba(255,255,255,0.6)',
          letterSpacing: '0.2em',
          marginBottom: 8,
          textTransform: 'uppercase',
        }}>
          Turn ${selected.usd} into
        </div>
        <div style={{
          fontSize: 32,
          fontWeight: 900,
          color: '#00ff88',
          textShadow: '0 0 35px rgba(0,255,136,0.6)',
          lineHeight: 1,
          marginBottom: 8,
        }}>
          ${selected.prize}
        </div>
        <div style={{
          fontSize: 11,
          color: '#00f5ff',
          fontWeight: 700,
          letterSpacing: '0.05em',
        }}>
          Winner Takes 85% • Instant Payout
        </div>
      </div>


      {/* Action Buttons */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <button
          onClick={handleJoin}
          disabled={isDisabled}
          style={{
            width: '100%',
            padding: '14px',
            borderRadius: 14,
            border: 'none',
            background: isDisabled
              ? 'rgba(255,255,255,0.1)'
              : 'linear-gradient(135deg, #00f5ff 0%, #00ff88 100%)',
            color: isDisabled ? 'rgba(255,255,255,0.4)' : '#000',
            fontSize: 16,
            fontWeight: 900,
            letterSpacing: '0.05em',
            cursor: isDisabled ? 'not-allowed' : 'pointer',
            boxShadow: isDisabled ? 'none' : '0 0 40px rgba(0,245,255,0.5), 0 4px 20px rgba(0,0,0,0.3)',
            transition: 'all 0.2s ease',
            textTransform: 'uppercase',
          }}
        >
          {isJoining ? '⏳ JOINING...' : preflightError ? '❌ UNAVAILABLE' : '🚀 JOIN TOURNAMENT NOW'}
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
            fontSize: 13,
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          ← BACK
        </button>
      </div>

      {preflightError && (
        <div style={{
          textAlign: 'center',
          marginTop: 12,
          fontSize: 11,
          color: 'rgba(255,100,100,0.9)',
          fontWeight: 600,
        }}>
          ⚠️ Tournaments temporarily unavailable
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
            Connected: {publicKey.slice(0, 8)}...{publicKey.slice(-8)}
          </div>
        )}

        {/* WalletConnect fallback deep-links on mobile */}
        {isMobileDevice() && wcError && (
          <div style={{ marginTop: 12, padding: 12, borderRadius: 12, background: 'rgba(0,0,0,0.55)', border: '1px solid rgba(255,255,255,0.12)', color: '#c7d2de', fontSize: 13 }}>
            <div style={{ marginBottom: 8 }}>{wcError}</div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {['phantom', 'solflare', 'backpack'].map(name => {
                const link = getWalletDeepLink(name);
                if (!link) return null;
                return <a key={name} href={link} style={{ padding: '8px 10px', borderRadius: 8, background: 'rgba(34,211,238,0.15)', color: '#22d3ee', textDecoration: 'none', border: '1px solid rgba(34,211,238,0.35)' }}>{name.charAt(0).toUpperCase() + name.slice(1)}</a>;
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
  const [showTutorial, setShowTutorial] = useState(false);
  const players = state.lobby?.players || [];
  const realPlayers = players.filter(p => !String(p).startsWith('BOT_'));
  const estimatedPrizeUsd = state.lobby ? Math.max(0, Math.floor(realPlayers.length * (state.lobby.entryFee as number) * 0.85)) : 0;

  useEffect(() => {
    if (state.lobby?.entryFee === 0) setShowTutorial(true);
  }, []);

  useEffect(() => {
    const refunded = (state as any).refundReceived;
    if (refunded && !state.lobby && onRefund) onRefund();
  }, [(state as any).refundReceived, state.lobby, onRefund]);

  const refundCountdown = (state.lobby as any)?.refundCountdown;
  const isSolo = players.length === 1;
  const isRefunding = refundCountdown !== undefined && refundCountdown <= 1;

  return (
    <div className="screen active mobile-lobby-screen" style={{ 
      background: "#030712",
      display: "flex",
      flexDirection: "column",
      padding: "20px 16px",
      paddingTop: "calc(20px + env(safe-area-inset-top, 0px))",
      height: "100dvh",
      boxSizing: "border-box",
      overflow: "hidden"
    }}>
      {showTutorial && <PracticeFullTutorial onDone={() => setShowTutorial(false)} />}
      
      <header style={{ textAlign: "center", marginBottom: "20px" }}>
        <div style={{ marginBottom: 12, display: "flex", justifyContent: "center" }}>
          <Atom size={32} weight="duotone" color="#00f5ff" />
        </div>
        <h1 style={{ fontSize: 24, fontWeight: 900, color: "#fff", margin: 0, fontFamily: "Orbitron, sans-serif" }}>
          LOBBY
        </h1>
      </header>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px", marginBottom: "16px" }}>
        <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "12px", padding: "12px", textAlign: "center" }}>
          <div style={{ fontSize: 9, color: "rgba(255,255,255,0.4)", textTransform: "uppercase" }}>Pilots</div>
          <div style={{ fontSize: 18, fontWeight: 800, color: "#00f5ff" }}>{players.length} / {state.lobby?.maxPlayers ?? 32}</div>
        </div>
        <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "12px", padding: "12px", textAlign: "center" }}>
          <div style={{ fontSize: 9, color: "rgba(255,255,255,0.4)", textTransform: "uppercase" }}>Prize</div>
          <div style={{ fontSize: 18, fontWeight: 800, color: "#00ff88" }}>${estimatedPrizeUsd}</div>
        </div>
      </div>

      <div style={{
        display: "flex",
        flexWrap: "wrap",
        gap: "6px",
        justifyContent: "center",
        marginBottom: "24px",
        maxHeight: "100px",
        overflowY: "auto",
        padding: "8px"
      }}>
        {players.map((pid: string) => {
          const name = state.lobby?.playerNames?.[pid] || (pid.startsWith("guest-") ? "Guest" : pid.slice(0, 4) + "…" + pid.slice(-4));
          const isMe = pid === state.playerId;
          return (
            <div key={pid} style={{
              fontSize: "10px",
              padding: "4px 10px",
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

      <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
        {state.countdown ? (
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: "12px", fontWeight: 800, color: "#00f5ff", letterSpacing: "0.2em" }}>STARTING IN</div>
            <div style={{ fontSize: "84px", fontWeight: 900, color: "#fff", fontFamily: "Orbitron, sans-serif" }}>
              {state.countdown.remaining}
            </div>
          </div>
        ) : (
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: "12px", color: "rgba(255,255,255,0.5)", fontWeight: 700 }}>
              {isRefunding ? "REFUNDING..." : "WAITING FOR RIVALS..."}
            </div>
          </div>
        )}
      </div>

      <footer style={{ marginTop: "auto", paddingBottom: "20px" }}>
        <button 
          className="mobile-btn-back" 
          onClick={onBack}
          style={{ width: "100%", background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "12px", padding: "14px" }}
        >
          ← ABORT MISSION
        </button>
      </footer>
    </div>
  );
}

import { GameEffects } from './GameEffects'; // Import type for ref if needed, though NewGameView handles instantiation

// ... inside Game component ...

function Game({ onEnd, onRestart }: { onEnd: () => void; onRestart: () => void; }) {
  const [gameCountdown, setGameCountdown] = useState<number>(6); // 6 seconds to match game engine preStart
  const { state } = useWs();
  const meId = state.playerId;

  // Effect to listen for high-impact events from server state and trigger haptics via GameEffects
  // Note: Since GameEffects is inside NewGameView (pixi context), we can't easily call its methods directly here.
  // BUT, NewGameView is responsible for rendering. 
  // Actually, GameEffects is instantiated inside NewGameView. 
  // Let's dispatch a custom event that GameEffects (inside NewGameView) can listen to, OR
  // simpler: handle haptics right here if we want, but GameEffects has the visual context.

  // Better approach: NewGameView already instantiates GameEffects. We should let NewGameView handle
  // the "business logic to visual/haptic" bridge.
  // However, for *global* haptics like impacts, we can add a listener here if needed,
  // but NewGameView is the authority on the game loop.

  // Let's stick to passing props/callbacks if we need to bridge, but `NewGameView` 
  // is likely where the update loop is. Let's check NewGameView...
  // NewGameView receives `wsState`. It can detect collisions/kills and trigger GameEffects.

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
    if ('vibrate' in navigator) navigator.vibrate(15);
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
      if (myRank) rankText = `#${myRank}`;
    }
  } catch { }

  return (
    <div className="screen active mobile-results-screen">
      <div className="mobile-results-container">
        <div className="mobile-result-header">
          <h1 className={`mobile-result-title ${isWinner ? 'win' : 'lose'}`}>
            {isWinner ? (
              <>
                <Trophy size={22} weight="fill" style={{ marginRight: 6 }} />
                Victory!
              </>
            ) : (
              <>
                <Skull size={22} weight="fill" style={{ marginRight: 6 }} />
                Eliminated
              </>
            )}
          </h1>
          <p className="mobile-result-subtitle">
            Winner: {winner ? `${winner.slice(0, 4)}…${winner.slice(-4)}` : '—'}
          </p>
          {typeof prize === 'number' && (
            <div className="mobile-prize-won">{prize.toFixed(4)} SOL</div>
          )}
        </div>

        {solscan && (
          <a href={solscan} target="_blank" rel="noreferrer" className="mobile-solscan-btn">
            <LinkSimple size={16} weight="bold" style={{ marginRight: 6 }} />
            View on Solscan
          </a>
        )}

        <div className="mobile-result-stats">
          {rankText && <div className="stat">Rank: {rankText}</div>}
          <div className="stat">Kills: {wsState.kills?.[selfId] || 0}</div>
        </div>

        <div className="mobile-result-actions">
          <button className="mobile-btn-primary" onClick={onPlayAgain}>
            <ArrowClockwise size={18} weight="bold" style={{ marginRight: 6 }} />
            Play Again
          </button>
          <button className="mobile-btn-secondary" onClick={onChangeTier}>
            <House size={18} weight="fill" style={{ marginRight: 6 }} />
            Menu
          </button>
        </div>
      </div>
    </div>
  );
}

