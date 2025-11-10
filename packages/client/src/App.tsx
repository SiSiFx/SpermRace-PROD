import { useEffect, useState } from 'react';
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
import { WsProvider, useWs } from './WsProvider';
import NewGameView from './NewGameView';

type AppScreen = 'landing' | 'practice' | 'modes' | 'wallet' | 'lobby' | 'game' | 'results';

export default function App() {
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

  return (
    <div id="app-root">
      {/* Header wallet short address or simulation badge */}
      <HeaderWallet screen={screen} />
      <div id="bg-particles" />
      {/* UNIFIED OVERLAY SYSTEM - Only ONE overlay shows at a time, priority: Error > Payment > Auth > Connecting */}
      {wsState.lastError ? (
        <div className="loading-overlay" style={{ display: 'flex', background: 'rgba(0,0,0,0.92)', backdropFilter: 'blur(8px)', zIndex: 10000 }}>
          <div className="modal-card" style={{
            padding: '28px 24px',
            maxWidth: '420px',
            background: 'linear-gradient(135deg, rgba(239,68,68,0.12) 0%, rgba(251,146,60,0.12) 100%)',
            border: '2px solid rgba(239,68,68,0.3)',
            boxShadow: '0 20px 60px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.1)'
          }}>
            <div style={{ textAlign: 'center', marginBottom: '16px' }}>
              <div style={{ fontSize: '48px', marginBottom: '8px' }}>
                {wsState.lastError.toLowerCase().includes('insufficient') ? '💸' : '⚠️'}
              </div>
              <div className="modal-title" style={{ fontSize: '24px', fontWeight: 800 }}>
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
                fontSize: '13px',
                color: 'rgba(255,255,255,0.7)',
                textAlign: 'center',
                marginBottom: '16px',
                lineHeight: '1.5'
              }}>
                {publicKey
                  ? '🚀 Top up your wallet with SOL to continue racing'
                  : '🔗 Connect a wallet or buy SOL to get started'}
              </div>
            )}

            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', justifyContent: 'center' }}>
              {wsState.lastError.toLowerCase().includes('insufficient') ? (
                <>
                  <button
                    className="btn-primary"
                    style={{
                      flex: '1',
                      minWidth: '140px',
                      padding: '14px 20px',
                      fontSize: '15px',
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
                  >💳 Buy SOL</button>
                  <button
                    className="btn-secondary"
                    style={{
                      flex: '0.8',
                      minWidth: '100px',
                      padding: '14px 20px',
                      fontSize: '15px',
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
                    padding: '14px 20px',
                    fontSize: '15px',
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
            wsState.entryFee.pending ? 'Processing entry fee…'
            : wsState.phase === 'authenticating' ? 'Please approve the wallet prompt to continue…'
            : 'Connecting…'
          }</div>
          {/* Smooth loading bar */}
          <div style={{ width: 280, height: 8, borderRadius: 6, overflow: 'hidden', marginTop: 10, border: '1px solid rgba(255,255,255,0.15)', background: 'rgba(255,255,255,0.08)' }}>
            <div style={{ width: `${loadProg}%`, height: '100%', background: 'linear-gradient(90deg, #22d3ee, #14b8a6)', transition: 'width 100ms linear' }}></div>
          </div>
          {/* Only show auth buttons when ACTUALLY in auth phase (not during payment) */}
          {wsState.phase === 'authenticating' && !wsState.entryFee.pending && (
            <div style={{ marginTop: 10, display: 'flex', gap: 8 }}>
              <button className="btn-primary" onClick={() => signAuthentication?.()}>Sign again</button>
              <button className="btn-secondary" onClick={() => { leave?.(); setScreen('landing'); }}>Back</button>
            </div>
          )}
        </div>
      ) : null}
      {screen === 'landing' && (
        <Landing
          solPrice={solPrice}
          onPractice={onPractice}
          onTournament={onTournament}
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
        <Lobby onStart={() => setScreen('game')} onBack={() => setScreen('modes')} />
      )}
      {screen === 'game' && (
        <Game onEnd={() => setScreen('results')} onRestart={() => setScreen('game')} />
      )}
      {screen === 'results' && (
        <Results onPlayAgain={() => setScreen('practice')} onChangeTier={() => setScreen('modes')} />
      )}
      {/* Toast - appears ABOVE overlays for visibility */}
      {toast && (
        <div style={{ position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)', background: 'rgba(0,0,0,0.72)', color: '#fff', padding: '10px 14px', borderRadius: 10, zIndex: 10001, fontSize: 12, border: '1px solid rgba(255,255,255,0.18)' }}>
          {toast}
        </div>
      )}
    </div>
  );
}

function HeaderWallet({ screen }: { screen: string }) {
  const { publicKey, disconnect } = useWallet() as any;
  const style: React.CSSProperties = { position: 'fixed', top: 8, right: 12, zIndex: 50, background: 'rgba(0,0,0,0.4)', padding: '6px 10px', borderRadius: 8, color: '#00ffff', fontSize: 12, display: 'flex', alignItems: 'center', gap: 8 };
  if (publicKey) {
    const short = `${publicKey.slice(0,4)}…${publicKey.slice(-4)}`;
    return (
      <div style={style}>
        <span>{short}</span>
        <button className="btn-secondary" style={{ padding: '2px 6px', fontSize: 11 }} onClick={() => disconnect?.()}>Logout</button>
      </div>
    );
  }
  if (screen === 'game') {
    return <div style={style}>Simulation mode (no wallet)</div>;
  }
  return null;
}

function Landing({ solPrice, onPractice, onTournament }: { solPrice: number | null; onPractice: () => void; onTournament: () => void; }) {
  const { publicKey, isConnecting } = useWallet();
  const sendAnalytic = async (type: string, payload: any) => { try { await fetch(`${API_BASE}/analytics`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ type, payload }) }); } catch {} };
  const handleTournament = async () => {
    // Go to tier selection first; wallet prompt will occur on Join
    sendAnalytic('landing_cta_click', { publicKey: publicKey || null });
    onTournament();
  };

  // Get player stats from localStorage
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
    <div className="screen active" id="landing-screen">
      <div className="landing-container">
        <div className="brand-section">
          <h1 className="brand-title"><span className="text-gradient">SPERM</span><span className="text-accent">RACE</span><span className="text-gradient">.IO</span></h1>
          <p className="brand-punchline">Battle Royale starts at birth 💥</p>
          {stats.totalGames > 0 && (
            <div style={{
              display: 'flex',
              gap: '12px',
              justifyContent: 'center',
              marginTop: '16px',
              flexWrap: 'wrap'
            }}>
              <div style={{
                background: 'rgba(34,211,238,0.15)',
                border: '1px solid rgba(34,211,238,0.4)',
                borderRadius: '8px',
                padding: '8px 12px',
                fontSize: '12px',
                color: '#ffffff'
              }}>
                <div style={{ opacity: 0.7 }}>Games</div>
                <div style={{ fontWeight: 700, fontSize: '16px' }}>{stats.totalGames}</div>
              </div>
              <div style={{
                background: 'rgba(34,211,238,0.15)',
                border: '1px solid rgba(34,211,238,0.4)',
                borderRadius: '8px',
                padding: '8px 12px',
                fontSize: '12px',
                color: '#ffffff'
              }}>
                <div style={{ opacity: 0.7 }}>Win Rate</div>
                <div style={{ fontWeight: 700, fontSize: '16px' }}>{winRate}%</div>
              </div>
              <div style={{
                background: 'rgba(34,211,238,0.15)',
                border: '1px solid rgba(34,211,238,0.4)',
                borderRadius: '8px',
                padding: '8px 12px',
                fontSize: '12px',
                color: '#ffffff'
              }}>
                <div style={{ opacity: 0.7 }}>Kills</div>
                <div style={{ fontWeight: 700, fontSize: '16px' }}>{stats.totalKills}</div>
              </div>
              {stats.totalPrizes > 0 && (
                <div style={{
                  background: 'linear-gradient(135deg, rgba(251,146,60,0.2), rgba(34,211,238,0.2))',
                  border: '1px solid rgba(251,146,60,0.5)',
                  borderRadius: '8px',
                  padding: '8px 12px',
                  fontSize: '12px',
                  color: '#ffffff'
                }}>
                  <div style={{ opacity: 0.7 }}>💰 Prizes Won</div>
                  <div style={{ fontWeight: 700, fontSize: '16px' }}>{stats.totalPrizes.toFixed(4)} SOL</div>
                </div>
              )}
            </div>
          )}
        </div>
        <div className="cta-section">
          <button className="cta-primary" onClick={handleTournament} disabled={isConnecting}><span className="cta-text">{isConnecting ? 'Opening wallet…' : 'Enter Tournament'}</span><div className="cta-glow"/></button>
          <button className="btn-secondary btn-small" onClick={onPractice}>Practice (Free)</button>
          <div className="live-sol-price"><span className="price-label">SOL</span><span className="price-value">${solPrice?.toFixed(2) ?? '--'}</span></div>
        </div>
      </div>
      {/* Removed separate landing wallet overlay - handled by global overlay system */}
    </div>
  );
}

