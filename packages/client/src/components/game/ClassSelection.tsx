/**
 * ClassSelection - Premium Bento-Style Class Selection
 * 
 * DESIGN_SPECS:
 * - DESIGN_VARIANCE: 8 (Asymmetric layout)
 * - MOTION_INTENSITY: 8 (Spring physics, perpetual motion)
 * - VISUAL_DENSITY: 5 (Balanced data + space)
 * 
 * Features:
 * - Spotlight border cards with magnetic hover
 * - Animated SVG sperm visualizations
 * - Radial gauges with liquid glass centers
 * - Holographic foil shimmer on selected
 * - Staggered orchestration on mount
 */

'use client';

import { useCallback, useEffect, useState, useRef, memo } from 'react';
import { motion, useMotionValue, useTransform, AnimatePresence } from 'framer-motion';
import { Check, ArrowRight, Sparkle } from 'phosphor-react';
import {
  SpermClassType,
  getAllClassTypes,
  getClassDisplayInfo,
  CLASS_STATS,
} from '../../game/engine/components/SpermClass';
import { SpermVisualization } from './SpermVisualization';
import { RadialGauge } from './RadialGauge';
import './ClassSelection.css';

interface ClassSelectionProps {
  selectedClass: SpermClassType;
  onSelect: (classType: SpermClassType) => void;
  onConfirm: () => void;
  visible: boolean;
}

const CLASS_ABILITY_INFO: Record<SpermClassType, { name: string; description: string }> = {
  [SpermClassType.BALANCED]: {
    name: 'Shield Protocol',
    description: '1.5s invincibility + trail immunity',
  },
  [SpermClassType.SPRINTER]: {
    name: 'Velocity Surge',
    description: 'Instant dash in facing direction',
  },
  [SpermClassType.TANK]: {
    name: 'Overdrive Mode',
    description: '2x speed + thick trail for 3s',
  },
};

// Spotlight border card component with magnetic physics
const SpotlightCard = memo(function SpotlightCard({
  children,
  className,
  isSelected,
  onClick,
  index,
}: {
  children: React.ReactNode;
  className?: string;
  isSelected: boolean;
  onClick: () => void;
  index: number;
}) {
  const cardRef = useRef<HTMLDivElement>(null);
  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!cardRef.current) return;
    const rect = cardRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    mouseX.set(x);
    mouseY.set(y);
  };

  return (
    <motion.div
      ref={cardRef}
      className={`spotlight-card ${className} ${isSelected ? 'selected' : ''}`}
      onClick={onClick}
      onMouseMove={handleMouseMove}
      initial={{ opacity: 0, y: 30 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{
        type: 'spring',
        stiffness: 100,
        damping: 20,
        delay: index * 0.1,
      }}
      whileHover={{ scale: 1.01, y: -2 }}
      whileTap={{ scale: 0.99 }}
    >
      {/* Spotlight border effect */}
      <motion.div
        className="spotlight-border"
        style={{
          background: useTransform(
            [mouseX, mouseY],
            ([x, y]) => `radial-gradient(400px circle at ${x}px ${y}px, rgba(255,255,255,0.15), transparent 40%)`
          ),
        }}
      />
      
      {/* Inner content */}
      <div className="card-content">
        {children}
      </div>

      {/* Selected indicator */}
      <AnimatePresence>
        {isSelected && (
          <motion.div
            className="selected-badge"
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 400, damping: 20 }}
          >
            <Check weight="bold" />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Holographic shimmer overlay */}
      {isSelected && (
        <motion.div
          className="holographic-shimmer"
          initial={{ x: '-100%' }}
          animate={{ x: '200%' }}
          transition={{
            duration: 2,
            repeat: Infinity,
            repeatDelay: 3,
            ease: 'easeInOut',
          }}
        />
      )}
    </motion.div>
  );
});

