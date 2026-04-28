/**
 * PreGameSequence - Orchestrates the pre-game experience
 *
 * Phase 1: Arena overview (7s) — camera zooms out, tutorial tips cycle, skip button
 * Phase 2: Countdown (3s) — camera zooms back in while 3/2/1/GO runs
 * Phase 3: Punch zoom (220ms) — impact zoom on GO
 *
 * Total: ~10.5 seconds (or ~3.5s if skipped)
 */

import { useEffect, useState, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CountdownAnimation } from '../CountdownAnimation';
import type { Game } from '../../game/engine/Game';
import { getDefaultZoom, ARENA_CONFIG } from '../../game/engine/config';
import './PreGameSequence.css';

interface PreGameSequenceProps {
  game: Game;
  totalPlayers?: number;
  skipToCountdown?: boolean;
  onComplete: () => void;
}

type Phase = 'mapOverview' | 'countdown' | 'zoomToPlayer' | 'complete';

// Phase durations in milliseconds
const PHASE_DURATIONS = {
  mapOverview: 7000,
  countdown: 3000,
  zoomToPlayer: 300,
};

// Zoom level that shows the full arena during overview — close enough to see all players
const OVERVIEW_ZOOM = 0.165;

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
    body: 'The safe zone closes in. Get caught outside and you\'re dead.',
  },
  {
    label: '03',
    headline: 'LAST ONE ALIVE',
    body: 'Outlast everyone. Be the last one swimming to claim the prize.',
  },
] as const;

const TIP_DURATION = Math.floor(PHASE_DURATIONS.mapOverview / TIPS.length);

/**
 * Pre-game sequence orchestrator
 * Manages camera movements and phase transitions
 */