function Practice({ onFinish: _onFinish, onBack }: { onFinish: () => void; onBack: () => void }) {
  const [step, setStep] = useState<'lobby' | 'game'>('lobby');
  const [meId] = useState<string>('PLAYER_' + Math.random().toString(36).slice(2, 8));
  const [players, setPlayers] = useState<string[]>([]);
  const [countdown, setCountdown] = useState<number>(5);
  const countdownTotal = 5;

  useEffect(() => {
    if (step === 'lobby') {
      // Set up players
      const base = [meId];
      const bots = Array.from({ length: 7 }, (_, i) => `BOT_${i.toString(36)}${Math.random().toString(36).slice(2,4)}`);
      setPlayers([...base, ...bots]);
      
      // Set up countdown timer
      setCountdown(countdownTotal); // Start with 5 seconds
      let currentCountdown = countdownTotal;
      
      const t = setInterval(() => {
        currentCountdown -= 1;
        setCountdown(currentCountdown);
        
        if (currentCountdown <= 0) {
          clearInterval(t);
          setStep('game');
        }
      }, 1000); // Update every second
      
      return () => clearInterval(t);
    }
  }, [step, meId]);

  if (step === 'lobby') {
    const maxPlayers = 8;
    const progressPct = Math.max(0, Math.min(100, Math.floor(((countdownTotal - countdown) / countdownTotal) * 100)));
    return (
      <div className="screen active" id="lobby-screen">
        <div className="lobby-container">
          <div className="lobby-header"><div className="lobby-title">Lobby</div><div className="lobby-status">{players.length}/{maxPlayers}</div></div>
          <div className="queue-bar"><div className="queue-left"><span className="queue-dot" /><span>{players.length}</span></div><div className="queue-center"><span>Queued</span></div><div className="queue-right"><span>Target</span><span>{maxPlayers}</span></div></div>
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
          {/* Progress bar mirrors countdown to make waiting easier */}
          <div style={{ display: 'flex', justifyContent: 'center', marginTop: 12 }}>
            <div style={{ width: 320, height: 10, borderRadius: 8, overflow: 'hidden', border: '1px solid rgba(255,255,255,0.15)', background: 'rgba(255,255,255,0.08)' }}>
              <div style={{ width: `${progressPct}%`, height: '100%', background: 'linear-gradient(90deg, #22d3ee, #14b8a6)', transition: 'width 300ms ease' }}></div>
            </div>
          </div>
          <div className="lobby-footer"><button className="btn-secondary" onClick={onBack}>Back</button></div>
        </div>
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
    <div className="screen active" id="mode-screen">
      <div className="modes-sheet">
        <div className="sheet-grip" />
        <div className="modal-header"><h2 className="modal-title">Enter Sperm Race</h2><p className="modal-subtitle">Select a tier</p></div>
        {(preflightError) && (
          <div className="modal-subtitle" style={{ color: '#ff8080', marginBottom: 8 }}>Tournaments are temporarily unavailable (prize preflight issue).</div>
        )}
        {/* Overlay removed here; global overlay handles connecting/auth */}
        <div className="tournament-grid">
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
                    // Disable transition when animating to avoid conflicts
                    transition: (publicKey && !isJoining && wsState.phase !== 'connecting' && wsState.phase !== 'authenticating') ? 'none' : 'all 0.2s ease',
                    // Only set transform when NOT animating (animation will handle it)
                    ...(!(publicKey && !isJoining && wsState.phase !== 'connecting' && wsState.phase !== 'authenticating') && { transform: 'translateY(0px)' }),
                    // Add glowing animation when wallet is connected and ready
                    animation: publicKey && !isJoining && wsState.phase !== 'connecting' && wsState.phase !== 'authenticating'
                      ? 'buttonGlow 2s ease-in-out infinite, buttonPulse 2s ease-in-out infinite'
                      : 'none'
                  }}
                  disabled={
                    isJoining
                    || wsState.phase === 'connecting'
                    || wsState.phase === 'authenticating'
                    || preflightError
                    || (!!preflight && (!preflight.configured || !preflight.address || preflight.sol == null))
                  }
                  onClick={async () => {
                    setIsJoining(true);
                    const ok = publicKey ? true : await connect();
                    if (!ok) {
                      setIsJoining(false);
                      onNotify('Wallet not detected. Please install or unlock your wallet.');
                      return;
                    }
                    await connectAndJoin({ entryFeeTier: t.usd as any, mode: 'tournament' });
                  }}
                  onMouseEnter={(e) => {
                    if (publicKey && !isJoining && wsState.phase !== 'connecting' && wsState.phase !== 'authenticating') {
                      e.currentTarget.style.animation = 'none';
                      e.currentTarget.style.transform = 'translateY(-3px) scale(1.02)';
                      e.currentTarget.style.boxShadow = '0 12px 32px rgba(0,0,0,0.25), inset 0 1px 0 rgba(255,255,255,0.4), 0 0 35px rgba(34,211,238,0.8)';
                    } else {
                      e.currentTarget.style.transform = 'translateY(-2px)';
                      e.currentTarget.style.boxShadow = '0 12px 32px rgba(0,0,0,0.25), inset 0 1px 0 rgba(255,255,255,0.4)';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (publicKey && !isJoining && wsState.phase !== 'connecting' && wsState.phase !== 'authenticating') {
                      e.currentTarget.style.animation = 'buttonGlow 2s ease-in-out infinite, buttonPulse 2s ease-in-out infinite';
                      e.currentTarget.style.transform = 'translateY(0px)';
                      e.currentTarget.style.boxShadow = '0 8px 24px rgba(0,0,0,0.2), inset 0 1px 0 rgba(255,255,255,0.3)';
                    } else {
                      e.currentTarget.style.transform = 'translateY(0px)';
                      e.currentTarget.style.boxShadow = '0 8px 24px rgba(0,0,0,0.2), inset 0 1px 0 rgba(255,255,255,0.3)';
                    }
                  }}
                >{
                  preflightError ? 'Service unavailable'
                  : (preflight && (!preflight.configured || !preflight.address || preflight.sol == null)) ? 'Temporarily unavailable'
                  : (isJoining || wsState.phase === 'connecting' || wsState.phase === 'authenticating') ? 'Joining…'
                  : publicKey ? `🚀 ENTER RACE - READY!` : `🚀 ENTER RACE`
                }</button>
              </div>
            );
          })}
        </div>
        <div className="mode-footer">
          <button className="btn-secondary" onClick={onClose}>Back</button>
        </div>
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
    <div className="screen active" id="wallet-screen">
      <div className="modal-container">
        <div className="modal-header"><h2 className="modal-title">Connect Wallet</h2><p className="modal-subtitle">Sign in with Solana to continue</p></div>
        <div className="wallet-connect-section">
          <button className="wallet-connect-btn" onClick={tryConnect}><div className="wallet-icon">🔗</div><div className="wallet-text"><div className="wallet-title">Connect</div><div className="wallet-subtitle">Phantom / Solflare / Coinbase • build wallet-refactor</div></div></button>
          {publicKey && <div className="practice-hint">Connected: {publicKey.slice(0,4)}…{publicKey.slice(-4)}</div>}
        </div>
        <button className="btn-secondary" onClick={onClose}>Back</button>
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
    <div className="screen active" id="lobby-screen">
      <div className="lobby-container">
        <div className="lobby-header"><div className="lobby-title">Lobby</div><div className="lobby-status">{players.length}/{state.lobby?.maxPlayers ?? 16}</div></div>
        {state.lobby && (
          <div className="lobby-prize" style={{ margin: '8px 0 12px 0', opacity: 0.9 }}>
            <span>Estimated Prize:</span> <strong>${estimatedPrizeUsd}</strong> <span style={{ opacity: 0.75 }}>(85% of entries)</span>
          </div>
        )}
        {state.phase === 'connecting' || state.phase === 'authenticating' ? (
          <div className="loading-overlay" style={{ display: 'flex' }}>
            <div className="loading-spinner"></div>
            <div className="loading-text">{state.phase === 'connecting' ? 'Connecting…' : 'Authenticating…'}</div>
          </div>
        ) : null}
        <div className="queue-bar"><div className="queue-left"><span className="queue-dot" /><span>{players.length}</span></div><div className="queue-center"><span>Queued</span></div><div className="queue-right"><span>Target</span><span>{state.lobby?.maxPlayers ?? 16}</span></div></div>
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
        <div className="lobby-footer"><button className="btn-secondary" onClick={onBack}>Back</button></div>
      </div>
    </div>
  );
}

