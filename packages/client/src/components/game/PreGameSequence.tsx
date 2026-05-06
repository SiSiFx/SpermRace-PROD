/**
 * PreGameSequence - Orchestrates the pre-game experience
 *
 * Phase 1: Arena overview — cinematic pull-back + spawn markers + roster + threat line
 *   - Practice: 7s   Tournament: 4s
 * Phase 2: Countdown (3s) — camera zooms back in while 3/2/1/GO runs
 * Phase 3: Punch zoom (220ms) — impact zoom on GO
 */

import { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CountdownAnimation } from '../CountdownAnimation';
import type { Game } from '../../game/engine/Game';
import { getDefaultZoom, ARENA_CONFIG } from '../../game/engine/config';
import { createComponentMask, ComponentNames } from '../../game/engine/components';
import type { Player } from '../../game/engine/components/Player';
import type { Position } from '../../game/engine/components/Position';
import './PreGameSequence.css';

interface PreGameSequenceProps {
  game: Game;
  totalPlayers?: number;
  skipToCountdown?: boolean;
  mode?: 'practice' | 'tournament';
  onComplete: () => void;
}

type Phase = 'mapOverview' | 'countdown' | 'zoomToPlayer' | 'complete';

type SpawnMarker = {
  id: string;
  worldX: number;
  worldY: number;
  colorStr: string;
  name: string;
  isLocal: boolean;
  phase: number;
};

// Phase durations in milliseconds
const PHASE_DURATIONS = {
  countdown: 1800,
  zoomToPlayer: 300,
};

// Zoom level that shows the full arena during overview
const OVERVIEW_ZOOM = 0.145;

// Tutorial tips shown during the overview
const TIPS = [
  {
    label: '01',
    headline: 'TRAILS KILL',
    body: 'Touch any trail — yours or theirs — and you die instantly.',
  },
  {
    label: '02',
    headline: 'ZONE SHRINKS',
    body: "The safe zone closes in. Get caught outside and you're dead.",
  },
  {
    label: '03',
    headline: 'LAST ONE ALIVE',
    body: 'Outlast everyone. Be the last one swimming to claim the prize.',
  },
] as const;

/**
 * Pre-game sequence orchestrator
 * Manages camera movements and phase transitions
 */
