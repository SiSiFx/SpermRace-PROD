import { useEffect, useState } from 'react';
import { OrientationWarning } from './OrientationWarning';
import { MobileTouchControls } from './MobileTouchControls';
// Base URL for backend API; prefer env, else infer by hostname, else same-origin /api
const API_BASE: string = (() => {
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
import NewGameView from './NewGameView';
import { Leaderboard } from './Leaderboard';
import './leaderboard.css';

type AppScreen = 'landing' | 'practice' | 'modes' | 'wallet' | 'lobby' | 'game' | 'results';

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
  const [solPrice, setSolPrice] = useState<number | null>(null);
  const { state: wsState, signAuthentication, leave } = useWs() as any;
  const [toast, setToast] = useState<string | null>(null);
  const showToast = (msg: string, duration = 2000) => {
    setToast(msg);
    window.setTimeout(() => setToast(null), duration);
  };
  const wallet = useWallet();
  const { publicKey } = wallet;
  const [showHelp, setShowHelp] = useState<boolean>(false);
  const [showLeaderboard, setShowLeaderboard] = useState<boolean>(false);
  
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

  const onPractice = () => setScreen('practice');
  const onTournament = () => setScreen('modes');

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
        else if (screen === 'wallet') setScreen('modes');
      }
    };
    window.addEventListener('popstate', preventBack);
    return () => window.removeEventListener('popstate', preventBack);
  }, [screen]);

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
          
          <button onClick={() => setShowHelp(v => !v)} title="Help" style={{ position: 'fixed', top: 8, left: 8, zIndex: 60, padding: '6px 8px', borderRadius: 8, background: 'rgba(0,0,0,0.55)', color: '#c7d2de', border: '1px solid rgba(255,255,255,0.12)', fontSize: 12, cursor: 'pointer' }}>?</button>
        </>
      )}
      
      {showHelp && (
        <div style={{ position: 'fixed', top: 40, left: 8, zIndex: 60, padding: '10px 12px', borderRadius: 10, background: 'rgba(0,0,0,0.80)', color: '#c7d2de', border: '1px solid rgba(255,255,255,0.12)', fontSize: 12, maxWidth: 260 }}>
          <div style={{ fontWeight: 700, marginBottom: 6 }}>Controls</div>
          <div>• Drag to aim</div>
          <div>• Double‑tap to boost</div>
        </div>
      )}

      {wsState.lastError && (
        <div className="loading-overlay mobile-overlay" style={{ display: 'flex', background: 'rgba(0,0,0,0.85)' }}>
          <div className="modal-card mobile-modal">
            <div className="modal-title">⚠️ Error</div>
            <div className="modal-subtitle" style={{ marginTop: 8 }}>{wsState.lastError}</div>
            <button className="btn-primary mobile-btn-large" style={{ marginTop: 16 }} onClick={() => location.reload()}>Reload App</button>
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
          onLeaderboard={() => setShowLeaderboard(true)}
        />
      )}
      {screen === 'practice' && (
        <Practice onFinish={() => setScreen('results')} onBack={() => setScreen('landing')} />
      )}
      {screen === 'modes' && (
        <Modes onSelect={() => setScreen('wallet')} onClose={() => setScreen('landing')} onNotify={showToast} />
      )}
      {screen === 'wallet' && (
        <Wallet onConnected={() => setScreen('lobby')} onClose={() => setScreen('modes')} />
      )}
      {screen === 'lobby' && (
        <Lobby 
          onStart={() => setScreen('game')} 
          onBack={() => setScreen('modes')}
          onRefund={() => setScreen('modes')}
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
    return <div className="mobile-wallet-badge">🎮 Practice</div>;
  }
  return null;
}

