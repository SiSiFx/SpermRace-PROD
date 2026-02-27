/**
 * Mobile App - Premium Dark Casino Design
 * Stake.com/Limbo aesthetic with glass morphism and smooth animations
 */

import { useEffect, useState, memo, lazy, Suspense } from 'react';
import { OrientationWarning } from './OrientationWarning';
import MobileTutorial from './MobileTutorial';
import { GameViewWrapper } from './components/GameViewWrapper';
import { fetchWithRetry } from './network/fetchWithTimeoutAndRetry';

// Premium UI components
import { PremiumLandingScreen } from './components/screens/premium/PremiumLandingScreen';
import { PremiumLobbyScreen } from './components/screens/premium/PremiumLobbyScreen';
import { PremiumResultsScreen } from './components/screens/premium/PremiumResultsScreen';

// Premium theme
import './styles/premium-theme.css';

// Legacy imports for wallet, tutorial
import './components/WalletScreen.css';
import './mobile-tutorial.css';

// Lazy load heavy components
const Leaderboard = lazy(() => import('./Leaderboard').then(m => ({ default: m.Leaderboard })));
const HowToPlayOverlay = lazy(() => import('./HowToPlayOverlay').then(m => ({ default: m.default })));
const WalletScreen = lazy(() => import('./components/WalletScreen').then(m => ({ default: m.WalletScreen })));

// Loading fallback component for Suspense
function LoadingFallback() {
  return (
    <div className="mobile-bio-overlay" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div className="mobile-bio-loading-text">Loading…</div>
    </div>
  );
}

const PRACTICE_TUTORIAL_SEEN_KEY = 'sr_practice_full_tuto_seen';

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

import { WalletProvider, useWallet } from './WalletProvider';
import { WsProvider, useWs } from './WsProvider';
import { PracticeModeSelection } from './PracticeModeSelection';
import {
  WarningCircle,
  Question,
  Trophy,
} from 'phosphor-react';
import './leaderboard.css';

