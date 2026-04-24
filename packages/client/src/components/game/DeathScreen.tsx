/**
 * DeathScreen.tsx - Taste-Skill Compliant Death Screen
 * Shows immediately when a player is eliminated mid-game
 * Brutal style with Framer Motion animations
 */

'use client';

import { useEffect, useState, memo, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sword, Timer, Ruler, ArrowCounterClockwise } from 'phosphor-react';
import './DeathScreen.css';

/** Counts from 0 to target over `duration` ms, starting after `delayMs` */
function useCountUp(target: number, duration = 750, delayMs = 0): number {
  const [value, setValue] = useState(0);
  const rafRef = useRef<number>(0);
  useEffect(() => {
    let startTime: number | null = null;
    const tick = (now: number) => {
      if (startTime === null) startTime = now + delayMs;
      const elapsed = now - startTime;
      if (elapsed < 0) { rafRef.current = requestAnimationFrame(tick); return; }
      const t = Math.min(1, elapsed / duration);
      const eased = 1 - Math.pow(1 - t, 4); // ease-out-quart
      setValue(Math.round(target * eased));
      if (t < 1) rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [target, duration, delayMs]);
  return value;
}

// Contextual verdict — deterministic, no randomness
function getVerdict(ownTrail: boolean, kills: number, timeSurvived: number, placement: number, totalPlayers: number): string {
  if (ownTrail)              return 'You crossed your own trail.';
  if (timeSurvived < 12)     return 'Under 12 seconds.';
  if (placement === 2)       return 'Runner-up.';
  if (kills >= 2)            return `${kills} kills.`;
  if (kills === 1)           return '1 kill.';
  if (totalPlayers > 5 && placement <= Math.floor(totalPlayers * 0.3)) return 'Top third.';
  return '';
}

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
  onQuickReplay?: () => void;
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
  onQuickReplay,
}: DeathScreenProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [countdown, setCountdown] = useState(5);

  // Brutal verdict — random but contextual, computed once on mount
  const verdict = useMemo(
    () => getVerdict(ownTrail, kills, timeSurvived, placement, totalPlayers),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  // Show own-trail explanation once — first time a player dies by their own trail
  const [showOwnTrailTip] = useState(() => {
    if (!ownTrail) return false;
    try {
      if (localStorage.getItem('spermrace_own_trail_explained')) return false;
      localStorage.setItem('spermrace_own_trail_explained', '1');
      return true;
    } catch { return false; }
  });

  useEffect(() => {
    const showTimer = setTimeout(() => setIsVisible(true), 100);
    return () => clearTimeout(showTimer);
  }, []);

  useEffect(() => {
    if (!isVisible) return;
    if (countdown <= 0) {
      // Auto-action priority: quick replay > spectate > leave
      if (onQuickReplay) {
        onQuickReplay();
      } else if (canSpectate && onSpectate) {
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

  // Count-up animations — start when card appears (~700ms after mount)
  const animatedKills = useCountUp(kills, 650, 700);
  const animatedSeconds = useCountUp(Math.floor(timeSurvived), 800, 750);
  const animatedTime = useMemo(() => {
    const m = Math.floor(animatedSeconds / 60);
    const s = animatedSeconds % 60;
    return `${m}:${String(s).padStart(2, '0')}`;
  }, [animatedSeconds]);

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
              animate={{ scale: 1, opacity: 1 }}
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

            {/* Brutal verdict */}
            <motion.p
              className="death-verdict"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.48 }}
            >
              {verdict}
            </motion.p>

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

            {/* Own-trail tip — shown once to explain the mechanic */}
            {showOwnTrailTip && (
              <motion.p
                className="death-own-trail-tip"
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.65 }}
              >
                Your trail becomes deadly 0.3s after you leave it — don't cross your own path.
              </motion.p>
            )}

            {/* Stats */}
            <div className="death-stats">
              <DeathStat label="KILLS" value={animatedKills.toString()} icon={<Sword weight="fill" />} delay={0.6} />
              <DeathStat label="SURVIVED" value={animatedTime} icon={<Timer weight="fill" />} delay={0.65} />
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
              {onQuickReplay && (
                <motion.button
                  onClick={onQuickReplay}
                  className="death-btn quick-replay"
                  aria-label={`Play again — auto in ${countdown}s`}
                  whileHover={{ scale: 1.02, y: -2 }}
                  whileTap={{ scale: 0.98 }}
                >
                  <ArrowCounterClockwise weight="fill" size={20} />
                  <span className="death-btn-text">PLAY AGAIN</span>
                </motion.button>
              )}

              <div className="death-secondary-actions">
                {canSpectate && onSpectate && (
                  <button className="death-text-link" onClick={onSpectate}>Spectate</button>
                )}
                {onLeave && (
                  <button className="death-text-link" onClick={onLeave}>See results</button>
                )}
              </div>
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