function Landing({ solPrice, onPractice, onTournament, onLeaderboard }: { solPrice: number | null; onPractice: () => void; onTournament: () => void; onLeaderboard?: () => void; }) {
  const { publicKey, isConnecting } = useWallet();
  const sendAnalytic = async (type: string, payload: any) => { try { await fetch(`${API_BASE}/analytics`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ type, payload }) }); } catch {} };
  
  const handleTournament = async () => {
    sendAnalytic('landing_cta_click', { publicKey: publicKey || null });
    onTournament();
  };

  const getPlayerStats = () => {
    try {
      const stored = localStorage.getItem('spermrace_stats');
      if (stored) return JSON.parse(stored);
    } catch {}
    return { totalGames: 0, wins: 0, losses: 0, totalPrizes: 0, totalKills: 0, history: [] };
  };
  const stats = getPlayerStats();
  const winRate = stats.totalGames > 0 ? ((stats.wins / stats.totalGames) * 100).toFixed(1) : '0.0';

  return (
    <div className="screen active mobile-landing" id="landing-screen">
      <div className="mobile-landing-container">
        <div className="mobile-brand-section">
          <h1 className="mobile-brand-title">
            <span className="text-gradient">SPERM</span>
            <span className="text-accent">RACE</span>
            <span className="text-gradient">.IO</span>
          </h1>
          <p className="mobile-brand-subtitle">Battle Royale 💥</p>
          
          {stats.totalGames > 0 && (
            <div className="mobile-stats-row">
              <div className="mobile-stat">
                <div className="label">Games</div>
                <div className="value">{stats.totalGames}</div>
              </div>
              <div className="mobile-stat">
                <div className="label">Win%</div>
                <div className="value">{winRate}%</div>
              </div>
              <div className="mobile-stat">
                <div className="label">Kills</div>
                <div className="value">{stats.totalKills}</div>
              </div>
              {stats.totalPrizes > 0 && (
                <div className="mobile-stat highlight">
                  <div className="label">💰 Won</div>
                  <div className="value">{stats.totalPrizes.toFixed(3)}</div>
                </div>
              )}
            </div>
          )}
        </div>
        
        <div className="mobile-cta-section">
          <button className="mobile-cta-primary" onClick={handleTournament} disabled={isConnecting}>
            <span className="icon">🏆</span>
            <span className="text">
              {isConnecting ? 'Opening Wallet...' : 'Enter Tournament'}
            </span>
          </button>
          
          <button className="mobile-btn-secondary" onClick={onPractice}>
            <span className="icon">🎮</span>
            <span className="text">Practice (Free)</span>
          </button>

          {onLeaderboard && (
            <button className="mobile-btn-secondary" onClick={onLeaderboard} style={{ marginTop: '12px' }}>
              <span className="icon">🏆</span>
              <span className="text">Leaderboard</span>
            </button>
          )}
          
          <div className="mobile-sol-price">
            <span className="label">SOL</span>
            <span className="price">${solPrice?.toFixed(2) ?? '--'}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function Practice({ onFinish: _onFinish, onBack }: { onFinish: () => void; onBack: () => void; }) {
  const [step, setStep] = useState<'lobby' | 'game'>('lobby');
  const [meId] = useState<string>('PLAYER_' + Math.random().toString(36).slice(2, 8));
  const [players, setPlayers] = useState<string[]>([]);
  const [countdown, setCountdown] = useState<number>(5);
  const countdownTotal = 5;
  
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
      setGameCountdown(6); // 6 seconds to match game engine
      const base = [meId];
      const bots = Array.from({ length: 7 }, (_, i) => `BOT_${i.toString(36)}${Math.random().toString(36).slice(2,4)}`);
      setPlayers([...base, ...bots]);
      
      setCountdown(countdownTotal);
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
    
    if (step === 'game') {
      setGameCountdown(6); // Reset to 6 seconds when game starts
      const timer = setInterval(() => {
        setGameCountdown(prev => Math.max(0, prev - 1));
      }, 1000);
      return () => clearInterval(timer);
    }
  }, [step, meId]);

  if (step === 'lobby') {
    const maxPlayers = 8;
    const progressPct = Math.max(0, Math.min(100, Math.floor(((countdownTotal - countdown) / countdownTotal) * 100)));
    return (
      <div className="screen active mobile-lobby-screen">
        <div className="mobile-lobby-container">
          <div className="mobile-lobby-header">
            <h2 className="mobile-lobby-title">🎮 Practice Lobby</h2>
            <div className="mobile-lobby-count">{players.length}/{maxPlayers}</div>
          </div>
          
          <div className="mobile-queue-status">
            <div className="status-item">
              <span className="dot"></span>
              <span>{players.length} Ready</span>
            </div>
            <div className="status-item">
              <span>Starting in {countdown}s</span>
            </div>
          </div>
          
          <div className="mobile-lobby-orbit">
            <div className="orbit-center" />
            <div className="orbit-ring">
              {players.map((p: string, i: number) => (
                <div key={p} className="orbit-sperm" style={{ '--i': i, '--n': players.length } as any} />
              ))}
            </div>
            <div className="mobile-countdown">{countdown}s</div>
          </div>
          
          <div className="mobile-progress-bar">
            <div className="mobile-progress-fill" style={{ width: `${progressPct}%` }}></div>
          </div>
          
          <div className="mobile-lobby-footer">
            <button className="mobile-btn-back" onClick={onBack}>← Back</button>
          </div>
        </div>
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
        {/* Game engine handles countdown display */}
      </div>
    );
  }

  return null;
}