type AppScreen = 'welcome' | 'landing' | 'practice' | 'practice-solo' | 'modes' | 'wallet' | 'lobby' | 'game' | 'results';

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
  const [returnScreen, setReturnScreen] = useState<AppScreen>('landing');
  const [solPrice, setSolPrice] = useState<number | null>(null);
  const [pendingEntryFee, setPendingEntryFee] = useState<number | undefined>(undefined);
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
  const [loadProg, setLoadProg] = useState<number>(0);
  const overlayActive = (wsState.phase === 'connecting' || wsState.phase === 'authenticating' || wsState.entryFee.pending);

  useEffect(() => {
    try {
      const qs = new URLSearchParams(window.location.search);
      if (qs.get('practice') === '1') {
        // Direct-link into gameplay: skip the practice tutorial/lobby scaffolding.
        try {
          localStorage.setItem(PRACTICE_TUTORIAL_SEEN_KEY, '1');
        } catch { }
        setScreen('practice-solo');
      }
    } catch { }
  }, []);

  useEffect(() => {
    let id: any;
    if (overlayActive) {
      setLoadProg(0);
      id = setInterval(() => { setLoadProg(p => (p >= 100 ? 0 : p + 2)); }, 120);
    } else {
      setLoadProg(0);
    }
    return () => { if (id) clearInterval(id); };
  }, [overlayActive]);

  useEffect(() => {
    const fetchSol = async () => {
      try {
        const result = await fetchWithRetry<{ usd: number }>(`${API_BASE}/sol-price`, {
          timeout: 5000,
          maxRetries: 2,
        });
        setSolPrice(Number(result.data.usd) || null);
      } catch { }
    };
    fetchSol();
    const id = setInterval(fetchSol, 30000);
    return () => clearInterval(id);
  }, []);

  const onPractice = () => setScreen('practice-solo');
  const onTournament = () => setScreen('landing');
  const onWallet = (entryFee?: number) => {
    setPendingEntryFee(entryFee);
    setReturnScreen(screen);
    setScreen('wallet');
  };

  useEffect(() => {
    if (wsState.phase === 'lobby') setScreen('lobby');
    else if (wsState.phase === 'game') setScreen('game');
    else if (wsState.phase === 'ended') setScreen('results');
  }, [wsState.phase]);

  useEffect(() => {
    const onWalletError = (e: any) => {
      const msg = e?.detail?.userMessage || e?.detail?.error?.message || 'Wallet error';
      showToast(msg, 2600);
    };
    window.addEventListener('wallet-error', onWalletError as any);
    return () => window.removeEventListener('wallet-error', onWalletError as any);
  }, []);

  useEffect(() => {
    const preventBack = (e: PopStateEvent) => {
      if (screen !== 'landing') {
        e.preventDefault();
        if (screen === 'modes') setScreen('landing');
        else if (screen === 'practice') setScreen('landing');
        else if (screen === 'practice-solo') setScreen('landing');
        else if (screen === 'wallet') setScreen(returnScreen);
      }
    };
    window.addEventListener('popstate', preventBack);
    return () => window.removeEventListener('popstate', preventBack);
  }, [screen, returnScreen]);

  return (
    <div id="app-root" className="mobile-optimized">
      <style>{`
        /* Neon-Biological styles are in mobile-neon.css */
      `}</style>
      <OrientationWarning />
      {screen !== "game" && screen !== "practice" && screen !== "practice-solo" && screen !== "welcome" && (
        <>
          {screen !== "landing" && <HeaderWallet screen={screen} wsState={wsState} publicKey={publicKey} />}
          <button className="mobile-bio-help" onClick={() => setShowHowTo(true)} aria-label="How to play">
            <Question size={20} weight="bold" aria-hidden="true" />
          </button>
        </>
      )}

      {wsState.lastError && (
        <div className="mobile-bio-overlay">
          <div style={{ background: 'var(--bio-glass-bg-strong)', border: '2px solid var(--bio-magenta)', padding: '30px', borderRadius: 'var(--bio-radius-lg)', boxShadow: '0 0 40px rgba(255, 0, 255, 0.3), 0 10px 40px rgba(0, 0, 0, 0.5)', maxWidth: '320px', textAlign: 'center', backdropFilter: 'var(--bio-glass-blur)' }}>
            <WarningCircle size={32} weight="fill" style={{ color: 'var(--bio-magenta)', marginBottom: 16 }} />
            <div style={{ fontSize: 14, fontWeight: 900, textTransform: 'uppercase', marginBottom: 20, color: 'var(--bio-white)' }}>Error</div>
            <div style={{ fontSize: 14, color: 'var(--bio-white-dim)', marginBottom: 20 }}>{wsState.lastError}</div>
            <button className="mobile-bio-btn mobile-bio-btn-primary" onClick={() => location.reload()}>Reload</button>
          </div>
        </div>
      )}

      {overlayActive && (
        <div className="mobile-bio-overlay">
          <div className="mobile-bio-loading-text">
            {wsState.entryFee.pending ? 'Verifying entry fee on Solana…'
              : wsState.phase === 'authenticating' ? 'Approve in wallet…'
                : 'Connecting…'}
          </div>
          <div className="mobile-bio-progress-bar">
            <div className="mobile-bio-progress-fill" style={{ width: `${loadProg}%` }}></div>
          </div>
          {wsState.phase === 'authenticating' && (
            <div>
              <button className="mobile-bio-btn mobile-bio-btn-primary" onClick={() => signAuthentication?.()}>Request Again</button>
              <button className="mobile-bio-btn mobile-bio-btn-secondary" onClick={() => { leave?.(); setScreen('landing'); }}>Cancel</button>
            </div>
          )}
        </div>
      )}

      {(screen === 'welcome' || screen === 'landing') && <PremiumLandingScreen solPrice={solPrice} onPractice={onPractice} onWallet={onWallet} onLeaderboard={() => setShowLeaderboard(true)} />}
      {screen === 'practice' && <PracticeModeSelection onSelectSolo={() => setScreen('practice-solo')} onBack={() => setScreen('landing')} onNotify={showToast} />}
      {screen === 'practice-solo' && <Practice onFinish={() => setScreen('results')} onBack={() => setScreen('landing')} />}
      {screen === 'modes' && <TournamentModesScreen onSelect={() => { setReturnScreen('modes'); setScreen('wallet'); }} onClose={() => setScreen('landing')} onNotify={showToast} solPrice={solPrice} />}
      {screen === 'wallet' && (
        <Suspense fallback={<LoadingFallback />}>
          <WalletScreen entryFee={pendingEntryFee} onConnected={() => setScreen('lobby')} onClose={() => setScreen(returnScreen)} />
        </Suspense>
      )}
      {screen === 'lobby' && <PremiumLobbyScreen onStart={() => setScreen('game')} onBack={() => setScreen('landing')} />}
      {screen === 'game' && <Game onEnd={() => setScreen('results')} onRestart={() => setScreen('game')} />}
      {screen === 'results' && (
        <PremiumResultsScreen
          onPlayAgain={() => setScreen('practice-solo')}
          onChangeTier={() => setScreen('landing')}
          onMultiplayer={() => setScreen('practice')}
        />
      )}

      {toast && <div className="mobile-bio-toast">{toast}</div>}
      {showHowTo && (
        <Suspense fallback={<LoadingFallback />}>
          <HowToPlayOverlay mode="mobile" onClose={() => setShowHowTo(false)} />
        </Suspense>
      )}
      {showLeaderboard && (
        <Suspense fallback={<LoadingFallback />}>
          <Leaderboard onClose={() => setShowLeaderboard(false)} apiBase={API_BASE} myWallet={publicKey || null} isMobile={true} />
        </Suspense>
      )}
    </div>
  );
}

