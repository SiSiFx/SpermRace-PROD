/**
 * AppUnified.tsx - Single adaptive App for PC and Mobile
 * Consolidates AppPC + AppMobile into one responsive component
 */

import { useState, useEffect, useCallback, useRef, lazy, Suspense, memo } from 'react';
import { WalletProvider, useWallet } from './WalletProvider';
import { WsProvider, useWs } from './WsProvider';
import { GameViewWrapper } from './components/GameViewWrapper';
import { PremiumLandingScreen } from './components/screens/premium/PremiumLandingScreen';
import { PremiumLobbyScreen } from './components/screens/premium/PremiumLobbyScreen';
import { PremiumResultsScreen } from './components/screens/premium/PremiumResultsScreen';
import { OrientationWarning } from './OrientationWarning';
import { useIsMobile } from './hooks/useIsMobile';
import { Trophy } from 'phosphor-react';
import './styles/premium-theme.css';
import './leaderboard.css';
import './AppUnified.css';

// Lazy-loaded components
const Leaderboard = lazy(() =>
  import('./Leaderboard').then((m) => ({ default: m.Leaderboard }))
);
const HowToPlayOverlay = lazy(() => import('./HowToPlayOverlay'));
const MobileTutorial = lazy(() => import('./MobileTutorial'));

// API Base URL
const API_BASE: string = (() => {
  try {
    const host = window?.location?.hostname?.toLowerCase() || '';
    if (host.endsWith('spermrace.io')) return '/api';
  } catch {}
  const env = (import.meta as any).env?.VITE_API_BASE as string | undefined;
  if (env?.trim()) return env.trim();
  return '/api';
})();

type AppScreen = 'landing' | 'practice-solo' | 'lobby' | 'game' | 'results';