function Modes({ onSelect: _onSelect, onClose, onNotify }: { onSelect: () => void; onClose: () => void; onNotify: (msg: string, duration?: number) => void }) {
  const { publicKey, connect } = useWallet();
  const { connectAndJoin, state: wsState } = useWs();
  const [isJoining, setIsJoining] = useState<boolean>(false);
  const [preflight, setPreflight] = useState<{ address: string | null; sol: number | null; configured: boolean } | null>(null);
  const [preflightError, setPreflightError] = useState<boolean>(false);
  
  useEffect(() => {
    (async () => {
      try {
        const r = await fetch(`${API_BASE}/prize-preflight`);
        if (!r.ok) throw new Error(`preflight ${r.status}`);
        const j = await r.json();
        setPreflight(j);
        const misconfigured = !j?.configured || !j?.address || j?.sol == null;
        setPreflightError(!!misconfigured);
      } catch {
        setPreflightError(true);
      }
    })();
  }, []);

  const tiers = [
    { name: 'Micro Race', usd: 1, max: 16, dur: '2-3 min' },
    { name: 'Nano Race', usd: 5, max: 32, dur: '3-4 min' },
    { name: 'Mega Race', usd: 25, max: 32, dur: '4-6 min' },
    { name: 'Championship', usd: 100, max: 16, dur: '5-8 min' },
  ];

  useEffect(() => {
    if (wsState.phase === 'lobby' || wsState.phase === 'game') setIsJoining(false);
  }, [wsState.phase]);

  return (
    <div className="screen active" id="mode-screen" style={{ position: 'relative', overflow: 'hidden', height: '100vh' }}>
      <div className="modes-sheet" style={{ position: 'relative', paddingBottom: '120px', overflowY: 'auto', height: '100%' }}>
        <div className="sheet-grip" />
        

        
        <div className="modal-header"><h2 className="modal-title">Enter Sperm Race</h2><p className="modal-subtitle">Select a tier</p></div>
        {preflightError && (
          <div className="modal-subtitle" style={{ color: '#ff8080', marginBottom: 8 }}>Tournaments are temporarily unavailable (prize preflight issue).</div>
        )}
        
        <div className="tournament-grid" style={{ marginBottom: '20px' }}>
          {tiers.map((t, i) => {
            const prize = (t.usd * t.max * 0.85).toFixed(2);
            const cardGradients = [
              'linear-gradient(135deg, rgba(34,211,238,0.15) 0%, rgba(99,102,241,0.15) 100%)',
              'linear-gradient(135deg, rgba(99,102,241,0.18) 0%, rgba(244,63,94,0.18) 100%)', 
              'linear-gradient(135deg, rgba(244,63,94,0.20) 0%, rgba(251,146,60,0.20) 100%)',
              'linear-gradient(135deg, rgba(251,146,60,0.22) 0%, rgba(34,211,238,0.22) 100%)'
            ];
            const prizeGradients = [
              'linear-gradient(90deg, rgba(34,211,238,0.25), rgba(99,102,241,0.25))',
              'linear-gradient(90deg, rgba(99,102,241,0.28), rgba(244,63,94,0.28))',
              'linear-gradient(90deg, rgba(244,63,94,0.30), rgba(251,146,60,0.30))',
              'linear-gradient(90deg, rgba(251,146,60,0.32), rgba(34,211,238,0.32))'
            ];
            
            const buttonGradients = [
              'linear-gradient(90deg, #22d3ee 0%, #6366f1 100%)',
              'linear-gradient(90deg, #6366f1 0%, #f43f5e 100%)',
              'linear-gradient(90deg, #f43f5e 0%, #fb923c 100%)',
              'linear-gradient(90deg, #fb923c 0%, #22d3ee 100%)'
            ];
            return (
              <div key={t.name} className="tournament-card" style={{
                background: cardGradients[i],
                border: '2px solid rgba(255,255,255,0.15)',
                borderRadius: '20px',
                padding: '24px',
                position: 'relative',
                overflow: 'hidden',
                backdropFilter: 'blur(10px)',
                boxShadow: '0 20px 40px rgba(0,0,0,0.15), inset 0 1px 0 rgba(255,255,255,0.1)'
              }} data-ribbon={i===0? '🔥 HOT' : i===1? '⭐ POPULAR' : i===2? '💎 VIP' : '👑 ELITE'}>
                
                {/* Animated background orb */}
                <div style={{
                  position: 'absolute',
                  top: '-50%',
                  right: '-30%',
                  width: '200px',
                  height: '200px',
                  background: prizeGradients[i],
                  borderRadius: '50%',
                  opacity: 0.3,
                  filter: 'blur(60px)',
                  animation: 'float 6s ease-in-out infinite'
                }} />
                
                <div className="tournament-header" style={{ position: 'relative', zIndex: 2 }}>
                  <div className="tournament-icon" style={{ fontSize: '32px', marginBottom: '8px' }}>🧬</div>
                  <h3 className="tournament-title" style={{ fontSize: '24px', fontWeight: 800, marginBottom: '4px' }}>{t.name}</h3>
                  <div className="tournament-badge" style={{ 
                    background: 'rgba(255,255,255,0.2)', 
                    padding: '4px 12px', 
                    borderRadius: '20px', 
                    fontSize: '12px',
                    fontWeight: 600,
                    backdropFilter: 'blur(10px)'
                  }}>Tier {i+1}</div>
                </div>
                
                {/* Massive prize display */}
                <div style={{ 
                  textAlign: 'center', 
                  margin: '20px 0', 
                  position: 'relative', 
                  zIndex: 2 
                }}>
                  <div style={{ fontSize: '14px', color: 'rgba(255,255,255,0.8)', marginBottom: '8px' }}>WIN UP TO</div>
                  <div style={{ 
                    fontSize: '48px', 
                    fontWeight: 900, 
                    background: buttonGradients[i],
                    backgroundClip: 'text',
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent',
                    textShadow: '0 4px 20px rgba(255,255,255,0.3)',
                    lineHeight: 1,
                    marginBottom: '4px'
                  }}>${prize}</div>
                  <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.7)' }}>Instant crypto payout</div>
                </div>

                <div className="tournament-details" style={{ position: 'relative', zIndex: 2 }}>
                  <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    background: 'rgba(255,255,255,0.1)',
                    padding: '12px 16px',
                    borderRadius: '12px',
                    marginBottom: '16px',
                    backdropFilter: 'blur(10px)'
                  }}>
                    <div>
                      <div style={{ fontSize: '18px', fontWeight: 700 }}>${t.usd.toFixed(2)}</div>
                      <div style={{ fontSize: '11px', opacity: 0.8 }}>Entry fee</div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: '14px', fontWeight: 600 }}>{t.max} players max</div>
                      <div style={{ fontSize: '11px', opacity: 0.8 }}>{t.dur} duration</div>
                    </div>
                  </div>
                </div>

                <button
                  style={{
                    width: '100%',
                    padding: '16px 24px',
                    background: buttonGradients[i],
                    border: 'none',
                    borderRadius: '16px',
                    color: '#000',
                    fontSize: '18px',
                    fontWeight: 800,
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px',
                    cursor: 'pointer',
                    position: 'relative',
                    zIndex: 2,
                    boxShadow: '0 8px 24px rgba(0,0,0,0.2), inset 0 1px 0 rgba(255,255,255,0.3)',
                    transition: 'all 0.2s ease',
                    transform: 'translateY(0px)'
                  }}
                  disabled={
                    isJoining ||
                    wsState.phase === 'connecting' ||
                    wsState.phase === 'authenticating' ||
                    preflightError ||
                    (!!preflight && (!preflight.configured || !preflight.address || preflight.sol == null))
                  }
                  onClick={async () => {
                    setIsJoining(true);
                    const ok = publicKey ? true : await connect();
                    if (!ok) {
                      setIsJoining(false);
                      onNotify('Wallet not detected. Please install or unlock your wallet.');
                      return;
                    }
                    
                    // ✅ FIX #1: Check balance BEFORE attempting payment
                    // TODO: Re-enable after fixing connection reference
                    // For now, skip balance check and let payment flow handle it
                    
                    await connectAndJoin({ entryFeeTier: t.usd as any, mode: 'tournament' });
                  }}
                >{
                  preflightError ? 'Service unavailable'
                  : (preflight && (!preflight.configured || !preflight.address || preflight.sol == null)) ? 'Temporarily unavailable'
                  : (isJoining || wsState.phase === 'connecting' || wsState.phase === 'authenticating') ? 'Joining…'
                  : `ENTER RACE`
                }</button>
              </div>
            );
          })}
        </div>
        
        {/* Small floating back button - fixed at bottom center */}
        <div style={{ 
          position: 'fixed',
          bottom: 'calc(40px + env(safe-area-inset-bottom, 0px))',
          left: '50%',
          transform: 'translateX(-50%)',
          zIndex: 1000,
          pointerEvents: 'none'
        }}>
          <button 
            onClick={onClose}
            style={{
              padding: '10px 20px',
              borderRadius: '24px',
              background: 'rgba(0, 0, 0, 0.9)',
              color: '#fff',
              border: '1.5px solid rgba(255, 255, 255, 0.3)',
              fontSize: '14px',
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              boxShadow: '0 4px 16px rgba(0, 0, 0, 0.6)',
              backdropFilter: 'blur(10px)',
              WebkitBackdropFilter: 'blur(10px)',
              pointerEvents: 'auto'
            }}
          >
            <span style={{ fontSize: '16px' }}>←</span> Back
          </button>
        </div>
      </div>
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
            ✅ {publicKey.slice(0,8)}...{publicKey.slice(-8)}
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
          <h2 className="mobile-lobby-title">🏆 Lobby</h2>
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
    console.log('[AppMobile] Boost button clicked, countdown:', gameCountdown);
    const event = new CustomEvent('mobile-boost');
    window.dispatchEvent(event);
  };
  
  return (
    <div className="screen active" style={{ padding: 0, position: 'fixed', inset: 0, width: '100vw', height: '100vh', zIndex: 100 }}>
      {/* Back button - top left, safe area aware */}
      <button 
        onClick={onEnd}
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
        onReplay={onRestart}
        onExit={onEnd}
      />
      <MobileTouchControls 
        onTouch={handleTouch}
        onBoost={handleBoost}
        canBoost={true}
        boostCooldownPct={1}
      />
      {/* Game engine handles countdown display */}
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
  } catch {}
  
  return (
    <div className="screen active mobile-results-screen">
      <div className="mobile-results-container">
        <div className="mobile-result-header">
          <h1 className={`mobile-result-title ${isWinner ? 'win' : 'lose'}`}>
            {isWinner ? '🏆 Victory!' : '💀 Eliminated'}
          </h1>
          <p className="mobile-result-subtitle">
            Winner: {winner ? `${winner.slice(0,4)}…${winner.slice(-4)}` : '—'}
          </p>
          {typeof prize === 'number' && (
            <div className="mobile-prize-won">{prize.toFixed(4)} SOL</div>
          )}
        </div>
        
        {solscan && (
          <a href={solscan} target="_blank" rel="noreferrer" className="mobile-solscan-btn">
            🔗 View on Solscan
          </a>
        )}
        
        <div className="mobile-result-stats">
          {rankText && <div className="stat">Rank: {rankText}</div>}
          <div className="stat">Kills: {wsState.kills?.[selfId] || 0}</div>
        </div>
        
        <div className="mobile-result-actions">
          <button className="mobile-btn-primary" onClick={onPlayAgain}>
            🔄 Play Again
          </button>
          <button className="mobile-btn-secondary" onClick={onChangeTier}>
            🏠 Menu
          </button>
        </div>
      </div>
    </div>
  );
}

