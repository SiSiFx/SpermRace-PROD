/**
 * ClassShowcase - Spotlight view of selected class during pre-game
 * Displays class icon, stats with animated bars, and ability preview
 */

import { useEffect, useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import {
  SpermClassType,
  CLASS_STATS,
  CLASS_DISPLAY_INFO,
} from '../../game/engine/components/SpermClass';
import { PersonSimple, PersonSimpleRun, Bicycle } from 'phosphor-react';
import './ClassShowcase.css';

interface ClassShowcaseProps {
  classType: SpermClassType;
  onComplete?: () => void;
  duration?: number;
}

// Map class types to their primary abilities
const CLASS_ABILITIES: Record<SpermClassType, { name: string; description: string; icon: string }> = {
  [SpermClassType.BALANCED]: {
    name: 'Shield',
    description: 'Activate invincibility for 1.5s',
    icon: '🛡️',
  },
  [SpermClassType.SPRINTER]: {
    name: 'Dash',
    description: 'Instant speed burst in facing direction',
    icon: '⚡',
  },
  [SpermClassType.TANK]: {
    name: 'Overdrive',
    description: '2x speed + thick trail for 3s',
    icon: '🔥',
  },
};

/**
 * Class showcase component with animated stats and particle effects
 */
export function ClassShowcase({
  classType,
  onComplete,
  duration = 1500,
}: ClassShowcaseProps) {
  const [isVisible, setIsVisible] = useState(true);
  const stats = CLASS_STATS[classType];
  const info = CLASS_DISPLAY_INFO[classType];
  const ability = CLASS_ABILITIES[classType];

  const displayColor = useMemo(() => {
    return `#${info.color.toString(16).padStart(6, '0')}`;
  }, [info.color]);

  // Auto-complete after duration
  useEffect(() => {
    const timer = setTimeout(() => {
      setIsVisible(false);
      // Small delay for exit animation
      setTimeout(() => {
        onComplete?.();
      }, 300);
    }, duration);

    return () => clearTimeout(timer);
  }, [duration, onComplete]);

  const getStatPercent = (value: number, max: number = 1.5) => {
    return Math.min(100, (value / max) * 100);
  };

  const getClassIcon = () => {
    switch (classType) {
      case SpermClassType.BALANCED:
        return <PersonSimple size={64} weight="fill" />;
      case SpermClassType.SPRINTER:
        return <PersonSimpleRun size={64} weight="fill" />;
      case SpermClassType.TANK:
        return <Bicycle size={64} weight="fill" />;
    }
  };

  if (!isVisible) {
    return (
      <motion.div
        className="class-showcase-overlay"
        initial={{ opacity: 1 }}
        animate={{ opacity: 0 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.3 }}
      />
    );
  }

  return (
    <motion.div
      className="class-showcase-overlay"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      {/* Background glow effect */}
      <div
        className="class-showcase-glow"
        style={{ background: `radial-gradient(circle at center, ${displayColor}20 0%, transparent 70%)` }}
      />

      {/* Main content container */}
      <motion.div
        className="class-showcase-content"
        initial={{ scale: 0.8, y: 30 }}
        animate={{ scale: 1, y: 0 }}
        transition={{
          type: 'spring',
          stiffness: 120,
          damping: 20,
          delay: 0.1,
        }}
      >
        {/* Class icon with particle ring */}
        <motion.div
          className="class-icon-wrapper"
          style={{ '--class-color': displayColor } as React.CSSProperties}
          initial={{ scale: 0, rotate: -180 }}
          animate={{ scale: 1, rotate: 0 }}
          transition={{
            type: 'spring',
            stiffness: 150,
            damping: 15,
            delay: 0.15,
          }}
        >
          <div className="class-icon-ring" />
          <div className="class-icon-inner">{getClassIcon()}</div>
          {/* Particle effects */}
          <div className="particle particle-1" />
          <div className="particle particle-2" />
          <div className="particle particle-3" />
          <div className="particle particle-4" />
        </motion.div>

        {/* Class name */}
        <motion.h2
          className="class-showcase-name"
          style={{ color: displayColor, textShadow: `0 0 30px ${displayColor}50` }}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25, duration: 0.4 }}
        >
          {info.name}
        </motion.h2>

        {/* Class description */}
        <motion.p
          className="class-showcase-description"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.35, duration: 0.4 }}
        >
          {info.description}
        </motion.p>

        {/* Stats section */}
        <motion.div
          className="class-showcase-stats"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.45, duration: 0.4 }}
        >
          {/* Speed stat */}
          <div className="showcase-stat">
            <div className="stat-header">
              <span className="stat-name">Speed</span>
              <span className="stat-value" style={{ color: displayColor }}>
                {Math.round(stats.speedMultiplier * 100)}%
              </span>
            </div>
            <div className="stat-bar-bg">
              <motion.div
                className="stat-bar-fill speed"
                initial={{ width: 0 }}
                animate={{ width: `${getStatPercent(stats.speedMultiplier)}%` }}
                transition={{ delay: 0.55, duration: 0.6, ease: 'easeOut' }}
                style={{ backgroundColor: displayColor }}
              />
            </div>
          </div>

          {/* Size stat */}
          <div className="showcase-stat">
            <div className="stat-header">
              <span className="stat-name">Size</span>
              <span className="stat-value" style={{ color: displayColor }}>
                {Math.round(stats.sizeMultiplier * 100)}%
              </span>
            </div>
            <div className="stat-bar-bg">
              <motion.div
                className="stat-bar-fill size"
                initial={{ width: 0 }}
                animate={{ width: `${getStatPercent(stats.sizeMultiplier)}%` }}
                transition={{ delay: 0.65, duration: 0.6, ease: 'easeOut' }}
                style={{ backgroundColor: displayColor }}
              />
            </div>
          </div>

          {/* Turn rate stat */}
          <div className="showcase-stat">
            <div className="stat-header">
              <span className="stat-name">Agility</span>
              <span className="stat-value" style={{ color: displayColor }}>
                {Math.round(stats.turnRateMultiplier * 100)}%
              </span>
            </div>
            <div className="stat-bar-bg">
              <motion.div
                className="stat-bar-fill agility"
                initial={{ width: 0 }}
                animate={{ width: `${getStatPercent(stats.turnRateMultiplier, 1.3)}%` }}
                transition={{ delay: 0.75, duration: 0.6, ease: 'easeOut' }}
                style={{ backgroundColor: displayColor }}
              />
            </div>
          </div>
        </motion.div>

        {/* Ability preview */}
        <motion.div
          className="class-showcase-ability"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.85, duration: 0.4 }}
        >
          <div className="ability-label">Special Ability</div>
          <div className="ability-card" style={{ borderColor: `${displayColor}40` }}>
            <span className="ability-icon">{ability.icon}</span>
            <div className="ability-info">
              <span className="ability-name" style={{ color: displayColor }}>
                {ability.name}
              </span>
              <span className="ability-desc">{ability.description}</span>
            </div>
          </div>
        </motion.div>
      </motion.div>

      {/* Progress bar at bottom */}
      <motion.div
        className="showcase-progress-container"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.5 }}
      >
        <div className="showcase-progress-bar">
          <motion.div
            className="showcase-progress-fill"
            style={{ backgroundColor: displayColor }}
            initial={{ width: '0%' }}
            animate={{ width: '100%' }}
            transition={{ duration: duration / 1000, ease: 'linear' }}
          />
        </div>
      </motion.div>
    </motion.div>
  );
}

export default ClassShowcase;
