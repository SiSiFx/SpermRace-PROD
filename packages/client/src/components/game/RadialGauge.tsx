/**
 * RadialGauge - Custom circular gauge for stat visualization
 * 
 * Features:
 * - Animated arc fill with spring physics
 * - Glow effects based on value
 * - Icon center with liquid glass backdrop
 * - Perpetual micro-animation on selected
 */

import { useEffect, memo } from 'react';
import { motion, useSpring, useTransform } from 'framer-motion';
import { 
  Gauge, 
  Ruler, 
  Compass,
  type Icon
} from 'phosphor-react';
import './RadialGauge.css';

type StatType = 'speed' | 'size' | 'agility';

interface RadialGaugeProps {
  type: StatType;
  value: number; // 0-100
  maxValue?: number;
  size?: 'sm' | 'md' | 'lg';
  isSelected?: boolean;
  delay?: number;
}

const STAT_CONFIG: Record<StatType, { 
  label: string; 
  color: string; 
  glowColor: string;
  icon: Icon;
}> = {
  speed: {
    label: 'Speed',
    color: '#fbbf24',
    glowColor: 'rgba(251, 191, 36, 0.4)',
    icon: Gauge,
  },
  size: {
    label: 'Size',
    color: '#ef4444',
    glowColor: 'rgba(239, 68, 68, 0.4)',
    icon: Ruler,
  },
  agility: {
    label: 'Agility',
    color: '#22d3ee',
    glowColor: 'rgba(34, 211, 238, 0.4)',
    icon: Compass,
  },
};

const SIZE_CONFIG = {
  sm: { diameter: 80, stroke: 6, fontSize: 11 },
  md: { diameter: 100, stroke: 8, fontSize: 13 },
  lg: { diameter: 140, stroke: 10, fontSize: 16 },
};

export const RadialGauge = memo(function RadialGauge({
  type,
  value,
  maxValue = 100,
  size = 'md',
  isSelected = false,
  delay = 0,
}: RadialGaugeProps) {
  const config = STAT_CONFIG[type];
  const sizeCfg = SIZE_CONFIG[size];
  const radius = (sizeCfg.diameter - sizeCfg.stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  
  // Normalize value to 0-100
  const normalizedValue = Math.min(100, Math.max(0, (value / maxValue) * 100));
  
  // Spring animation for the gauge fill
  const springValue = useSpring(0, {
    stiffness: 100,
    damping: 30,
  });
  
  const strokeDashoffset = useTransform(
    springValue,
    [0, 100],
    [circumference, circumference * 0.25] // Leave a gap at the top
  );
  
  useEffect(() => {
    springValue.set(normalizedValue);
  }, [normalizedValue, springValue]);
  
  const IconComponent = config.icon;
  const displayValue = Math.round(value);
  
  return (
    <motion.div 
      className={`radial-gauge ${type} ${isSelected ? 'selected' : ''}`}
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ 
        type: 'spring', 
        stiffness: 200, 
        damping: 20,
        delay: delay 
      }}
      style={{ 
        width: sizeCfg.diameter, 
        height: sizeCfg.diameter,
        '--gauge-color': config.color,
        '--gauge-glow': config.glowColor,
      } as React.CSSProperties}
    >
      {/* Background track */}
      <svg 
        className="gauge-svg"
        width={sizeCfg.diameter}
        height={sizeCfg.diameter}
        viewBox={`0 0 ${sizeCfg.diameter} ${sizeCfg.diameter}`}
      >
        <defs>
          {/* Gradient for the fill */}
          <linearGradient id={`gradient-${type}`} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor={config.color} stopOpacity="0.3" />
            <stop offset="100%" stopColor={config.color} />
          </linearGradient>
          
          {/* Glow filter */}
          <filter id={`glow-${type}`} x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation={isSelected ? 4 : 2} result="coloredBlur" />
            <feMerge>
              <feMergeNode in="coloredBlur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>
        
        {/* Background arc */}
        <circle
          className="gauge-track"
          cx={sizeCfg.diameter / 2}
          cy={sizeCfg.diameter / 2}
          r={radius}
          fill="none"
          strokeWidth={sizeCfg.stroke}
        />
        
        {/* Animated fill arc */}
        <motion.circle
          className="gauge-fill"
          cx={sizeCfg.diameter / 2}
          cy={sizeCfg.diameter / 2}
          r={radius}
          fill="none"
          stroke={`url(#gradient-${type})`}
          strokeWidth={sizeCfg.stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          style={{ strokeDashoffset }}
          filter={isSelected ? `url(#glow-${type})` : undefined}
          transform={`rotate(135 ${sizeCfg.diameter / 2} ${sizeCfg.diameter / 2})`}
        />
      </svg>
      
      {/* Center content with liquid glass effect */}
      <div className="gauge-center">
        <div className="gauge-icon-wrapper">
          <IconComponent 
            weight="fill" 
            size={sizeCfg.diameter * 0.22}
            className="gauge-icon"
          />
        </div>
        
        {/* Value display */}
        <motion.span 
          className="gauge-value"
          style={{ fontSize: sizeCfg.fontSize }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: delay + 0.3 }}
        >
          {displayValue}%
        </motion.span>
      </div>
      
      {/* Label */}
      <motion.span 
        className="gauge-label"
        initial={{ opacity: 0, y: 5 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: delay + 0.2 }}
      >
        {config.label}
      </motion.span>
    </motion.div>
  );
});

export default RadialGauge;
