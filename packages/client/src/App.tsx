import { useEffect, useState } from 'react';
// Base URL for backend API.
// For any spermrace.io host (prod/dev/www), always use same-origin /api so hosting can proxy
// and we avoid CORS issues when VITE_API_BASE points at api.spermrace.io.
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
import NewGameView from './NewGameView';
import { Leaderboard } from './Leaderboard';
import { WarningCircle, CreditCard, LinkSimple } from 'phosphor-react';
import { Modes } from './components/Modes';
import { PlayerCard } from './components/PlayerCard';
import './leaderboard.css';
import './hero-effects.css';
import './components/PlayerCard.css';

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
  const [toast] = useState<string | null>(null);
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
            background: 'rgba(3,3,5,0.96)',
            border: '1px solid rgba(255,255,255,0.12)',
            boxShadow: '0 24px 80px rgba(0,0,0,0.9)'
          }}>
            <div style={{ textAlign: 'center', marginBottom: '16px' }}>
              <div className="modal-title" style={{ fontSize: '24px', fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                <WarningCircle size={24} weight="fill" />
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
                  ? 'Top up your wallet with SOL to continue racing'
                  : 'Connect a wallet or buy SOL to get started'}
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
                    background: '#00F0FF',
                    boxShadow: '0 8px 26px rgba(0,240,255,0.45)',
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
                  >
                    <CreditCard size={18} weight="fill" style={{ marginRight: 8 }} />
                    Buy SOL
                  </button>
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
          <div style={{ width: 280, height: 8, borderRadius: 6, overflow: 'hidden', marginTop: 10, border: '1px solid rgba(255,255,255,0.15)', background: 'rgba(255,255,255,0.04)' }}>
            <div style={{ width: `${loadProg}%`, height: '100%', background: '#00F0FF', transition: 'width 100ms linear' }}></div>
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
          onWallet={() => setScreen('wallet')}
          onLeaderboard={() => setShowLeaderboard(true)}
        />
      )}
      {screen === 'practice' && (
        <Practice onFinish={() => setScreen('results')} onBack={() => setScreen('landing')} />
      )}
      {screen === 'wallet' && (
        <Wallet onConnected={() => setScreen('lobby')} onClose={() => setScreen('landing')} />
      )}
      {screen === 'lobby' && (
        <Lobby onStart={() => setScreen('game')} onBack={() => setScreen('landing')} />
      )}
      {screen === 'game' && (
        <Game onEnd={() => setScreen('results')} onRestart={() => setScreen('game')} />
      )}
      {screen === 'results' && (
        <Results onPlayAgain={() => setScreen('practice')} onChangeTier={() => setScreen('landing')} />
      )}
      {/* Toast - appears ABOVE overlays for visibility */}
      {toast && (
        <div style={{ position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)', background: 'rgba(0,0,0,0.72)', color: '#fff', padding: '10px 14px', borderRadius: 10, zIndex: 10001, fontSize: 12, border: '1px solid rgba(255,255,255,0.18)' }}>
          {toast}
        </div>
      )}

      {/* Leaderboard Modal */}
      {showLeaderboard && (
        <Leaderboard
          onClose={() => setShowLeaderboard(false)}
          apiBase={API_BASE}
          myWallet={publicKey || null}
          isMobile={false}
        />
      )}
    </div>
  );
}

