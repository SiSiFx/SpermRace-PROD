import { useEffect, useState } from 'react';
import { OrientationWarning } from './OrientationWarning';
import { MobileTouchControls } from './MobileTouchControls';
import MobileTutorial from './MobileTutorial';
import { PracticeModeSelection } from './PracticeModeSelection';
import PracticeFullTutorial from './PracticeFullTutorial';

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
import NewGameView from './NewGameView';
import { Leaderboard } from './Leaderboard';
import HowToPlayOverlay from './HowToPlayOverlay';
import {
  WarningCircle,
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
  const [returnScreen, setReturnScreen] = useState<AppScreen>('landing');
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
  const [loadProg, setLoadProg] = useState<number>(0);
  const overlayActive = (wsState.phase === 'connecting' || wsState.phase === 'authenticating' || wsState.entryFee.pending);

  useEffect(() => {
    try {
      const qs = new URLSearchParams(window.location.search);
      if (qs.get('practice') === '1') setScreen('practice');
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
  const onWallet = () => { setReturnScreen(screen); setScreen('wallet'); };

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
        else if (screen === 'practice-solo') setScreen('practice');
        else if (screen === 'wallet') setScreen(returnScreen);
      }
    };
    window.addEventListener('popstate', preventBack);
    return () => window.removeEventListener('popstate', preventBack);
  }, [screen, returnScreen]);

  return (
    <div id="app-root" className="mobile-optimized">
      <OrientationWarning />
      {screen !== "game" && screen !== "practice" && (
        <>
          <HeaderWallet screen={screen} wsState={wsState} publicKey={publicKey} />
          <button className="mobile-help-btn" onClick={() => setShowHowTo(true)}>
            <Question size={20} weight="bold" />
          </button>
        </>
      )}

      {wsState.lastError && (
        <div className="loading-overlay mobile-overlay" style={{ display: "flex", background: "rgba(0,0,0,0.85)" }}>
          <div className="modal-card mobile-modal">
            <div className="modal-title" style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
              <WarningCircle size={20} weight="fill" />
              <span>Error</span>
            </div>
            <div className="modal-subtitle" style={{ marginTop: 8 }}>{wsState.lastError}</div>
            <button className="btn-primary mobile-btn-large" style={{ marginTop: 16 }} onClick={() => location.reload()}>Reload App</button>
          </div>
        </div>
      )}

      {overlayActive && (
        <div className="loading-overlay mobile-overlay" style={{ display: 'flex' }}>
          <div className="loading-spinner mobile-spinner"></div>
          <div className="loading-text mobile-loading-text">{
            wsState.entryFee.pending ? 'Verifying entry fee transaction on Solana…'
              : wsState.phase === 'authenticating' ? 'Approve signature in your wallet to continue…'
                : 'Opening WebSocket connection…'
          }</div>
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

      {screen === 'landing' && <Landing solPrice={solPrice} onPractice={onPractice} onTournament={onTournament} onWallet={onWallet} onLeaderboard={() => setShowLeaderboard(true)} />}
      {screen === 'practice' && <PracticeModeSelection onSelectSolo={() => setScreen('practice-solo')} onBack={() => setScreen('landing')} onNotify={showToast} />}
      {screen === 'practice-solo' && <Practice onFinish={() => setScreen('results')} onBack={() => setScreen('practice')} />}
      {screen === 'modes' && <TournamentModesScreen onSelect={() => { setReturnScreen('modes'); setScreen('wallet'); }} onClose={() => setScreen('landing')} onNotify={showToast} />}
      {screen === 'wallet' && <Wallet onConnected={() => setScreen('lobby')} onClose={() => setScreen(returnScreen)} />}
      {screen === 'lobby' && <Lobby onStart={() => setScreen('game')} onBack={() => setScreen(wsState.lobby?.entryFee === 0 ? 'landing' : 'modes')} onRefund={() => setScreen(wsState.lobby?.entryFee === 0 ? 'landing' : 'modes')} />}
      {screen === 'game' && <Game onEnd={() => setScreen('results')} onRestart={() => setScreen('game')} />}
      {screen === 'results' && <Results onPlayAgain={() => setScreen('practice')} onChangeTier={() => setScreen('modes')} />}

      {toast && <div className="mobile-toast">{toast}</div>}
      {showHowTo && <HowToPlayOverlay mode="mobile" onClose={() => setShowHowTo(false)} />}
      {showLeaderboard && <Leaderboard onClose={() => setShowLeaderboard(false)} apiBase={API_BASE} myWallet={publicKey || null} isMobile={true} />}
    </div>
  );
}

function HeaderWallet({ publicKey }: { screen: string; wsState: any; publicKey: any }) {
  const { disconnect } = useWallet() as any;
  if (!publicKey) return null;
  const short = `${publicKey.slice(0, 4)}…${publicKey.slice(-4)}`;
  return (
    <div className="mobile-wallet-badge" style={{ border: "1px solid rgba(0, 245, 255, 0.3)", background: "linear-gradient(135deg, rgba(0, 245, 255, 0.1), rgba(0, 255, 136, 0.05))", boxShadow: "0 0 15px rgba(0, 245, 255, 0.1)", padding: "6px 12px", borderRadius: "12px", display: "flex", alignItems: "center", gap: "8px" }}>
      <span style={{ fontSize: "10px", fontWeight: 800, letterSpacing: "0.05em", color: "#00f5ff", textTransform: "uppercase" }}>{short}</span>
      <button style={{ background: "rgba(255,255,255,0.1)", border: "none", color: "#fff", width: "18px", height: "18px", borderRadius: "50%", fontSize: "10px", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }} onClick={() => disconnect?.()}>✕</button>
    </div>
  );
}

function Landing({ solPrice, onPractice, onTournament, onWallet, onLeaderboard }: { solPrice: number | null; onPractice: () => void; onTournament?: () => void; onWallet: () => void; onLeaderboard?: () => void; }) {
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
    <div className="screen active mobile-landing">
      <div className="mobile-landing-container" style={{ width: '100%', maxWidth: 600, margin: '0 auto', height: '100dvh', padding: '20px 24px 0', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', gap: 16, boxSizing: 'border-box' }}>
        <header style={{ textAlign: 'center', width: '100%' }}>
          <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'center' }}>
            <Atom size={56} weight="duotone" color="#00f5ff" />
          </div>
          <div style={{ fontFamily: 'Orbitron, sans-serif', letterSpacing: '0.3em', fontSize: 10, textTransform: 'uppercase', color: '#00f5ff', marginBottom: 16 }}>BATTLE ROYALE STARTS AT BIRTH</div>
          <h1 style={{ display: 'flex', justifyContent: 'center', alignItems: 'baseline', gap: 10, fontSize: 36, lineHeight: 1, margin: 0 }}>
            <span style={{ color: '#fff', fontWeight: 800 }}>SPERM</span>
            <span style={{ fontWeight: 800, background: 'linear-gradient(135deg, #00f5ff, #00ff88)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>RACE</span>
          </h1>
          <p style={{ marginTop: 14, fontSize: 11, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.7)', margin: '14px 0 0' }}>SURVIVE. ELIMINATE. WIN CRYPTO.</p>
          <div style={{ marginTop: 8, fontSize: 11, color: 'rgba(148,163,184,0.78)', fontFamily: 'monospace' }}>SOL: {solPrice != null ? `$${solPrice.toFixed(2)}` : '--.--'}</div>
          {totalGames > 0 && (
            <div style={{ marginTop: 24, display: 'flex', justifyContent: 'center', width: '100%' }}>
              <div style={{ padding: '12px 16px', borderRadius: 16, background: 'rgba(15,23,42,0.6)', border: '1px solid rgba(148,163,184,0.2)', display: 'flex', gap: 16, backdropFilter: 'blur(10px)' }}>
                <div className="mobile-stat"><div className="label">Games</div><div className="value">{totalGames}</div></div>
                <div className="mobile-stat"><div className="label">Win%</div><div className="value">{winRate}%</div></div>
                <div className="mobile-stat"><div className="label">Kills</div><div className="value">{totalKills}</div></div>
              </div>
            </div>
          )}
        </header>
        <main style={{ width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <section style={{ marginTop: 10, display: 'flex', alignItems: 'center', flexDirection: 'column', gap: 12, width: '100%', maxWidth: 400 }}>
            <button className="mobile-cta-primary" onClick={() => onTournament?.()}><span>Enter Tournament</span></button>
            <button className="mobile-btn-secondary" onClick={onPractice}><span>Practice Mode (Free)</span></button>
          </section>
          <div style={{ marginTop: 16, fontSize: 10, textAlign: 'center', color: 'rgba(0, 245, 255, 0.6)', letterSpacing: '0.1em', fontWeight: 600 }}>TOURNAMENTS FROM $1 • WINNER TAKES ALL</div>
        </main>
        <footer style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', marginTop: 20, paddingBottom: 'calc(40px + env(safe-area-inset-bottom, 0px))', gap: 16, width: '100%', maxWidth: 400 }}>
          <button className="mobile-btn-secondary" style={{ flex: 1, justifyContent: 'center' }} onClick={onPractice}>Practice</button>
          {onLeaderboard && <button className="mobile-btn-secondary" style={{ flex: 1, justifyContent: 'center' }} onClick={onLeaderboard}>Leaders</button>}
          <button className="mobile-btn-secondary" style={{ flex: 1, justifyContent: 'center' }} onClick={onWallet}>Wallet</button>
        </footer>
      </div>
    </div>
  );
}

function Practice({ onFinish: _onFinish, onBack }: { onFinish: () => void; onBack: () => void; }) {
  const [step, setStep] = useState<'lobby' | 'game'>(() => {
    try {
      return localStorage.getItem(PRACTICE_TUTORIAL_SEEN_KEY) ? 'game' : 'lobby';
    } catch {
      return 'lobby';
    }
  });
  const [meId] = useState<string>('PLAYER_' + Math.random().toString(36).slice(2, 8));
  const [players, setPlayers] = useState<string[]>([]);
  const [showPracticeIntro, setShowPracticeIntro] = useState<boolean>(() => {
    try {
      return !localStorage.getItem(PRACTICE_TUTORIAL_SEEN_KEY);
    } catch {
      return true;
    }
  });
  const [gameCountdown, setGameCountdown] = useState<number>(6);

  useEffect(() => {
    if (step === 'lobby') {
      if (showPracticeIntro) return;
      const bots = Array.from({ length: 7 }, (_, i) => 'BOT_' + i.toString(36) + Math.random().toString(36).slice(2, 4));
      setPlayers([meId, ...bots]);
      setStep('game');
    }
    if (step === 'game') {
      setGameCountdown(3);
      const timer = setInterval(() => { setGameCountdown(prev => Math.max(0, prev - 1)); }, 1000);
      return () => clearInterval(timer);
    }
  }, [step, meId, showPracticeIntro]);

  if (step === 'lobby') {
    return (
      <div className="screen active mobile-lobby-screen">
        {showPracticeIntro && (
          <PracticeFullTutorial
            onDone={() => {
              setShowPracticeIntro(false);
              try {
                localStorage.setItem(PRACTICE_TUTORIAL_SEEN_KEY, '1');
              } catch { }
              setStep('game');
            }}
          />
        )}
        <div className="mobile-lobby-container">
          <header style={{ textAlign: "center", marginBottom: "20px" }}>
            <Atom size={32} weight="duotone" color="#00f5ff" />
            <h1 style={{ fontSize: 24, fontWeight: 900, color: "#fff", fontFamily: "Orbitron, sans-serif" }}>PRACTICE</h1>
          </header>
          <div className="mobile-lobby-orbit">
            <div className="orbit-center" />
            <div className="orbit-ring">
              {players.map((p, i) => (
                <div key={p} className="orbit-sperm" style={{ '--i': i, '--n': players.length } as any} />
              ))}
            </div>
          </div>
          <footer className="mobile-lobby-footer"><button className="mobile-btn-back" style={{ width: '100%', background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "12px", padding: "14px" }} onClick={onBack}>← Back</button></footer>
        </div>
      </div>
    );
  }

  return (
    <div className="screen active" style={{ padding: 0, position: 'fixed', inset: 0, width: '100vw', height: '100vh', zIndex: 100 }}>
      <button onClick={onBack} style={{ position: 'fixed', top: 'calc(12px + env(safe-area-inset-top, 0px))', left: 'calc(12px + env(safe-area-inset-left, 0px))', zIndex: 2001, padding: '10px 16px', background: 'rgba(0, 0, 0, 0.7)', border: '1.5px solid rgba(255, 255, 255, 0.3)', borderRadius: '12px', color: '#fff', fontSize: '16px', fontWeight: 600, cursor: 'pointer', backdropFilter: 'blur(10px)' }}>✕</button>
      <NewGameView meIdOverride={meId || 'YOU'} onReplay={() => setStep('lobby')} onExit={onBack} />
      <MobileTouchControls onTouch={(x, y) => window.dispatchEvent(new CustomEvent('mobile-joystick', { detail: { x, y } }))} onBoost={() => { if ('vibrate' in navigator) navigator.vibrate(15); window.dispatchEvent(new CustomEvent('mobile-boost')); }} canBoost={true} boostCooldownPct={1} />
      <MobileTutorial countdown={gameCountdown} />
    </div>
  );
}

function TournamentModesScreen({ onSelect: _onSelect, onClose, onNotify }: { onSelect: () => void; onClose: () => void; onNotify: (msg: string) => void }) {
  const { publicKey, connect } = useWallet();
  const { connectAndJoin, state: wsState } = useWs();
  const [preflight, setPreflight] = useState<{ address: string | null; sol: number | null; configured: boolean } | null>(null);
  const [preflightError, setPreflightError] = useState<boolean>(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const tiers = [{ name: 'MICRO', usd: 1, prize: 10 }, { name: 'NANO', usd: 5, prize: 50 }, { name: 'MEGA', usd: 25, prize: 250 }, { name: 'ELITE', usd: 100, prize: 1000 }];
  const selected = tiers[selectedIndex];
  const isDisabled = preflightError || wsState.phase === 'connecting' || wsState.phase === 'authenticating';

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

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'linear-gradient(180deg, #030712 0%, #0a1628 100%)', display: 'flex', flexDirection: 'column', padding: '20px 16px', paddingTop: 'calc(20px + env(safe-area-inset-top, 0px))', paddingBottom: 'calc(40px + env(safe-area-inset-bottom, 0px))', overflowY: 'auto' }}>
      <header style={{ textAlign: 'center', marginBottom: 20 }}>
        <h1 style={{ fontSize: 22, fontWeight: 900, color: '#fff', margin: 0 }}>TOURNAMENT</h1>
        <p style={{ fontSize: 13, color: 'rgba(0,245,255,0.8)', margin: 0 }}>Win Real Crypto in 3 Minutes ⚡</p>
      </header>
      {preflight && !preflightError && (
        <div style={{ margin: '0 0 14px 0', padding: '10px 12px', borderRadius: 14, background: 'rgba(0, 245, 255, 0.06)', border: '1px solid rgba(0, 245, 255, 0.18)', color: 'rgba(255,255,255,0.8)', fontSize: 11, lineHeight: 1.35, textAlign: 'center' }}>
          Payouts: OK • Wallet: {preflight.address ? `${preflight.address.slice(0, 4)}…${preflight.address.slice(-4)}` : '—'} • Balance: {typeof preflight.sol === 'number' ? `${preflight.sol.toFixed(2)} SOL` : '—'}
        </div>
      )}
      {preflightError && (
        <div style={{ margin: '0 0 14px 0', padding: '12px 12px', borderRadius: 14, background: 'rgba(255, 59, 48, 0.08)', border: '1px solid rgba(255, 59, 48, 0.28)', color: 'rgba(255,255,255,0.85)', fontSize: 12, lineHeight: 1.35 }}>
          Tournament payouts are not configured right now. Please try again later.
        </div>
      )}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 16 }}>
        {tiers.map((tier, i) => (
          <button key={tier.name} onClick={() => setSelectedIndex(i)} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '12px 8px', borderRadius: 16, border: i === selectedIndex ? '2px solid #00f5ff' : '1px solid rgba(255,255,255,0.1)', background: i === selectedIndex ? 'rgba(0,245,255,0.1)' : 'rgba(255,255,255,0.03)', cursor: 'pointer' }}>
            <div style={{ fontSize: 14, fontWeight: 800 }}>${tier.usd}</div>
            <div style={{ fontSize: 12, color: i === selectedIndex ? '#00f5ff' : 'rgba(255,255,255,0.5)' }}>{tier.name}</div>
            <div style={{ fontSize: 20, fontWeight: 900, color: '#00ff88' }}>${tier.prize}</div>
          </button>
        ))}
      </div>
      <div style={{ background: 'rgba(0,245,255,0.1)', borderRadius: 16, padding: '16px', textAlign: 'center', marginBottom: 16 }}>
        <div style={{ fontSize: 10, textTransform: 'uppercase', color: 'rgba(255,255,255,0.6)' }}>Pot</div>
        <div style={{ fontSize: 32, fontWeight: 900, color: '#00ff88' }}>${selected.prize}</div>
      </div>
      <button
        onClick={async () => {
          if (isDisabled) return;
          if (!publicKey && !(await connect())) {
            onNotify?.('Connect wallet to enter tournament');
            return;
          }
          try {
            await connectAndJoin({ entryFeeTier: selected.usd as any, mode: 'tournament' });
          } catch (e) {
            onNotify?.('Failed to join tournament');
          }
        }}
        disabled={isDisabled}
        style={{ width: '100%', padding: '14px', borderRadius: 14, background: 'linear-gradient(135deg, #00f5ff 0%, #00ff88 100%)', color: '#000', fontWeight: 900, opacity: isDisabled ? 0.6 : 1 }}
      >
        {preflightError ? 'UNAVAILABLE' : 'JOIN NOW'}
      </button>
      <button onClick={onClose} style={{ marginTop: 10, width: '100%', padding: '14px', borderRadius: 14, background: 'transparent', border: '1px solid rgba(255,255,255,0.15)', color: '#fff' }}>BACK</button>
    </div>
  );
}

