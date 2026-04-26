/**
 * PreGameSequence - Orchestrates the pre-game experience
 *
 * Phase 1: Arena overview (2.5s) — camera zooms out to show full arena
 * Phase 2: Countdown (3s) — camera zooms back in while 3/2/1/GO runs
 * Phase 3: Punch zoom (220ms) — impact zoom on GO
 *
 * Total: ~5.7 seconds
 */

import { useEffect, useState, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CountdownAnimation } from '../CountdownAnimation';
import type { Game } from '../../game/engine/Game';
import { getDefaultZoom } from '../../game/engine/config';
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
  mapOverview: 2500,
  countdown: 3000,
  zoomToPlayer: 300,
};

// Zoom level that shows the full arena during overview
const OVERVIEW_ZOOM = 0.10;

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
  const playerIdRef = useRef<string | null>(null);
  const initialPlayerPosRef = useRef<{ x: number; y: number } | null>(null);
  const animationFrameRef = useRef<number | null>(null);

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

  // Phase 1: Arena overview — zoom out to show the whole arena.
  // startPreviewRender() is already running (camera.update + render.update each frame),
  // so simply setting targetZoom is enough — camera smooth factor animates it.
  useEffect(() => {
    if (phase !== 'mapOverview') return;

    setMapOverviewReady(true);

    // Zoom out: camera smooth factor (0.18) animates from 0.72 → 0.10 in ~400ms
    const cam = (game.getEngine().getSystemManager() as any).getSystem?.('camera');
    cam?.setZoom(OVERVIEW_ZOOM);

    const timer = setTimeout(() => {
      setPhase('countdown');
      setShowCountdown(true);
    }, PHASE_DURATIONS.mapOverview);

    return () => clearTimeout(timer);
  }, [phase, game]);

  // Phase 2: Countdown — zoom back in to player while 3/2/1 runs.
  // Camera is still following the player entity so it re-centres automatically.
  useEffect(() => {
    if (phase !== 'countdown' || skipToCountdown) return;
    const cam = (game.getEngine().getSystemManager() as any).getSystem?.('camera');
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
      {/* Arena overview label — fades in while camera zooms out */}
      <AnimatePresence>
        {phase === 'mapOverview' && mapOverviewReady && (
          <motion.div
            className="map-overview-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, transition: { duration: 0 } }}
            transition={{ duration: 0.5, delay: 0.4 }}
          >
            <p className="map-overview-label">
              {totalPlayers} players · last one alive wins
            </p>
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