export function PreGameSequence({
  game,
  totalPlayers = 10,
  skipToCountdown = false,
  onComplete,
}: PreGameSequenceProps) {
  const [phase, setPhase] = useState<Phase>(skipToCountdown ? 'countdown' : 'mapOverview');
  const [showCountdown, setShowCountdown] = useState(skipToCountdown);
  const [mapOverviewReady, setMapOverviewReady] = useState(false);
  const [tipIndex, setTipIndex] = useState(0);
  const playerIdRef = useRef<string | null>(null);
  const initialPlayerPosRef = useRef<{ x: number; y: number } | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const tipIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

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

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      if (tipIntervalRef.current) {
        clearInterval(tipIntervalRef.current);
      }
    };
  }, [game]);

  // Camera animation helper
  const animateCamera = useCallback((
    targetX: number,
    targetY: number,
    targetZoom: number,
    duration: number,
    onDone?: () => void
  ) => {
    const engine = game.getEngine();
    const systemManager = engine.getSystemManager();
    const systems = (systemManager as any).systems || [];

    // Find camera and render systems
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

      // Update camera position and zoom
      cameraSystem.setPosition(currentX, currentY);
      cameraSystem.setZoom(currentZoom);
      // Drive the render system manually — engine is paused so its loop doesn't tick,
      // but we still need the canvas to redraw each frame to show the zoom animation.
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

  // Phase 1: Arena overview — zoom out, cycle tutorial tips
  // startPreviewRender() is already running (camera.update + render.update each frame),
  // so simply setting targetZoom is enough — camera smooth factor animates it.
  useEffect(() => {
    if (phase !== 'mapOverview') return;

    setMapOverviewReady(true);

    // Center on arena then zoom out — snap happens during the overlay's 0.3s invisible fade-in
    const cam = (game.getEngine().getSystemManager() as any).getSystem?.('camera');
    const isMob = window.innerWidth <= 900;
    const cx = (isMob ? ARENA_CONFIG.MOBILE_WIDTH : ARENA_CONFIG.DESKTOP_WIDTH) / 2;
    const cy = (isMob ? ARENA_CONFIG.MOBILE_HEIGHT : ARENA_CONFIG.DESKTOP_HEIGHT) / 2;
    cam?.setPosition(cx, cy);   // clears follow target, snaps camera to arena center
    cam?.setZoom(OVERVIEW_ZOOM); // startPreviewRender() animates zoom each frame

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
    }, PHASE_DURATIONS.mapOverview);

    return () => {
      clearTimeout(timer);
      if (tipIntervalRef.current) {
        clearInterval(tipIntervalRef.current);
        tipIntervalRef.current = null;
      }
    };
  }, [phase, game]);

  // Phase 2: Countdown — zoom back in to player while 3/2/1 runs.
  // Camera is still following the player entity so it re-centres automatically.
  useEffect(() => {
    if (phase !== 'countdown' || skipToCountdown) return;
    const cam = (game.getEngine().getSystemManager() as any).getSystem?.('camera');
    // Re-enable follow so camera drifts from arena center → player during the 3s countdown
    if (playerIdRef.current) cam?.setTarget(playerIdRef.current);
    cam?.setZoom(getDefaultZoom(window.innerWidth <= 900));
  }, [phase, game, skipToCountdown]);

  // Phase 3: Countdown -> Zoom to Player
  // Resume engine immediately at GO so the player starts moving during the camera zoom-in.
  // This eliminates the freeze between "GO!" and gameplay starting.
  const handleCountdownComplete = useCallback(() => {
    setShowCountdown(false);
    setPhase('zoomToPlayer');
    game.getEngine().resume();

    // Play spawn sound immediately at GO
    const systems = (game.getEngine().getSystemManager() as any).systems || [];
    for (const sys of systems) {
      if (sys.constructor.name === 'SoundSystem') {
        sys.playSpawn?.();
        break;
      }
    }
  }, [game]);

  // Phase 4: Zoom to Player -> Complete
  // Two-step punch zoom: overshoot to 1.25× default (zoomed in close), then the camera
  // smooth factor naturally settles back to default while gameplay runs.
  useEffect(() => {
    if (phase !== 'zoomToPlayer') return;

    const playerPos = initialPlayerPosRef.current;
    if (!playerPos) {
      setPhase('complete');
      onComplete();
      return;
    }

    // Get camera system to re-enable follow
    const engine = game.getEngine();
    const systemManager = engine.getSystemManager();
    const systems = (systemManager as any).systems || [];

    let cameraSystem: any = null;
    for (const sys of systems) {
      if (sys.constructor.name === 'CameraSystem') {
        cameraSystem = sys;
        break;
      }
    }

    const focusZoom = getDefaultZoom(window.innerWidth <= 900);
    // Punch in closer than normal zoom, then let smooth follow settle to focusZoom
    const punchZoom = focusZoom * 1.28;

    // Step 1: Fast zoom to player position, punched in close
    animateCamera(playerPos.x, playerPos.y, punchZoom, 220, () => {
      // Shake on impact — tactile "GO!" feel
      if (cameraSystem) {
        cameraSystem.shake(0.28, 0.22);
        // Set target zoom back to normal; camera smooth factor eases it out during gameplay
        cameraSystem.setZoom(focusZoom);
      }

      // Re-enable camera follow so it tracks player immediately
      if (cameraSystem && playerIdRef.current) {
        cameraSystem.setTarget(playerIdRef.current);
      }

      // Trigger spawn visual effects NOW — camera is on the player at full zoom,
      // so the pop-in, ring, and grace aura are fully visible at this moment
      const allSystems = (game.getEngine().getSystemManager() as any).systems || [];
      for (const sys of allSystems) {
        if (sys.constructor.name === 'RenderSystem') {
          sys.resetSpawnState?.();
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
      {/* Arena overview — transparent overlay with cycling tip card + skip button */}
      <AnimatePresence>
        {phase === 'mapOverview' && mapOverviewReady && (
          <motion.div
            className="map-overview-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, transition: { duration: 0 } }}
            transition={{ duration: 0.4, delay: 0.3 }}
          >
            {/* Player count label */}
            <p className="map-overview-label">{totalPlayers} players · last one alive wins</p>

            {/* Tutorial tip card */}
            <div className="overview-tip-wrap">
              {/* Progress bar spanning full 7s */}
              <div className="overview-progress-bar">
                <motion.div
                  className="overview-progress-fill"
                  initial={{ width: '0%' }}
                  animate={{ width: '100%' }}
                  transition={{ duration: PHASE_DURATIONS.mapOverview / 1000, ease: 'linear' }}
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
