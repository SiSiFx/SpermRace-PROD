import { useEffect, useState } from 'react';
// Base URL for backend API; prefer same-origin /api for dev/preview, absolute for production domain
const API_BASE: string = (() => {
  // For any non-production host (localhost, Vercel preview, etc.) always hit same-origin /api
  try {
    const host = (window?.location?.hostname || '').toLowerCase();
    if (!host.includes('spermrace.io')) return '/api';
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
import HowToPlayOverlay from './HowToPlayOverlay';
import PracticeFullTutorial from './PracticeFullTutorial';
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
  const openLeaderboard = () => setShowLeaderboard(true);
  const openHowTo = () => setShowHowTo(true);

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
      {/* PC top bar: brand + nav + wallet */}
      <HeaderWallet
        screen={screen}
        status={statusText}
        onPractice={onPractice}
        onTournament={onTournament}
        onLeaderboard={openLeaderboard}
        onShowHowTo={openHowTo}
      />
      <div id="bg-particles" />
      


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
                  ? 'Top up your wallet with SOL to continue racing'
                  : 'Connect a wallet or buy SOL to get started'}
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
                  >Buy SOL</button>
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
          onLeaderboard={openLeaderboard}
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
        <div style={{ position: 'fixed', inset: 0, zIndex: 11000 }}>
          <Leaderboard
            onClose={() => setShowLeaderboard(false)}
            apiBase={API_BASE}
            myWallet={publicKey || null}
            isMobile={false}
          />
        </div>
      )}
    </div>
  );
}

