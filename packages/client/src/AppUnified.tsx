import { useEffect, useState, lazy, Suspense } from 'react';
import { WalletProvider, useWallet } from './WalletProvider';
import { WsProvider, useWs } from './WsProvider';
import { isMobileDevice } from './deviceDetection';
import { OrientationWarning } from './OrientationWarning';

// Shared components
import { ConnectionOverlay } from './components/ConnectionOverlay';
import { Toast } from './components/Toast';
import { HeaderWallet } from './components/HeaderWallet';
import { Landing } from './components/screens/Landing';
import { Practice } from './components/screens/Practice';
import { Results } from './components/screens/Results';
import { LoadingSpinner } from './components/LoadingSpinner';
import { Modes } from './components/Modes';

// Lazy loaded components
const Leaderboard = lazy(() => import('./Leaderboard').then(m => ({ default: m.Leaderboard })));
const HowToPlayOverlay = lazy(() => import('./HowToPlayOverlay'));
const NewGameView = lazy(() => import('./NewGameView'));

// API Base URL
const API_BASE: string = (() => {
  try {
    const host = (window?.location?.hostname || '').toLowerCase();
    if (host.endsWith('spermrace.io')) return '/api';
  } catch {}
  const env = (import.meta as any).env?.VITE_API_BASE as string | undefined;
  if (env && typeof env === 'string' && env.trim()) return env.trim();
  return '/api';
})();

type AppScreen = 'landing' | 'practice' | 'modes' | 'wallet' | 'lobby' | 'game' | 'results';

export default function AppUnified() {
  return (
    <WalletProvider>
      <WsProvider>
        <AppInner />
      </WsProvider>
    </WalletProvider>
  );
}

