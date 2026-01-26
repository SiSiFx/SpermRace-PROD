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
import './leaderboard.css';
import './style-enhancements.css';

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
      {/* Premium animated background */}
      <div className="bio-bg-gradient" />
      <div className="bio-grid-overlay" />

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
          position: 'relative',
        }}
      >
        {/* Multi-layered border system with depth */}
        <div className="border-layer-1" />
        <div className="border-layer-2" />
        <div className="border-layer-3" />

        {/* Enhanced Bio-Cyberpunk Glow Effects */}
        <div className="bio-glow-sphere glow-primary" />
        <div className="bio-glow-sphere glow-secondary" />
        <div className="bio-glow-sphere glow-tertiary" />

        {/* Enhanced DNA Particle System with more sophisticated motion */}
        <div className="dna-particle-system">
          {[...Array(12)].map((_, i) => (
            <div
              key={i}
              className="dna-particle"
              style={{
                '--delay': `${i * 0.3}s`,
                '--x': `${Math.sin(i * 0.5) * 15}%`,
                '--y': `${(i * 8) % 100}%`,
                '--size': `${Math.random() * 4 + 2}px`,
                '--color': i % 3 === 0 ? 'var(--accent)' : i % 3 === 1 ? 'var(--accent-cyan)' : 'var(--accent-purple)',
              } as any}
            />
          ))}
        </div>

        {/* Premium Hero Title with sophisticated typography */}
        <header className="landing-header">
          {/* Multi-layered chromatic aberration */}
          <div className="title-chromatic-layer chromatic-red" />
          <div className="title-chromatic-layer chromatic-cyan" />
          <div className="title-chromatic-layer chromatic-green" />

          {/* Main title with enhanced gradient and depth */}
          <h1 className="brand-title-premium">
            <span className="title-word">SPERM</span>
            <span className="title-separator" />
            <span className="title-word">RACE</span>
            <span className="title-underline" />
          </h1>

          {/* Premium subtitle with animated decorations */}
          <div className="subtitle-container">
            <span className="subtitle-line" />
            <p className="subtitle-text">
              <span className="subtitle-char" style={{ '--delay': '0s' }}>B</span>
              <span className="subtitle-char" style={{ '--delay': '0.05s' }}>I</span>
              <span className="subtitle-char" style={{ '--delay': '0.1s' }}>O</span>
              <span className="subtitle-char" style={{ '--delay': '0.15s' }}>-</span>
              <span className="subtitle-char" style={{ '--delay': '0.2s' }}>A</span>
              <span className="subtitle-char" style={{ '--delay': '0.25s' }}>R</span>
              <span className="subtitle-char" style={{ '--delay': '0.3s' }}>E</span>
              <span className="subtitle-char" style={{ '--delay': '0.35s' }}>N</span>
              <span className="subtitle-char" style={{ '--delay': '0.4s' }}>A</span>
              <span className="subtitle-char" style={{ '--delay': '0.45s' }}>&nbsp;</span>
              <span className="subtitle-char" style={{ '--delay': '0.5s' }}>P</span>
              <span className="subtitle-char" style={{ '--delay': '0.55s' }}>R</span>
              <span className="subtitle-char" style={{ '--delay': '0.6s' }}>O</span>
              <span className="subtitle-char" style={{ '--delay': '0.65s' }}>T</span>
              <span className="subtitle-char" style={{ '--delay': '0.7s' }}>O</span>
              <span className="subtitle-char" style={{ '--delay': '0.75s' }}>C</span>
              <span className="subtitle-char" style={{ '--delay': '0.8s' }}>O</span>
              <span className="subtitle-char" style={{ '--delay': '0.85s' }}>L</span>
            </p>
            <span className="subtitle-line" />
          </div>

          {/* Decorative tech elements */}
          <div className="header-decorations">
            <div className="tech-corner corner-tl">
              <span className="corner-line" />
              <span className="corner-dot" />
            </div>
            <div className="tech-corner corner-tr">
              <span className="corner-line" />
              <span className="corner-dot" />
            </div>
            <div className="tech-corner corner-bl">
              <span className="corner-line" />
              <span className="corner-dot" />
            </div>
            <div className="tech-corner corner-br">
              <span className="corner-line" />
              <span className="corner-dot" />
            </div>
          </div>
        </header>

        {/* Modes Grid */}
        <div style={{ position: 'relative', zIndex: 1 }}>
          <Modes />
        </div>

        {/* Premium Footer */}
        <footer className="landing-footer">
          <nav className="footer-nav">
            <button
              type="button"
              className="footer-link"
              onClick={onPractice}
            >
              <span className="link-icon">▶</span>
              <span className="link-text">Practice</span>
            </button>
            <span className="footer-divider" />
            <button
              type="button"
              className="footer-link"
              onClick={onWallet}
            >
              <span className="link-icon">◆</span>
              <span className="link-text">Wallet</span>
            </button>
            {onLeaderboard && (
              <>
                <span className="footer-divider" />
                <button
                  type="button"
                  className="footer-link"
                  onClick={onLeaderboard}
                >
                  <span className="link-icon">▽</span>
                  <span className="link-text">Leaderboard</span>
                </button>
              </>
            )}
          </nav>
          <div className="footer-sol">
            <span className="sol-label">SOL</span>
            <span className="sol-divider">:</span>
            <span className="sol-value">
              {solPrice != null ? `$${solPrice.toFixed(2)}` : '--'}
            </span>
            <span className="sol-indicator" />
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
        {/* Animated Border Effects */}
        <div className="lobby-border-glow" />
        <div className="lobby-scanline" />

        <div className="lobby-header">
          <div className="lobby-title">
            <span className="title-icon">◈</span>
            <span>COMMAND CENTER</span>
            <div className="title-pulse" />
          </div>
          <div className="lobby-status">
            <span className="status-label">ROSTER</span>
            <span className="status-value">{players.length}/{state.lobby?.maxPlayers ?? 16}</span>
            <div className="status-indicator" />
          </div>
        </div>

        {state.lobby && (
          <div className="lobby-prize-panel">
            <div className="prize-glow" />
            <div className="prize-content">
              <span className="prize-label">ESTIMATED PRIZE POOL</span>
              <div className="prize-amount">
                <span className="currency-symbol">$</span>
                <span className="amount-value">{estimatedPrizeUsd}</span>
                <span className="prize-pulse" />
              </div>
              <span className="prize-note">85% winner distribution</span>
            </div>
          </div>
        )}

        {state.phase === 'connecting' || state.phase === 'authenticating' ? (
          <div className="loading-overlay" style={{ display: 'flex' }}>
            <div className="loading-spinner"></div>
            <div className="loading-text">{state.phase === 'connecting' ? 'Connecting…' : 'Authenticating…'}</div>
          </div>
        ) : null}

        {/* Enhanced Queue Bar with Data Flow */}
        <div className="queue-bar">
          <div className="queue-data-stream" />
          <div className="queue-left">
            <span className="queue-dot" />
            <span className="queue-value">{players.length}</span>
            <span className="queue-label">ACTIVE</span>
          </div>
          <div className="queue-center">
            <span className="queue-status">QUEUED</span>
            <div className="queue-particles">
              {[...Array(5)].map((_, i) => (
                <span key={i} className="particle" style={{ '--delay': `${i * 0.2}s` } as any} />
              ))}
            </div>
          </div>
          <div className="queue-right">
            <span className="queue-label">TARGET</span>
            <span className="queue-value">{state.lobby?.maxPlayers ?? 16}</span>
          </div>
        </div>

        {/* Holographic Player List */}
        <div className="player-hologrid">
          <div className="hologrid-header">
            <span className="hologrid-title">ACTIVE OPERATORS</span>
            <div className="hologrid-line" />
            <span className="hologrid-count">{players.length} UNITS</span>
          </div>
          <div className="hologrid-content">
            {players.map((pid: string) => {
              const name = state.lobby?.playerNames?.[pid] || (pid.startsWith("guest-") ? "Guest" : pid.slice(0, 4) + "…" + pid.slice(-4));
              const isMe = pid === state.playerId;
              return (
                <div key={pid} className={`hologram-player ${isMe ? 'player-highlight' : ''}`}>
                  <div className="player-scan" />
                  <span className="player-name">{name}</span>
                  <div className="player-data-bits">
                    {[...Array(3)].map((_, i) => (
                      <span key={i} className="data-bit" style={{ '--delay': `${i * 0.15}s` } as any} />
                    ))}
                  </div>
                  {isMe && <div className="player-indicator">YOU</div>}
                </div>
              );
            })}
          </div>
        </div>

        {/* Enhanced Orbit with Bio-Tech Aesthetics */}
        <div className="lobby-orbit">
          <div className="orbit-particles">
            {[...Array(12)].map((_, i) => (
              <div key={i} className="orbit-particle" style={{ '--angle': `${i * 30}deg`, '--delay': `${i * 0.1}s` } as any} />
            ))}
          </div>
          <div className="orbit-center">
            <div className="center-core" />
            <div className="center-ring-1" />
            <div className="center-ring-2" />
            <div className="center-pulse" />
          </div>
          <div className="orbit-ring">
            {players.map((p: string, i: number) => (
              <div key={p} className="orbit-sperm" style={{ '--i': i, '--n': players.length } as any} />
            ))}
          </div>
          {state.countdown && (
            <div className="countdown-halo">
              <div className="halo-ring">
                <div className="halo-segment-1" />
                <div className="halo-segment-2" />
                <div className="halo-segment-3" />
              </div>
              <div className="halo-timer">{state.countdown.remaining}s</div>
              <div className="halo-warning">LAUNCH SEQUENCE</div>
            </div>
          )}
        </div>

        <div className="lobby-footer">
          <button className="btn-secondary" onClick={onBack}>
            <span className="btn-icon">◀</span>
            <span>ABORT MISSION</span>
          </button>
        </div>
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
  const { state: wsState, connectAndJoin } = useWs();
  const { publicKey } = useWallet();
  const tx = wsState.lastRound?.txSignature;
  const winner = wsState.lastRound?.winnerId;
  const prize = wsState.lastRound?.prizeAmount;
  const solscan = tx ? `https://solscan.io/tx/${tx}${SOLANA_CLUSTER === 'devnet' ? '?cluster=devnet' : ''}` : null;
  const selfId = wsState.playerId || publicKey || '';
  const isWinner = !!winner && winner === selfId;
  const [playAgainBusy, setPlayAgainBusy] = useState(false);
  const [showResult, setShowResult] = useState(false);
  const [showParticles, setShowParticles] = useState(false);

  // Trigger cinematic entrance animation
  useEffect(() => {
    const timer1 = setTimeout(() => setShowResult(true), 100);
    const timer2 = setTimeout(() => setShowParticles(true), 400);
    return () => { clearTimeout(timer1); clearTimeout(timer2); };
  }, []);

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
      {/* Cinematic scanline sweep overlay */}
      <div className={`cinematic-scanline ${isWinner ? 'victory-scan' : 'defeat-scan'}`} />

      {/* Particle explosion effect for victory */}
      {isWinner && showParticles && (
        <div className="victory-particles">
          {[...Array(20)].map((_, i) => (
            <div key={i} className="particle" style={{
              '--delay': `${Math.random() * 0.5}s`,
              '--x': `${(Math.random() - 0.5) * 200}px`,
              '--y': `${(Math.random() - 0.5) * 200}px`,
              '--size': `${Math.random() * 8 + 4}px`
            } as React.CSSProperties} />
          ))}
        </div>
      )}

      {/* DNA Helix animation for victory */}
      {isWinner && (
        <div className="dna-helix-container">
          <div className="dna-strand strand-1"></div>
          <div className="dna-strand strand-2"></div>
        </div>
      )}

      {/* Screen shake for defeat */}
      {!isWinner && <div className="screen-shake"></div>}

      <div className={`modal-card ${isWinner ? 'victory-modal' : 'defeat-modal'} ${showResult ? 'result-visible' : ''}`}>
        {/* Victory header */}
        {isWinner ? (
          <div className="modal-header">
            <div className="victory-icon">🧬</div>
            <h2 className="round-result victory">
              <span className="result-text">FERTILIZATION!</span>
              <span className="result-glow"></span>
            </h2>
            <p className="round-description victory-desc">
              Winner: {winner ? `${winner.slice(0,4)}…${winner.slice(-4)}` : '—'}
              {typeof prize === 'number' && (
                <span className="prize-amount">
                  {' '}• Prize: <span className="prize-number">{prize.toFixed(4)}</span> SOL
                </span>
              )}
            </p>
          </div>
        ) : (
          /* Defeat header */
          <div className="modal-header">
            <div className="defeat-icon">⚠</div>
            <h2 className="round-result defeat">
              <span className="result-text">ELIMINATED</span>
              <span className="glitch-overlay"></span>
            </h2>
            <p className="round-description defeat-desc">
              Winner: {winner ? `${winner.slice(0,4)}…${winner.slice(-4)}` : '—'}
              {typeof prize === 'number' && ` • Prize: ${prize.toFixed(4)} SOL`}
            </p>
          </div>
        )}

        {/* Stats display with holographic effect */}
        <div className="stats-hologram">
          {solscan && (
            <div className="stat-line">
              <a href={solscan} target="_blank" rel="noreferrer" className="hologram-link">
                <span className="stat-label">TRANSACTION</span>
                <span className="stat-value external">View on Solscan ↗</span>
              </a>
            </div>
          )}
          {rankText && (
            <div className="stat-line">
              <span className="stat-label">RANK</span>
              <span className="stat-value">{rankText}</span>
            </div>
          )}
          <div className="stat-line">
            <span className="stat-label">KILLS</span>
            <span className="stat-value">{wsState.kills?.[selfId] || 0}</span>
          </div>
        </div>

        {/* Action buttons with bio-glow */}
        <div className="round-actions">
          <button
            className={`action-btn ${isWinner ? 'victory-btn' : 'defeat-btn'}`}
            onClick={handlePlayAgain}
            disabled={playAgainBusy}
          >
            <span className="btn-bg"></span>
            <span className="btn-text">{playAgainBusy ? 'JOINING...' : 'REPLAY'}</span>
            <span className="btn-glow"></span>
          </button>
          <button className="action-btn secondary-btn" onClick={onChangeTier}>
            <span className="btn-bg"></span>
            <span className="btn-text">QUIT</span>
          </button>
        </div>

        {/* Decorative tech elements */}
        <div className="tech-corner corner-tl"></div>
        <div className="tech-corner corner-tr"></div>
        <div className="tech-corner corner-bl"></div>
        <div className="tech-corner corner-br"></div>
      </div>
    </div>
  );
}





