const HeaderWallet = memo(function HeaderWallet({ screen, wsState, publicKey }: { screen: string; wsState: any; publicKey: any }) {
  const { disconnect } = useWallet() as any;
  if (!publicKey || typeof publicKey !== 'string' || publicKey.length < 8) return null;
  const short = `${publicKey.slice(0, 4)}…${publicKey.slice(-4)}`;
  return (
    <div className="mobile-bio-wallet-badge">
      <span className="mobile-bio-wallet-text">{short}</span>
      <button className="mobile-bio-wallet-close" onClick={() => disconnect?.()} aria-label="Disconnect wallet">×</button>
    </div>
  );
}, (prevProps, nextProps) => {
  return prevProps.publicKey === nextProps.publicKey;
});

const TournamentModesScreen = memo(function TournamentModesScreen({ onSelect, onClose, onNotify, solPrice }: { onSelect: () => void; onClose: () => void; onNotify: (msg: string) => void; solPrice: number | null }) {
  const { publicKey, connect } = useWallet();
  const { connectAndJoin, state: wsState } = useWs();
  const [preflight, setPreflight] = useState<{ address: string | null; sol: number | null; configured: boolean } | null>(null);
  const [preflightError, setPreflightError] = useState<boolean>(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const tiers = [
    { name: 'CHALLENGER', usd: 1, max: 16, prize: 10, popular: true, desc: 'Perfect for beginners' },
    { name: 'COMPETITOR', usd: 5, max: 32, prize: 50, popular: false, desc: 'Most competitive' },
    { name: 'CONTENDER', usd: 25, max: 32, prize: 250, popular: false, desc: 'High stakes action' },
    { name: 'CHAMPION', usd: 100, max: 16, prize: 1000, popular: false, desc: 'Ultimate challenge' },
  ];
  const selected = tiers[selectedIndex];
  const isDisabled = preflightError || wsState.phase === 'connecting' || wsState.phase === 'authenticating';

  useEffect(() => {
    (async () => {
      try {
        const result = await fetchWithRetry<{ address: string | null; sol: number | null; configured: boolean }>(`${API_BASE}/prize-preflight`, {
          timeout: 5000,
          maxRetries: 2,
        });
        setPreflight(result.data);
        setPreflightError(!result.data?.configured || !result.data?.address || result.data?.sol == null);
      } catch {
        setPreflightError(true);
      }
    })();
  }, []);

  return (
    <div className="mobile-bio-landing">
      <Trophy size={48} weight="fill" style={{ color: 'var(--bio-lime)', margin: '0 auto 20px', filter: 'drop-shadow(0 0 15px var(--bio-lime-dim))' }} />
      <h1 className="mobile-bio-title">Tournament</h1>
      <p className="mobile-bio-subtitle">Win prizes in 3-minute matches</p>

      {!preflightError && preflight && (
        <div style={{ padding: '12px', background: 'rgba(0, 247, 255, 0.1)', border: '1px solid var(--bio-cyan)', borderRadius: 'var(--bio-radius-lg)', marginBottom: 20, textAlign: 'center', fontSize: 12, fontWeight: 700, textTransform: 'uppercase', boxShadow: '0 0 20px rgba(0, 247, 255, 0.2)' }}>
          <div style={{ color: 'var(--bio-cyan)', textShadow: '0 0 10px var(--bio-cyan-dim)' }}>Wallet: {preflight.address ? `${preflight.address.slice(0, 4)}…${preflight.address.slice(-4)}` : '—'} • {typeof preflight.sol === 'number' ? `${preflight.sol.toFixed(2)} SOL` : '—'}</div>
        </div>
      )}

      {preflightError && (
        <div style={{ padding: '12px', background: 'rgba(255, 0, 255, 0.1)', border: '1px solid var(--bio-magenta)', borderRadius: 'var(--bio-radius-lg)', marginBottom: 20, textAlign: 'center', fontSize: 12, fontWeight: 700, color: 'var(--bio-magenta)', textTransform: 'uppercase', boxShadow: '0 0 20px rgba(255, 0, 255, 0.2)' }}>
          Payouts unavailable. Try again later.
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 20 }} role="group" aria-label="Tournament tier selection">
        {tiers.map((tier, i) => (
          <button
            key={tier.name}
            onClick={() => setSelectedIndex(i)}
            aria-label={`Select ${tier.name} tier - $${tier.usd} entry, $${tier.prize} prize`}
            aria-pressed={i === selectedIndex}
            style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '16px', background: i === selectedIndex ? 'var(--bio-gradient-player)' : 'var(--bio-glass-bg)', border: i === selectedIndex ? 'none' : '1px solid var(--bio-glass-border)', borderRadius: 'var(--bio-radius-lg)', cursor: 'pointer', boxShadow: i === selectedIndex ? '0 0 30px rgba(0, 247, 255, 0.4)' : '0 0 15px rgba(0, 247, 255, 0.1)' }}
          >
            <div style={{ fontSize: 20, fontWeight: 900, color: i === selectedIndex ? 'var(--bio-void)' : 'var(--bio-white)' }}>${tier.usd}</div>
            <div style={{ fontSize: 12, fontWeight: 700, color: i === selectedIndex ? 'var(--bio-void)' : 'var(--bio-white-dim)', textTransform: 'uppercase' }}>{tier.name}</div>
            <div style={{ fontSize: 16, fontWeight: 900, color: i === selectedIndex ? 'var(--bio-void)' : 'var(--bio-cyan)', marginTop: 4 }}>${tier.prize}</div>
          </button>
        ))}
      </div>

      <div style={{ background: 'var(--bio-glass-bg-strong)', border: '1px solid var(--bio-glass-border-strong)', borderRadius: 'var(--bio-radius-lg)', padding: '16px', textAlign: 'center', marginBottom: 20, boxShadow: '0 0 30px rgba(0, 247, 255, 0.2)' }}>
        <div style={{ fontSize: 11, textTransform: 'uppercase', color: 'var(--bio-lime)', fontWeight: 700, marginBottom: 8, textShadow: '0 0 10px var(--bio-lime-dim)' }}>Winner Payout</div>
        <div style={{ fontSize: 32, fontWeight: 900, color: 'var(--bio-lime)', textShadow: '0 0 20px var(--bio-lime-dim)' }}>${selected.prize}</div>
      </div>

      <button
        onClick={async () => {
          if (isDisabled) return;
          if (!publicKey && !(await connect())) {
            onNotify('Connect wallet first');
            return;
          }
          try {
            await connectAndJoin({ entryFeeTier: selected.usd as any, mode: 'tournament' });
          } catch (e) {
            onNotify('Failed to join');
          }
        }}
        disabled={isDisabled}
        className="mobile-bio-cta"
        aria-label={`Join ${selected.name} tournament - $${selected.usd} entry fee`}
        style={{ opacity: isDisabled ? 0.5 : 1, marginTop: 0 }}
      >
        {preflightError ? 'Unavailable' : 'Join Now'}
      </button>

      <button onClick={onClose} className="mobile-bio-secondary" aria-label="Back to welcome screen">← Back</button>
    </div>
  );
}, (prevProps, nextProps) => {
  return prevProps.solPrice === nextProps.solPrice;
});