function AppInner() {
  const isMobile = isMobileDevice();
  const [screen, setScreen] = useState<AppScreen>('landing');
  const [practiceReplay, setPracticeReplay] = useState(false);
  const [solPrice, setSolPrice] = useState<number | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [showLeaderboard, setShowLeaderboard] = useState(false);
  const [showHowTo, setShowHowTo] = useState(false);
  const [loadProg, setLoadProg] = useState(0);
  
  const { state: wsState, signAuthentication, leave } = useWs() as any;
  const { publicKey } = useWallet() as any;
  
  const showToast = (msg: string, duration = 2000) => {
    setToast(msg);
    setTimeout(() => setToast(null), duration);
  };
  
  // Loading progress animation
  const overlayActive = wsState.phase === 'connecting' || wsState.phase === 'authenticating' || wsState.entryFee?.pending;
  useEffect(() => {
    let id: any;
    if (overlayActive) {
      setLoadProg(0);
      id = setInterval(() => setLoadProg(p => (p >= 100 ? 0 : p + 2)), 120);
    } else {
      setLoadProg(0);
    }
    return () => { if (id) clearInterval(id); };
  }, [overlayActive]);
  
  // Background animation (landing only)
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
  
  // SOL price fetch
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
  
  // Wallet error handling
  useEffect(() => {
    const onWalletError = (e: any) => {
      const msg = e?.detail?.userMessage || e?.detail?.error?.message || 'Wallet error';
      showToast(msg, 2600);
    };
    window.addEventListener('wallet-error', onWalletError as any);
    return () => window.removeEventListener('wallet-error', onWalletError as any);
  }, []);
  
  // WS state sync
  useEffect(() => {
    if (wsState.phase === 'lobby') setScreen('lobby');
    else if (wsState.phase === 'game') setScreen('game');
  }, [wsState.phase]);
  
  // Keyboard shortcuts
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (screen === 'modes') setScreen('landing');
        else if (screen === 'practice') setScreen('landing');
        else if (screen === 'wallet') setScreen('modes');
      }
      if (e.key === 'p' && screen === 'landing') handlePractice();
      if (e.key === 't' && screen === 'landing') setScreen('modes');
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [screen]);
  
  // Mobile back button handling
  useEffect(() => {
    if (!isMobile) return;
    const preventBack = (e: PopStateEvent) => {
      if (screen !== 'landing') {
        e.preventDefault();
        if (screen === 'modes') setScreen('landing');
        else if (screen === 'practice') setScreen('landing');
        else if (screen === 'wallet') setScreen('modes');
      }
    };
    window.addEventListener('popstate', preventBack);
    return () => window.removeEventListener('popstate', preventBack);
  }, [screen, isMobile]);

  const handlePractice = () => {
    setPracticeReplay(false);
    setScreen('practice');
  };
  
  const handlePlayAgain = () => {
    setPracticeReplay(true);
    setScreen('practice');
  };

  const statusText = (() => {
    if (wsState.phase === 'authenticating') return 'Authenticating…';
    if (wsState.phase === 'lobby') return 'Lobby';
    if (wsState.phase === 'game') return 'In Game';
    if (wsState.phase === 'connecting') return 'Connecting…';
    return publicKey ? 'Connected' : 'Not Connected';
  })();

  return (
    <div id="app-root" className={isMobile ? 'mobile-optimized' : 'pc-optimized'}>
      {isMobile && <OrientationWarning />}
      
      <HeaderWallet
        screen={screen}
        status={statusText}
        solPrice={solPrice}
        onPractice={handlePractice}
        onTournament={() => setScreen('modes')}
        onLeaderboard={() => setShowLeaderboard(true)}
        onShowHowTo={() => setShowHowTo(true)}
      />
      
      <div id="bg-particles" />
      
      <ConnectionOverlay
        wsState={wsState}
        publicKey={publicKey}
        loadProg={loadProg}
        signAuthentication={signAuthentication}
        leave={leave}
        onBack={() => setScreen('landing')}
        variant={isMobile ? 'mobile' : 'default'}
      />
      
      {screen === 'landing' && (
        <Landing
          solPrice={solPrice}
          onPractice={handlePractice}
          onTournament={() => setScreen('modes')}
          onWallet={() => setScreen('wallet')}
          onLeaderboard={() => setShowLeaderboard(true)}
        />
      )}
      
      {screen === 'practice' && (
        <Suspense fallback={<LoadingSpinner message="Loading Practice..." size="large" />}>
          <Practice
            onFinish={() => setScreen('results')}
            onBack={() => setScreen('landing')}
            skipLobby={practiceReplay}
          />
        </Suspense>
      )}
      
      {screen === 'modes' && (
        <div className="screen active" style={{ padding: isMobile ? '80px 16px 100px' : '100px 40px' }}>
          <div style={{ maxWidth: 960, margin: '0 auto' }}>
            <h2 style={{ 
              textAlign: 'center', 
              fontSize: isMobile ? 24 : 32,
              fontWeight: 800,
              marginBottom: 24,
              color: '#fff'
            }}>
              Select Tournament
            </h2>
            <Modes />
            <div style={{ marginTop: 24, textAlign: 'center' }}>
              <button className="btn-secondary" onClick={() => setScreen('landing')}>
                Back
              </button>
            </div>
          </div>
        </div>
      )}
      
      {screen === 'wallet' && (
        <Wallet 
          onConnected={() => setScreen('lobby')} 
          onClose={() => setScreen('modes')} 
        />
      )}
      
      {screen === 'lobby' && (
        <Lobby 
          onStart={() => setScreen('game')} 
          onBack={() => setScreen('modes')} 
        />
      )}
      
      {screen === 'game' && (
        <Suspense fallback={<LoadingSpinner message="Loading Game..." size="large" />}>
          <Game onEnd={() => setScreen('results')} onRestart={() => setScreen('game')} />
        </Suspense>
      )}
      
      {screen === 'results' && (
        <Results onPlayAgain={handlePlayAgain} onChangeTier={() => setScreen('landing')} />
      )}
      
      <Toast message={toast} variant={isMobile ? 'mobile' : 'default'} />
      
      {showLeaderboard && (
        <Suspense fallback={<LoadingSpinner message="Loading..." size="large" />}>
          <Leaderboard
            onClose={() => setShowLeaderboard(false)}
            apiBase={API_BASE}
            myWallet={publicKey || null}
            isMobile={isMobile}
          />
        </Suspense>
      )}
      
      {showHowTo && (
        <Suspense fallback={null}>
          <HowToPlayOverlay onClose={() => setShowHowTo(false)} mode={isMobile ? 'mobile' : 'pc'} />
        </Suspense>
      )}
    </div>
  );
}

