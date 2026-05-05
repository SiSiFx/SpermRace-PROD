/**
 * ZoneIndicator.tsx - Zone Status and Safe Zone Display
 * Shows zone timer, shrink status, and safe zone indicator
 */

import { useEffect, useState, memo, useMemo } from 'react';
import './ZoneIndicator.css';

export enum ZoneState {
  IDLE = 'idle',
  WARNING = 'warning',
  SHRINKING = 'shrinking',
  FINAL = 'final',
}

export interface ZoneIndicatorProps {
  /** Current zone state */
  state: ZoneState;

  /** Time until next phase (seconds) */
  timeUntilNextPhase: number;

  /** Current zone radius */
  currentRadius: number;

  /** Initial arena radius */
  maxRadius: number;

  /** Minimum zone radius */
  minRadius: number;

  /** Zone center position */
  center: { x: number; y: number };

  /** Player position (for distance calculation) */
  playerPos?: { x: number; y: number };

  /** Show on minimap */
  showOnMinimap?: boolean;
}

/**
 * Zone indicator component
 * Memoized to prevent unnecessary re-renders
 */
export const ZoneIndicator = memo(function ZoneIndicator({
  state,
  timeUntilNextPhase,
  currentRadius,
  maxRadius,
  minRadius,
  center,
  playerPos,
  showOnMinimap = true,
}: ZoneIndicatorProps) {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    setIsVisible(true);
  }, []);

  // Memoize computed values to prevent recalculation on every render
  const formattedTime = useMemo(() => {
    const seconds = timeUntilNextPhase / 1000;
    if (seconds < 0) return '0s';
    if (seconds < 60) return `${Math.ceil(seconds)}s`;
    const mins = Math.floor(seconds / 60);
    const secs = Math.ceil(seconds % 60);
    return `${mins}:${String(secs).padStart(2, '0')}`;
  }, [timeUntilNextPhase]);

  const statusText = useMemo(() => {
    switch (state) {
      case ZoneState.IDLE:
        return 'SAFE';
      case ZoneState.WARNING:
        return 'WARNING';
      case ZoneState.SHRINKING:
        return 'SHRINKING';
      case ZoneState.FINAL:
        return 'FINAL ZONE';
      default:
        return '';
    }
  }, [state]);

  const statusClass = useMemo(() => {
    switch (state) {
      case ZoneState.IDLE:
        return 'zone-safe';
      case ZoneState.WARNING:
        return 'zone-warning';
      case ZoneState.SHRINKING:
        return 'zone-shrinking';
      case ZoneState.FINAL:
        return 'zone-final';
      default:
        return '';
    }
  }, [state]);

  // Calculate player distance from safe zone
  const playerDistance = useMemo(() => {
    if (!playerPos) return 0;
    return Math.sqrt(
      Math.pow(playerPos.x - center.x, 2) +
      Math.pow(playerPos.y - center.y, 2)
    ) - currentRadius;
  }, [playerPos, center, currentRadius]);

  const isOutside = playerDistance > 0;
  const isInDanger = playerDistance > -100 && playerDistance < 50;

  // Zone progress percentage
  const progress = useMemo(() =>
    Math.max(0, Math.min(1, (maxRadius - currentRadius) / (maxRadius - minRadius))),
    [maxRadius, currentRadius, minRadius]
  );

  return (
    <>
      {/* Main HUD indicator */}
      {isVisible && (
        <div className={`zone-indicator ${statusClass}`}>
          <div className="zone-icon">
            {state === ZoneState.WARNING && '⚠️'}
            {state === ZoneState.SHRINKING && '🔻'}
            {state === ZoneState.FINAL && '⬡'}
            {state === ZoneState.IDLE && '✓'}
          </div>
          <div className="zone-info">
            <span className="zone-status">{statusText}</span>
            {state !== ZoneState.FINAL && (
              <span className="zone-time">{formattedTime}</span>
            )}
          </div>

          {/* Progress bar */}
          {(state === ZoneState.SHRINKING || state === ZoneState.WARNING) && (
            <div className="zone-progress-bar">
              <div
                className="zone-progress-fill"
                style={{ width: `${progress * 100}%` }}
              />
            </div>
          )}
        </div>
      )}

      {/* Safe zone indicator (when player is near edge or outside) */}
      {playerPos && (isInDanger || isOutside) && (
        <div className={`zone-danger-alert ${isOutside ? 'outside' : 'warning'}`}>
          {isOutside ? 'OUTSIDE ZONE!' : 'ZONE APPROACHING!'}
        </div>
      )}

      {/* Minimap safe zone overlay */}
      {showOnMinimap && (
        <div
          className="minimap-safe-zone"
          style={{
            left: '50%',
            top: '50%',
            width: `${(currentRadius / maxRadius) * 100}%`,
            aspectRatio: '1',
            transform: 'translate(-50%, -50%)',
          }}
        />
      )}
    </>
  );
});

/**
 * Compact zone timer for minimal HUD
 */
interface ZoneTimerProps {
  state: ZoneState;
  timeRemaining: number;
}

export const ZoneTimer = memo(function ZoneTimer({ state, timeRemaining }: ZoneTimerProps) {
  const formattedTime = useMemo(() => {
    const seconds = timeRemaining;
    if (seconds < 0) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${String(secs).padStart(2, '0')}`;
  }, [timeRemaining]);

  const timerClass = useMemo(() => {
    switch (state) {
      case ZoneState.WARNING:
        return 'timer-warning';
      case ZoneState.SHRINKING:
        return 'timer-shrinking';
      case ZoneState.FINAL:
        return 'timer-final';
      default:
        return 'timer-safe';
    }
  }, [state]);

  return (
    <div className={`zone-timer ${timerClass}`}>
      {state === ZoneState.SHRINKING || state === ZoneState.FINAL ? (
        <span>ZONE {formattedTime}</span>
      ) : (
        <span>SAFE {formattedTime}</span>
      )}
    </div>
  );
});

export default ZoneIndicator;
