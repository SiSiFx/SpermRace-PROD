import { useState, useRef } from 'react';

interface HolographicKeycardProps {
  tier: {
    name: string;
    usd: number;
    max: number;
    prize: number;
    popular: boolean;
    desc: string;
  };
  isActive: boolean;
  onClick: () => void;
  disabled?: boolean;
}

export function HolographicKeycard({ tier, isActive, onClick, disabled }: HolographicKeycardProps) {
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });
  const [isHovered, setIsHovered] = useState(false);
  const cardRef = useRef<HTMLButtonElement>(null);

  const roi = ((tier.prize / tier.usd - 1) * 100).toFixed(0);

  const handleMouseMove = (e: React.MouseEvent<HTMLButtonElement>) => {
    if (!cardRef.current) return;

    const rect = cardRef.current.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;

    setMousePosition({ x, y });
  };

  const handleMouseLeave = () => {
    setIsHovered(false);
    setMousePosition({ x: 50, y: 50 });
  };

  const getTierColor = () => {
    switch (tier.name) {
      case 'MICRO':
        return { primary: '#00f5ff', secondary: '#00ff88', glow: 'rgba(0, 245, 255, 0.6)' };
      case 'NANO':
        return { primary: '#8b5cf6', secondary: '#a78bfa', glow: 'rgba(139, 92, 246, 0.6)' };
      case 'MEGA':
        return { primary: '#f59e0b', secondary: '#fbbf24', glow: 'rgba(245, 158, 11, 0.6)' };
      case 'ELITE':
        return { primary: '#ef4444', secondary: '#f87171', glow: 'rgba(239, 68, 68, 0.6)' };
      default:
        return { primary: '#00f5ff', secondary: '#00ff88', glow: 'rgba(0, 245, 255, 0.6)' };
    }
  };

  const colors = getTierColor();

  return (
    <button
      ref={cardRef}
      onClick={onClick}
      disabled={disabled}
      onMouseMove={handleMouseMove}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={handleMouseLeave}
      style={{
        position: 'relative',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px 18px',
        borderRadius: 20,
        border: isActive ? `2px solid ${colors.primary}` : '1px solid rgba(255,255,255,0.1)',
        background: isActive
          ? `linear-gradient(135deg, ${colors.glow} 0%, rgba(0,0,0,0.3) 100%)`
          : 'rgba(255,255,255,0.02)',
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.5 : 1,
        transform: isHovered && !disabled
          ? `perspective(1000px) rotateX(${(mousePosition.y - 50) * 0.1}deg) rotateY(${(mousePosition.x - 50) * 0.1}deg) translateY(-8px) scale(1.02)`
          : 'perspective(1000px) rotateX(0) rotateY(0) translateY(0) scale(1)',
        transition: 'transform 0.3s cubic-bezier(0.4, 0, 0.2, 1), border-color 0.3s ease, background 0.3s ease',
        boxShadow: isActive || isHovered
          ? `0 20px 60px ${colors.glow}, inset 0 1px 0 rgba(255,255,255,0.15), 0 0 100px ${colors.glow}40`
          : '0 4px 20px rgba(0,0,0,0.3)',
        overflow: 'hidden',
        perspective: '1000px',
        transformStyle: 'preserve-3d',
      }}
    >
      {/* Holographic Shimmer Effect */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: `radial-gradient(circle at ${mousePosition.x}% ${mousePosition.y}%, ${colors.glow}30, transparent 50%)`,
          opacity: isHovered ? 1 : 0,
          transition: 'opacity 0.3s ease',
          pointerEvents: 'none',
          borderRadius: 20,
        }}
      />

      {/* Holographic Scanlines */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: `repeating-linear-gradient(
            0deg,
            transparent,
            transparent 2px,
            ${colors.glow}10 2px,
            ${colors.glow}10 4px
          )`,
          opacity: isActive ? 0.3 : 0.1,
          pointerEvents: 'none',
          borderRadius: 20,
          animation: isActive ? 'scanline 3s linear infinite' : 'none',
        }}
      />

      {/* Holographic Border Glow */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          borderRadius: 20,
          padding: 1,
          background: isActive
            ? `linear-gradient(${45 + (mousePosition.x - 50) * 0.5}deg, ${colors.primary}, ${colors.secondary}, ${colors.primary})`
            : 'linear-gradient(45deg, rgba(255,255,255,0.1), rgba(255,255,255,0.05))',
          WebkitMask: 'linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)',
          WebkitMaskComposite: 'xor',
          maskComposite: 'exclude',
          opacity: isHovered || isActive ? 1 : 0.5,
          transition: 'opacity 0.3s ease',
          pointerEvents: 'none',
        }}
      />

      {/* Holographic Reflection */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: '50%',
          background: `linear-gradient(180deg, ${colors.glow}20 0%, transparent 100%)`,
          opacity: isHovered ? 0.6 : 0,
          transition: 'opacity 0.3s ease',
          pointerEvents: 'none',
          borderRadius: '20px 20px 0 0',
        }}
      />

      {/* Popular Badge */}
      {tier.popular && (
        <div
          style={{
            position: 'absolute',
            top: -10,
            right: -10,
            background: 'linear-gradient(135deg, #ff6b00, #ff8c00)',
            color: '#fff',
            fontSize: 9,
            fontWeight: 900,
            padding: '5px 14px',
            borderRadius: 16,
            textTransform: 'uppercase',
            letterSpacing: '0.1em',
            boxShadow: '0 4px 16px rgba(255,107,0,0.6)',
            transform: isHovered ? 'scale(1.1)' : 'scale(1)',
            transition: 'transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
            zIndex: 10,
          }}
        >
          🔥 HOT
        </div>
      )}

      {/* Entry Fee */}
      <div
        style={{
          padding: '8px 20px',
          borderRadius: 24,
          background: isActive
            ? `linear-gradient(135deg, ${colors.primary}, ${colors.secondary})`
            : 'rgba(255,255,255,0.08)',
          fontSize: 22,
          fontWeight: 900,
          color: isActive ? '#000' : '#fff',
          marginBottom: 14,
          transform: 'translateZ(20px)',
          textShadow: isActive ? 'none' : `0 0 20px ${colors.glow}`,
          transition: 'all 0.3s ease',
        }}
      >
        ${tier.usd}
      </div>

      {/* Tier Name */}
      <div
        style={{
          fontSize: 17,
          fontWeight: 800,
          color: isActive ? colors.primary : 'rgba(255,255,255,0.7)',
          marginBottom: 14,
          letterSpacing: '0.12em',
          textTransform: 'uppercase',
          transform: 'translateZ(15px)',
          textShadow: isActive ? `0 0 30px ${colors.glow}` : 'none',
          transition: 'all 0.3s ease',
        }}
      >
        {tier.name}
      </div>

      {/* Prize */}
      <div
        style={{
          fontSize: 44,
          fontWeight: 900,
          color: isActive ? colors.secondary : 'rgba(255,255,255,0.6)',
          textShadow: isActive ? `0 0 40px ${colors.glow}` : 'none',
          lineHeight: 1,
          marginBottom: 10,
          transform: 'translateZ(25px)',
          transition: 'all 0.3s ease',
        }}
      >
        ${tier.prize}
      </div>

      {/* ROI Badge */}
      <div
        style={{
          fontSize: 12,
          color: isActive ? colors.secondary : 'rgba(255,255,255,0.4)',
          letterSpacing: '0.12em',
          fontWeight: 900,
          marginBottom: 12,
          textTransform: 'uppercase',
          transform: 'translateZ(10px)',
          textShadow: isActive ? `0 0 20px ${colors.glow}` : 'none',
          transition: 'all 0.3s ease',
          padding: '4px 12px',
          borderRadius: 12,
          background: isActive ? `${colors.glow}20` : 'transparent',
        }}
      >
        {roi}% ROI
      </div>

      {/* Description */}
      <div
        style={{
          fontSize: 12,
          color: 'rgba(255,255,255,0.5)',
          textAlign: 'center',
          transform: 'translateZ(5px)',
          transition: 'all 0.3s ease',
        }}
      >
        {tier.desc}
      </div>
    </button>
  );
}