function Wallet({ onConnected, onClose }: { onConnected: () => void; onClose: () => void; }) {
  const { connect, publicKey } = useWallet();
  return (
    <div className="screen active mobile-wallet-screen">
      <div className="mobile-wallet-container">
        <h2 className="mobile-wallet-title">Connect Wallet</h2>
        <button className="mobile-wallet-connect-btn" onClick={async () => { if (await connect()) onConnected(); }}>Connect Wallet</button>
        {publicKey && <div className="mobile-connected-status">Connected: {publicKey.slice(0, 8)}...</div>}
        <button className="mobile-btn-back" onClick={onClose}>← Back</button>
      </div>
    </div>
  );
}

function Lobby({ onStart: _onStart, onBack, onRefund }: { onStart: () => void; onBack: () => void; onRefund?: () => void }) {
  const { state } = useWs();
  const [showTutorial, setShowTutorial] = useState(false);
  const players = state.lobby?.players || [];
  const botCount = players.filter(p => String(p).startsWith('BOT_')).length;
  const realCount = Math.max(0, players.length - botCount);
  const realPlayers = players.filter(p => !String(p).startsWith('BOT_'));
  const prize = state.lobby ? Math.max(0, Math.floor(realPlayers.length * (state.lobby.entryFee as number) * 0.85)) : 0;
  const lobbyMode = (state.lobby as any)?.mode as ('practice' | 'tournament' | undefined);
  const practiceMissingPlayers = lobbyMode === 'practice' ? Math.max(0, 2 - realPlayers.length) : 0;

  useEffect(() => {
    if (state.lobby?.entryFee !== 0) {
      setShowTutorial(false);
      return;
    }
    let seen = false;
    try { seen = !!localStorage.getItem(PRACTICE_TUTORIAL_SEEN_KEY); } catch { }
    setShowTutorial(!seen);
  }, [state.lobby?.entryFee]);
  useEffect(() => { if ((state as any).refundReceived && !state.lobby && onRefund) onRefund(); }, [(state as any).refundReceived, state.lobby, onRefund]);

  return (
    <div className="screen active mobile-lobby-screen" style={{ background: "#030712", display: "flex", flexDirection: "column", padding: "20px 16px", paddingTop: "calc(20px + env(safe-area-inset-top, 0px))", height: "100dvh", boxSizing: "border-box", overflow: "hidden" }}>
      {showTutorial && (
        <PracticeFullTutorial
          onDone={() => {
            setShowTutorial(false);
            try {
              localStorage.setItem(PRACTICE_TUTORIAL_SEEN_KEY, '1');
            } catch { }
          }}
        />
      )}
      <header style={{ textAlign: "center", marginBottom: "20px" }}>
        <Atom size={32} weight="duotone" color="#00f5ff" style={{ margin: '0 auto 12px' }} />
        <h1 style={{ fontSize: 24, fontWeight: 900, color: "#fff", fontFamily: "Orbitron, sans-serif" }}>LOBBY</h1>
      </header>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px", marginBottom: "16px" }}>
        <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "12px", padding: "12px", textAlign: "center" }}>
          <div style={{ fontSize: 9, color: "rgba(255,255,255,0.4)" }}>Pilots</div>
          <div style={{ fontSize: 18, fontWeight: 800, color: "#00f5ff" }}>{players.length} / {state.lobby?.maxPlayers ?? 32}</div>
          {botCount > 0 && (
            <div style={{ marginTop: 4, fontSize: 10, color: "rgba(255,255,255,0.55)" }}>
              Real: {realCount} • Bots: {botCount}
            </div>
          )}
        </div>
        <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "12px", padding: "12px", textAlign: "center" }}>
          <div style={{ fontSize: 9, color: "rgba(255,255,255,0.4)" }}>Prize</div>
          <div style={{ fontSize: 18, fontWeight: 800, color: "#00ff88" }}>${prize}</div>
        </div>
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: "6px", justifyContent: "center", marginBottom: "24px", maxHeight: "100px", overflowY: "auto", padding: "8px", background: "rgba(0,0,0,0.2)", borderRadius: "12px", border: "1px solid rgba(255,255,255,0.05)" }}>
        {players.map((pid: string) => (
          <div key={pid} style={{ fontSize: "10px", padding: "4px 10px", borderRadius: "6px", background: pid === state.playerId ? "rgba(0, 245, 255, 0.15)" : "rgba(255, 255, 255, 0.05)", border: pid === state.playerId ? "1px solid rgba(0, 245, 255, 0.3)" : "1px solid rgba(255, 255, 255, 0.1)", color: pid === state.playerId ? "#00f5ff" : "rgba(255, 255, 255, 0.7)", fontWeight: 800 }}>
            {state.lobby?.playerNames?.[pid] || pid.slice(0, 4) + "…"}
          </div>
        ))}
      </div>
      <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
        {state.countdown ? (
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: "12px", fontWeight: 800, color: "#00f5ff", letterSpacing: "0.2em" }}>STARTING IN</div>
            <div style={{ fontSize: "84px", fontWeight: 900, color: "#fff", fontFamily: "Orbitron, sans-serif" }}>{state.countdown.remaining}</div>
          </div>
        ) : (
          <div style={{ textAlign: "center" }}>
            <div className="mobile-lobby-spinner" style={{ margin: '0 auto 20px' }}></div>
            <div style={{ fontSize: "12px", color: "rgba(255,255,255,0.5)", fontWeight: 800 }}>
              {lobbyMode === 'practice' && practiceMissingPlayers > 0
                ? `NEED ${practiceMissingPlayers} MORE PLAYER${practiceMissingPlayers === 1 ? '' : 'S'} TO START`
                : 'WAITING FOR RIVALS...'}
            </div>
            {lobbyMode === 'practice' && practiceMissingPlayers > 0 && (
              <div style={{ marginTop: 8, fontSize: 11, color: "rgba(148,163,184,0.8)" }}>
                Practice is pure multiplayer (2+ players).
              </div>
            )}
          </div>
        )}
      </div>
      <footer style={{ marginTop: "auto", paddingBottom: "20px" }}><button className="mobile-btn-back" style={{ width: '100%', background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "12px", padding: "14px" }} onClick={onBack}>← ABORT MISSION</button></footer>
    </div>
  );
}

