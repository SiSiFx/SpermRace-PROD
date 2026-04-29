import { useCallback, useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { createComponentMask, ComponentNames } from './components';
import type { Health } from './components/Health';
import { hasSpawnProtection } from './components/Health';
import type { Position } from './components/Position';
import { createGame, type Game } from './Game';
import type { CombatEvent } from './systems/CombatFeedbackSystem';
import { installAutomationHooks } from './view/automation';
import { clamp, normalize } from './view/math';
import { createInitialSnapshot, getViewSummary } from './view/snapshot';
import type { GameStats, TouchState, ViewSnapshot } from './view/types';
import { useDeviceMode } from './view/hooks/useDeviceMode';
import { useKeyboardState } from './view/hooks/useKeyboardState';
import { PreGameSequence } from '../../components/game/PreGameSequence';
import { DeathScreen } from '../../components/game/DeathScreen';
import { GameRadar } from './GameRadar';
import './NewGameViewECS.css';
export type { GameStats } from './view/types';

interface NewGameViewECSProps {
  playerName?: string;
  playerColor?: number;
  botCount?: number;
  enableAbilities?: boolean;
  /** When true, QuickJoin overlay is shown from first frame (practice). Default true. */
  enableQuickJoin?: boolean;
  meIdOverride?: string;
  onGameEnd?: (stats: GameStats) => void;
  onPlayerDeath?: (killer: string | null) => void;
  onError?: (error: Error) => void;
  onReplay?: () => void;
  onExit?: () => void;
  /** Practice win → jump straight to real-money room */
  onPlayReal?: () => void;
  /** Prize label shown on the "play for real" upsell (e.g. "$42") */
  playRealPrize?: string;
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
  queryCacheEntries: number;
  queryCacheHits: number;
  queryCacheInvalidations: number;
  speed: number;
  inputMag: number;
  boostActive: boolean;
};

const STREAK_VISUALS: Array<{ minKills: number; label: string; color: string }> = [
  { minKills: 10, label: 'GODLIKE', color: '#facc15' },
  { minKills: 7, label: 'ULTRA KILL', color: '#f472b6' },
  { minKills: 5, label: 'MEGA KILL', color: '#fb7185' },
  { minKills: 3, label: 'TRIPLE KILL', color: '#34d399' },
  { minKills: 2, label: 'DOUBLE KILL', color: '#22d3ee' },
];

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

const BOT_NAME_LIST = [
  'Vex', 'Kira', 'Dax', 'Zara', 'Rook', 'Nova', 'Jett', 'Lyra',
  'Colt', 'Fenn', 'Skye', 'Oryn', 'Blaze', 'Sable', 'Raze', 'Wren',
];

function QuickJoinOverlay({ botCount, playerName }: { botCount: number; playerName: string }) {
  const [visibleCount, setVisibleCount] = useState(0);

  useEffect(() => {
    if (visibleCount >= botCount) return;
    const t = setTimeout(() => setVisibleCount(v => v + 1), 110);
    return () => clearTimeout(t);
  }, [visibleCount, botCount]);

  const botNames = BOT_NAME_LIST.slice(0, botCount);

  return (
    <div className="quick-join-overlay">
      <div className="quick-join-title">PRACTICE ARENA</div>
      <div className="quick-join-roster">
        <div className="quick-join-row quick-join-you">
          <span className="quick-join-dot" style={{ background: '#22d3ee' }} />
          <span className="quick-join-name">{playerName}</span>
          <span className="quick-join-tag">YOU</span>
        </div>
        {botNames.map((name, i) => (
          <div
            key={name}
            className={`quick-join-row${i < visibleCount ? ' quick-join-visible' : ''}`}
          >
            <span className="quick-join-dot" />
            <span className="quick-join-name">{name}</span>
            <span className="quick-join-tag">BOT</span>
          </div>
        ))}
      </div>
      <div className="quick-join-status">
        {visibleCount < botCount ? 'Loading bots…' : 'Ready — launching'}
      </div>
    </div>
  );
}

export function NewGameViewECS({
  playerName = 'Player',
  playerColor = 0x22d3ee,
  botCount = 7,
  enableAbilities = true,
  enableQuickJoin = true,
  onGameEnd,
  onPlayerDeath,
  onError,
  onExit,
  onPlayReal,
  playRealPrize = '$42',
}: NewGameViewECSProps) {
  const [session, setSession] = useState(0);
  const isMobile = useDeviceMode(900);
  const [snapshot, setSnapshot] = useState<ViewSnapshot>(() => createInitialSnapshot(botCount));
  const [spawnProtected, setSpawnProtected] = useState(false);

  // Death screen state (shown in-game instead of jumping to results screen)
  const [showDeathScreen, setShowDeathScreen] = useState(false);
  const [pendingDeathStats, setPendingDeathStats] = useState<GameStats | null>(null);
  // Instant stamp shown the moment of death (before 650ms card delay)
  const [showDeathStamp, setShowDeathStamp] = useState(false);
  const deathStampKillerRef = useRef<string | null>(null);

  // Spectator mode — engine keeps running after player death; overlay shown instead of exit
  const [spectating, setSpectating] = useState(false);
  const spectatingRef = useRef(false);
  const spectatingStatsRef = useRef<GameStats | null>(null);

  // Win overlay state — shown in-game for 3s before exiting to results
  const [winStats, setWinStats] = useState<GameStats | null>(null);
  // Instant stamp shown the moment of win (before 900ms overlay delay)
  const [showVictoryStamp, setShowVictoryStamp] = useState(false);
  const [winCountdown, setWinCountdown] = useState(3);
  const [displayKills, setDisplayKills] = useState(0);
  const [displaySeconds, setDisplaySeconds] = useState(0);

  const [gameStarted, setGameStarted] = useState(false);
  const [showPreGame, setShowPreGame] = useState(false);
  const [showControlsHint, setShowControlsHint] = useState(false);
  const controlsHintShownAtRef = useRef<number>(0);
  const [stickUi, setStickUi] = useState({ active: false, dx: 0, dy: 0, baseX: 0, baseY: 0 });
  const [skipMapOverview, setSkipMapOverview] = useState(false);
  const [showQuickJoin, setShowQuickJoin] = useState(enableQuickJoin);
  const [killFeed, setKillFeed] = useState<KillFeedItem[]>([]);
  const [streakBanner, setStreakBanner] = useState<StreakBanner | null>(null);
  const [showToolsPanel] = useState(() => shouldShowToolsPanel());
  const [toolsSnapshot, setToolsSnapshot] = useState<ToolsSnapshot>({
    fps: 0,
    frameMs: 0,
    activeEntities: 0,
    systemCount: 0,
    queryCacheEntries: 0,
    queryCacheHits: 0,
    queryCacheInvalidations: 0,
    speed: 0,
    inputMag: 0,
    boostActive: false,
  });
  const [toolsCopied, setToolsCopied] = useState(false);
  const [mobileBoostHeld, setMobileBoostHeld] = useState(false);

  // First-game contextual hints — shown inline, one at a time, never again after first game
  const isFirstGame = useMemo(() => {
    try { return !localStorage.getItem('spermrace_played_before'); } catch { return false; }
  }, []);
  const [gameHint, setGameHint] = useState<'trail' | null>(null);

  const hostRef = useRef<HTMLDivElement | null>(null);
  const gameRef = useRef<Game | null>(null);
  const endedRef = useRef(false);
  const cleanupRef = useRef<(() => void) | null>(null);
  const mouseRef = useRef<{ x: number; y: number; active: boolean }>({ x: 0, y: 0, active: false });
  const streakTimerRef = useRef<number | null>(null);
  const toolsTickRef = useRef<number>(0);
  const toolsCopiedTimerRef = useRef<number | null>(null);
  const mobileBoostHeldRef = useRef(false);
  const prevAliveCountRef = useRef<number>(botCount + 1);

  // Schedule first-game hints once gameplay begins
  useEffect(() => {
    if (!gameStarted || !isFirstGame) return;
    const dismiss = window.setTimeout(() => setGameHint(null), 9000);
    const t1 = window.setTimeout(() => setGameHint('trail'), 2500);
    return () => { window.clearTimeout(t1); window.clearTimeout(dismiss); };
  }, [gameStarted, isFirstGame]);

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

  // Win overlay derived values
  const displayTime = useMemo(() => {
    const m = Math.floor(displaySeconds / 60);
    const s = displaySeconds % 60;
    return `${m}:${String(s).padStart(2, '0')}`;
  }, [displaySeconds]);

  const winSubLine = useMemo(() => {
    if (!winStats) return '';
    const { kills, duration, totalPlayers } = winStats;
    const secs = Math.floor(duration / 1000);
    const mins = Math.floor(secs / 60);
    const rem = secs % 60;
    if (kills >= 5) return `${kills} cells eliminated. You were the predator.`;
    if (kills === 0 && secs >= 240) return 'No kills. Pure evasion. Still the last one breathing.';
    const n = totalPlayers - 1;
    return `Outlasted ${n} opponent${n !== 1 ? 's' : ''} over ${mins}m ${rem}s.`;
  }, [winStats]);

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

  // Win overlay: count down then exit to results
  useEffect(() => {
    if (!winStats) return;
    if (winCountdown <= 0) { onGameEnd?.(winStats); return; }
    const t = window.setTimeout(() => setWinCountdown(c => c - 1), 1000);
    return () => window.clearTimeout(t);
  }, [winStats, winCountdown, onGameEnd]);

  // Win overlay: count-up animation for stats
  useEffect(() => {
    if (!winStats) return;
    setDisplayKills(0);
    setDisplaySeconds(0);
    const kills = winStats.kills;
    const totalSeconds = Math.floor(winStats.duration / 1000);
    const delayMs = 300;
    const killsMs = 400;
    const secsMs = 800;
    const start = performance.now();
    let killsDone = false;
    let secsDone = false;
    let raf: number;
    const tick = (now: number) => {
      const elapsed = now - start - delayMs;
      if (elapsed >= 0) {
        if (!killsDone) {
          const t = Math.min(1, elapsed / killsMs);
          const eased = 1 - Math.pow(1 - t, 4);
          setDisplayKills(Math.round(kills * eased));
          if (t >= 1) killsDone = true;
        }
        if (!secsDone) {
          const t = Math.min(1, elapsed / secsMs);
          const eased = 1 - Math.pow(1 - t, 4);
          setDisplaySeconds(Math.round(totalSeconds * eased));
          if (t >= 1) secsDone = true;
        }
      }
      if (!killsDone || !secsDone) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [winStats]);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    const onTouchStart = (e: TouchEvent) => {
      const t = touchRef.current;
      for (let i = 0; i < e.changedTouches.length; i += 1) {
        const touch = e.changedTouches[i];

        // 50% split: joystick zone (left) vs boost zone (right).
        // 62% caused the right boost zone to be too narrow on tablets.
        if (t.moveTouchId == null && touch.clientX < window.innerWidth * 0.5) {
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

  // Shared game creation — called by both first-run and quick-replay
  const startGame = useCallback(async (skip: boolean) => {
    const host = hostRef.current;
    if (!host) return;

    try {
      host.replaceChildren();

      // On quick-replay (skip=true): hide the overlay immediately. On first run it's
      // already visible from mount (enableQuickJoin initializes it to true).
      if (skip) setShowQuickJoin(false);

      // Start game creation — pause immediately when ready so no frames run before countdown.
      const gamePromise = createGame({
        container: host,
        isMobile,
        playerName,
        playerColor,
        botCount,
        enableAbilities,
      }).then(game => {
        game.getEngine().pause();
        game.getEngine().startPreviewRender();
        return game;
      });

      // Run game creation in parallel with a minimum display time for the join animation
      const minDisplay = skip ? 0 : 1200;
      const [game] = await Promise.all([
        gamePromise,
        new Promise<void>(r => setTimeout(r, minDisplay)),
      ]);

      gameRef.current = game;
      setShowQuickJoin(false);

      setSkipMapOverview(true); // always skip the 7s arena tour — go straight to countdown
      setShowPreGame(true);
      setShowControlsHint(true);
      controlsHintShownAtRef.current = Date.now();
      gameRef.current!.resumeAudio().catch(() => {});
      cleanupRef.current = installAutomationHooks(host, gameRef, mouseRef);
    } catch (e) {
      setShowQuickJoin(false);
      onError?.(e as Error);
    }
  }, [isMobile, playerName, playerColor, botCount, enableAbilities, onError]);

  // Auto-start on mount — no class selection needed
  const hasAutoStarted = useRef(false);
  useEffect(() => {
    if (hasAutoStarted.current) return;
    hasAutoStarted.current = true;
    void startGame(false);
  }, [startGame]);

  // Handle pre-game sequence completion
  const handlePreGameComplete = useCallback(() => {
    setShowPreGame(false);
    setGameStarted(true);
    // Resume game engine (no-op if already resumed by PreGameSequence at GO)
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
    
    // Game should already be created by auto-start
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
          setGameHint(null);
          try { localStorage.setItem('spermrace_played_before', '1'); } catch {}

          try {
            game.getEngine().pause();
          } catch {}

          const stats: GameStats = {
            placement: finalSnapshot.placement || (finalSnapshot.status === 'won' ? 1 : 0),
            kills: finalSnapshot.kills,
            duration: finalSnapshot.elapsed * 1000,
            distance: 0,
            winner: finalSnapshot.status === 'won',
            killerName: finalSnapshot.killer,
            totalPlayers: botCount + 1,
          };

          if (finalSnapshot.status === 'dead') {
            // Show in-game death screen — delay so death explosion plays first
            onPlayerDeath?.(finalSnapshot.killer);
            setPendingDeathStats(stats);
            setTimeout(() => setShowDeathScreen(true), 650);
          } else {
            // Won — show instant stamp, then delay 900ms for explosion before overlay
            setShowVictoryStamp(true);
            setTimeout(() => {
              setShowVictoryStamp(false);
              setWinStats(stats);
              setWinCountdown(3);
            }, 900);
          }
        };

        const processCombatEvents = (events: ReadonlyArray<CombatEvent>) => {
          if (!events.length) return;

          const localPlayerId = game.getPlayerId();
          const feedToAdd: KillFeedItem[] = [];
          let localStreak: StreakBanner | null = null;

          for (const event of events) {
            if (event.type === 'kill' || event.type === 'kill_streak') {
              const isLocalKill = event.killerId === localPlayerId;
              const isLocalDeath = event.victimId === localPlayerId;
              const killerLabel = isLocalKill ? 'YOU' : event.killerName;
              const victimLabel = isLocalDeath ? 'YOU' : event.victimName;
              feedToAdd.push({
                id: `${event.timestamp}-${event.killerId}-${event.victimId}`,
                text: `${killerLabel} ✕ ${victimLabel}`,
                emphasis: isLocalKill ? 'local' : isLocalDeath ? 'danger' : 'neutral',
                timestamp: event.timestamp,
              });
            } else if (event.type === 'death') {
              const isLocalVictim = event.victimId === localPlayerId;
              if (isLocalVictim) {
                const cause = event.killerId === 'zone' ? 'ZONE' : 'own trail';
                feedToAdd.push({
                  id: `${event.timestamp}-${event.victimId}-death`,
                  text: `YOU DIED (${cause})`,
                  emphasis: 'danger',
                  timestamp: event.timestamp,
                });
              }
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

          // Dismiss controls hint after 6s minimum (so players have time to read it)
          if (showControlsHint && Date.now() - controlsHintShownAtRef.current > 6000) {
            setShowControlsHint(false);
          }

          // Abilities
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
          let hasDirection = false;
          if (playerPos) {
            if (Math.abs(move.x) > 0.001 || Math.abs(move.y) > 0.001) {
              targetX = playerPos.x + move.x * targetDistance;
              targetY = playerPos.y + move.y * targetDistance;
              hasDirection = true;
            } else if (renderSystem && mouseRef.current.active) {
              const worldPos = renderSystem.screenToWorld(mouseRef.current.x, mouseRef.current.y);
              targetX = worldPos.x;
              targetY = worldPos.y;
              hasDirection = true;
            }
            // No else: hasDirection=false tells InputSystem to keep current heading
          }

          game.setInput({
            targetX,
            targetY,
            boost,
            hasDirection,
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
          setSpawnProtected(h ? hasSpawnProtection(h) : false);
          const aliveCount = countAlivePlayers();
          const boostEnergy = game.getBoostEnergy();
          const boostPct = boostEnergy.max > 0 ? (boostEnergy.current / boostEnergy.max) * 100 : 0;
          const elapsed = game.getEngine().getTimeStats().totalTime;
          const kills = h?.kills ?? 0;

          const isDead = !!h && !h.isAlive;
          const isWon = !isDead && aliveCount <= 1 && elapsed > 0.5;
          const status: ViewSnapshot['status'] = isDead ? 'dead' : isWon ? 'won' : 'playing';
          const placement = status === 'won' ? 1 : status === 'dead' ? Math.max(1, aliveCount + 1) : 0;

          const zoneInfo = game.getZoneInfo();
          const zonePhase = (zoneInfo?.state ?? 'idle') as ViewSnapshot['zonePhase'];
          const dist = zoneInfo?.distanceFromPlayer ?? 9999;


          const abilityProgress = enableAbilities
            ? game.getAbilityProgress('shield')
            : { cooldown: 0, active: 0 };

          const nextSnapshot: ViewSnapshot = {
            aliveCount,
            kills,
            boostPct,
            elapsed,
            status,
            placement,
            killer: resolveKillerLabel(h?.killerId ?? null, game),
            zonePhase,
            isPlayerOutside: dist < 0,
            isPlayerInDanger: dist >= 0 && dist < 200,
            timeUntilShrink: Math.ceil((zoneInfo?.timeUntilNextPhaseMs ?? 0) / 1000),
            abilityCooldownPct: abilityProgress.cooldown,
            abilityActive: abilityProgress.active > 0,
          };

          setSnapshot(nextSnapshot);

          // "1 TRIBUTE REMAINS" dramatic feed entry
          if (prevAliveCountRef.current > 1 && aliveCount === 1) {
            setKillFeed((prev) => [
              ...prev,
              {
                id: `tribute-remains-${Date.now()}`,
                text: '1 CELL REMAINS',
                emphasis: 'danger' as const,
                timestamp: Date.now(),
              },
            ].slice(-7));
          }
          prevAliveCountRef.current = aliveCount;

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
                queryCacheEntries: debugInfo.entityManager.queryCacheEntries,
                queryCacheHits: debugInfo.entityManager.queryCacheHits,
                queryCacheInvalidations: debugInfo.entityManager.queryCacheInvalidations,
                speed: getPlayerSpeed(),
                inputMag: Math.hypot(move.x, move.y),
                boostActive: boost,
              });
            }
          }

          // Spectator mode: when local player dies, keep engine + RAF running
          // so bots continue playing. Exit to results when game ends.
          if (status === 'dead') {
            if (!spectatingRef.current) {
              spectatingRef.current = true;
              // Show instant stamp — visible the same frame as death detection
              deathStampKillerRef.current = nextSnapshot.killer;
              setShowDeathStamp(true);
              onPlayerDeath?.(nextSnapshot.killer);
              const deathStats: GameStats = {
                placement: Math.max(1, nextSnapshot.aliveCount + 1),
                kills: nextSnapshot.kills,
                duration: nextSnapshot.elapsed * 1000,
                distance: 0,
                winner: false,
                killerName: nextSnapshot.killer,
                totalPlayers: botCount + 1,
              };
              spectatingStatsRef.current = deathStats;
              setPendingDeathStats(deathStats);
              setGameHint(null);
              try { localStorage.setItem('spermrace_played_before', '1'); } catch {}
              setTimeout(() => {
                setShowDeathStamp(false);
                setShowDeathScreen(true);
              }, 650);
            }
            // All others eliminated — auto-exit to results
            if (!endedRef.current && nextSnapshot.aliveCount <= 1) {
              endedRef.current = true;
              setShowDeathScreen(false);
              setSpectating(false);
              try { game.getEngine().pause(); } catch {}
              setTimeout(() => {
                onGameEnd?.(spectatingStatsRef.current ?? {
                  placement: 2, kills: 0, duration: 0, distance: 0,
                  winner: false, killerName: null, totalPlayers: botCount + 1,
                });
              }, 800);
              return;
            }
            rafId = window.requestAnimationFrame(tick);
            return;
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
  }, [session, isMobile, playerName, playerColor, botCount, enableAbilities, onGameEnd, onPlayerDeath, onError, playerHealthMask, gameStarted, showPreGame]);

  const summary = useMemo(() => {
    return getViewSummary(snapshot);
  }, [snapshot.status, snapshot.elapsed]);

  const resetPlayState = () => {
    inputRef.current = { move: { x: 0, y: 0 }, boost: false };
    keyStateRef.current.clear();
    setSnapshot(createInitialSnapshot(botCount));
    setStickUi({ active: false, dx: 0, dy: 0, baseX: 0, baseY: 0 });
    setKillFeed([]);
    setStreakBanner(null);
    mobileBoostHeldRef.current = false;
    setMobileBoostHeld(false);
    setToolsCopied(false);
    prevAliveCountRef.current = botCount + 1;
    endedRef.current = false;
    setShowDeathScreen(false);
    setShowDeathStamp(false);
    setPendingDeathStats(null);
    setSpectating(false);
    setShowVictoryStamp(false);
    setShowQuickJoin(false);
    spectatingRef.current = false;
    spectatingStatsRef.current = null;
  };

  // Replay: restart game
  const handleReplay = () => {
    resetPlayState();
    setGameStarted(false);
    setSession((v) => v + 1);
    void startGame(true);
  };

  // Quick replay: same class, skip showcase + map overview, just countdown
  const handleQuickReplay = () => {
    resetPlayState();
    setGameStarted(false);
    setSession((v) => v + 1);
    void startGame(true);
  };

  // Spectate: dismiss death screen and show spectator overlay
  const handleSpectate = () => {
    setShowDeathScreen(false);
    setSpectating(true);
  };

  // Leave: exit to results screen / lobby
  const handleLeave = () => {
    setShowDeathScreen(false);
    setSpectating(false);
    // Pause engine — may still be running if player was spectating
    try { gameRef.current?.getEngine().pause(); } catch {}
    if (pendingDeathStats) {
      onGameEnd?.(pendingDeathStats);
    } else {
      onExit?.();
    }
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

  const onAbilityPointerDown = useCallback((e: ReactPointerEvent<HTMLButtonElement>) => {
    e.preventDefault();
    e.stopPropagation();
    gameRef.current?.activateAbility('shield');
  }, []);

  return (
    <div className="ecs-root" data-status={snapshot.status}>
      {/* Quick bot-join animation — shown during game creation */}
      {showQuickJoin && (
        <QuickJoinOverlay botCount={botCount} playerName={playerName} />
      )}

      {/* Pre-Game Sequence */}
      {showPreGame && gameRef.current && (
        <PreGameSequence
          game={gameRef.current}
          totalPlayers={botCount + 1}
          skipToCountdown={skipMapOverview}
          onComplete={handlePreGameComplete}
        />
      )}

      <div ref={hostRef} className="ecs-canvas-host" />

      {/* Dominant alive counter — centered at top */}
      {snapshot.status === 'playing' && (
        <div className="ecs-alive-dominant-wrap">
          <div className={`ecs-alive-dominant${snapshot.aliveCount <= 3 ? ' danger' : ''}`}>
            <span className="ecs-alive-kicker">{snapshot.aliveCount <= 3 ? 'Final Duel' : 'Alive'}</span>
            <strong key={snapshot.aliveCount}>{snapshot.aliveCount}</strong>
          </div>
        </div>
      )}

      {gameStarted && (
        <div className="ecs-hud">
          <div className="ecs-pill">PRACTICE · {summary.statusText}</div>
          <div className="ecs-metric">KILLS <strong key={snapshot.kills} className="ecs-kill-pop">{snapshot.kills}</strong></div>
          <div className="ecs-metric ecs-time-metric">TIME <strong>{summary.timeText}</strong></div>
          <div className="ecs-boost-wrap">
            <span>BOOST</span>
            <div className="ecs-boost-bar"><div className="ecs-boost-fill" style={{ width: `${snapshot.boostPct}%` }} /></div>
          </div>
        </div>
      )}

      {/* Zone phase pill */}
      {snapshot.status === 'playing' && !(snapshot.zonePhase === 'idle' && snapshot.timeUntilShrink <= 0) && (
        <div className={`ecs-zone-pill is-${snapshot.zonePhase}`}>
          {snapshot.zonePhase === 'idle'
            ? `ZONE: ${snapshot.timeUntilShrink}s`
            : snapshot.zonePhase === 'warning'
            ? `ZONE CLOSING: ${snapshot.timeUntilShrink}s`
            : snapshot.zonePhase === 'shrinking' ? 'ZONE SHRINKING'
            : 'FINAL ZONE'}
        </div>
      )}
      {/* Danger border overlay */}
      {snapshot.status === 'playing' && snapshot.isPlayerOutside && (
        <div className="ecs-danger-border" />
      )}

      {/* Radar */}
      {snapshot.status === 'playing' && gameRef.current && (
        <GameRadar game={gameRef.current} playerMask={playerHealthMask} />
      )}

      {/* Spawn protection indicator */}
      {snapshot.status === 'playing' && spawnProtected && (
        <div className="ecs-spawn-shield">SPAWNING — PROTECTED</div>
      )}

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

      {snapshot.status === 'playing' && showControlsHint && (
        <div className="ecs-controls-hint">
          {isMobile ? (
            <>
              <div>Steer with left thumb · Hold right side to <strong>Boost</strong></div>
              <div>Touching any trail kills you · Stay inside the zone</div>
            </>
          ) : (
            <>
              <div>Mouse to steer · <strong>Space</strong> to Boost</div>
              <div>Touching any trail kills you · Stay inside the shrinking zone</div>
              <div>Last cell standing wins</div>
            </>
          )}
        </div>
      )}

      {isMobile && gameStarted && snapshot.status === 'playing' && (
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
          {showControlsHint && (
            <div className="ecs-mobile-boost-hint">HOLD RIGHT SIDE TO BOOST</div>
          )}
          {enableAbilities && (
            <button
              type="button"
              className={`ecs-mobile-ability-btn${snapshot.abilityActive ? ' is-active' : snapshot.abilityCooldownPct > 0 ? ' is-cooling' : ''}`}
              onPointerDown={onAbilityPointerDown}
              onContextMenu={(e) => e.preventDefault()}
              aria-label="Use Shield"
            >
              <svg className="ecs-ability-cooldown-ring" viewBox="0 0 46 46">
                <circle className="ecs-ability-ring-track" cx="23" cy="23" r="20"/>
                <circle className="ecs-ability-ring-fill" cx="23" cy="23" r="20"
                  style={{ strokeDashoffset: 125.66 * (snapshot.abilityActive ? 0 : snapshot.abilityCooldownPct) }}
                />
              </svg>
              <span className="ecs-ability-btn-label">SHIELD</span>
            </button>
          )}
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
            <span>QCACHE</span><strong>{toolsSnapshot.queryCacheEntries}</strong>
            <span>QHITS</span><strong>{toolsSnapshot.queryCacheHits}</strong>
            <span>QINV</span><strong>{toolsSnapshot.queryCacheInvalidations}</strong>
            <span>SPEED</span><strong>{Math.round(toolsSnapshot.speed)}</strong>
            <span>INPUT</span><strong>{toolsSnapshot.inputMag.toFixed(2)}</strong>
            <span>BOOST</span><strong>{toolsSnapshot.boostActive ? 'ON' : 'OFF'}</strong>
          </div>
          <button type="button" className="ecs-tools-copy" onClick={copyToolsSnapshot}>
            {toolsCopied ? 'SNAPSHOT COPIED' : 'COPY LIVE SNAPSHOT'}
          </button>
        </div>
      )}

      {/* Victory stamp — appears instantly on win, fades before full overlay */}
      {showVictoryStamp && (
        <div className="ecs-victory-stamp">
          <span className="ecs-victory-stamp-text">VICTORY</span>
        </div>
      )}

      {/* In-game victory overlay — 3s then auto-exits to results */}
      {winStats && (
        <div className="ecs-win-overlay">
          <div className="ecs-win-card">
            <div className="ecs-win-stamp">VICTORY</div>
            <div className="ecs-win-sub">Last cell standing</div>
            <div className="ecs-win-stats-row">
              <span>{winStats.kills} KILL{winStats.kills !== 1 ? 'S' : ''}</span>
              <span className="ecs-win-dot">·</span>
              <span>{Math.floor(winStats.duration / 1000)}s</span>
            </div>
            {onPlayReal && (
              <>
                <div className="ecs-win-hook">You just beat {winStats.totalPlayers - 1} opponents. Ready for real money?</div>
                <button
                  className="ecs-win-play-real"
                  onClick={onPlayReal}
                >
                  PLAY FOR REAL → win {playRealPrize} in SOL
                </button>
              </>
            )}
            <button
              className="ecs-win-continue"
              onClick={() => onGameEnd?.(winStats)}
            >
              {onPlayReal ? `SKIP · ${winCountdown}` : `CONTINUE · ${winCountdown}`}
            </button>
          </div>
        </div>
      )}

      {/* First-game contextual hints — shown inline, one at a time, first game only */}
      {gameHint && snapshot.status === 'playing' && (
        <div className="ecs-game-hint" role="status" aria-live="polite">
          <div className="ecs-game-hint-body">
            <span className="ecs-game-hint-icon" aria-hidden="true">
              {gameHint === 'trail' ? '⚠' : '⚡'}
            </span>
            <div>
              {gameHint === 'trail' && (
                <><strong>Your trail is deadly</strong><span>Don't cross your own path after leaving it</span></>
              )}
            </div>
          </div>
          <button className="ecs-game-hint-dismiss" onClick={() => setGameHint(null)} aria-label="Dismiss hint">✕</button>
        </div>
      )}

      {/* ELIMINATED stamp — appears instantly on death, clears as death card slides in */}
      {showDeathStamp && (
        <div className="ecs-death-stamp">
          <span className="ecs-death-stamp-text">ELIMINATED</span>
          {deathStampKillerRef.current && (
            <span className="ecs-death-stamp-by">by {deathStampKillerRef.current}</span>
          )}
        </div>
      )}

      {/* In-game death screen — shown on death, player chooses quick replay / spectate / leave */}
      {showDeathScreen && pendingDeathStats && (
        <DeathScreen
          placement={pendingDeathStats.placement}
          totalPlayers={pendingDeathStats.totalPlayers}
          killerName={pendingDeathStats.killerName}
          ownTrail={!pendingDeathStats.killerName}
          kills={pendingDeathStats.kills}
          timeSurvived={pendingDeathStats.duration / 1000}
          canSpectate={true}
          onSpectate={handleSpectate}
          onQuickReplay={handleQuickReplay}
          onLeave={handleLeave}
        />
      )}

      {/* Spectator overlay — engine still running, watching remaining bots */}
      {spectating && (
        <div className="spectator-overlay">
          <div className="spectator-badge">WATCHING</div>
          <div className="spectator-alive">{snapshot.aliveCount} alive</div>
          <button className="spectator-skip" onClick={handleLeave}>
            Skip to results
          </button>
        </div>
      )}
    </div>
  );
}

export default NewGameViewECS;