export function ClassSelection({
  selectedClass,
  onSelect,
  onConfirm,
  visible,
}: ClassSelectionProps) {
  const allClasses = getAllClassTypes();
  const [hoveredClass] = useState<SpermClassType | null>(null);

  // Keyboard handler
  useEffect(() => {
    if (!visible) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      switch (e.key) {
        case '1':
          onSelect(SpermClassType.BALANCED);
          break;
        case '2':
          onSelect(SpermClassType.SPRINTER);
          break;
        case '3':
          onSelect(SpermClassType.TANK);
          break;
        case 'Enter':
        case ' ':
          onConfirm();
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [visible, onSelect, onConfirm]);

  const getStatValue = useCallback((classType: SpermClassType, stat: 'speed' | 'size' | 'agility') => {
    const stats = CLASS_STATS[classType];
    switch (stat) {
      case 'speed':
        return Math.round(stats.speedMultiplier * 100);
      case 'size':
        return Math.round(stats.sizeMultiplier * 100);
      case 'agility':
        return Math.round(stats.turnRateMultiplier * 100);
    }
  }, []);

  if (!visible) return null;

  return (
    <motion.div
      className="class-selection-v2"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      {/* Background ambient effects */}
      <div className="ambient-glow balanced" />
      <div className="ambient-glow sprinter" />
      <div className="ambient-glow tank" />

      <div className="selection-container">
        {/* Header - Asymmetric left-aligned */}
        <motion.header
          className="selection-header"
          initial={{ opacity: 0, x: -30 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ type: 'spring', stiffness: 100, damping: 20 }}
        >
          <div className="header-badge">
            <Sparkle weight="fill" />
            <span>Select Your Fighter</span>
          </div>
          <h1 className="header-title">
            Choose Your
            <span className="gradient-text">Class</span>
          </h1>
          <p className="header-subtitle">
            Each sperm type has unique stats and abilities. Pick one that matches your playstyle.
          </p>
        </motion.header>

        {/* Main Bento Grid - Asymmetric layout */}
        <div className="bento-grid">
          {allClasses.map((classType, index) => {
            const info = getClassDisplayInfo(classType);
            const ability = CLASS_ABILITY_INFO[classType];
            const isSelected = selectedClass === classType;
            const isHovered = hoveredClass === classType;
            const displayColor = `#${info.color.toString(16).padStart(6, '0')}`;

            return (
              <SpotlightCard
                key={classType}
                className={`class-tile ${classType} ${isSelected ? 'selected' : ''}`}
                isSelected={isSelected}
                onClick={() => onSelect(classType)}
                index={index}
              >
                {/* Class number indicator */}
                <div className="tile-number" style={{ color: displayColor }}>
                  0{index + 1}
                </div>

                {/* Main content area */}
                <div className="tile-main">
                  {/* Sperm visualization */}
                  <div className="tile-visual">
                    <SpermVisualization
                      classType={classType}
                      isSelected={isSelected || isHovered}
                      size="xl"
                    />
                  </div>

                  {/* Info section */}
                  <div className="tile-info">
                    <h3 className="tile-name" style={{ color: displayColor }}>
                      {info.name}
                    </h3>
                    <p className="tile-description">
                      {info.description}
                    </p>
                  </div>
                </div>

                {/* Radial gauges row */}
                <div className="tile-gauges">
                  <RadialGauge
                    type="speed"
                    value={getStatValue(classType, 'speed')}
                    size="md"
                    isSelected={isSelected}
                    delay={index * 0.1 + 0.2}
                  />
                  <RadialGauge
                    type="size"
                    value={getStatValue(classType, 'size')}
                    size="md"
                    isSelected={isSelected}
                    delay={index * 0.1 + 0.3}
                  />
                  <RadialGauge
                    type="agility"
                    value={getStatValue(classType, 'agility')}
                    size="md"
                    isSelected={isSelected}
                    delay={index * 0.1 + 0.4}
                  />
                </div>

                {/* Ability info */}
                <div className="tile-ability">
                  <div className="ability-line" style={{ background: displayColor }} />
                  <div className="ability-content">
                    <span className="ability-name" style={{ color: displayColor }}>
                      {ability.name}
                    </span>
                    <span className="ability-desc">
                      {ability.description}
                    </span>
                  </div>
                </div>
              </SpotlightCard>
            );
          })}
        </div>

        {/* Confirm button - Floating style */}
        <motion.div
          className="selection-actions"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5, type: 'spring', stiffness: 100 }}
        >
          <motion.button
            className="confirm-btn"
            onClick={onConfirm}
            whileHover={{ scale: 1.02, y: -2 }}
            whileTap={{ scale: 0.98 }}
          >
            <span className="btn-glow" />
            <span className="btn-content">
              <span className="btn-text">Deploy Selected Unit</span>
              <ArrowRight weight="bold" className="btn-icon" />
            </span>
          </motion.button>
          
          <p className="keyboard-hint">
            Press <kbd>1</kbd> <kbd>2</kbd> <kbd>3</kbd> to select, <kbd>Enter</kbd> to confirm
          </p>
        </motion.div>
      </div>
    </motion.div>
  );
}

export default ClassSelection;
