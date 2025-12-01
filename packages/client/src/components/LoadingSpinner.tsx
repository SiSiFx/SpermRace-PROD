import { useEffect, useState } from 'react';

interface LoadingSpinnerProps {
  message?: string;
  size?: 'small' | 'medium' | 'large';
}

export function LoadingSpinner({ message = 'Loading...', size = 'medium' }: LoadingSpinnerProps) {
  const [frame, setFrame] = useState(0);
  
  useEffect(() => {
    const interval = setInterval(() => {
      setFrame((prev) => (prev + 1) % 3);
    }, 150);
    return () => clearInterval(interval);
  }, []);
  
  const sizes = {
    small: { container: 40, sperm: 12, tail: 20 },
    medium: { container: 60, sperm: 18, tail: 30 },
    large: { container: 80, sperm: 24, tail: 40 },
  };
  
  const { container, sperm: spermSize, tail } = sizes[size];
  
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 16,
    }}>
      <div style={{
        position: 'relative',
        width: container,
        height: container,
      }}>
        {/* Swimming Sperm Cell */}
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            style={{
              position: 'absolute',
              top: '50%',
              left: '50%',
              transform: `translate(-50%, -50%) rotate(${i * 120 + frame * 5}deg) translateY(-${container / 2.5}px)`,
              opacity: frame === i ? 1 : 0.3,
              transition: 'opacity 0.15s ease',
            }}
          >
            {/* Head */}
            <div style={{
              width: spermSize,
              height: spermSize,
              borderRadius: '50%',
              background: 'linear-gradient(135deg, #00f5ff, #00ff88)',
              boxShadow: '0 0 12px rgba(0,245,255,0.6)',
              marginBottom: -4,
            }} />
            {/* Tail */}
            <div style={{
              width: 3,
              height: tail,
              background: 'linear-gradient(180deg, rgba(0,245,255,0.8), transparent)',
              borderRadius: '0 0 50% 50%',
              marginLeft: spermSize / 2 - 1.5,
              transform: `rotate(${Math.sin(frame * 2 + i) * 15}deg)`,
              transformOrigin: 'top center',
              transition: 'transform 0.15s ease',
            }} />
          </div>
        ))}
        
        {/* Center Glow */}
        <div style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          width: container / 2,
          height: container / 2,
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(0,245,255,0.2), transparent)',
          animation: 'pulse 1.5s ease-in-out infinite',
        }} />
      </div>
      
      {message && (
        <div style={{
          fontSize: size === 'small' ? 12 : size === 'medium' ? 14 : 16,
          color: 'rgba(255,255,255,0.7)',
          fontWeight: 600,
          textAlign: 'center',
        }}>
          {message}
        </div>
      )}
      
      <style>{`
        @keyframes pulse {
          0%, 100% {
            opacity: 0.3;
            transform: translate(-50%, -50%) scale(1);
          }
          50% {
            opacity: 0.6;
            transform: translate(-50%, -50%) scale(1.2);
          }
        }
      `}</style>
    </div>
  );
}

export default LoadingSpinner;