function getInitialScreen(): AppScreen {
  if (!(import.meta as any).env?.DEV) return 'landing';

  try {
    const params = new URLSearchParams(window.location.search);
    if (params.get('previewLobby')) return 'lobby';

    const screen = params.get('screen');
    if (
      screen === 'landing' ||
      screen === 'practice-solo' ||
      screen === 'lobby' ||
      screen === 'game' ||
      screen === 'results'
    ) {
      return screen;
    }
  } catch {}

  return 'landing';
}

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
  const isMobile = useIsMobile();
  const { state: wsState, connectAndJoin } = useWs();
  const { publicKey, disconnect, connect } = useWallet();

  const [screen, setScreen] = useState<AppScreen>(() => getInitialScreen());
  const [solPrice, setSolPrice] = useState<number | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [isNewPlayer, setIsNewPlayer] = useState(() => {
    try { return !localStorage.getItem('spermrace_played_before'); } catch { return true; }
  });

  const markPlayed = useCallback(() => {
    try { localStorage.setItem('spermrace_played_before', '1'); } catch {}
    setIsNewPlayer(false);
  }, []);
  const [showLeaderboard, setShowLeaderboard] = useState(false);
  const [showHowToPlay, setShowHowToPlay] = useState(false);
  const [gameCountdown] = useState<number | null>(null);
  const [practiceStats, setPracticeStats] = useState<{ placement: number; kills: number; duration: number; winner: boolean; killerName: string | null; totalPlayers: number } | null>(null);
  // Track whether the current online game is free/practice so Results screen shows correct UI
  const joinedAsPracticeRef = useRef(false);
  // Track last selected tier so the upsell CTA reflects the right prize
  const [selectedTier, setSelectedTier] = useState<{ usd: number; prize: string }>({ usd: 5, prize: '$42' });

  // Fetch SOL price
  useEffect(() => {
    const fetchPrice = async () => {
      try {
        const res = await fetch(`${API_BASE}/sol-price`);
        const data = await res.json();
        if (data?.usd) setSolPrice(data.usd);
      } catch {}
    };
    fetchPrice();
    const interval = setInterval(fetchPrice, 60000);
    return () => clearInterval(interval);
  }, []);

  // Toast handler
  const showToast = useCallback((msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2000);
  }, []);

  // WebSocket state → screen routing
  useEffect(() => {
    const phase = wsState.phase;
    if (phase === 'authenticating') {
      if (screen !== 'lobby') setScreen('lobby');
    } else if (phase === 'game') {
      if (screen !== 'game') setScreen('game');
    } else if (phase === 'ended') {
      markPlayed();
      // Build practiceStats for online free/practice games so Results screen shows correct UI
      if (joinedAsPracticeRef.current && !practiceStats) {
        const selfId = wsState.playerId || '';
        const isWinner = !!wsState.lastRound?.winnerId && wsState.lastRound.winnerId === selfId;
        const totalPlayers = wsState.initialPlayers.length || 1;
        // Placement: winner = 1, otherwise position from elimination order
        const elimIdx = wsState.eliminationOrder.indexOf(selfId);
        const placement = isWinner ? 1 : (elimIdx >= 0 ? totalPlayers - elimIdx : totalPlayers);
        // Killer name from kill feed
        const killedByEntry = wsState.killFeed.find(e => e.victimId === selfId);
        const killerName = killedByEntry?.killerId
          ? (wsState.lobby?.playerNames?.[killedByEntry.killerId] || null)
          : null;
        setPracticeStats({
          winner: isWinner,
          placement,
          kills: wsState.kills[selfId] || 0,
          duration: 0,
          killerName,
          totalPlayers,
        });
        joinedAsPracticeRef.current = false;
      }
      if (screen !== 'results') setScreen('results');
    }
  }, [wsState.phase, screen, markPlayed]);

  // PC Keyboard shortcuts
  useEffect(() => {
    if (isMobile) return;

    const handleKeyPress = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (screen === 'lobby') setScreen('landing');
      }
      if (screen === 'landing') {
        if (e.key === 'p' || e.key === 'P') setScreen('practice-solo');
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [isMobile, screen]);

  // Mobile browser back handler
  useEffect(() => {
    if (!isMobile) return;

    const handleBack = (e: PopStateEvent) => {
      if (screen !== 'landing') {
        e.preventDefault();
        window.history.pushState(null, '', window.location.href);
        setScreen('landing');
      }
    };

    window.history.pushState(null, '', window.location.href);
    window.addEventListener('popstate', handleBack);
    return () => window.removeEventListener('popstate', handleBack);
  }, [isMobile, screen]);

  // Navigation handlers - Practice routes through server lobby (guest mode, no wallet needed)
  const PRACTICE_NAMES = ['Ace', 'Atom', 'Blitz', 'Chrome', 'Dusk', 'Echo', 'Ember', 'Fuse', 'Glitch', 'Hex', 'Ion', 'Jade', 'Lux', 'Mach', 'Nitro'];
  const onPractice = useCallback(async () => {
    const name = PRACTICE_NAMES[Math.floor(Math.random() * PRACTICE_NAMES.length)];
    try {
      joinedAsPracticeRef.current = true;
      await connectAndJoin({ entryFeeTier: 0, mode: 'practice', guestName: name });
    } catch {
      joinedAsPracticeRef.current = false;
      // Server unavailable — fall back to local offline practice
      setScreen('practice-solo');
    }
  }, [connectAndJoin]);

  const onWallet = useCallback(async (tier?: { usd: number; prize: string }) => {
    if (tier) setSelectedTier(tier);
    const success = await connect();
    if (success) {
      setScreen('lobby');
    } else {
      showToast('Wallet not connected — try again or use Practice mode');
    }
  }, [connect, showToast]);
  const openLeaderboard = useCallback(() => setShowLeaderboard(true), []);

  // Loading fallback
  const LoadingFallback = (
    <div className="loading-fallback">
      <div className="loading-spinner" />
    </div>
  );

  return (
    <div id="app-root" className={isMobile ? 'mobile-optimized' : 'pc-optimized'}>
      {/* Orientation warning (mobile only) */}
      {isMobile && <OrientationWarning />}

      {/* Header */}
      <Header
        screen={screen}
        isMobile={isMobile}
        publicKey={publicKey}
        onDisconnect={disconnect}
        onLeaderboard={openLeaderboard}
        onHelp={() => setShowHowToPlay(true)}
      />

      {/* Toast */}
      {toast && (
        <div className={`toast ${isMobile ? 'mobile-toast' : 'pc-toast'}`}>
          {toast}
        </div>
      )}

      {/* Screens */}
      {screen === 'landing' && (
        <PremiumLandingScreen
          solPrice={solPrice}
          onPractice={onPractice}
          onWallet={onWallet}
          onLeaderboard={openLeaderboard}
          onHelp={() => setShowHowToPlay(true)}
          isNewPlayer={isNewPlayer}
        />
      )}

      {screen === 'practice-solo' && (
        <Practice
          onFinish={(stats) => { markPlayed(); setPracticeStats(stats); setScreen('results'); }}
          onBack={() => setScreen('landing')}
          onPlayReal={() => { onWallet(selectedTier); }}
          playRealPrize={selectedTier.prize}
          isMobile={isMobile}
        />
      )}

      {screen === 'lobby' && (
        <PremiumLobbyScreen onBack={() => setScreen('landing')} />
      )}

      {screen === 'game' && (
        <Game
          onEnd={() => setScreen('results')}
          onRestart={() => setScreen('game')}
          isMobile={isMobile}
          countdown={gameCountdown}
        />
      )}

      {screen === 'results' && (
        <PremiumResultsScreen
          onPlayAgain={() => {
            joinedAsPracticeRef.current = false;
            setPracticeStats(null);
            // Online practice + local practice → back to practice; tournament → landing
            if (practiceStats) setScreen('practice-solo');
            else setScreen('landing');
          }}
          onChangeTier={() => { joinedAsPracticeRef.current = false; setPracticeStats(null); setScreen('landing'); }}
          practiceStats={practiceStats ?? undefined}
        />
      )}

      {/* Modals */}
      {showLeaderboard && (
        <Suspense fallback={LoadingFallback}>
          <Leaderboard
            onClose={() => setShowLeaderboard(false)}
            apiBase={API_BASE}
            myWallet={publicKey || null}
            isMobile={isMobile}
          />
        </Suspense>
      )}

      {showHowToPlay && (
        <Suspense fallback={LoadingFallback}>
          <HowToPlayOverlay mode={isMobile ? 'mobile' : 'pc'} onClose={() => setShowHowToPlay(false)} />
        </Suspense>
      )}
    </div>
  );
}

