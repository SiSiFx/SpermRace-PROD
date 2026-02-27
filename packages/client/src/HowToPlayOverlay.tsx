/**
 * HowToPlayOverlay.tsx - Taste-Skill Compliant
 * Mobile-first, non-scrollable educational overlay
 */

'use client';

import { useEffect } from 'react';
import { motion } from 'framer-motion';
import { X, Globe, Lightning, TrendUp, Warning } from 'phosphor-react';
import './HowToPlayOverlay.css';

type OverlayMode = 'pc' | 'mobile';

interface HowToPlayOverlayProps {
  mode: OverlayMode;
  onClose: () => void;
}

export function HowToPlayOverlay({ mode, onClose }: HowToPlayOverlayProps) {
  const isMobile = mode === 'mobile';

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <motion.div
      className="how-to-play-overlay"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
    >
      <motion.div
        className="how-to-play-modal"
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        transition={{ type: 'spring', stiffness: 100, damping: 20 }}
      >
        {/* Header */}
        <div className="how-to-play-header">
          <div>
            <h2 className="how-to-play-title">How to win SpermRace</h2>
            <p className="how-to-play-subtitle">
              60–90 seconds. One arena. One winner takes the prize pool.
            </p>
          </div>
          <motion.button
            className="how-to-play-close"
            onClick={onClose}
            whileHover={{ scale: 1.05, rotate: 90 }}
            whileTap={{ scale: 0.95 }}
            aria-label="Close"
          >
            <X size={20} weight="bold" />
          </motion.button>
        </div>

        {/* Content */}
        <div className="how-to-play-content">
          {/* Objective */}
          <motion.section
            className="how-to-play-section objective"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
          >
            <div className="section-icon">
              <TrendUp weight="fill" />
            </div>
            <div className="section-content">
              <h3 className="section-title">Objective</h3>
              <ul>
                <li>Survive longer than everyone else – last sperm alive wins the round.</li>
                <li>
                  In tournaments, the <strong>winner takes ~85% of the entry fee pool</strong> (shown in the lobby).
                </li>
                <li>Practice mode is free and uses bots – perfect for learning.</li>
              </ul>
            </div>
          </motion.section>

          {/* Controls */}
          <motion.section
            className="how-to-play-section controls"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
          >
            <div className="section-icon">
              <Globe weight="fill" />
            </div>
            <div className="section-content">
              <h3 className="section-title">Controls</h3>
              <div className="controls-grid">
                <div className="control-group">
                  <div className="control-label">PC</div>
                  <ul>
                    <li>Aim with the mouse cursor</li>
                    <li>Move with <strong>WASD</strong></li>
                    <li>Boost with <strong>Space</strong> or <strong>B</strong></li>
                    <li>Press <strong>ESC</strong> to go back</li>
                  </ul>
                </div>
                <div className="control-group">
                  <div className="control-label">Mobile</div>
                  <ul>
                    <li>Drag left side to steer</li>
                    <li>Tap <strong>BOOST</strong> to dash</li>
                    <li>On-field countdown before moving</li>
                  </ul>
                </div>
              </div>
            </div>
          </motion.section>

          {/* Hazards */}
          <motion.section
            className="how-to-play-section hazards"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
          >
            <div className="section-icon warning">
              <Warning weight="fill" />
            </div>
            <div className="section-content">
              <h3 className="section-title">Hazards & Powerups</h3>
              <ul>
                <li>
                  Your glowing <strong>trail kills on contact</strong> – including you after a short spawn grace.
                </li>
                <li>
                  Other players&apos; trails are deadly too – try to cut them off while staying safe.
                </li>
                <li>
                  The arena <strong>shrinks and slices in</strong> over time. Stay inside the safe zone.
                </li>
                <li>
                  Small energy orbs refill your boost meter. Grab them to keep dashing.
                </li>
              </ul>
            </div>
          </motion.section>

          {/* Tip */}
          <motion.div
            className="how-to-play-tip"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.25 }}
          >
            <Lightning weight="fill" size={16} />
            <span>
              Use <strong>Practice</strong> to learn movement, then join tournaments when you can consistently reach the final 3.
            </span>
          </motion.div>
        </div>
      </motion.div>
    </motion.div>
  );
}

export default HowToPlayOverlay;
