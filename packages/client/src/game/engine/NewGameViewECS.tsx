import { useCallback, useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { createComponentMask, ComponentNames } from './components';
import type { Health } from './components/Health';
import type { Position } from './components/Position';
import { SpermClassType } from './components/SpermClass';
import { createGame, type Game } from './Game';
import type { CombatEvent } from './systems/CombatFeedbackSystem';
import { installAutomationHooks } from './view/automation';
import { clamp, normalize } from './view/math';
import { createInitialSnapshot, getViewSummary } from './view/snapshot';
import type { GameStats, TouchState, ViewSnapshot } from './view/types';
import { useDeviceMode } from './view/hooks/useDeviceMode';
import { useKeyboardState } from './view/hooks/useKeyboardState';
import { ClassSelection } from '../../components/game/ClassSelection';
import { PreGameSequence } from '../../components/game/PreGameSequence';
import './NewGameViewECS.css';
export type { GameStats } from './view/types';

interface NewGameViewECSProps {
  playerName?: string;
  playerColor?: number;
  botCount?: number;
  enableAbilities?: boolean;
  meIdOverride?: string;
  onGameEnd?: (stats: GameStats) => void;
  onPlayerDeath?: (killer: string | null) => void;
  onError?: (error: Error) => void;
  onReplay?: () => void;
  onExit?: () => void;
}

type KillFeedItem = {
  id: string;
  text: string;
  emphasis: 'neutral' | 'local' | 'danger';
  timestamp: number;
};

type StreakBanner = {
  id: string;
  label: string;
  color: string;
  killerName: string;
};

type ToolsSnapshot = {
  fps: number;
  frameMs: number;
  activeEntities: number;
  systemCount: number;
  speed: number;
  inputMag: number;
  boostActive: boolean;
};

const NERD_BRIEF_SESSION_KEY = 'sr_nerd_brief_seen_v1';

const STREAK_VISUALS: Array<{ minKills: number; label: string; color: string }> = [
  { minKills: 10, label: 'GODLIKE', color: '#facc15' },
  { minKills: 7, label: 'ULTRA KILL', color: '#f472b6' },
  { minKills: 5, label: 'MEGA KILL', color: '#fb7185' },
  { minKills: 3, label: 'TRIPLE KILL', color: '#34d399' },
  { minKills: 2, label: 'DOUBLE KILL', color: '#22d3ee' },
];

function shouldShowNerdBrief(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    const qs = new URLSearchParams(window.location.search);
    // Keep gameplay-first by default. Show only when explicitly requested.
    if (qs.get('nerd') === '1' || qs.get('brief') === '1') {
      return true;
    }
    return false;
  } catch {
    return false;
  }
}

function markNerdBriefSeen(): void {
  if (typeof window === 'undefined') return;
  try {
    window.sessionStorage.setItem(NERD_BRIEF_SESSION_KEY, '1');
  } catch {}
}

function getStreakVisual(streak: number): { label: string; color: string } | null {
  const visual = STREAK_VISUALS.find((tier) => streak >= tier.minKills);
  return visual ?? null;
}

function shouldShowToolsPanel(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    const qs = new URLSearchParams(window.location.search);
    const tools = qs.get('tools');
    const debug = qs.get('debug');
    const devtools = qs.get('devtools');
    return tools === '1' || tools === 'true' || debug === '1' || devtools === '1';
  } catch {
    return false;
  }
}

function resolveKillerLabel(killerId: string | null, game: Game): string | null {
  if (!killerId) return null;
  if (killerId === 'zone') return 'Zone Wall';
  if (killerId === 'trap') return 'Trap';
  if (killerId === 'powerup') return 'Hazard';

  const killerEntity = game.getEngine().getEntityManager().getEntity(killerId);
  const killerPlayer = killerEntity?.getComponent<{ name: string }>(ComponentNames.PLAYER);
  if (killerPlayer?.name) return killerPlayer.name;

  if (killerId.startsWith('entity_')) return 'Unknown';
  return killerId;
}

