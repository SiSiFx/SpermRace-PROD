/**
 * PreGameSequence - Orchestrates the pre-game experience
 *
 * Phase 1: Map Overview (0.9s) - Quick arena context
 * Phase 2: Countdown (1.8s) - Fast start pulse
 *
 * Total: ~3 seconds
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
  mapOverview: 900,
  countdown: 3000,
  zoomToPlayer: 300,
};

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
    
    // Find camera system
    let cameraSystem: any = null;
    for (const sys of systems) {
      if (sys.constructor.name === 'CameraSystem') {
        cameraSystem = sys;
        break;
      }
    }

    if (!cameraSystem) {
      onDone?.();
      return;
    }

    const startPos = cameraSystem.getPosition();
    const startZoom = cameraSystem.getZoom();
    const startTime = performance.now();

    const animate = (currentTime: number) => {
      const elapsed = currentTime - startTime;
      const progress = Math.min(1, elapsed / duration);
      
      // Ease out cubic
      const easeProgress = 1 - Math.pow(1 - progress, 3);

      const currentX = startPos.x + (targetX - startPos.x) * easeProgress;
      const currentY = startPos.y + (targetY - startPos.y) * easeProgress;
      const currentZoom = startZoom + (targetZoom - startZoom) * easeProgress;

      // Update camera without auto-follow
      cameraSystem.setPosition(currentX, currentY);
      cameraSystem.setZoom(currentZoom);

      if (progress < 1) {
        animationFrameRef.current = requestAnimationFrame(animate);
      } else {
        onDone?.();
      }
    };

    animationFrameRef.current = requestAnimationFrame(animate);
  }, [game]);

  // Phase 1: Map Overview -> Countdown
  useEffect(() => {
    if (phase !== 'mapOverview') return;

    const engine = game.getEngine();
    const worldSize = engine.getWorldSize();
    const centerX = worldSize.width / 2;
    const centerY = worldSize.height / 2;

    // Mark map overview as ready for rendering
    setMapOverviewReady(true);

    // Animate camera to center with zoom out
    animateCamera(centerX, centerY, 0.34, PHASE_DURATIONS.mapOverview, () => {
      setPhase('countdown');
      setShowCountdown(true);
    });

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [phase, game, animateCamera]);

  // Phase 3: Countdown -> Zoom to Player
  const handleCountdownComplete = useCallback(() => {
    setShowCountdown(false);
    setPhase('zoomToPlayer');
  }, []);

  // Phase 4: Zoom to Player -> Complete
  useEffect(() => {
    if (phase !== 'zoomToPlayer') return;

    const playerPos = initialPlayerPosRef.current;
    if (!playerPos) {
      // Fallback if no player position
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

    // Animate back to player
    const focusZoom = getDefaultZoom(window.innerWidth <= 900);

    animateCamera(playerPos.x, playerPos.y, focusZoom, PHASE_DURATIONS.zoomToPlayer, () => {
      // Re-enable camera follow
      if (cameraSystem && playerIdRef.current) {
        cameraSystem.setTarget(playerIdRef.current);
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
      {/* Map Overview UI overlay */}
      <AnimatePresence>
        {phase === 'mapOverview' && mapOverviewReady && (
          <motion.div
            className="map-overview-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
          >
            {/* Arena info card */}
            <motion.div
              className="map-info-card"
              initial={{ y: -30, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: -30, opacity: 0 }}
              transition={{ delay: 0.2, duration: 0.4 }}
            >
              <h3 className="map-info-title">{totalPlayers} CELLS DETECTED</h3>
              <p className="map-info-subtitle">Last one alive wins</p>
            </motion.div>

            {/* Freeze indicator */}
            <motion.div
              className="zone-warning"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              transition={{ delay: 0.5, duration: 0.4 }}
            >
              <div className="zone-warning-icon">■</div>
              <span className="zone-warning-text">ALL CELLS LOCKED — COUNTDOWN BEGINS</span>
            </motion.div>

            {/* Player markers indicator */}
            <motion.div
              className="player-markers-hint"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 20 }}
              transition={{ delay: 0.7, duration: 0.4 }}
            >
              <div className="player-marker-example you">You</div>
              <div className="player-marker-example enemy">Enemies</div>
            </motion.div>

            {/* Progress indicator */}
            <div className="map-overview-progress">
              <motion.div
                className="map-overview-progress-fill"
                initial={{ width: '0%' }}
                animate={{ width: '100%' }}
                transition={{ duration: PHASE_DURATIONS.mapOverview / 1000, ease: 'linear' }}
              />
            </div>
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
