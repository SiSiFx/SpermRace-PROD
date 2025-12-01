import { useEffect, useState } from 'react';

interface SpermLoadingAnimationProps {
  onComplete?: () => void;
}

export function SpermLoadingAnimation({ onComplete }: SpermLoadingAnimationProps) {
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    // Auto-complete after animation duration
    const timer = setTimeout(() => {
      setIsVisible(false);
      onComplete?.();
    }, 800); // Animation duration

    return () => clearTimeout(timer);
  }, [onComplete]);

  if (!isVisible) return null;

  // Generate multiple sperm at different heights
  const spermCount = 5;
  const sperms = Array.from({ length: spermCount }, (_, i) => ({
    id: i,
    top: 15 + i * 18, // Staggered vertically
    delay: i * 0.1, // Staggered timing
    scale: 0.8 + Math.random() * 0.4, // Varied sizes
  }));

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        pointerEvents: 'none',
        overflow: 'hidden',
      }}
    >
      {sperms.map((sperm) => (
        <div
          key={sperm.id}
          style={{
            position: 'absolute',
            top: `${sperm.top}%`,
            left: '-60px',
            animation: `spermSwim 0.8s cubic-bezier(0.4, 0, 0.2, 1) ${sperm.delay}s forwards`,
            transform: `scale(${sperm.scale})`,
            filter: 'drop-shadow(0 0 8px rgba(0, 245, 255, 0.6))',
          }}
        >
          {/* Sperm head */}
          <div
            style={{
              width: '24px',
              height: '32px',
              background: 'radial-gradient(circle at 40% 40%, #00f5ff, #00b4cc)',
              borderRadius: '50% 50% 50% 50% / 60% 60% 40% 40%',
              position: 'relative',
              boxShadow: '0 0 12px rgba(0, 245, 255, 0.7), inset 0 2px 4px rgba(255, 255, 255, 0.3)',
            }}
          />
          
          {/* Sperm tail */}
          <svg
            width="80"
            height="8"
            viewBox="0 0 80 8"
            style={{
              position: 'absolute',
              left: '-80px',
              top: '12px',
            }}
          >
            <path
              d="M 0 4 Q 20 0, 40 4 T 80 4"
              stroke="#00b4cc"
              strokeWidth="3"
              fill="none"
              strokeLinecap="round"
              opacity="0.8"
              style={{
                animation: 'tailWave 0.3s ease-in-out infinite',
              }}
            />
          </svg>
        </div>
      ))}

      <style>{`
        @keyframes spermSwim {
          0% {
            transform: translateX(0) scale(${spermCount}) rotate(-5deg);
            opacity: 0;
          }
          20% {
            opacity: 1;
          }
          80% {
            opacity: 1;
          }
          100% {
            transform: translateX(calc(100vw + 100px)) scale(${spermCount}) rotate(5deg);
            opacity: 0;
          }
        }
        
        @keyframes tailWave {
          0%, 100% {
            d: path('M 0 4 Q 20 0, 40 4 T 80 4');
          }
          50% {
            d: path('M 0 4 Q 20 8, 40 4 T 80 4');
          }
        }
      `}</style>
    </div>
  );
}

export default SpermLoadingAnimation;
