import { useState, useEffect, lazy, Suspense } from 'react';
import { GameController } from 'phosphor-react';
import { isMobileDevice } from '../../deviceDetection';
import { LoadingSpinner } from '../LoadingSpinner';

const NewGameView = lazy(() => import('../../NewGameView'));
const PracticeFullTutorial = lazy(() => import('../../PracticeFullTutorial'));
const MobileTutorial = lazy(() => import('../../MobileTutorial'));

// Lazy load MobileTouchControls only when needed
const MobileTouchControls = lazy(() => import('../../MobileTouchControls').then(m => ({ default: m.MobileTouchControls })));

interface PracticeProps {
  onFinish: () => void;
  onBack: () => void;
  skipLobby?: boolean;
}

export function Practice({ onFinish: _onFinish, onBack, skipLobby = false }: PracticeProps) {
  const isMobile = isMobileDevice();
  
  const [step, setStep] = useState<'lobby' | 'game'>(() => {
    if (skipLobby) return 'game';
    try {
      // PC skips lobby if tutorial seen, mobile always shows tutorial first
      if (!isMobile && localStorage.getItem('sr_practice_full_tuto_seen')) return 'game';
    } catch {}
    return 'lobby';
  });
  
  const [meId] = useState<string>('PLAYER_' + Math.random().toString(36).slice(2, 8));
  const [players, setPlayers] = useState<string[]>([]);
  const [countdown, setCountdown] = useState<number>(5);
  const countdownTotal = 5;
  
  // Mobile-specific state
  const [showPracticeIntro, setShowPracticeIntro] = useState<boolean>(() => {
    if (!isMobile) return false;
    try {
      return !localStorage.getItem('sr_practice_full_tuto_seen');
    } catch {
      return true;
    }
  });
  const [gameCountdown, setGameCountdown] = useState<number>(6);

  // Mobile touch handlers
  const handleTouch = (x: number, y: number) => {
    const event = new CustomEvent('mobile-joystick', { detail: { x, y } });
    window.dispatchEvent(event);
  };
  
  const handleBoost = () => {
    const event = new CustomEvent('mobile-boost');
    window.dispatchEvent(event);
  };

  useEffect(() => {
    if (step === 'lobby') {
      // Mobile with tutorial intro - wait for tutorial
      if (isMobile && showPracticeIntro) return;
      
      // Mobile without tutorial - skip straight to game
      if (isMobile) {
        setGameCountdown(3);
        const base = [meId];
        const bots = Array.from({ length: 7 }, (_, i) => `BOT_${i.toString(36)}${Math.random().toString(36).slice(2,4)}`);
        setPlayers([...base, ...bots]);
        setStep('game');
        return;
      }
      
      // Desktop - show lobby countdown
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
    
    if (step === 'game' && isMobile) {
      setGameCountdown(3);
      const timer = setInterval(() => {
        setGameCountdown(prev => Math.max(0, prev - 1));
      }, 1000);
      return () => clearInterval(timer);
    }
  }, [step, meId, showPracticeIntro, isMobile]);

  // Mobile Lobby
  if (step === 'lobby' && isMobile) {
    const maxPlayers = 8;
    return (
      <div className="screen active mobile-lobby-screen">
        <div className="mobile-lobby-container">
          <div className="mobile-lobby-header">
            <h2 className="mobile-lobby-title" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <GameController size={18} weight="fill" />
              <span>Practice Lobby</span>
            </h2>
            <div className="mobile-lobby-count">{players.length}/{maxPlayers}</div>
          </div>
          
          <div className="mobile-queue-status">
            <div className="status-item">
              <span className="dot"></span>
              <span>{players.length} Ready</span>
            </div>
            <div className="status-item">
              <span>Tutorial</span>
            </div>
          </div>
          
          <div className="mobile-lobby-orbit">
            <div className="orbit-center" />
            <div className="orbit-ring">
              {players.map((p: string, i: number) => (
                <div key={p} className="orbit-sperm" style={{ '--i': i, '--n': players.length } as any} />
              ))}
            </div>
            <div className="mobile-countdown"></div>
          </div>
          
          <div className="mobile-progress-bar">
            <div className="mobile-progress-fill" style={{ width: '0%' }}></div>
          </div>
          
          <div className="mobile-lobby-footer">
            <button className="mobile-btn-back" onClick={onBack}>← Back</button>
          </div>
        </div>
        <Suspense fallback={null}>
          <PracticeFullTutorial
            visible={showPracticeIntro}
            onDone={() => {
              setShowPracticeIntro(false);
              try { localStorage.setItem('sr_practice_full_tuto_seen', '1'); } catch {}
            }}
          />
        </Suspense>
      </div>
    );
  }

  // Desktop Lobby
  if (step === 'lobby' && !isMobile) {
    const maxPlayers = 8;
    const progressPct = Math.max(0, Math.min(100, Math.floor(((countdownTotal - countdown) / countdownTotal) * 100)));
    return (
      <div className="screen active" id="lobby-screen">
        <div className="lobby-container">
          <div className="lobby-header">
            <div className="lobby-title">Lobby</div>
            <div className="lobby-status">{players.length}/{maxPlayers}</div>
          </div>
          <div className="queue-bar">
            <div className="queue-left"><span className="queue-dot" /><span>{players.length}</span></div>
            <div className="queue-center"><span>Queued</span></div>
            <div className="queue-right"><span>Target</span><span>{maxPlayers}</span></div>
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
          <div style={{ display: 'flex', justifyContent: 'center', marginTop: 12 }}>
            <div style={{ width: 320, height: 10, borderRadius: 8, overflow: 'hidden', border: '1px solid rgba(255,255,255,0.15)', background: 'rgba(255,255,255,0.04)' }}>
              <div style={{ width: `${progressPct}%`, height: '100%', background: '#00F0FF', transition: 'width 300ms ease' }}></div>
            </div>
          </div>
          <div className="lobby-footer">
            <button className="btn-secondary" onClick={onBack}>Back</button>
          </div>
        </div>
      </div>
    );
  }

  // Game - Mobile
  if (step === 'game' && isMobile) {
    return (
      <div className="screen active" style={{ padding: 0, position: 'fixed', inset: 0, width: '100vw', height: '100vh', zIndex: 100 }}>
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
        <Suspense fallback={<LoadingSpinner message="Loading Game..." size="large" />}>
          <NewGameView 
            meIdOverride={meId || 'YOU'}
            onReplay={() => setStep('lobby')}
            onExit={onBack}
          />
        </Suspense>
        <Suspense fallback={null}>
          <MobileTouchControls 
            onTouch={handleTouch}
            onBoost={handleBoost}
            canBoost={true}
            boostCooldownPct={1}
          />
          <MobileTutorial countdown={gameCountdown} context="practice" />
        </Suspense>
      </div>
    );
  }

  // Game - Desktop
  if (step === 'game' && !isMobile) {
    return (
      <div className="screen active" style={{ padding: 0 }}>
        <Suspense fallback={<LoadingSpinner message="Loading Game..." size="large" />}>
          <NewGameView 
            meIdOverride={meId || 'YOU'}
            onReplay={() => setStep('lobby')}
            onExit={onBack}
          />
        </Suspense>
      </div>
    );
  }

  return null;
}

export default Practice;