// ============================================================================
// HEADER COMPONENT
// ============================================================================

const Header = memo(function Header({
  screen,
  isMobile,
  publicKey,
  onDisconnect,
  onLeaderboard,
  onHelp,
}: {
  screen: AppScreen;
  isMobile: boolean;
  publicKey: string | null;
  onDisconnect: () => void;
  onLeaderboard: () => void;
  onHelp: () => void;
}) {
  // Hide header during game
  if (screen === 'game' || screen === 'practice-solo' || screen === 'landing') return null;

  return (
    <header className={`app-header ${isMobile ? 'mobile' : 'pc'}`}>
      <div className="header-left">
        {publicKey && (
          <div className="wallet-badge">
            <span className="wallet-address">
              {publicKey.slice(0, 4)}...{publicKey.slice(-4)}
            </span>
            <button className="disconnect-btn" onClick={onDisconnect}>
              Disconnect
            </button>
          </div>
        )}
      </div>
      <div className="header-right">
        <button className="header-btn" onClick={onLeaderboard} title="Leaderboard">
          <Trophy size={20} weight="duotone" />
        </button>
        {!isMobile && (
          <button className="header-btn" onClick={onHelp} title="How to Play">
            ?
          </button>
        )}
      </div>
    </header>
  );
});

// ============================================================================
// PRACTICE COMPONENT
// ============================================================================

function Practice({
  onFinish,
  onBack,
  onPlayReal,
  playRealPrize,
  isMobile,
}: {
  onFinish: (stats: any) => void;
  onBack: () => void;
  onPlayReal?: () => void;
  playRealPrize?: string;
  isMobile: boolean;
}) {
  const [meId] = useState(() => {
    const NAMES = [
      'Ace', 'Atom', 'Blitz', 'Chrome', 'Dusk', 'Echo', 'Ember', 'Fuse',
      'Glitch', 'Hex', 'Ion', 'Jade', 'Lux', 'Mach', 'Nitro', 'Onyx',
      'Prism', 'Quark', 'Rex', 'Rush', 'Spark', 'Surge', 'Talon', 'Titan',
      'Torch', 'Volt', 'Wraith', 'Zero', 'Apex', 'Crypt', 'Flux', 'Grit',
    ];
    return NAMES[Math.floor(Math.random() * NAMES.length)];
  });
  const [countdown, setCountdown] = useState(3);
  const [showTutorial, setShowTutorial] = useState(() => {
    try {
      return !localStorage.getItem('spermrace_tutorial_seen');
    } catch {
      return true;
    }
  });

  // Countdown timer
  useEffect(() => {
    if (countdown <= 0) return;
    const timer = setTimeout(() => setCountdown(c => c - 1), 1000);
    return () => clearTimeout(timer);
  }, [countdown]);

  const handleTutorialDone = useCallback(() => {
    setShowTutorial(false);
    try {
      localStorage.setItem('spermrace_tutorial_seen', '1');
    } catch {}
  }, []);

  return (
    <div className="screen active game-screen">
      <GameViewWrapper
        meIdOverride={meId}
        onReplay={onBack}
        onExit={onBack}
        onGameEnd={onFinish}
        onPlayReal={onPlayReal}
        playRealPrize={playRealPrize}
      />
      {isMobile && showTutorial && (
        <Suspense fallback={null}>
          <MobileTutorial countdown={countdown} onComplete={handleTutorialDone} context="practice" />
        </Suspense>
      )}
    </div>
  );
}

// ============================================================================
// GAME COMPONENT
// ============================================================================

function Game({
  onEnd,
  onRestart,
  countdown,
}: {
  onEnd: () => void;
  onRestart: () => void;
  isMobile: boolean;
  countdown: number | null;
}) {
  return (
    <div className="screen active game-screen">
      <GameViewWrapper onReplay={onRestart} onExit={onEnd} />
      {countdown !== null && countdown > 0 && (
        <div className="game-countdown-overlay">
          <div className="countdown-number">{countdown}</div>
        </div>
      )}
    </div>
  );
}
