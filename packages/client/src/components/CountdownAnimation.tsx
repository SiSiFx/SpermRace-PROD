/**
 * CountdownAnimation
 * 3… 2… 1… FIGHT!
 *
 * Design principles:
 * - NO per-frame React state updates. setState fires once per second (number tick).
 * - ALL visual transitions (scale, opacity, ring drain) handled by CSS keyframes
 *   keyed to the current number, so React remounts them cleanly on each tick.
 * - SVG circular ring depletes over 1 s via stroke-dashoffset CSS animation.
 *   Perfectly smooth, GPU-accelerated, zero React overhead.
 */

import { useEffect, useState, memo } from 'react';
import './CountdownAnimation.css';

interface CountdownAnimationProps {
  duration?: number; // ms (default 3000 = 3 ticks)
  onComplete?: () => void;
  isVisible?: boolean;
}

const RING_R = 72;
const RING_CIRC = 2 * Math.PI * RING_R; // ≈ 452 px

export const CountdownAnimation = memo(function CountdownAnimation({
  duration = 3000,
  onComplete,
  isVisible = true,
}: CountdownAnimationProps) {
  const totalTicks = Math.round(duration / 1000);
  const [tick, setTick] = useState(totalTicks); // 3 → 2 → 1 → 0

  useEffect(() => {
    if (!isVisible) return;

    setTick(totalTicks); // reset on (re)mount

    // Tick once per second
    const id = setInterval(() => {
      setTick(t => {
        if (t <= 1) {
          clearInterval(id);
          // Show "GO!" for 600 ms then call onComplete
          setTimeout(() => onComplete?.(), 600);
          return 0;
        }
        return t - 1;
      });
    }, 1000);

    return () => clearInterval(id);
  }, [isVisible, totalTicks, onComplete]);

  if (!isVisible) return null;

  const isGo = tick === 0;

  // Color per tick
  const ringColor = isGo
    ? '#34d399'          // green
    : tick === 1
      ? '#f87171'        // red
      : tick === 2
        ? '#fbbf24'      // amber
        : '#22d3ee';     // cyan

  return (
    <div className="cd-overlay" data-testid="countdown-overlay">

      {/* Circular ring — keyed so CSS animation restarts on each tick */}
      {!isGo && (
        <svg
          key={`ring-${tick}`}
          className="cd-ring-svg"
          viewBox="0 0 160 160"
          aria-hidden="true"
        >
          {/* Track */}
          <circle
            cx="80" cy="80" r={RING_R}
            className="cd-ring-track"
          />
          {/* Draining arc */}
          <circle
            cx="80" cy="80" r={RING_R}
            className="cd-ring-arc"
            style={{
              stroke: ringColor,
              strokeDasharray: RING_CIRC,
              // animation handles dashoffset 0 → CIRC over 1 s
            }}
          />
        </svg>
      )}

      {/* Per-tick radial flash — keyed so animation restarts on each number */}
      <div key={`flash-${tick}`} className="cd-flash" aria-hidden="true" />

      {/* Number — keyed so CSS punch-in restarts on each tick */}
      <div
        key={`num-${tick}`}
        className={`cd-number${isGo ? ' is-go' : ''}`}
        data-testid="countdown-number"
        style={{ color: isGo ? '#34d399' : ringColor } as React.CSSProperties}
      >
        {isGo ? 'GO!' : tick}
      </div>

      <div className="cd-scanlines" aria-hidden="true" />
    </div>
  );
});