export function PreGameSequence({
  game,
  totalPlayers = 10,
  skipToCountdown = false,
  mode = 'practice',
  onComplete,
}: PreGameSequenceProps) {
  // Overview duration depends on mode — tournament is shorter to minimise desync
  const OVERVIEW_DURATION_MS = mode === 'tournament' ? 4000 : 7000;
  const TIP_DURATION = Math.floor(OVERVIEW_DURATION_MS / TIPS.length);

  const [phase, setPhase] = useState<Phase>(skipToCountdown ? 'countdown' : 'mapOverview');
  const [showCountdown, setShowCountdown] = useState(skipToCountdown);
  const [mapOverviewReady, setMapOverviewReady] = useState(false);
  const [tipIndex, setTipIndex] = useState(0);
  const [markers, setMarkers] = useState<SpawnMarker[]>([]);

  const playerIdRef = useRef<string | null>(null);
  const initialPlayerPosRef = useRef<{ x: number; y: number } | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const tipIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const markerCanvasRef = useRef<HTMLCanvasElement>(null);
  const cameraSysRef = useRef<any>(null);

  // Get camera system and player info on mount
  useEffect(() => {
    const engine = game.getEngine();
    playerIdRef.current = game.getPlayerId();

    // Get initial player position
    const playerId = game.getPlayerId();
    if (playerId) {
      const entityManager = engine.getEntityManager();
      const playerEntity = entityManager.getEntity(playerId);
      if (playerEntity) {
        const position = playerEntity.getComponent<{ x: number; y: number }>('Position');
        if (position) {
          initialPlayerPosRef.current = { x: position.x, y: position.y };
        }
      }
    }

    // Pause game immediately
    engine.pause();

    // Find camera system for worldToScreen in marker RAF loop
    const systemManager = engine.getSystemManager();
    const camSys = systemManager.getSystem('camera');
    cameraSysRef.current = camSys ?? null;

    // Gather spawn positions of all Player+Position entities
    const mask = createComponentMask(ComponentNames.PLAYER, ComponentNames.POSITION);
    const allEntities = engine.getEntityManager().queryByMask(mask);
    const markerList: SpawnMarker[] = [];
    for (const entity of allEntities) {
      const pos = entity.getComponent<Position>(ComponentNames.POSITION);
      const player = entity.getComponent<Player>(ComponentNames.PLAYER);
      if (!pos || !player) continue;
      markerList.push({
        id: entity.id,
        worldX: pos.x,
        worldY: pos.y,
        colorStr: '#' + player.color.toString(16).padStart(6, '0'),
        name: player.name,
        isLocal: player.isLocal,
        phase: Math.random() * Math.PI * 2,
      });
    }
    setMarkers(markerList);

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      if (tipIntervalRef.current) {
        clearInterval(tipIntervalRef.current);
      }
    };
  }, [game]);

  // Camera animation helper — animates from current camera position to target
  const animateCamera = useCallback((
    targetX: number,
    targetY: number,
    targetZoom: number,
    duration: number,
    onDone?: () => void
  ) => {
    const engine = game.getEngine();
    const systemManager = engine.getSystemManager();
    const systems = systemManager.getSystems();

    // Find camera and render systems via public API
    let cameraSystem: any = null;
    let renderSystem: any = null;
    for (const sys of systems) {
      if (sys.constructor.name === 'CameraSystem') cameraSystem = sys;
      if (sys.constructor.name === 'RenderSystem') renderSystem = sys;
    }

    if (!cameraSystem) {
      onDone?.();
      return;
    }

    const startPos = cameraSystem.getPosition();
    const startZoom = cameraSystem.getZoom();
    const startTime = performance.now();
    let lastTime = startTime;

    const animate = (currentTime: number) => {
      const dt = Math.min((currentTime - lastTime) / 1000, 0.05);
      lastTime = currentTime;

      const elapsed = currentTime - startTime;
      const progress = Math.min(1, elapsed / duration);

      // Ease out cubic
      const easeProgress = 1 - Math.pow(1 - progress, 3);

      const currentX = startPos.x + (targetX - startPos.x) * easeProgress;
      const currentY = startPos.y + (targetY - startPos.y) * easeProgress;
      const currentZoom = startZoom + (targetZoom - startZoom) * easeProgress;

      cameraSystem.setPosition(currentX, currentY);
      // setZoomDirect sets both zoom AND targetZoom immediately — needed because
      // CameraSystem.update() is not running while the engine is paused, so
      // setZoom() (which only sets targetZoom) would never be applied.
      (cameraSystem as any).setZoomDirect?.(currentZoom);
      // Drive render manually — engine is paused but canvas must redraw each frame
      renderSystem?.update(dt);

      if (progress < 1) {
        animationFrameRef.current = requestAnimationFrame(animate);
      } else {
        onDone?.();
      }
    };

    animationFrameRef.current = requestAnimationFrame(animate);
  }, [game]);

  // Skip the overview and go straight to countdown
  const handleSkip = useCallback(() => {
    if (tipIntervalRef.current) {
      clearInterval(tipIntervalRef.current);
      tipIntervalRef.current = null;
    }
    setPhase('countdown');
    setShowCountdown(true);
  }, []);

  // Phase 1: Arena overview — cinematic pull-back + cycle tips
  useEffect(() => {
    if (phase !== 'mapOverview') return;

    setMapOverviewReady(true);

    const isMob = window.innerWidth <= 900;
    const cx = (isMob ? ARENA_CONFIG.MOBILE_WIDTH : ARENA_CONFIG.DESKTOP_WIDTH) / 2;
    const cy = (isMob ? ARENA_CONFIG.MOBILE_HEIGHT : ARENA_CONFIG.DESKTOP_HEIGHT) / 2;

    // Pull-back: animate FROM player spawn (current cam pos) TO arena center over 1.3s
    animateCamera(cx, cy, OVERVIEW_ZOOM, 1300);

    // Cycle tips
    let idx = 0;
    tipIntervalRef.current = setInterval(() => {
      idx = (idx + 1) % TIPS.length;
      setTipIndex(idx);
    }, TIP_DURATION);

    const timer = setTimeout(() => {
      if (tipIntervalRef.current) {
        clearInterval(tipIntervalRef.current);
        tipIntervalRef.current = null;
      }
      setPhase('countdown');
      setShowCountdown(true);
    }, OVERVIEW_DURATION_MS);

    return () => {
      clearTimeout(timer);
      if (tipIntervalRef.current) {
        clearInterval(tipIntervalRef.current);
        tipIntervalRef.current = null;
      }
    };
  }, [phase, game, animateCamera, OVERVIEW_DURATION_MS, TIP_DURATION]);

  // Marker canvas RAF loop — draws pulsing spawn-position rings for every player
  useEffect(() => {
    if (phase !== 'mapOverview' || markers.length === 0) return;
    const canvas = markerCanvasRef.current;
    const camSys = cameraSysRef.current;
    if (!canvas || !camSys) return;

    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let rafId: number;
    const draw = (t: number) => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      for (const m of markers) {
        const s = camSys.worldToScreen(m.worldX, m.worldY);
        if (s.x < -60 || s.x > canvas.width + 60 || s.y < -60 || s.y > canvas.height + 60) continue;
        const pulse = 0.75 + 0.25 * Math.sin(t * 0.0022 + m.phase);
        ctx.globalAlpha = 1;

        if (m.isLocal) {
          // Outer glow ring
          ctx.beginPath();
          ctx.arc(s.x, s.y, 28 * pulse, 0, Math.PI * 2);
          ctx.strokeStyle = '#22d3ee';
          ctx.lineWidth = 1.5;
          ctx.globalAlpha = 0.28;
          ctx.stroke();
          // Inner ring (opposite phase)
          const ip = 0.75 + 0.25 * Math.sin(t * 0.0022 + m.phase + Math.PI);
          ctx.beginPath();
          ctx.arc(s.x, s.y, 16 * ip, 0, Math.PI * 2);
          ctx.strokeStyle = '#22d3ee';
          ctx.lineWidth = 2.5;
          ctx.globalAlpha = 0.90;
          ctx.stroke();
          // Center dot
          ctx.beginPath();
          ctx.arc(s.x, s.y, 4, 0, Math.PI * 2);
          ctx.fillStyle = '#ffffff';
          ctx.globalAlpha = 0.9;
          ctx.fill();
          // "YOU" label
          ctx.globalAlpha = 0.95;
          ctx.fillStyle = '#22d3ee';
          ctx.font = 'bold 10px "JetBrains Mono", monospace';
          ctx.textAlign = 'center';
          ctx.fillText('YOU', s.x, s.y - 34);
          // Tick line connecting label to ring
          ctx.beginPath();
          ctx.moveTo(s.x, s.y - 28);
          ctx.lineTo(s.x, s.y - 24);
          ctx.strokeStyle = '#22d3ee';
          ctx.lineWidth = 1.5;
          ctx.globalAlpha = 0.55;
          ctx.stroke();
        } else {
          // Other player ring — same style for bots and real tournament players
          ctx.beginPath();
          ctx.arc(s.x, s.y, 10 * pulse, 0, Math.PI * 2);
          ctx.strokeStyle = m.colorStr;
          ctx.lineWidth = 1.5;
          ctx.globalAlpha = 0.55;
          ctx.stroke();
          // Center dot
          ctx.beginPath();
          ctx.arc(s.x, s.y, 2.5, 0, Math.PI * 2);
          ctx.fillStyle = m.colorStr;
          ctx.globalAlpha = 0.7;
          ctx.fill();
          // Name label
          ctx.globalAlpha = 0.55;
          ctx.fillStyle = m.colorStr;
          ctx.font = '9px system-ui, sans-serif';
          ctx.textAlign = 'center';
          ctx.fillText(m.name, s.x, s.y + 20);
        }
      }
      rafId = requestAnimationFrame(draw);
    };
    rafId = requestAnimationFrame(draw);

    return () => {
      cancelAnimationFrame(rafId);
      canvas.getContext('2d')?.clearRect(0, 0, canvas.width, canvas.height);
    };
  }, [phase, markers]);

  // Threat context line — computed once from spawn positions
  const threatLine = useMemo(() => {
    const local = markers.find(m => m.isLocal);
    if (!local) return null;
    const nearby = markers.filter(
      m => !m.isLocal && Math.hypot(m.worldX - local.worldX, m.worldY - local.worldY) < 1400
    );
    if (nearby.length === 0) return 'ISOLATED START — open space around you';
    if (nearby.length === 1) return '1 CELL NEARBY — stay sharp';
    return `${nearby.length} CELLS NEARBY — immediate threat`;
  }, [markers]);

  // Phase 2: Countdown — zoom back in to player while 3/2/1 runs.
  useEffect(() => {
    if (phase !== 'countdown' || skipToCountdown) return;
    const cam = (game.getEngine().getSystemManager() as any).getSystem?.('camera');
    if (playerIdRef.current) cam?.setTarget(playerIdRef.current);
    cam?.setZoom(getDefaultZoom(window.innerWidth <= 900));
  }, [phase, game, skipToCountdown]);

  // Phase 3: Countdown -> Zoom to Player
  const handleCountdownComplete = useCallback(() => {
    setShowCountdown(false);
    setPhase('zoomToPlayer');
    game.getEngine().resume();

    // Play spawn sound immediately at GO
    const systems = game.getEngine().getSystemManager().getSystems();
    for (const sys of systems) {
      if (sys.constructor.name === 'SoundSystem') {
        (sys as any).playSpawn?.();
        break;
      }
    }
  }, [game]);

  // Phase 4: Zoom to Player -> Complete
  useEffect(() => {
    if (phase !== 'zoomToPlayer') return;

    const playerPos = initialPlayerPosRef.current;
    if (!playerPos) {
      setPhase('complete');
      onComplete();
      return;
    }

    const systems = game.getEngine().getSystemManager().getSystems();
    let cameraSystem: any = null;
    for (const sys of systems) {
      if (sys.constructor.name === 'CameraSystem') {
        cameraSystem = sys;
        break;
      }
    }

    const focusZoom = getDefaultZoom(window.innerWidth <= 900);
    const punchZoom = focusZoom * 1.28;

    animateCamera(playerPos.x, playerPos.y, punchZoom, 220, () => {
      if (cameraSystem) {
        cameraSystem.shake(0.28, 0.22);
        cameraSystem.setZoom(focusZoom);
      }
      if (cameraSystem && playerIdRef.current) {
        cameraSystem.setTarget(playerIdRef.current);
      }

      // Trigger spawn visual effects
      const allSystems = game.getEngine().getSystemManager().getSystems();
      for (const sys of allSystems) {
        if (sys.constructor.name === 'RenderSystem') {
          (sys as any).resetSpawnState?.();
          break;
        }
      }

      setPhase('complete');
      onComplete();
    });

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [phase, game, animateCamera, onComplete]);

  return (
    <div className="pre-game-sequence">
      {/* Arena overview — transparent overlay with cinematic pull-back + spawn markers */}
      <AnimatePresence>
        {phase === 'mapOverview' && mapOverviewReady && (
          <motion.div
            className="map-overview-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, transition: { duration: 0 } }}
            transition={{ duration: 0.4, delay: 0.3 }}
          >
            {/* Full-screen marker canvas — transparent, sits over game canvas */}
            <canvas ref={markerCanvasRef} className="spawn-marker-canvas" />

            {/* Player count label */}
            <p className="map-overview-label">{totalPlayers} players · last one alive wins</p>

            {/* Tutorial tip card + roster */}
            <div className="overview-tip-wrap">
              {/* Progress bar spanning full overview duration */}
              <div className="overview-progress-bar">
                <motion.div
                  className="overview-progress-fill"
                  initial={{ width: '0%' }}
                  animate={{ width: '100%' }}
                  transition={{ duration: OVERVIEW_DURATION_MS / 1000, ease: 'linear' }}
                />
              </div>

              {/* Animated tip — slides on tip change */}
              <AnimatePresence mode="wait">
                <motion.div
                  key={tipIndex}
                  className="overview-tip-card"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  transition={{ duration: 0.25 }}
                >
                  <div className="tip-header">
                    <span className="tip-label">{TIPS[tipIndex].label}</span>
                    <span className="tip-headline">{TIPS[tipIndex].headline}</span>
                  </div>
                  <p className="tip-body">{TIPS[tipIndex].body}</p>
                </motion.div>
              </AnimatePresence>

              {/* Player roster — all spawn positions with staggered animation */}
              {markers.length > 0 && (
                <div className="overview-roster">
                  {[...markers]
                    .sort((a, b) => (b.isLocal ? 1 : 0) - (a.isLocal ? 1 : 0))
                    .map((m, i) => (
                      <div
                        key={m.id}
                        className={`roster-entry${m.isLocal ? ' is-you' : ''}`}
                        style={{ animationDelay: `${i * 55}ms` }}
                      >
                        <span className="roster-dot" style={{ background: m.colorStr }} />
                        <span className="roster-name">{m.name}</span>
                        {m.isLocal && <span className="roster-you-tag">YOU</span>}
                      </div>
                    ))
                  }
                </div>
              )}

              {/* Threat context line */}
              {threatLine && <p className="overview-threat">{threatLine}</p>}
            </div>

            {/* Skip button */}
            <button className="overview-skip-btn" onClick={handleSkip}>
              SKIP →
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Countdown overlay */}
      {showCountdown && (
        <CountdownAnimation
          duration={PHASE_DURATIONS.countdown}
          onComplete={handleCountdownComplete}
          isVisible={showCountdown}
        />
      )}
    </div>
  );
}

export default PreGameSequence;