function Practice({ onFinish: _onFinish, onBack }: { onFinish: () => void; onBack: () => void }) {
  const [meId] = useState<string>('PLAYER_' + Math.random().toString(36).slice(2, 8));
  const [practiceRound, setPracticeRound] = useState<number>(0);
  const [gameCountdown, setGameCountdown] = useState<number>(3);

  useEffect(() => {
    setGameCountdown(3);
    const timer = setInterval(() => { setGameCountdown(prev => Math.max(0, prev - 1)); }, 1000);
    return () => clearInterval(timer);
  }, [practiceRound]);

  return (
    <div className="screen active" style={{ padding: 0, position: 'fixed', inset: 0, width: '100vw', height: '100dvh', zIndex: 100, overflow: 'hidden' }}>
      <button onClick={onBack} style={{ position: 'fixed', top: 'calc(12px + env(safe-area-inset-top, 0px))', left: 'calc(12px + env(safe-area-inset-left, 0px))', zIndex: 2001, padding: '10px 14px', background: 'var(--bio-glass-bg)', border: '1px solid var(--bio-glass-border)', borderRadius: 'var(--bio-radius-lg)', color: 'var(--bio-white)', fontSize: 14, fontWeight: 900, boxShadow: '0 0 20px rgba(0, 247, 255, 0.3)', backdropFilter: 'var(--bio-glass-blur)', cursor: 'pointer', minWidth: '44px', minHeight: '44px' }}>✕</button>
      <GameViewWrapper
        key={`${meId}-${practiceRound}`}
        meIdOverride={meId || 'YOU'}
        onReplay={() => setPracticeRound((value) => value + 1)}
        onExit={onBack}
      />
      <MobileTutorial countdown={gameCountdown} />
    </div>
  );
}

function Game({ onEnd, onRestart }: { onEnd: () => void; onRestart: () => void }) {
  const [gameCountdown, setGameCountdown] = useState<number>(6);
  useEffect(() => { const timer = setInterval(() => { setGameCountdown(prev => Math.max(0, prev - 1)); }, 1000); return () => clearInterval(timer); }, []);
  return (
    <div className="screen active" style={{ padding: 0, position: 'fixed', inset: 0, width: '100vw', height: '100dvh', zIndex: 100, overflow: 'hidden' }}>
      <GameViewWrapper onReplay={onRestart} onExit={onEnd} />
      <MobileTutorial countdown={gameCountdown} />
    </div>
  );
}