// Wallet component (simple, same for both platforms)
function Wallet({ onConnected, onClose }: { onConnected: () => void; onClose: () => void }) {
  const { connect, publicKey } = useWallet() as any;
  const isMobile = isMobileDevice();
  
  const tryConnect = async () => {
    if (await connect()) onConnected();
  };
  
  return (
    <div className="screen active" id="wallet-screen">
      <div className="modal-container" style={{ padding: isMobile ? '20px 16px' : undefined }}>
        <div className="modal-header">
          <h2 className="modal-title">Connect Wallet</h2>
          <p className="modal-subtitle">Sign in with Solana to continue</p>
        </div>
        <div className="wallet-connect-section">
          <button className="wallet-connect-btn" onClick={tryConnect}>
            <div className="wallet-text">
              <div className="wallet-title">Connect Wallet</div>
              <div className="wallet-subtitle">Phantom / Solflare / Coinbase</div>
            </div>
          </button>
          {publicKey && (
            <div className="practice-hint">Connected: {publicKey.slice(0,4)}…{publicKey.slice(-4)}</div>
          )}
        </div>
        <button className="btn-secondary" onClick={onClose}>Back</button>
      </div>
    </div>
  );
}

// Lobby component
function Lobby({ onStart: _onStart, onBack }: { onStart: () => void; onBack: () => void }) {
  const { state } = useWs() as any;
  const isMobile = isMobileDevice();
  const players = state.lobby?.players || [];
  const realPlayers = players.filter((p: string) => !String(p).startsWith('BOT_'));
  const estimatedPrizeUsd = state.lobby ? Math.max(0, Math.floor(realPlayers.length * (state.lobby.entryFee as number) * 0.85)) : 0;
  
  return (
    <div className={`screen active ${isMobile ? 'mobile-lobby-screen' : ''}`} id="lobby-screen">
      <div className={isMobile ? 'mobile-lobby-container' : 'lobby-container'}>
        <div className={isMobile ? 'mobile-lobby-header' : 'lobby-header'}>
          <div className={isMobile ? 'mobile-lobby-title' : 'lobby-title'}>Lobby</div>
          <div className={isMobile ? 'mobile-lobby-count' : 'lobby-status'}>{players.length}/{state.lobby?.maxPlayers ?? 16}</div>
        </div>
        {state.lobby && (
          <div className="lobby-prize" style={{ margin: '8px 0 12px 0', opacity: 0.9, textAlign: 'center' }}>
            <span>Estimated Prize:</span> <strong>${estimatedPrizeUsd}</strong> <span style={{ opacity: 0.75 }}>(85% of entries)</span>
          </div>
        )}
        <div className="queue-bar">
          <div className="queue-left"><span className="queue-dot" /><span>{players.length}</span></div>
          <div className="queue-center"><span>Queued</span></div>
          <div className="queue-right"><span>Target</span><span>{state.lobby?.maxPlayers ?? 16}</span></div>
        </div>
        <div className={isMobile ? 'mobile-lobby-orbit' : 'lobby-orbit'}>
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
        <div className={isMobile ? 'mobile-lobby-footer' : 'lobby-footer'}>
          <button className={isMobile ? 'mobile-btn-back' : 'btn-secondary'} onClick={onBack}>
            {isMobile ? '← Back' : 'Back'}
          </button>
        </div>
      </div>
    </div>
  );
}

// Game component
function Game({ onEnd, onRestart }: { onEnd: () => void; onRestart: () => void }) {
  const isMobile = isMobileDevice();
  
  return (
    <div className="screen active" style={{ padding: 0 }}>
      <Suspense fallback={<LoadingSpinner message="Loading Game..." size="large" />}>
        <NewGameView onReplay={onRestart} onExit={onEnd} />
      </Suspense>
      {isMobile && <MobileTouchControlsWrapper />}
    </div>
  );
}

// Mobile touch controls wrapper
function MobileTouchControlsWrapper() {
  const [MobileTouchControls, setMobileTouchControls] = useState<any>(null);
  
  useEffect(() => {
    import('./MobileTouchControls').then(m => setMobileTouchControls(() => m.MobileTouchControls));
  }, []);
  
  const handleTouch = (x: number, y: number) => {
    window.dispatchEvent(new CustomEvent('mobile-joystick', { detail: { x, y } }));
  };
  
  const handleBoost = () => {
    window.dispatchEvent(new CustomEvent('mobile-boost'));
  };
  
  if (!MobileTouchControls) return null;
  
  return (
    <MobileTouchControls 
      onTouch={handleTouch}
      onBoost={handleBoost}
      canBoost={true}
      boostCooldownPct={1}
    />
  );
}
