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
import HowToPlayOverlay from './HowToPlayOverlay';
import { Leaderboard } from './Leaderboard';

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
      {/* Header wallet + status */}
      <HeaderWallet screen={screen} status={statusText} />
      <div id="bg-particles" />
      
      {/* PC: Keyboard shortcuts hint */}
      <div className="pc-shortcuts-hint">
        <div className="shortcut-item">
          <kbd>ESC</kbd> Back
        </div>
        <div className="shortcut-item">
          <kbd>P</kbd> Practice
        </div>
        <div className="shortcut-item">
          <kbd>T</kbd> Tournament
        </div>
      </div>

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
              <div style={{ fontSize: '52px', marginBottom: '8px' }}>
                {wsState.lastError.toLowerCase().includes('insufficient') ? '💸' : '⚠️'}
              </div>
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
                  ? '🚀 Top up your wallet with SOL to continue racing'
                  : '🔗 Connect a wallet or buy SOL to get started'}
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
                  >💳 Buy SOL</button>
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
          onLeaderboard={() => setShowLeaderboard(true)}
        />
      )}
      {screen === 'practice' && (
        <Practice onFinish={() => setScreen('results')} onBack={() => setScreen('landing')} />
      )}
      {screen === 'modes' && (
        <TournamentModesScreen onSelect={() => setScreen('wallet')} onClose={() => setScreen('landing')} onNotify={showToast} />
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

      {/* Help toggle */}
      <button
        onClick={() => setShowHowTo(true)}
        title="How to play"
        style={{ position: 'fixed', top: 10, left: 10, zIndex: 60, padding: '6px 8px', borderRadius: 8, background: 'rgba(0,0,0,0.55)', color: '#c7d2de', border: '1px solid rgba(255,255,255,0.12)', fontSize: 12, cursor: 'pointer' }}
      >
        ?
      </button>
      {showHelp && (
        <div style={{ position: 'fixed', top: 44, left: 10, zIndex: 60, padding: '10px 12px', borderRadius: 10, background: 'rgba(0,0,0,0.80)', color: '#c7d2de', border: '1px solid rgba(255,255,255,0.12)', fontSize: 12, maxWidth: 320 }}>
          <div style={{ fontWeight: 700, marginBottom: 6 }}>Controls</div>
          <div>• Aim with mouse</div>
          <div>• Boost: Space or B</div>
          <div>• Back: ESC</div>
        </div>
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

function HeaderWallet({ screen, status }: { screen: string; status: string }) {
  const { publicKey, disconnect } = useWallet() as any;
  const style: React.CSSProperties = {
    position: 'fixed',
    top: 16,
    right: 16,
    zIndex: 60,
    background: 'rgba(0,0,0,0.65)',
    padding: '10px 16px',
    borderRadius: 10,
    fontSize: 13,
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    border: '1px solid rgba(255,255,255,0.15)'
  };

  if (publicKey) {
    const short = `${publicKey.slice(0,6)}…${publicKey.slice(-6)}`;
    return (
      <div style={style}>
        <span style={{ color: '#c7d2de', opacity: 0.7, fontSize: 12 }}>{status}</span>
        <span style={{ color: 'rgba(255,255,255,0.3)' }}>•</span>
        <span style={{ fontFamily: 'JetBrains Mono, monospace', color: '#00ffff' }}>{short}</span>
        <button className="btn-secondary" style={{ padding: '4px 10px', fontSize: 12 }} onClick={() => disconnect?.()}>Disconnect</button>
      </div>
    );
  }
  if (screen === 'game') {
    return <div style={style}>🎮 Simulation mode (no wallet)</div>;
  }
  // Show status even when not connected
  return <div style={{ ...style, color: '#c7d2de' }}>{status}</div>;
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

  return (
    <div className="screen active pc-landing" id="landing-screen">
      <div
        className="landing-container"
        style={{
          maxWidth: 1200,
          margin: '0 auto',
          minHeight: '100vh',
          padding: '48px 24px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'stretch',
          justifyContent: 'center',
          gap: 32,
        }}
      >
        <header style={{ textAlign: 'center' }}>
          <div
            style={{
              fontFamily: 'Orbitron, system-ui, -apple-system, BlinkMacSystemFont, sans-serif',
              letterSpacing: '0.22em',
              fontSize: 12,
              textTransform: 'uppercase',
              color: 'rgba(148,163,184,0.9)',
              marginBottom: 12,
            }}
          >
            BIO-ARENA PROTOCOL
          </div>
          <h1
            style={{
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'baseline',
              gap: 12,
              fontSize: 56,
              lineHeight: 1,
            }}
          >
            <span style={{ color: '#fff', fontWeight: 800 }}>SPERM</span>
            <span
              style={{
                fontWeight: 800,
                color: 'transparent',
                WebkitTextStroke: '1px rgba(148,163,184,0.9)',
              }}
            >
              RACE
            </span>
          </h1>
          <p
            style={{
              marginTop: 16,
              fontSize: 14,
              letterSpacing: '0.18em',
              textTransform: 'uppercase',
              color: 'rgba(148,163,184,0.9)',
            }}
          >
            ON-CHAIN FERTILIZATION BATTLE ROYALE
          </p>
          <div
            style={{
              marginTop: 10,
              fontSize: 12,
              color: 'rgba(148,163,184,0.75)',
              fontFamily: 'JetBrains Mono, ui-monospace, SFMono-Regular, Menlo, monospace',
            }}
          >
            SOL: {solPrice != null ? `$${solPrice.toFixed(2)}` : '--.--'}
          </div>
        </header>

        <main>
          {/* Hero CTAs: emphasize paid tournaments while keeping free option visible */}
          <section
            style={{
              marginTop: 24,
              display: 'flex',
              justifyContent: 'center',
              gap: 12,
              flexWrap: 'wrap',
            }}
          >
            <button
              type="button"
              className="cta-primary"
              style={{ minWidth: 260, position: 'relative' }}
              onClick={() => onTournament?.()}
            >
              <span className="cta-text">Play for SOL (from $1)</span>
              <div className="cta-glow" />
            </button>

            <button
              type="button"
              className="btn-secondary"
              style={{
                padding: '10px 18px',
                fontSize: 12,
                textTransform: 'uppercase',
                letterSpacing: '0.14em',
              }}
              onClick={onPractice}
            >
              Race for Free
            </button>
          </section>

          <div
            style={{
              marginTop: 8,
              fontSize: 11,
              textAlign: 'center',
              color: 'rgba(148,163,184,0.7)',
            }}
          >
            Select your entry tier on the next screen. Micro races start at $1.
          </div>
        </main>

        <footer
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginTop: 8,
            gap: 12,
            fontSize: 12,
            color: 'rgba(148,163,184,0.85)',
          }}
        >
          <div style={{ display: 'flex', gap: 12 }}>
            <button
              type="button"
              className="btn-secondary"
              style={{ padding: '4px 10px', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.12em' }}
              onClick={onPractice}
            >
              Practice
            </button>
            {onLeaderboard && (
              <button
                type="button"
                className="btn-secondary"
                style={{ padding: '4px 10px', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.12em' }}
                onClick={onLeaderboard}
              >
                Leaderboard
              </button>
            )}
          </div>
          <button
            type="button"
            className="btn-secondary"
            style={{ padding: '4px 10px', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.12em' }}
            onClick={onWallet}
          >
            Wallet
          </button>
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
  }, [step, meId]);

  if (step === 'lobby') {
    const maxPlayers = 8;
    const progressPct = Math.max(0, Math.min(100, Math.floor(((countdownTotal - countdown) / countdownTotal) * 100)));
    return (
      <div className="screen active pc-lobby" id="lobby-screen">
        <div className="lobby-container pc-lobby-container">
          <div className="lobby-header">
            <div className="lobby-title">🎮 Practice Lobby</div>
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

function TournamentModesScreen({ onSelect: _onSelect, onClose, onNotify }: { onSelect: () => void; onClose: () => void; onNotify: (msg: string, duration?: number) => void }) {
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
        {preflightError && (
          <div className="modal-subtitle" style={{ color: '#ff8080', marginBottom: 8 }}>Tournaments are temporarily unavailable (prize preflight issue).</div>
        )}

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
                  : publicKey ? `🚀 ENTER RACE - READY!` : `ENTER RACE`
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
    <div className="screen active pc-wallet" id="wallet-screen">
      <div className="pc-wallet-container">
        <div className="modal-header">
          <h2 className="modal-title">🔐 Connect Wallet</h2>
          <p className="modal-subtitle">Sign in with Solana to continue</p>
        </div>
        
        <div className="pc-wallet-options">
          <button className="pc-wallet-btn" onClick={tryConnect}>
            <div className="wallet-icon">🔗</div>
            <div className="wallet-text">
              <div className="wallet-title">Connect Wallet</div>
              <div className="wallet-subtitle">Phantom / Solflare / Coinbase • build wallet-refactor</div>
            </div>
          </button>
          {publicKey && (
            <div className="pc-connected-badge">
              ✅ Connected: {publicKey.slice(0,6)}…{publicKey.slice(-6)}
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
          <div className="lobby-title">🏆 Tournament Lobby</div>
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
            🐛 Debug {debugOn ? 'ON' : 'OFF'}
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
    <div className="screen active pc-results" id="round-end">
      <div className="modal-card pc-results-card">
        <div className="modal-header">
          <h2 className={`round-result ${isWinner ? 'victory' : 'defeat'}`}>
            {isWinner ? '🏆 Victory! Fertilization!' : '💀 Eliminated'}
          </h2>
          <p className="round-description">
            Winner: {winner ? `${winner.slice(0,6)}…${winner.slice(-6)}` : '—'}
            {typeof prize === 'number' ? ` • Prize: ${prize.toFixed(4)} SOL` : ''}
          </p>
        </div>
        
        {solscan && (
          <div className="pc-solscan-link">
            <a href={solscan} target="_blank" rel="noreferrer">
              🔗 View payout on Solscan →
            </a>
          </div>
        )}
        
        {rankText && (
          <div className="pc-stats-summary">
            <div className="stat">{rankText}</div>
            <div className="stat">Kills: {wsState.kills?.[selfId] || 0}</div>
          </div>
        )}
        
        <div className="round-actions pc-actions">
          <button className="btn-primary pc-btn-large" onClick={onPlayAgain}>
            🔄 Play Again
          </button>
          <button className="btn-secondary pc-btn" onClick={onChangeTier}>
            🏠 Main Menu
          </button>
        </div>
      </div>
    </div>
  );
}

