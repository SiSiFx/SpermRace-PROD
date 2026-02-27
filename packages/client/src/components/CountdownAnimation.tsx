/**
 * CountdownAnimation - Brutal Bet Style
 * Screen-filling typographic countdown animation with brutalist design
 * Black/white/red/yellow, thick borders, offset shadows, bold uppercase
 */

import { useEffect, useState, useRef, memo, useMemo } from 'react';
import './CountdownAnimation.css';

interface CountdownAnimationProps {
  duration?: number; // Duration in milliseconds (default: 3000ms = 3 seconds)
  onComplete?: () => void;
  isVisible?: boolean;
}

/**
 * Screen-filling typographic countdown animation (3... 2... 1... GO!)
 * Features:
 * - Massive, screen-filling typography with brutalist borders
 * - Smooth scale and fade animations
 * - Color transitions based on urgency (green → yellow → red)
 * - Glitch effect on "GO!"
 * - Responsive design for mobile and desktop
 * Memoized to prevent unnecessary re-renders
 */
export const CountdownAnimation = memo(function CountdownAnimation({
  duration = 3000,
  onComplete,
  isVisible = true,
}: CountdownAnimationProps) {
  const [currentNumber, setCurrentNumber] = useState(3);
  const [scale, setScale] = useState(0.5);
  const [opacity, setOpacity] = useState(0);
  const [isGlitching, setIsGlitching] = useState(false);
  const startTimeRef = useRef<number>();

  useEffect(() => {
    if (!isVisible) return;

    startTimeRef.current = performance.now();
    let frameId: number;

    const animate = (currentTime: number) => {
      if (!startTimeRef.current) {
        startTimeRef.current = currentTime;
      }

      const elapsed = currentTime - startTimeRef.current;
      const remaining = Math.max(0, duration - elapsed);
      const secondsRemaining = Math.ceil(remaining / 1000);

      // Update current number
      setCurrentNumber(secondsRemaining > 0 ? secondsRemaining : 0);

      // Calculate animation progress for current second
      const progressInSecond = (remaining % 1000) / 1000; // 1 = start of second, 0 = end

      // Animate scale: start small, bounce in, then fade out
      const scaleAnimation = easeOutBack(1 - progressInSecond);
      setScale(scaleAnimation);

      // Animate opacity: fade in at start, fade out at end
      if (progressInSecond > 0.85) {
        // Fade out
        setOpacity((progressInSecond - 0.85) / 0.15);
      } else {
        // Full opacity
        setOpacity(1);
      }

      // Trigger glitch effect on "GO!" (0 seconds)
      if (secondsRemaining === 0 && !isGlitching) {
        setIsGlitching(true);
        // Reset glitch effect after animation
        setTimeout(() => setIsGlitching(false), 500);
      }

      // Check if countdown is complete
      if (remaining <= 0) {
        // Continue animation for a bit more to show "GO!"
        if (elapsed < duration + 500) {
          frameId = requestAnimationFrame(animate);
        } else {
          onComplete?.();
        }
      } else {
        frameId = requestAnimationFrame(animate);
      }
    };

    frameId = requestAnimationFrame(animate);

    return () => {
      cancelAnimationFrame(frameId);
    };
  }, [duration, onComplete, isVisible]);

  // Don't render if not visible
  if (!isVisible) return null;

  const isGo = currentNumber === 0;
  const isMobile = window.innerWidth <= 768;

  // Memoize the number class to avoid recalculation on every render
  const numberClass = useMemo(() => {
    if (isGo) return 'go';
    if (currentNumber === 1) return 'one';
    if (currentNumber === 2) return 'two';
    return 'three';
  }, [isGo, currentNumber]);

  return (
    <div className="bru-countdown-overlay" data-testid="countdown-overlay">
      <div
        className={`bru-countdown-number ${numberClass} ${isGlitching ? 'glitch' : ''}`}
        data-testid="countdown-number"
        style={{
          transform: `scale(${scale})`,
          opacity: opacity,
        }}
      >
        {isGo ? 'GO!' : currentNumber}
      </div>

      {/* Subtitle for desktop */}
      {!isMobile && !isGo && (
        <div
          className="bru-countdown-subtitle"
          style={{
            opacity: opacity * 0.9,
          }}
        >
          Prepare for Battle
        </div>
      )}

      {/* Scanline effect */}
      <div className="bru-countdown-scanlines" aria-hidden="true" />
    </div>
  );
});

/**
 * Easing function for smooth bounce-in animation
 */
function easeOutBack(t: number): number {
  const c1 = 1.70158;
  const c3 = c1 + 1;
  return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
}