function HeaderWallet({
  screen,
  status,
  onPractice,
  onTournament,
  onLeaderboard,
  onShowHowTo,
}: {
  screen: string;
  status: string;
  onPractice: () => void;
  onTournament: () => void;
  onLeaderboard?: () => void;
  onShowHowTo?: () => void;
}) {
  const { publicKey, disconnect, connect } = useWallet() as any;
  const short = publicKey ? `${publicKey.slice(0, 4)}…${publicKey.slice(-4)}` : null;
  const isLanding = screen === 'landing';
  const showStatusPill = status && status !== 'Not Connected' && status !== 'Connected';

  return (
    <header className="pc-header">
      <div className="pc-header-left">
        <button
          type="button"
          className="pc-logo"
          onClick={() => {
            if (screen !== 'landing') {
              try { window.location.href = '/'; } catch {}
            }
          }}
        >
          <span className="pc-logo-main">SPERM</span>
          <span className="pc-logo-sub">RACE</span>
        </button>
        {isLanding && (
          <nav className="pc-nav">
            <button type="button" className="pc-nav-link" onClick={onTournament}>Tournaments</button>
            {onLeaderboard && (
              <button type="button" className="pc-nav-link" onClick={onLeaderboard}>Leaderboard</button>
            )}
          </nav>
        )}
      </div>
      <div className="pc-header-right">
        {showStatusPill && <span className="pc-status-pill">{status}</span>}
        {short ? (
          <>
            <span className="pc-wallet-id">{short}</span>
            <button
              type="button"
              className="btn-secondary pc-wallet-btn"
              onClick={() => disconnect?.()}
            >
              Disconnect
            </button>
          </>
        ) : (
          <button
            type="button"
            className="btn-primary pc-wallet-btn"
            onClick={() => connect?.()}
          >
            Connect Wallet
          </button>
        )}
      </div>
    </header>
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
      if (stored) {
        return JSON.parse(stored) as { totalGames?: number; wins?: number; totalKills?: number };
      }
    } catch {}
    return { totalGames: 0, wins: 0, totalKills: 0 };
  };

  const stats = getPlayerStats();
  const totalGames = stats.totalGames || 0;
  const totalKills = stats.totalKills || 0;
  const winRate = totalGames > 0 ? ((stats.wins || 0) / totalGames * 100).toFixed(1) : '0.0';

  return (
    <div className="screen active pc-landing" id="landing-screen">
      <div
        className="landing-container"
        style={{
          maxWidth: 1200,
          margin: '0 auto',
          minHeight: '100vh',
          padding: '140px 40px 64px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 48,
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
              marginBottom: 16,
            }}
          >
            BIO-ARENA PROTOCOL
          </div>
          <h1
            style={{
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'baseline',
              gap: 16,
              fontSize: 72,
              lineHeight: 1,
              marginBottom: 20,
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
              fontSize: 14,
              letterSpacing: '0.18em',
              textTransform: 'uppercase',
              color: 'rgba(148,163,184,0.9)',
            }}
          >
            ON-CHAIN FERTILIZATION BATTLE ROYALE
          </p>
        </header>

        <main>
          {/* Hero CTAs */}
          <section
            style={{
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'stretch',
              gap: 20,
              flexWrap: 'wrap',
            }}
          >
            <button
              type="button"
              className="cta-primary"
              style={{ minWidth: 280, position: 'relative', fontSize: 14, padding: '16px 36px' }}
              onClick={() => onTournament?.()}
            >
              <span className="cta-text">Enter Tournament</span>
              <div className="cta-glow" />
            </button>

            <button
              type="button"
              className="cta-primary"
              style={{ minWidth: 280, position: 'relative', fontSize: 14, padding: '16px 36px' }}
              onClick={onPractice}
            >
              <span className="cta-text">Practice Mode (Free)</span>
              <div className="cta-glow" />
            </button>
          </section>

          <div
            style={{
              marginTop: 12,
              fontSize: 12,
              textAlign: 'center',
              color: 'rgba(148,163,184,0.7)',
            }}
          >
            Tournament entry from $1 • Instant crypto payouts
          </div>

          {totalGames > 0 && (
            <section style={{ marginTop: 32 }}>
              <div className="pc-stats-grid">
                <div className="pc-stat-card">
                  <div className="stat-label">Games</div>
                  <div className="stat-value">{totalGames}</div>
                </div>
                <div className="pc-stat-card highlight">
                  <div className="stat-label">Win%</div>
                  <div className="stat-value">{winRate}%</div>
                </div>
                <div className="pc-stat-card">
                  <div className="stat-label">Kills</div>
                  <div className="stat-value">{totalKills}</div>
                </div>
              </div>
            </section>
          )}
        </main>
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

  const [showPracticeIntro, setShowPracticeIntro] = useState<boolean>(() => {
    try {
      return !localStorage.getItem('sr_practice_full_tuto_seen');
    } catch {
      return true;
    }
  });

  useEffect(() => {
    if (step === 'lobby') {
      const base = [meId];
      const bots = Array.from({ length: 7 }, (_, i) => `BOT_${i.toString(36)}${Math.random().toString(36).slice(2,4)}`);
      setPlayers([...base, ...bots]);
      setCountdown(countdownTotal);
      if (showPracticeIntro) return;
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
  }, [step, meId, showPracticeIntro]);

  if (step === 'lobby') {
    const maxPlayers = 8;
    const progressPct = Math.max(0, Math.min(100, Math.floor(((countdownTotal - countdown) / countdownTotal) * 100)));
    return (
      <div className="screen active pc-lobby" id="lobby-screen">
        <div className="lobby-container pc-lobby-container">
          <div className="lobby-header">
            <div className="lobby-title">Practice Lobby</div>
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
    { name: 'Micro Race', usd: 1, max: 16, dur: '2–3 min' },
    { name: 'Nano Race', usd: 5, max: 32, dur: '3–4 min' },
    { name: 'Mega Race', usd: 25, max: 32, dur: '4–6 min' },
    { name: 'Championship', usd: 100, max: 16, dur: '5–8 min' },
  ];

  const [selectedIndex, setSelectedIndex] = useState(0);

  useEffect(() => {
    if (wsState.phase === 'lobby' || wsState.phase === 'game') setIsJoining(false);
  }, [wsState.phase]);

  const buttonGradients = [
    'linear-gradient(135deg, #22d3ee, #14b8a6)',
    'linear-gradient(135deg, #6366f1, #8b5cf6)',
    'linear-gradient(135deg, #f43f5e, #fb923c)',
    'linear-gradient(135deg, #fb923c, #fbbf24)'
  ];

  const badgeLabels = ['Warmup', 'Blitz', 'Apex', 'Grand Final'];
  const selectedTier = tiers[selectedIndex];
  const selectedPrize = (selectedTier.usd * selectedTier.max * 0.85).toFixed(2);
  const disabledSelected = isJoining
    || wsState.phase === 'connecting'
    || wsState.phase === 'authenticating'
    || preflightError
    || (!!preflight && (!preflight.configured || !preflight.address || preflight.sol == null));

  const handleJoinSelected = async () => {
    if (disabledSelected) return;
    setIsJoining(true);
    const ok = publicKey ? true : await connect();
    if (!ok) {
      setIsJoining(false);
      onNotify('Wallet not detected. Please install or unlock your wallet.');
      return;
    }
    await connectAndJoin({ entryFeeTier: selectedTier.usd as any, mode: 'tournament' });
  };

  return (
    <div className="screen active" id="mode-screen" style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '100px 40px 40px',
    }}>
      <div style={{
        maxWidth: 1400,
        width: '100%',
      }}>
        <div style={{ textAlign: 'center', marginBottom: 48 }}>
          <h2 style={{
            fontSize: 48,
            fontWeight: 800,
            color: '#fff',
            marginBottom: 12,
            letterSpacing: '0.02em'
          }}>Select Your Entry Tier</h2>
          <p style={{
            fontSize: 16,
            color: 'rgba(148,163,184,0.9)',
            marginBottom: 8
          }}>Tournament races • Winner takes 85% of prize pool</p>
          {preflightError && (
            <div style={{ color: '#ff8080', fontSize: 14, marginTop: 16 }}>
              Tournaments temporarily unavailable
            </div>
          )}
        </div>

        {/* Bio-Arena Map layout: left = arenas, right = detail drawer */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'minmax(0, 420px) minmax(0, 1fr)',
            gap: 32,
            alignItems: 'stretch',
            marginBottom: 40,
          }}
        >
          {/* Left: stylized map with arena nodes */}
          <div
            style={{
              position: 'relative',
              padding: 24,
              borderRadius: 24,
              background: 'radial-gradient(circle at 0 0, rgba(56,189,248,0.16), transparent 55%), rgba(15,23,42,0.96)',
              border: '1px solid rgba(148,163,184,0.5)',
              boxShadow: '0 18px 50px rgba(0,0,0,0.7)',
              overflow: 'hidden',
            }}
          >
            {/* Vertical path line */}
            <div
              style={{
                position: 'absolute',
                left: 40,
                top: 28,
                bottom: 28,
                width: 3,
                background: 'linear-gradient(to bottom, rgba(34,211,238,0.9), rgba(129,140,248,0.7))',
                opacity: 0.8,
              }}
            />
            <div
              style={{
                position: 'absolute',
                left: 34,
                top: 34,
                bottom: 34,
                width: 14,
                borderRadius: 999,
                background: 'radial-gradient(circle, rgba(15,23,42,0.8), transparent 70%)',
              }}
            />

            <div style={{ position: 'relative', zIndex: 1, marginBottom: 16 }}>
              <div
                style={{
                  fontSize: 11,
                  textTransform: 'uppercase',
                  letterSpacing: '0.18em',
                  color: 'rgba(148,163,184,0.9)',
                  marginBottom: 6,
                }}
              >
                Bio-Arena Map
              </div>
              <div style={{ fontSize: 18, fontWeight: 600, color: '#e5e7eb' }}>
                Choose your arena along the fertilization route
              </div>
            </div>

            <div
              style={{
                position: 'relative',
                zIndex: 1,
                display: 'flex',
                flexDirection: 'column',
                gap: 14,
                marginTop: 6,
              }}
            >
              {tiers.map((t, i) => {
                const active = i === selectedIndex;
                const difficulty = i + 1; // 1–4
                return (
                  <button
                    key={t.name}
                    type="button"
                    onClick={() => setSelectedIndex(i)}
                    style={{
                      position: 'relative',
                      marginLeft: 32,
                      padding: '10px 14px',
                      borderRadius: 14,
                      border: active ? '1px solid rgba(34,211,238,0.9)' : '1px solid rgba(51,65,85,0.9)',
                      background: active ? 'rgba(15,23,42,0.95)' : 'rgba(15,23,42,0.85)',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 12,
                      cursor: 'pointer',
                      boxShadow: active ? '0 0 24px rgba(34,211,238,0.45)' : '0 8px 22px rgba(0,0,0,0.7)',
                      transform: active ? 'translateX(2px)' : 'translateX(0)',
                      transition: 'all 0.18s ease-out',
                      opacity: preflightError ? 0.7 : 1,
                    }}
                  >
                    {/* Node dot */}
                    <div
                      style={{
                        position: 'absolute',
                        left: -19,
                        top: '50%',
                        transform: 'translateY(-50%)',
                        width: 14,
                        height: 14,
                        borderRadius: '999px',
                        background: active
                          ? 'radial-gradient(circle, #22d3ee, #0ea5e9)'
                          : 'radial-gradient(circle, #4b5563, #020617)',
                        boxShadow: active ? '0 0 18px rgba(34,211,238,0.9)' : '0 0 6px rgba(15,23,42,1)',
                        border: '2px solid rgba(15,23,42,0.95)',
                      }}
                    />

                    <div
                      style={{
                        width: 26,
                        height: 26,
                        borderRadius: '999px',
                        border: '1px solid rgba(148,163,184,0.7)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: 11,
                        fontWeight: 800,
                        letterSpacing: '0.08em',
                        textTransform: 'uppercase',
                      }}
                    >
                      SR
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 14, fontWeight: 700, color: '#e5e7eb' }}>{t.name}</div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 2 }}>
                        {/* Difficulty dots */}
                        <div style={{ display: 'flex', gap: 3 }}>
                          {Array.from({ length: 4 }).map((_, idx) => (
                            <span
                              key={idx}
                              style={{
                                width: 6,
                                height: 6,
                                borderRadius: '999px',
                                background:
                                  idx < difficulty
                                    ? 'linear-gradient(135deg, #fb923c, #f97316)'
                                    : 'rgba(55,65,81,0.9)',
                              }}
                            />
                          ))}
                        </div>
                        <span style={{ fontSize: 11, color: 'rgba(148,163,184,0.9)', textTransform: 'uppercase', letterSpacing: '0.12em' }}>
                          {badgeLabels[i]}
                        </span>
                      </div>
                      <div style={{ fontSize: 11, color: 'rgba(148,163,184,0.9)', marginTop: 4 }}>
                        ${t.usd} • {t.max}p • {t.dur}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Right: arena detail panel (drawer style) */}
          <div
            style={{
              width: '100%',
              background: 'rgba(14,14,18,0.96)',
              borderRadius: 24,
              border: '1px solid rgba(255,255,255,0.12)',
              position: 'relative',
              overflow: 'hidden',
              padding: 26,
              boxShadow: '0 22px 70px rgba(0,0,0,0.7)',
              backdropFilter: 'blur(24px)',
            }}
          >
            <div
              style={{
                position: 'absolute',
                inset: 0,
                background: `${buttonGradients[selectedIndex]}`,
                opacity: 0.12,
                mixBlendMode: 'screen',
                pointerEvents: 'none',
              }}
            />

            <div style={{ position: 'relative', zIndex: 1, display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div>
                <div
                  style={{
                    fontSize: 11,
                    textTransform: 'uppercase',
                    letterSpacing: '0.16em',
                    color: 'rgba(148,163,184,0.9)',
                    marginBottom: 6,
                  }}
                >
                  Arena Details
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div
                    style={{
                      width: 32,
                      height: 32,
                      borderRadius: '999px',
                      border: '1px solid rgba(148,163,184,0.7)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: 12,
                      fontWeight: 800,
                      letterSpacing: '0.08em',
                      textTransform: 'uppercase',
                    }}
                  >
                    SR
                  </div>
                  <div>
                    <div style={{ fontSize: 22, fontWeight: 800, color: '#fff' }}>{selectedTier.name}</div>
                    <div style={{ fontSize: 12, color: 'rgba(148,163,184,0.95)' }}>
                      Tier {selectedIndex + 1} • {badgeLabels[selectedIndex]}
                    </div>
                  </div>
                </div>
              </div>

              <div>
                <div
                  style={{
                    fontSize: 12,
                    color: 'rgba(148,163,184,0.85)',
                    marginBottom: 4,
                    textTransform: 'uppercase',
                    letterSpacing: '0.14em',
                  }}
                >
                  Win up to
                </div>
                <div
                  style={{
                    fontSize: 44,
                    fontWeight: 900,
                    background: buttonGradients[selectedIndex],
                    backgroundClip: 'text',
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent',
                    lineHeight: 1,
                    textShadow: '0 4px 18px rgba(0,0,0,0.8)',
                    marginBottom: 4,
                  }}
                >
                  ${selectedPrize}
                </div>
                <div style={{ fontSize: 13, color: 'rgba(148,163,184,0.9)' }}>
                  Winner takes ~85% of the prize pool
                </div>
              </div>

              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(3, minmax(0,1fr))',
                  gap: 10,
                  marginTop: 4,
                }}
              >
                <div
                  style={{
                    padding: 12,
                    borderRadius: 10,
                    background: 'rgba(15,23,42,0.9)',
                    border: '1px solid rgba(148,163,184,0.4)',
                    textAlign: 'center',
                  }}
                >
                  <div style={{ fontSize: 18, fontWeight: 700, color: '#fff' }}>${selectedTier.usd}</div>
                  <div style={{ fontSize: 10, color: 'rgba(148,163,184,0.85)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Buy-in</div>
                </div>
                <div
                  style={{
                    padding: 12,
                    borderRadius: 10,
                    background: 'rgba(15,23,42,0.9)',
                    border: '1px solid rgba(148,163,184,0.4)',
                    textAlign: 'center',
                  }}
                >
                  <div style={{ fontSize: 18, fontWeight: 700, color: '#fff' }}>{selectedTier.max}</div>
                  <div style={{ fontSize: 10, color: 'rgba(148,163,184,0.85)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Players max</div>
                </div>
                <div
                  style={{
                    padding: 12,
                    borderRadius: 10,
                    background: 'rgba(15,23,42,0.9)',
                    border: '1px solid rgba(148,163,184,0.4)',
                    textAlign: 'center',
                  }}
                >
                  <div style={{ fontSize: 16, fontWeight: 700, color: '#fff' }}>{selectedTier.dur}</div>
                  <div style={{ fontSize: 10, color: 'rgba(148,163,184,0.85)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Duration</div>
                </div>
              </div>

              <button
                type="button"
                onClick={handleJoinSelected}
                disabled={disabledSelected}
                style={{
                  marginTop: 16,
                  width: '100%',
                  padding: '14px 28px',
                  borderRadius: 999,
                  border: 'none',
                  background: buttonGradients[selectedIndex],
                  color: selectedIndex === 1 ? '#fff' : '#000',
                  fontSize: 15,
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  letterSpacing: '0.1em',
                  cursor: disabledSelected ? 'not-allowed' : 'pointer',
                  boxShadow: disabledSelected ? 'none' : '0 10px 30px rgba(0,0,0,0.6)',
                  opacity: disabledSelected ? 0.7 : 1,
                  transition: 'all 0.2s ease',
                }}
              >
                {preflightError
                  ? 'Service Unavailable'
                  : (preflight && (!preflight.configured || !preflight.address || preflight.sol == null))
                  ? 'Temporarily Unavailable'
                  : (isJoining || wsState.phase === 'connecting' || wsState.phase === 'authenticating')
                  ? 'Joining…'
                  : publicKey
                  ? 'Enter Race'
                  : 'Connect & Enter'}
              </button>

              {(preflightError || (preflight && (!preflight.configured || !preflight.address || preflight.sol == null))) && (
                <div style={{ textAlign: 'left', marginTop: 8, fontSize: 11, color: '#f97373' }}>
                  Service unavailable • please try again later
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Back Button */}
        <div style={{ textAlign: 'center' }}>
          <button
            className="btn-secondary"
            style={{ padding: '12px 32px', fontSize: 15 }}
            onClick={onClose}
          >
            ← Back to Menu
          </button>
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
          <h2 className="modal-title">Connect Wallet</h2>
          <p className="modal-subtitle">Sign in with Solana to continue</p>
        </div>
        
        <div className="pc-wallet-options">
          <button className="pc-wallet-btn" onClick={tryConnect}>
            <div className="wallet-icon">SR</div>
            <div className="wallet-text">
              <div className="wallet-title">Connect Wallet</div>
              <div className="wallet-subtitle">Phantom / Solflare / Coinbase • build wallet-refactor</div>
            </div>
          </button>
          {publicKey && (
            <div className="pc-connected-badge">
              Connected: {publicKey.slice(0,6)}…{publicKey.slice(-6)}
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
          <div className="lobby-title">Tournament Lobby</div>
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
            {isWinner ? 'Victory! Fertilization!' : 'Eliminated'}
          </h2>
          <p className="round-description">
            Winner: {winner ? `${winner.slice(0,6)}…${winner.slice(-6)}` : '—'}
            {typeof prize === 'number' ? ` • Prize: ${prize.toFixed(4)} SOL` : ''}
          </p>
        </div>
        
        {solscan && (
          <div className="pc-solscan-link">
            <a href={solscan} target="_blank" rel="noreferrer">
              View payout on Solscan →
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
            Play Again
          </button>
          <button className="btn-secondary pc-btn" onClick={onChangeTier}>
            Main Menu
          </button>
        </div>
      </div>
    </div>
  );
}