function Game({ onEnd, onRestart }: { onEnd: () => void; onRestart: () => void; }) {
  const [gameCountdown, setGameCountdown] = useState<number>(6);
  useEffect(() => { const timer = setInterval(() => { setGameCountdown(prev => Math.max(0, prev - 1)); }, 1000); return () => clearInterval(timer); }, []);
  return (
    <div className="screen active" style={{ padding: 0, position: 'fixed', inset: 0, width: '100vw', height: '100vh', zIndex: 100 }}>
      <NewGameView onReplay={onRestart} onExit={onEnd} />
      <MobileTouchControls onTouch={(x, y) => window.dispatchEvent(new CustomEvent('mobile-joystick', { detail: { x, y } }))} onBoost={() => { if ('vibrate' in navigator) navigator.vibrate(15); window.dispatchEvent(new CustomEvent('mobile-boost')); }} canBoost={true} boostCooldownPct={1} />
      <MobileTutorial countdown={gameCountdown} />
    </div>
  );
}

function Results({ onPlayAgain, onChangeTier }: { onPlayAgain: () => void; onChangeTier: () => void; }) {
  const { state: wsState, connectAndJoin } = useWs();
  const { publicKey } = useWallet();
  const winner = wsState.lastRound?.winnerId;
  const prize = wsState.lastRound?.prizeAmount;
  const isWinner = !!winner && (winner === wsState.playerId || winner === publicKey);
  const [playAgainBusy, setPlayAgainBusy] = useState(false);

  const selfId = wsState.playerId || publicKey || '';

  // Calculate stats
  const initialPlayers = wsState.initialPlayers || [];
  const totalPlayers = initialPlayers.length;
  const myKills = wsState.kills?.[selfId] || 0;

  // Calculate rank
  let rank = 0;
  try {
    const order = wsState.eliminationOrder || [];
    const uniqueOrder: string[] = [];
    for (const pid of order) {
      if (pid && !uniqueOrder.includes(pid)) uniqueOrder.push(pid);
    }
    const rankMap: Record<string, number> = {};
    if (winner) rankMap[winner] = 1;
    let r = 2;
    for (let i = uniqueOrder.length - 1; i >= 0; i--) {
      const pid = uniqueOrder[i];
      if (pid && !rankMap[pid]) { rankMap[pid] = r; r++; }
    }
    rank = rankMap[selfId] || 0;
  } catch {}

  const handlePlayAgain = async () => {
    if (playAgainBusy) return;
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

  return (
    <div className="screen active mobile-results-screen">
      <div className="mobile-results-container">
        <h1 className={`mobile-result-title ${isWinner ? 'win' : 'lose'}`}>{isWinner ? 'Victory!' : 'Eliminated'}</h1>
        <p className="mobile-result-subtitle">Winner: {winner ? winner.slice(0, 4) + "…" : "—"}</p>
        {typeof prize === 'number' && <div className="mobile-prize-won">{prize.toFixed(4)} SOL</div>}

        {/* Tech-styled Mobile Stats */}
        <div className="match-stats-dashboard">
          <div className="tech-gauge-container">
            <div className="tech-gauge">
              <div className="gauge-label">Rank</div>
              <div className={`gauge-value ${isWinner ? 'gold' : 'accent'}`}>#{rank}</div>
              <div className="gauge-subtext">of {totalPlayers}</div>
            </div>
            <div className="tech-gauge">
              <div className="gauge-label">Kills</div>
              <div className="gauge-value accent">{myKills}</div>
              <div className="gauge-subtext">eliminations</div>
            </div>
          </div>

          {totalPlayers > 0 && (
            <>
              <div className="tech-progress-bar">
                <div className="tech-progress-label">
                  <span className="label-text">Placement</span>
                  <span className="label-value">{totalPlayers - rank + 1} / {totalPlayers}</span>
                </div>
                <div className="tech-progress-track">
                  <div
                    className={`tech-progress-fill ${isWinner ? 'gold' : ''}`}
                    style={{ width: `${Math.min(100, ((totalPlayers - rank + 1) / totalPlayers) * 100)}%` }}
                  />
                </div>
              </div>

              <div className="tech-progress-bar">
                <div className="tech-progress-label">
                  <span className="label-text">Kill Performance</span>
                  <span className="label-value">{myKills} / {Math.max(5, Math.ceil(totalPlayers / 3))}</span>
                </div>
                <div className="tech-progress-track">
                  <div
                    className={`tech-progress-fill ${myKills > 0 ? '' : 'danger'}`}
                    style={{ width: `${Math.min(100, (myKills / Math.max(5, Math.ceil(totalPlayers / 3))) * 100)}%` }}
                  />
                </div>
              </div>
            </>
          )}

          <div className="match-stats-grid">
            <div className="stat-card">
              <div className="stat-card-label">Position</div>
              <div className={`stat-card-value ${isWinner ? 'gold' : ''}`}>#{rank}</div>
            </div>
            <div className="stat-card">
              <div className="stat-card-label">Players</div>
              <div className="stat-card-value">{totalPlayers}</div>
            </div>
          </div>
        </div>

        <div className="mobile-result-actions">
          <button className="mobile-btn-primary" onClick={handlePlayAgain} disabled={playAgainBusy}>{playAgainBusy ? 'Joining…' : 'Play Again'}</button>
          <button className="mobile-btn-secondary" onClick={onChangeTier}>Menu</button>
        </div>
      </div>
    </div>
  );
}