function HeaderWallet({ screen }: { screen: string }) {
  const { publicKey, disconnect } = useWallet() as any;
  const style: React.CSSProperties = {
    position: 'fixed',
    top: 12,
    right: 16,
    zIndex: 50,
    background: 'rgba(3,3,5,0.9)',
    padding: '6px 10px',
    borderRadius: 999,
    border: '1px solid rgba(255,255,255,0.12)',
    color: 'var(--text-secondary)',
    fontSize: 12,
    display: 'flex',
    alignItems: 'center',
    gap: 8,
  };
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

function Landing({
  solPrice,
  onPractice,
  onWallet,
  onLeaderboard,
}: {
  solPrice: number | null;
  onPractice: () => void;
  onWallet: () => void;
  onLeaderboard?: () => void;
}) {
  return (
    <div className="screen active" id="landing-screen">
      <div
        className="landing-container"
        style={{
          maxWidth: 960,
          padding: '48px 24px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '100vh',
          gap: 32,
        }}
      >
        {/* Hero Title */}
        <header style={{ textAlign: 'center' }}>
          <h1
            className="brand-title"
            style={{
              fontSize: 'clamp(3rem, 10vw, 5.4rem)',
              letterSpacing: '0.3em',
              textTransform: 'uppercase',
            }}
          >
            <span style={{ color: 'var(--text-primary)' }}>SPERM</span>
            <span
              style={{
                marginLeft: 16,
                color: 'transparent',
                WebkitTextStroke: '1px rgba(255,255,255,0.7)',
              }}
            >
              RACE
            </span>
          </h1>
          <p
            style={{
              marginTop: 16,
              fontSize: 13,
              textTransform: 'uppercase',
              letterSpacing: 6,
              color: 'var(--text-secondary)',
            }}
          >
            BIO-ARENA PROTOCOL
          </p>
        </header>

        {/* Modes Grid */}
        <Modes />

        {/* Footer */}
        <footer
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 8,
            marginTop: 16,
          }}
        >
          <div style={{ display: 'flex', gap: 16 }}>
            <button
              type="button"
              className="btn-secondary"
              style={{ background: 'transparent', border: 'none', padding: 0 }}
              onClick={onPractice}
            >
              Practice
            </button>
            <button
              type="button"
              className="btn-secondary"
              style={{ background: 'transparent', border: 'none', padding: 0 }}
              onClick={onWallet}
            >
              Wallet
            </button>
            {onLeaderboard && (
              <button
                type="button"
                className="btn-secondary"
                style={{ background: 'transparent', border: 'none', padding: 0 }}
                onClick={onLeaderboard}
              >
                Leaderboard
              </button>
            )}
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
            SOL: {solPrice != null ? `$${solPrice.toFixed(2)}` : '--'}
          </div>
        </footer>
      </div>
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

          {/* Player Cards Grid for Practice Mode */}
          <div className="player-cards-grid" style={{ marginBottom: '16px' }}>
            {players.map((pid: string, index: number) => {
              const name = pid.startsWith('BOT_') ? `Bot ${index}` : pid;
              const isMe = pid === meId;
              return (
                <PlayerCard
                  key={pid}
                  playerId={pid}
                  playerName={name}
                  isMe={isMe}
                  isReady={true}
                  index={index}
                />
              );
            })}
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
          {/* Progress bar mirrors countdown to make waiting easier */}
          <div style={{ display: 'flex', justifyContent: 'center', marginTop: 12 }}>
            <div style={{ width: 320, height: 10, borderRadius: 8, overflow: 'hidden', border: '1px solid rgba(255,255,255,0.15)', background: 'rgba(255,255,255,0.04)' }}>
              <div style={{ width: `${progressPct}%`, height: '100%', background: '#00F0FF', transition: 'width 300ms ease' }}></div>
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
          <button className="wallet-connect-btn" onClick={tryConnect}>
            <div className="wallet-icon">
              <LinkSimple size={18} weight="bold" />
            </div>
            <div className="wallet-text">
              <div className="wallet-title">Connect</div>
              <div className="wallet-subtitle">Phantom / Solflare / Coinbase • build wallet-refactor</div>
            </div>
          </button>
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
        
        {/* Player Cards Grid */}
        <div className="player-cards-grid">
          {players.map((pid: string, index: number) => {
            const name = state.lobby?.playerNames?.[pid] || (pid.startsWith("guest-") ? "Guest" : pid.slice(0, 4) + "…" + pid.slice(-4));
            const isMe = pid === state.playerId;
            return (
              <PlayerCard
                key={pid}
                playerId={pid}
                playerName={name}
                isMe={isMe}
                isReady={true}
                index={index}
              />
            );
          })}
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

// Helper component for tech-styled progress bar
function TechProgressBar({ label, value, max, suffix = '', theme = 'cyan' }: {
  label: string;
  value: number;
  max: number;
  suffix?: string;
  theme?: 'cyan' | 'gold' | 'danger';
}) {
  const percentage = Math.min(100, Math.max(0, (value / max) * 100));
  const themeClass = theme === 'gold' ? 'gold' : theme === 'danger' ? 'danger' : '';

  return (
    <div className="tech-progress-bar">
      <div className="tech-progress-label">
        <span className="label-text">{label}</span>
        <span className="label-value">{value}{suffix} / {max}{suffix}</span>
      </div>
      <div className="tech-progress-track">
        <div className={`tech-progress-fill ${themeClass}`} style={{ width: `${percentage}%` }} />
      </div>
    </div>
  );
}

// Helper component for tech gauge
function TechGauge({ label, value, subtext, theme = 'cyan' }: {
  label: string;
  value: string | number;
  subtext?: string;
  theme?: 'cyan' | 'gold';
}) {
  const themeClass = theme === 'gold' ? 'gold' : 'accent';

  return (
    <div className="tech-gauge">
      <div className="gauge-label">{label}</div>
      <div className={`gauge-value ${themeClass}`}>{value}</div>
      {subtext && <div className="gauge-subtext">{subtext}</div>}
    </div>
  );
}

// Stats display component
function MatchStats({ wsState, selfId, isWinner }: {
  wsState: any;
  selfId: string;
  isWinner: boolean;
}) {
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
    const winner = wsState.lastRound?.winnerId;
    if (winner) rankMap[winner] = 1;
    let r = 2;
    for (let i = uniqueOrder.length - 1; i >= 0; i--) {
      const pid = uniqueOrder[i];
      if (pid && !rankMap[pid]) { rankMap[pid] = r; r++; }
    }
    rank = rankMap[selfId] || 0;
  } catch {}

  // Calculate performance rating
  const getPerformanceRating = () => {
    if (!rank) return { rating: 'N/A', stars: 0, class: '' };
    const percentile = (totalPlayers - rank + 1) / totalPlayers;
    if (percentile >= 0.8 || isWinner) return { rating: 'Excellent', stars: 5, class: 'excellent' };
    if (percentile >= 0.6) return { rating: 'Good', stars: 4, class: 'good' };
    if (percentile >= 0.4) return { rating: 'Average', stars: 3, class: 'average' };
    return { rating: 'Keep Practicing', stars: 2, class: 'poor' };
  };

  const performance = getPerformanceRating();

  return (
    <div className="match-stats-dashboard">
      {/* Performance Rating */}
      <div style={{ textAlign: 'center', marginBottom: '20px' }}>
        <div className={`performance-rating ${performance.class}`}>
          <div className="rating-stars">
            {[1, 2, 3, 4, 5].map((star) => (
              <span
                key={star}
                className={`rating-star ${star <= performance.stars ? 'active' : ''}`}
              >
                ★
              </span>
            ))}
          </div>
          <span className="rating-text">{performance.rating}</span>
        </div>
      </div>

      {/* Tech Gauges */}
      <div className="tech-gauge-container">
        <TechGauge label="Rank" value={`#${rank}`} subtext={`of ${totalPlayers}`} theme={isWinner ? 'gold' : 'cyan'} />
        <TechGauge label="Kills" value={myKills} subtext="eliminations" />
        <TechGauge label="Survival" value={`${rank <= totalPlayers / 3 ? 'Top' : ''}${Math.round(((totalPlayers - rank + 1) / totalPlayers) * 100)}%`} subtext="of players" />
      </div>

      {/* Progress Bars */}
      {totalPlayers > 0 && (
        <>
          <TechProgressBar
            label="Placement"
            value={totalPlayers - rank + 1}
            max={totalPlayers}
            suffix=""
            theme={isWinner ? 'gold' : 'cyan'}
          />
          <TechProgressBar
            label="Kill Performance"
            value={myKills}
            max={Math.max(5, Math.ceil(totalPlayers / 3))}
            suffix=""
            theme={myKills > 0 ? 'cyan' : 'danger'}
          />
        </>
      )}

      {/* Stats Grid */}
      <div className="match-stats-grid">
        <div className="stat-card">
          <div className="stat-card-label">Final Position</div>
          <div className={`stat-card-value ${isWinner ? 'gold' : ''}`}>#{rank}</div>
        </div>
        <div className="stat-card">
          <div className="stat-card-label">Total Players</div>
          <div className="stat-card-value">{totalPlayers}</div>
        </div>
        <div className="stat-card">
          <div className="stat-card-label">Eliminations</div>
          <div className="stat-card-value highlight">{myKills}</div>
        </div>
        <div className="stat-card">
          <div className="stat-card-label">Win Rate</div>
          <div className="stat-card-value">{isWinner ? '100%' : '0%'}</div>
        </div>
      </div>
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
    <div className="screen active" id="round-end">
      <div className="modal-card">
        <div className="modal-header"><h2 className={`round-result ${isWinner ? 'victory' : 'defeat'}`}>{isWinner ? 'Fertilization!' : 'Eliminated'}</h2><p className="round-description">Winner: {winner ? `${winner.slice(0,4)}…${winner.slice(-4)}` : '—'}{typeof prize === 'number' ? ` • Prize: ${prize.toFixed(4)} SOL` : ''}</p></div>
        {solscan && (
          <div className="modal-subtitle"><a href={solscan} target="_blank" rel="noreferrer">View payout on Solscan</a></div>
        )}

        {/* Tech-styled Match Stats */}
        <MatchStats wsState={wsState} selfId={selfId} isWinner={isWinner} />

        <div className="round-actions">
          <button className="btn-primary" onClick={handlePlayAgain} disabled={playAgainBusy}>{playAgainBusy ? 'Joining…' : 'Replay'}</button>
          <button className="btn-secondary" onClick={onChangeTier}>Quit</button>
        </div>
      </div>
    </div>
  );
}





