function Game({ onEnd, onRestart }: { onEnd: () => void; onRestart: () => void }) {
  const { state } = useWs();
  const [debugOn, setDebugOn] = useState<boolean>(() => {
    try { const v = localStorage.getItem('sr_debug'); return v === '1'; } catch { return false; }
  });
  useEffect(() => { try { localStorage.setItem('sr_debug', debugOn ? '1' : '0'); } catch {} }, [debugOn]);
  const isProd = (import.meta as any).env?.PROD === true;
  return (
    <div className="screen active" style={{ padding: 0 }}>
      <NewGameView 
        onReplay={onRestart} // restart the same game
        onExit={onEnd} // go to results
      />
      {/* debug overlay toggle (dev only) */}
      {!isProd && (
        <div style={{ position: 'fixed', bottom: 8, left: 8, zIndex: 9999, display: 'flex', gap: 8, alignItems: 'center' }}>
          <button onClick={() => setDebugOn(v => !v)} className="btn-secondary" style={{ padding: '4px 8px', fontSize: 12 }}>Debug {debugOn ? 'ON' : 'OFF'}</button>
          {debugOn && (
            <div style={{ background: 'rgba(0,0,0,0.5)', padding: '6px 8px', borderRadius: 6, color: '#fff', fontSize: 12 }}>
              Collision overlays ({(state.debugCollisions || []).length})
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
  // Compute compact summary: your kills and rank if known (use wsState.playerId)
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
  } catch {}
  return (
    <div className="screen active" id="round-end">
      <div className="modal-card">
        <div className="modal-header"><h2 className={`round-result ${isWinner ? 'victory' : 'defeat'}`}>{isWinner ? 'Fertilization!' : 'Eliminated'}</h2><p className="round-description">Winner: {winner ? `${winner.slice(0,4)}…${winner.slice(-4)}` : '—'}{typeof prize === 'number' ? ` • Prize: ${prize.toFixed(4)} SOL` : ''}</p></div>
        {solscan && (
          <div className="modal-subtitle"><a href={solscan} target="_blank" rel="noreferrer">View payout on Solscan</a></div>
        )}
        {rankText && (
          <div className="modal-subtitle">{rankText} • Kills: {wsState.kills?.[selfId] || 0}</div>
        )}
        <div className="round-actions"><button className="btn-primary" onClick={onPlayAgain}>Replay</button><button className="btn-secondary" onClick={onChangeTier}>Quit</button></div>
      </div>
    </div>
  );
}






