export function NewGameViewECS({
  playerName = 'Player',
  playerColor = 0x22d3ee,
  botCount = 7,
  enableAbilities = true,
  onGameEnd,
  onPlayerDeath,
  onError,
  onReplay,
  onExit,
}: NewGameViewECSProps) {
  const [session, setSession] = useState(0);
  const isMobile = useDeviceMode(900);
  const [snapshot, setSnapshot] = useState<ViewSnapshot>(() => createInitialSnapshot(botCount));

  // Class selection state
  const [showClassSelection, setShowClassSelection] = useState(true);
  const [selectedClass, setSelectedClass] = useState<SpermClassType>(SpermClassType.BALANCED);
  const [gameStarted, setGameStarted] = useState(false);
  const [showPreGame, setShowPreGame] = useState(false);
  const [stickUi, setStickUi] = useState({ active: false, dx: 0, dy: 0, baseX: 0, baseY: 0 });
  const [showNerdBrief, setShowNerdBrief] = useState(() => shouldShowNerdBrief());
  const [killFeed, setKillFeed] = useState<KillFeedItem[]>([]);
  const [streakBanner, setStreakBanner] = useState<StreakBanner | null>(null);
  const [showToolsPanel] = useState(() => shouldShowToolsPanel());
  const [toolsSnapshot, setToolsSnapshot] = useState<ToolsSnapshot>({
    fps: 0,
    frameMs: 0,
    activeEntities: 0,
    systemCount: 0,
    speed: 0,
    inputMag: 0,
    boostActive: false,
  });
  const [toolsCopied, setToolsCopied] = useState(false);
  const [mobileBoostHeld, setMobileBoostHeld] = useState(false);

  const hostRef = useRef<HTMLDivElement | null>(null);
  const gameRef = useRef<Game | null>(null);
  const endedRef = useRef(false);
  const cleanupRef = useRef<(() => void) | null>(null);
  const mouseRef = useRef<{ x: number; y: number; active: boolean }>({ x: 0, y: 0, active: false });
  const streakTimerRef = useRef<number | null>(null);
  const toolsTickRef = useRef<number>(0);
  const toolsCopiedTimerRef = useRef<number | null>(null);
  const mobileBoostHeldRef = useRef(false);

  const keyStateRef = useKeyboardState();
  const touchRef = useRef<TouchState>({
    moveTouchId: null,
    boostTouchId: null,
    moveOrigin: { x: 0, y: 0 },
  });
  const inputRef = useRef({ move: { x: 0, y: 0 }, boost: false });

  const playerHealthMask = useMemo(() => {
    return createComponentMask(ComponentNames.PLAYER, ComponentNames.HEALTH);
  }, []);

  const dismissNerdBrief = useCallback(() => {
    setShowNerdBrief(false);
    markNerdBriefSeen();
  }, []);

  useEffect(() => {
    const timer = window.setInterval(() => {
      const now = Date.now();
      setKillFeed((prev) => prev.filter((entry) => now - entry.timestamp < 5200));
    }, 600);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    return () => {
      if (streakTimerRef.current !== null) {
        window.clearTimeout(streakTimerRef.current);
        streakTimerRef.current = null;
      }
      if (toolsCopiedTimerRef.current !== null) {
        window.clearTimeout(toolsCopiedTimerRef.current);
        toolsCopiedTimerRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    const onTouchStart = (e: TouchEvent) => {
      const t = touchRef.current;
      for (let i = 0; i < e.changedTouches.length; i += 1) {
        const touch = e.changedTouches[i];

        if (t.moveTouchId == null && touch.clientX < window.innerWidth * 0.62) {
          t.moveTouchId = touch.identifier;
          t.moveOrigin = { x: touch.clientX, y: touch.clientY };
          inputRef.current.move = { x: 0, y: 0 };
          setStickUi({ active: true, dx: 0, dy: 0, baseX: touch.clientX, baseY: touch.clientY });
          continue;
        }

        if (t.boostTouchId == null) {
          t.boostTouchId = touch.identifier;
          inputRef.current.boost = true;
        }
      }
    };

    const onTouchMove = (e: TouchEvent) => {
      const t = touchRef.current;
      for (let i = 0; i < e.changedTouches.length; i += 1) {
        const touch = e.changedTouches[i];
        if (t.moveTouchId !== touch.identifier) continue;

        const rawX = touch.clientX - t.moveOrigin.x;
        const rawY = touch.clientY - t.moveOrigin.y;
        const n = normalize(rawX, rawY);
        const max = 64;
        const mag = clamp(Math.hypot(rawX, rawY), 0, max);
        // Deadzone to prevent drift
        if (mag < 5) {
          inputRef.current.move = { x: 0, y: 0 };
          setStickUi({ active: true, dx: 0, dy: 0, baseX: t.moveOrigin.x, baseY: t.moveOrigin.y });
          continue;
        }
        const moveX = n.x * (mag / max);
        const moveY = n.y * (mag / max);
        inputRef.current.move = { x: moveX, y: moveY };
        setStickUi({ active: true, dx: moveX * max, dy: moveY * max, baseX: t.moveOrigin.x, baseY: t.moveOrigin.y });
      }
    };

    const onTouchEnd = (e: TouchEvent) => {
      const t = touchRef.current;
      for (let i = 0; i < e.changedTouches.length; i += 1) {
        const touch = e.changedTouches[i];

        if (t.moveTouchId === touch.identifier) {
          t.moveTouchId = null;
          inputRef.current.move = { x: 0, y: 0 };
          setStickUi({ active: false, dx: 0, dy: 0, baseX: 0, baseY: 0 });
        }

        if (t.boostTouchId === touch.identifier) {
          t.boostTouchId = null;
          inputRef.current.boost = false;
        }
      }
    };

    host.addEventListener('touchstart', onTouchStart, { passive: true });
    host.addEventListener('touchmove', onTouchMove, { passive: true });
    host.addEventListener('touchend', onTouchEnd, { passive: true });
    host.addEventListener('touchcancel', onTouchEnd, { passive: true });

    return () => {
      host.removeEventListener('touchstart', onTouchStart);
      host.removeEventListener('touchmove', onTouchMove);
      host.removeEventListener('touchend', onTouchEnd);
      host.removeEventListener('touchcancel', onTouchEnd);
    };
  }, [session]);

  useEffect(() => {
    if (!showNerdBrief || snapshot.status !== 'playing') return;
    const timer = window.setTimeout(() => dismissNerdBrief(), 12000);
    return () => window.clearTimeout(timer);
  }, [showNerdBrief, snapshot.status, dismissNerdBrief]);

  useEffect(() => {
    if (!showNerdBrief || snapshot.status !== 'playing') return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === 'Escape' || e.key === ' ') {
        dismissNerdBrief();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [showNerdBrief, snapshot.status, dismissNerdBrief]);

  // Handle class selection confirmation - create game and start pre-game sequence
  const handleClassConfirm = useCallback(async () => {
    setShowClassSelection(false);
    setShowPreGame(true);

    const host = hostRef.current;
    if (!host) return;

    // Create the game immediately but it will be paused by PreGameSequence
    try {
      // Clear any previous PIXI canvases/UI attached to the host.
      host.replaceChildren();

      const game = await createGame({
        container: host,
        isMobile,
        playerName,
        playerColor,
        botCount,
        enableAbilities,
        classType: selectedClass,
      });

      gameRef.current = game;
      
      // Pause the engine immediately for pre-game sequence
      game.getEngine().pause();
      
      cleanupRef.current = installAutomationHooks(host, gameRef, mouseRef);
    } catch (e) {
      onError?.(e as Error);
    }
  }, [isMobile, playerName, playerColor, botCount, enableAbilities, selectedClass, onError]);

  // Handle pre-game sequence completion
  const handlePreGameComplete = useCallback(() => {
    setShowPreGame(false);
    setGameStarted(true);
    // Resume game engine
    if (gameRef.current) {
      gameRef.current.getEngine().resume();
    }
  }, []);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    // Don't start gameplay loop until pre-game sequence completes
    if (!gameStarted) return;
    
    // Don't start if we're still in pre-game
    if (showPreGame) return;
    
    // Game should already be created by handleClassConfirm
    const game = gameRef.current;
    if (!game) return;

    let cancelled = false;
    endedRef.current = false;
    mouseRef.current = { x: 0, y: 0, active: false };

    const safeDestroy = async (game: Game | null) => {
      if (!game) return;
      try {
        await game.destroy();
      } catch (e) {
        console.warn('[NewGameViewECS] Failed to destroy game cleanly:', e);
      }
    };

    const start = async () => {
      try {
        // Use existing game created during pre-game sequence
        if (!game) {
          console.warn('[NewGameViewECS] No game instance found');
          return;
        }

        const getPlayerPosition = (): Position | null => {
          const id = game.getPlayerId();
          if (!id) return null;
          const entity = game.getEngine().getEntityManager().getEntity(id);
          if (!entity) return null;
          const pos = entity.getComponent<Position>(ComponentNames.POSITION);
          return pos ?? null;
        };

        const getPlayerHealth = (): Health | null => {
          const id = game.getPlayerId();
          if (!id) return null;
          const entity = game.getEngine().getEntityManager().getEntity(id);
          if (!entity) return null;
          const h = entity.getComponent<Health>(ComponentNames.HEALTH);
          return h ?? null;
        };

        const getPlayerSpeed = (): number => {
          const id = game.getPlayerId();
          if (!id) return 0;
          const entity = game.getEngine().getEntityManager().getEntity(id);
          if (!entity) return 0;
          const velocity = entity.getComponent<{ speed: number }>(ComponentNames.VELOCITY);
          return (velocity && Number.isFinite(velocity.speed)) ? velocity.speed : 0;
        };

        const countAlivePlayers = (): number => {
          const entities = game.getEngine().getEntityManager().queryByMask(playerHealthMask);
          let alive = 0;
          for (const e of entities) {
            const h = e.getComponent<Health>(ComponentNames.HEALTH);
            if (!h) continue;
            if (!h.isAlive) continue;
            alive += 1;
          }
          return alive;
        };

        const endGame = (finalSnapshot: ViewSnapshot) => {
          if (endedRef.current) return;
          endedRef.current = true;
          setSnapshot(finalSnapshot);

          try {
            game.getEngine().pause();
          } catch {}

          const stats: GameStats = {
            placement: finalSnapshot.placement || (finalSnapshot.status === 'won' ? 1 : 0),
            kills: finalSnapshot.kills,
            duration: finalSnapshot.elapsed,
            distance: 0,
          };

          if (finalSnapshot.status === 'dead') onPlayerDeath?.(finalSnapshot.killer);
          onGameEnd?.(stats);
        };

        const processCombatEvents = (events: ReadonlyArray<CombatEvent>) => {
          if (!events.length) return;

          const localPlayerId = game.getPlayerId();
          const feedToAdd: KillFeedItem[] = [];
          let localStreak: StreakBanner | null = null;

          for (const event of events) {
            if (event.type === 'kill' || event.type === 'kill_streak') {
              feedToAdd.push({
                id: `${event.timestamp}-${event.killerId}-${event.victimId}`,
                text: `${event.killerName} eliminated ${event.victimName}`,
                emphasis: event.killerId === localPlayerId ? 'local' : 'neutral',
                timestamp: event.timestamp,
              });
            } else if (event.type === 'death' && event.victimId === localPlayerId) {
              feedToAdd.push({
                id: `${event.timestamp}-${event.victimId}-death`,
                text: 'You were eliminated',
                emphasis: 'danger',
                timestamp: event.timestamp,
              });
            }

            if (event.type === 'kill_streak' && event.killerId === localPlayerId && event.streak) {
              const streakVisual = getStreakVisual(event.streak);
              if (streakVisual) {
                localStreak = {
                  id: `${event.timestamp}-${event.killerId}-streak`,
                  label: streakVisual.label,
                  color: streakVisual.color,
                  killerName: event.killerName,
                };
              }
            }
          }

          if (feedToAdd.length > 0) {
            setKillFeed((prev) => [...prev, ...feedToAdd].slice(-7));
          }

          if (localStreak) {
            setStreakBanner(localStreak);
            if (streakTimerRef.current !== null) {
              window.clearTimeout(streakTimerRef.current);
            }
            streakTimerRef.current = window.setTimeout(() => {
              setStreakBanner(null);
              streakTimerRef.current = null;
            }, 1600);
          }
        };

        let rafId = 0;
        const tick = () => {
          if (cancelled) return;
          if (endedRef.current) return;

          const keys = keyStateRef.current;
          const keyboard = normalize(
            Number(keys.has('d') || keys.has('arrowright')) - Number(keys.has('a') || keys.has('arrowleft')),
            Number(keys.has('s') || keys.has('arrowdown')) - Number(keys.has('w') || keys.has('arrowup')),
          );

          const touchMove = inputRef.current.move;
          const useTouch = Math.abs(touchMove.x) > 0.001 || Math.abs(touchMove.y) > 0.001;
          const move = useTouch ? touchMove : keyboard;
          const boost = inputRef.current.boost || mobileBoostHeldRef.current || keys.has('shift') || keys.has(' ');

          if (
            showNerdBrief &&
            (Math.abs(move.x) > 0.001 || Math.abs(move.y) > 0.001 || boost)
          ) {
            dismissNerdBrief();
          }

          // Abilities (optional) - keep it simple for now.
          if (enableAbilities) {
            if (keys.has('q')) game.activateAbility('dash');
            if (keys.has('e')) game.activateAbility('shield');
            if (keys.has('f')) game.activateAbility('trap');
            if (keys.has('r')) game.activateAbility('overdrive');
          }

          const playerPos = getPlayerPosition();
          const renderSystem = game.getRenderSystem();
          const targetDistance = 900;

          let targetX = 0;
          let targetY = 0;
          if (playerPos) {
            if (Math.abs(move.x) > 0.001 || Math.abs(move.y) > 0.001) {
              targetX = playerPos.x + move.x * targetDistance;
              targetY = playerPos.y + move.y * targetDistance;
            } else if (renderSystem && mouseRef.current.active) {
              const worldPos = renderSystem.screenToWorld(mouseRef.current.x, mouseRef.current.y);
              targetX = worldPos.x;
              targetY = worldPos.y;
            } else {
              targetX = playerPos.x + targetDistance;
              targetY = playerPos.y;
            }
          }

          game.setInput({
            targetX,
            targetY,
            boost,
            timestamp: Date.now(),
          });

          const combatFeedback = game.getCombatFeedbackSystem();
          if (combatFeedback) {
            const events = combatFeedback.getEvents();
            if (events.length > 0) {
              processCombatEvents(events);
              combatFeedback.clearEvents();
            }
          }

          const h = getPlayerHealth();
          const aliveCount = countAlivePlayers();
          const boostEnergy = game.getBoostEnergy();
          const boostPct = boostEnergy.max > 0 ? (boostEnergy.current / boostEnergy.max) * 100 : 0;
          const elapsed = game.getEngine().getTimeStats().totalTime;
          const kills = h?.kills ?? 0;

          const isDead = !!h && !h.isAlive;
          const isWon = !isDead && aliveCount <= 1 && elapsed > 0.5;
          const status: ViewSnapshot['status'] = isDead ? 'dead' : isWon ? 'won' : 'playing';
          const placement = status === 'won' ? 1 : status === 'dead' ? Math.max(1, aliveCount + 1) : 0;

          const nextSnapshot: ViewSnapshot = {
            aliveCount,
            kills,
            boostPct,
            elapsed,
            status,
            placement,
            killer: resolveKillerLabel(h?.killerId ?? null, game),
          };

          setSnapshot(nextSnapshot);

          if (showToolsPanel) {
            const perfNow = performance.now();
            if (perfNow - toolsTickRef.current >= 240) {
              toolsTickRef.current = perfNow;
              const debugInfo = game.getEngine().getDebugInfo();
              setToolsSnapshot({
                fps: debugInfo.timeStats.fps,
                frameMs: debugInfo.timeStats.frameTime,
                activeEntities: debugInfo.entityManager.active,
                systemCount: debugInfo.systemCount,
                speed: getPlayerSpeed(),
                inputMag: Math.hypot(move.x, move.y),
                boostActive: boost,
              });
            }
          }

          if (status !== 'playing') {
            endGame(nextSnapshot);
            return;
          }

          rafId = window.requestAnimationFrame(tick);
        };

        rafId = window.requestAnimationFrame(tick);

        return () => {
          window.cancelAnimationFrame(rafId);
        };
      } catch (e) {
        if (!cancelled) onError?.(e as Error);
      }
    };

    void start();

    return () => {
      cancelled = true;
      try {
        cleanupRef.current?.();
      } catch {}
      cleanupRef.current = null;
      void safeDestroy(gameRef.current);
      gameRef.current = null;
    };
  }, [session, isMobile, playerName, playerColor, botCount, enableAbilities, onGameEnd, onPlayerDeath, onError, playerHealthMask, dismissNerdBrief, gameStarted, showPreGame, selectedClass]);

  const summary = useMemo(() => {
    return getViewSummary(snapshot);
  }, [snapshot.status, snapshot.elapsed]);

  const handleReplay = () => {
    if (onReplay) {
      onReplay();
      return;
    }

    inputRef.current = { move: { x: 0, y: 0 }, boost: false };
    keyStateRef.current.clear();
    setSnapshot(createInitialSnapshot(botCount));
    setStickUi({ active: false, dx: 0, dy: 0, baseX: 0, baseY: 0 });
    setKillFeed([]);
    setStreakBanner(null);
    setShowNerdBrief(shouldShowNerdBrief());
    mobileBoostHeldRef.current = false;
    setMobileBoostHeld(false);
    setToolsCopied(false);
    // Keep same class, just restart
    setGameStarted(false);
    setShowClassSelection(true);
    setSession((v) => v + 1);
  };

  // Quick replay with same class
  const handleQuickReplay = () => {
    if (onReplay) {
      onReplay();
      return;
    }

    inputRef.current = { move: { x: 0, y: 0 }, boost: false };
    keyStateRef.current.clear();
    setSnapshot(createInitialSnapshot(botCount));
    setStickUi({ active: false, dx: 0, dy: 0, baseX: 0, baseY: 0 });
    setKillFeed([]);
    setStreakBanner(null);
    setShowNerdBrief(shouldShowNerdBrief());
    mobileBoostHeldRef.current = false;
    setMobileBoostHeld(false);
    setToolsCopied(false);
    setShowPreGame(false);
    // Restart with same class (skip class selection and pre-game)
    setGameStarted(false);
    setTimeout(() => setGameStarted(true), 50);
    setSession((v) => v + 1);
  };

  const copyToolsSnapshot = useCallback(async () => {
    const game = gameRef.current;
    if (!game || typeof navigator === 'undefined' || !navigator.clipboard?.writeText) return;
    try {
      await navigator.clipboard.writeText(game.getTextSnapshot());
      setToolsCopied(true);
      if (toolsCopiedTimerRef.current !== null) {
        window.clearTimeout(toolsCopiedTimerRef.current);
      }
      toolsCopiedTimerRef.current = window.setTimeout(() => {
        setToolsCopied(false);
        toolsCopiedTimerRef.current = null;
      }, 1200);
    } catch {}
  }, []);

  const onBoostPointerDown = useCallback((e: ReactPointerEvent<HTMLButtonElement>) => {
    e.preventDefault();
    e.stopPropagation();
    mobileBoostHeldRef.current = true;
    setMobileBoostHeld(true);
  }, []);

  const onBoostPointerUp = useCallback((e: ReactPointerEvent<HTMLButtonElement>) => {
    e.preventDefault();
    e.stopPropagation();
    mobileBoostHeldRef.current = false;
    setMobileBoostHeld(false);
  }, []);

  return (
    <div className="ecs-root" data-status={snapshot.status}>
      {/* Class Selection Modal */}
      <ClassSelection
        selectedClass={selectedClass}
        onSelect={setSelectedClass}
        onConfirm={handleClassConfirm}
        visible={showClassSelection}
      />

      {/* Pre-Game Sequence */}
      {showPreGame && gameRef.current && (
        <PreGameSequence
          game={gameRef.current}
          selectedClass={selectedClass}
          onComplete={handlePreGameComplete}
        />
      )}

      <div ref={hostRef} className="ecs-canvas-host" />

      <div className="ecs-hud">
        <div className="ecs-pill">{summary.statusText}</div>
        <div className="ecs-metric">ALIVE <strong>{snapshot.aliveCount}</strong></div>
        <div className="ecs-metric">KILLS <strong>{snapshot.kills}</strong></div>
        <div className="ecs-metric">TIME <strong>{summary.timeText}</strong></div>
        <div className="ecs-boost-wrap">
          <span>BOOST</span>
          <div className="ecs-boost-bar"><div className="ecs-boost-fill" style={{ width: `${snapshot.boostPct}%` }} /></div>
        </div>
      </div>

      {snapshot.status === 'playing' && killFeed.length > 0 && (
        <div className="ecs-kill-feed" aria-live="polite">
          {killFeed.map((entry) => (
            <div key={entry.id} className={`ecs-kill-feed-item is-${entry.emphasis}`}>
              {entry.text}
            </div>
          ))}
        </div>
      )}

      {snapshot.status === 'playing' && streakBanner && (
        <div className="ecs-streak-banner" style={{ ['--streak-color' as any]: streakBanner.color }}>
          <strong>{streakBanner.label}</strong>
          <span>{streakBanner.killerName}</span>
        </div>
      )}

      {snapshot.status === 'playing' && showNerdBrief && (
        <div className="ecs-nerd-overlay">
          <div className="ecs-nerd-card">
            <div className="ecs-nerd-kicker">FIRST RUN / NERD MODE</div>
            <h3>What This Game Feels Like</h3>
            <p>
              "Yo, this is high-speed vector combat. I steer with precision,
              weaponize my trail, and out-macro the chaos."
            </p>
            <div className="ecs-nerd-grid">
              <div>
                <strong>Steer</strong>
                <span>{isMobile ? 'Left thumb joystick' : 'Mouse or WASD / Arrows'}</span>
              </div>
              <div>
                <strong>Boost</strong>
                <span>{isMobile ? 'Hold right side' : 'Hold Space / Shift'}</span>
              </div>
              <div>
                <strong>Secure Kills</strong>
                <span>Slice enemies with your tail, avoid theirs.</span>
              </div>
              <div>
                <strong>Stay Alive</strong>
                <span>Grab green DNA, avoid the shrinking zone wall.</span>
              </div>
            </div>
            <button
              type="button"
              className="ecs-nerd-start"
              onClick={dismissNerdBrief}
            >
              LET ME COOK
            </button>
          </div>
        </div>
      )}

      {isMobile && snapshot.status === 'playing' && (
        <>
          <div
            className="ecs-joystick-base"
            style={{
              opacity: stickUi.active ? 1 : 0.4,
              left: stickUi.active ? `calc(${stickUi.baseX}px - 64px)` : undefined,
              top: stickUi.active ? `calc(${stickUi.baseY}px - 64px)` : undefined,
              bottom: stickUi.active ? 'auto' : undefined,
            }}
          >
            <div
              className="ecs-joystick-knob"
              style={{ transform: `translate(calc(-50% + ${stickUi.dx}px), calc(-50% + ${stickUi.dy}px))` }}
            />
          </div>
          <button
            type="button"
            className={`ecs-mobile-boost-btn ${mobileBoostHeld ? 'is-held' : ''}`}
            onPointerDown={onBoostPointerDown}
            onPointerUp={onBoostPointerUp}
            onPointerLeave={onBoostPointerUp}
            onPointerCancel={onBoostPointerUp}
            onContextMenu={(e) => e.preventDefault()}
            aria-label="Boost"
          >
            BOOST
          </button>
          <div className="ecs-mobile-boost-hint">HOLD RIGHT BUTTON OR RIGHT SIDE TO BOOST</div>
        </>
      )}

      {showToolsPanel && snapshot.status === 'playing' && (
        <div className="ecs-tools-panel">
          <div className="ecs-tools-title">GAMEPLAY TOOLS</div>
          <div className="ecs-tools-grid">
            <span>FPS</span><strong>{Math.round(toolsSnapshot.fps)}</strong>
            <span>FRAME</span><strong>{toolsSnapshot.frameMs.toFixed(1)}ms</strong>
            <span>ENTITIES</span><strong>{toolsSnapshot.activeEntities}</strong>
            <span>SYSTEMS</span><strong>{toolsSnapshot.systemCount}</strong>
            <span>SPEED</span><strong>{Math.round(toolsSnapshot.speed)}</strong>
            <span>INPUT</span><strong>{toolsSnapshot.inputMag.toFixed(2)}</strong>
            <span>BOOST</span><strong>{toolsSnapshot.boostActive ? 'ON' : 'OFF'}</strong>
          </div>
          <button type="button" className="ecs-tools-copy" onClick={copyToolsSnapshot}>
            {toolsCopied ? 'SNAPSHOT COPIED' : 'COPY LIVE SNAPSHOT'}
          </button>
        </div>
      )}

      {snapshot.status !== 'playing' && !showClassSelection && (
        <div className="ecs-end-overlay">
          <h2>{snapshot.status === 'won' ? 'VICTORY' : 'ELIMINATED'}</h2>
          <p>Placement: #{snapshot.placement}</p>
          <p>Kills: {snapshot.kills}</p>
          <p>Time: {summary.timeText}</p>
          {snapshot.killer ? <p>Killed by: {snapshot.killer}</p> : null}
          <div className="ecs-actions">
            <button type="button" onClick={handleQuickReplay}>REPLAY</button>
            <button type="button" onClick={handleReplay}>CHANGE CLASS</button>
            <button type="button" onClick={() => onExit?.()}>EXIT</button>
          </div>
        </div>
      )}
    </div>
  );
}

export default NewGameViewECS;
