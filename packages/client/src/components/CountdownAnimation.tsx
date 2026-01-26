import { useEffect, useState, useRef } from 'react';

interface CountdownAnimationProps {
  duration?: number; // Duration in milliseconds (default: 3000ms = 3 seconds)
  onComplete?: () => void;
  isVisible?: boolean;
}

/**
 * Screen-filling typographic countdown animation (3... 2... 1... GO!)
 * Features:
 * - Massive, screen-filling typography
 * - Smooth scale and fade animations
 * - Color transitions based on urgency (green → yellow → red)
 * - Glitch effect on "GO!"
 * - Responsive design for mobile and desktop
 */
export function CountdownAnimation({
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
  }, [duration, onComplete, isVisible, isGlitching]);

  // Don't render if not visible
  if (!isVisible) return null;

  const isGo = currentNumber === 0;
  const isMobile = window.innerWidth <= 768;

  // Determine color based on number
  const getColor = () => {
    if (isGo) return '#10b981'; // Green for GO!
    if (currentNumber === 1) return '#ef4444'; // Red
    if (currentNumber === 2) return '#fbbf24'; // Yellow
    return '#10b981'; // Green
  };

  const getGlowColor = () => {
    if (isGo) return '16, 185, 129';
    if (currentNumber === 1) return '239, 68, 68';
    if (currentNumber === 2) return '251, 191, 36';
    return '16, 185, 129';
  };

  const color = getColor();
  const glowColor = getGlowColor();

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 9999,
        pointerEvents: 'none',
        backgroundColor: 'rgba(0, 0, 0, 0.3)',
        backdropFilter: 'blur(2px)',
      }}
    >
      <div
        style={{
          fontSize: isMobile ? '180px' : '280px',
          fontWeight: 900,
          color: color,
          fontFamily: 'Orbitron, sans-serif',
          textAlign: 'center',
          lineHeight: 1,
          transform: `scale(${scale})`,
          opacity: opacity,
          textShadow: `
            0 0 60px rgba(${glowColor}, 1),
            0 0 120px rgba(${glowColor}, 0.8),
            0 0 180px rgba(${glowColor}, 0.6),
            0 8px 32px rgba(0, 0, 0, 0.9)
          `,
          letterSpacing: isGo ? (isMobile ? '8px' : '16px') : '-8px',
          userSelect: 'none',
          ...(isGlitching && {
            animation: 'glitch 0.3s infinite',
          }),
        }}
      >
        {isGo ? 'GO!' : currentNumber}
      </div>

      {/* Additional text for desktop */}
      {!isMobile && !isGo && (
        <div
          style={{
            position: 'absolute',
            bottom: '20%',
            left: '50%',
            transform: 'translateX(-50%)',
            fontSize: '24px',
            fontWeight: 600,
            color: '#22d3ee',
            fontFamily: 'Orbitron, sans-serif',
            textShadow: '0 0 20px rgba(34, 211, 238, 0.8)',
            letterSpacing: '4px',
            textTransform: 'uppercase',
            opacity: opacity * 0.8,
          }}
        >
          Prepare for Battle
        </div>
      )}

      {/* Scanline effect */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'repeating-linear-gradient(' +
            '0deg, ' +
            'rgba(0, 0, 0, 0.1), ' +
            'rgba(0, 0, 0, 0.1) 1px, ' +
            'transparent 1px, ' +
            'transparent 2px' +
            ')',
          pointerEvents: 'none',
          opacity: 0.3,
        }}
      />

      <style>{`
        @keyframes glitch {
          0% {
            transform: translate(0) scale(${scale});
          }
          20% {
            transform: translate(-5px, 5px) scale(${scale * 1.02});
          }
          40% {
            transform: translate(-5px, -5px) scale(${scale * 0.98});
          }
          60% {
            transform: translate(5px, 5px) scale(${scale * 1.02});
          }
          80% {
            transform: translate(5px, -5px) scale(${scale * 0.98});
          }
          100% {
            transform: translate(0) scale(${scale});
          }
        }
      `}</style>
    </div>
  );
}

/**
 * Easing function for smooth bounce-in animation
 */
function easeOutBack(t: number): number {
  const c1 = 1.70158;
  const c3 = c1 + 1;
  return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
}
