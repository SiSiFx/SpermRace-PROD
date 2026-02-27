/**
 * DeathScreen.tsx - Taste-Skill Compliant Death Screen
 * Shows immediately when a player is eliminated mid-game
 * Brutal style with Framer Motion animations
 */

'use client';

import { useEffect, useState, memo, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sword, Timer, Ruler, Eye, ArrowLeft, ArrowsClockwise } from 'phosphor-react';
import './DeathScreen.css';

export interface DeathScreenProps {
  placement: number;
  totalPlayers: number;
  killerName: string | null;
  killerColor?: number;
  ownTrail: boolean;
  kills: number;
  timeSurvived: number;
  distance?: number;
  canSpectate: boolean;
  onSpectate?: () => void;
  onLeave?: () => void;
  onChangeClass?: () => void;
}

export const DeathScreen = memo(function DeathScreen({
  placement,
  totalPlayers,
  killerName,
  killerColor,
  ownTrail,
  kills,
  timeSurvived,
  distance,
  canSpectate,
  onSpectate,
  onLeave,
  onChangeClass,
}: DeathScreenProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [countdown, setCountdown] = useState(5);

  useEffect(() => {
    const showTimer = setTimeout(() => setIsVisible(true), 100);
    return () => clearTimeout(showTimer);
  }, []);

  useEffect(() => {
    if (!isVisible) return;
    if (countdown <= 0) {
      if (canSpectate && onSpectate) {
        onSpectate();
      } else if (onLeave) {
        onLeave();
      }
      return;
    }
    const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
    return () => clearTimeout(timer);
  }, [isVisible, countdown, canSpectate, onSpectate, onLeave]);

  const formattedTime = useMemo(() => {
    const mins = Math.floor(timeSurvived / 60);
    const secs = Math.floor(timeSurvived % 60);
    return `${mins}:${String(secs).padStart(2, '0')}`;
  }, [timeSurvived]);

  const formattedDistance = useMemo(() => {
    if (distance === undefined) return undefined;
    return Math.floor(distance / 10).toString();
  }, [distance]);

  const placementOrdinal = useMemo(() => {
    const s = ['th', 'st', 'nd', 'rd'];
    const v = placement % 100;
    return placement + (s[(v - 20) % 10] || s[v] || s[0]);
  }, [placement]);

  const killerText = useMemo(() => {
    if (ownTrail) return 'OWN TRAIL';
    if (killerName) return killerName.toUpperCase();
    return 'UNKNOWN';
  }, [ownTrail, killerName]);

  const killerStyle = useMemo(() =>
    killerColor
      ? { background: `#${killerColor.toString(16).padStart(6, '0')}` }
      : {},
    [killerColor]
  );

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          className="death-overlay"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3 }}
          role="dialog"
          aria-modal="true"
          aria-labelledby="death-title"
        >
          {/* Background effect */}
          <div className="death-bg-effect" />

          <motion.div
            className="death-card"
            initial={{ scale: 0.8, opacity: 0, rotate: -5 }}
            animate={{ scale: 1, opacity: 1, rotate: 0 }}
            exit={{ scale: 0.8, opacity: 0, rotate: 5 }}
            transition={{
              type: 'spring',
              stiffness: 200,
              damping: 20,
              delay: 0.1
            }}
          >
            {/* Eliminated stamp */}
            <motion.h2
              id="death-title"
              className="death-stamp"
              initial={{ scale: 2, opacity: 0, rotate: -15 }}
              animate={{ scale: 1, opacity: 1, rotate: -3 }}
              transition={{
                type: 'spring',
                stiffness: 300,
                damping: 25,
                delay: 0.3
              }}
            >
              ELIMINATED
            </motion.h2>

            {/* Placement */}
            <motion.div
              className="death-placement"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4, type: 'spring', stiffness: 100 }}
            >
              {placementOrdinal} PLACE
              <span className="death-total"> / {totalPlayers}</span>
            </motion.div>

            {/* Killer info */}
            <motion.div
              className="death-killer"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.5 }}
            >
              <span className="death-killer-label">KILLED BY</span>
              {killerColor && <span className="death-killer-color" style={killerStyle} />}
              <span className="death-killer-name">{killerText}</span>
            </motion.div>

            {/* Stats */}
            <div className="death-stats">
              <DeathStat label="KILLS" value={kills.toString()} icon={<Sword weight="fill" />} delay={0.6} />
              <DeathStat label="SURVIVED" value={formattedTime} icon={<Timer weight="fill" />} delay={0.65} />
              {formattedDistance !== undefined && (
                <DeathStat label="DISTANCE" value={formattedDistance} icon={<Ruler weight="fill" />} delay={0.7} />
              )}
            </div>

            {/* Actions */}
            <motion.div
              className="death-actions"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.75 }}
              role="group"
              aria-label="Game options"
            >
              {canSpectate && onSpectate && (
                <motion.button
                  onClick={onSpectate}
                  className="death-btn spectate"
                  aria-label="Spectate - watch remaining players"
                  whileHover={{ scale: 1.02, y: -2 }}
                  whileTap={{ scale: 0.98 }}
                >
                  <Eye weight="fill" size={20} />
                  <span className="death-btn-content">
                    <span className="death-btn-text">SPECTATE</span>
                    <span className="death-btn-subtitle">Watch remaining players</span>
                  </span>
                </motion.button>
              )}

              {onChangeClass && (
                <motion.button
                  onClick={onChangeClass}
                  className="death-btn change-class"
                  aria-label="Change class for next round"
                  whileHover={{ scale: 1.02, y: -2 }}
                  whileTap={{ scale: 0.98 }}
                >
                  <ArrowsClockwise weight="fill" size={20} />
                  <span className="death-btn-content">
                    <span className="death-btn-text">CHANGE CLASS</span>
                    <span className="death-btn-subtitle">Pick a different playstyle</span>
                  </span>
                </motion.button>
              )}

              {onLeave && (
                <motion.button
                  onClick={onLeave}
                  className="death-btn leave"
                  aria-label={`Return to lobby - automatic in ${countdown} seconds`}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                >
                  <ArrowLeft weight="bold" size={20} />
                  <span className="death-btn-content">
                    <span className="death-btn-text">RETURN TO LOBBY</span>
                    <span className="death-btn-subtitle">Auto in {countdown}s</span>
                  </span>
                </motion.button>
              )}
            </motion.div>

            {/* Progress bar */}
            <div className="death-progress">
              <motion.div
                className="death-progress-bar"
                initial={{ width: 0 }}
                animate={{ width: `${((5 - countdown) / 5) * 100}%` }}
                transition={{ duration: 1, ease: 'linear' }}
              />
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
});

interface DeathStatProps {
  label: string;
  value: string;
  icon: React.ReactNode;
  delay: number;
}

const DeathStat = memo(function DeathStat({ label, value, icon, delay }: DeathStatProps) {
  return (
    <motion.div
      className="death-stat"
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ delay, type: 'spring', stiffness: 200, damping: 20 }}
      whileHover={{ y: -2, backgroundColor: 'rgba(255, 255, 255, 0.05)' }}
    >
      <span className="death-stat-icon">{icon}</span>
      <div className="death-stat-content">
        <div className="death-stat-value">{value}</div>
        <div className="death-stat-label">{label}</div>
      </div>
    </motion.div>
  );
});

export function useDeathScreen() {
  const [deathProps, setDeathProps] = useState<DeathScreenProps | null>(null);

  const showDeath = (props: Omit<DeathScreenProps, 'onSpectate' | 'onLeave'>) => {
    setDeathProps(props as DeathScreenProps);
  };

  const hideDeath = () => {
    setDeathProps(null);
  };

  return {
    deathProps,
    showDeath,
    hideDeath,
  };
}

export default DeathScreen;
