/**
 * SpermRace Premium Landing Screen - Asymmetric Layout
 * Left-aligned hero, 2x2 tier grid, live stats, trust badges
 */

'use client';

import { memo, useEffect, useRef, useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import {
  ArrowLeft,
  Trophy,
  Coin,
  Users,
  Lightning,
  ShieldCheck,
  CurrencyCircleDollar,
} from 'phosphor-react';
import { startLandingAlgorithmicArt } from './landingAlgorithmicArt';
import './PremiumLandingScreen.css';

export interface PremiumLandingScreenProps {
  solPrice?: number | null;
  onPractice?: () => void;
  onWallet?: (entryFee?: number) => void;
  onLeaderboard?: () => void;
  onBack?: () => void;
}

interface Tier {
  name: string;
  usd: number;
  prize: number;
  accent: string;
}

const TIERS: Tier[] = [
  { name: 'Challenger', usd: 1, prize: 10, accent: '#0ea5e9' },
  { name: 'Competitor', usd: 5, prize: 50, accent: '#fbbf24' },
  { name: 'Contender', usd: 25, prize: 250, accent: '#a78bfa' },
  { name: 'Champion', usd: 100, prize: 1000, accent: '#f472b6' },
];

// Spring animation configs
const springHero = { type: 'spring' as const, stiffness: 80, damping: 20 };
const springCard = { type: 'spring' as const, stiffness: 100, damping: 20 };
const staggerContainer = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: {
      staggerChildren: 0.05,
    },
  },
};
const staggerItem = {
  hidden: { opacity: 0, y: 20, scale: 0.95 },
  show: { opacity: 1, y: 0, scale: 1, transition: springCard },
};

// Live Counter Component
const LiveCounter = memo(function LiveCounter({
  count,
  label,
  icon: Icon,
}: {
  count: number;
  label: string;
  icon: typeof Users;
}) {
  return (
    <div className="live-counter">
      <span className="live-dot" />
      <Icon size={16} weight="fill" />
      <span className="live-count">{count}</span>
      <span className="live-label">{label}</span>
    </div>
  );
});

// Trust Badge Component
const TrustBadge = memo(function TrustBadge({
  icon: Icon,
  label,
}: {
  icon: typeof ShieldCheck;
  label: string;
}) {
  return (
    <div className="trust-badge">
      <Icon size={14} weight="fill" />
      <span>{label}</span>
    </div>
  );
});

export const PremiumLandingScreen = memo(function PremiumLandingScreen({
  onPractice,
  onWallet,
  onBack,
}: PremiumLandingScreenProps) {
  const [selectedTier, setSelectedTier] = useState(0);
  const [isLoaded, setIsLoaded] = useState(false);
  const [playersOnline, setPlayersOnline] = useState(47);
  const [gamesToday, setGamesToday] = useState(128);
  const artCanvasRef = useRef<HTMLCanvasElement | null>(null);

  const selected = TIERS[selectedTier];

  useEffect(() => {
    const timer = setTimeout(() => setIsLoaded(true), 80);
    return () => clearTimeout(timer);
  }, []);

  // Simulate live stats fluctuation
  useEffect(() => {
    const interval = setInterval(() => {
      setPlayersOnline((prev) => Math.max(20, prev + Math.floor(Math.random() * 7) - 3));
      setGamesToday((prev) => prev + (Math.random() > 0.7 ? 1 : 0));
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const canvas = artCanvasRef.current;
    if (!canvas) return;
    return startLandingAlgorithmicArt(canvas, {
      seedKey: `spermrace-${selected.name}-${selected.usd}-${selectedTier}`,
      baseHex: '#09090b',
      accentHex: selected.accent,
      secondaryHex: '#0ea5e9',
    });
  }, [selected.name, selected.usd, selected.accent, selectedTier]);

  const handleTierSelect = useCallback((index: number) => {
    setSelectedTier(index);
  }, []);

  return (
    <motion.div
      className="premium-landing"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      {/* Background effects */}
      <div className="landing-bg" aria-hidden="true">
        <div className="landing-radial" />
        <canvas ref={artCanvasRef} className="landing-canvas" />
        <div className="landing-grid" />
        <div className="landing-noise" />
      </div>

      {/* Header */}
      <motion.header
        className="landing-header"
        initial={{ y: -20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.1 }}
      >
        <div className="header-left">
          {onBack && (
            <motion.button
              className="back-btn"
              onClick={onBack}
              whileHover={{ scale: 1.05, x: -2 }}
              whileTap={{ scale: 0.95 }}
            >
              <ArrowLeft size={18} weight="bold" />
              <span>Back</span>
            </motion.button>
          )}
        </div>
        <div className="brand" role="heading" aria-level={1} aria-label="SPERM RACE">
          SPERMRACE
        </div>
        <div className="header-right" />
      </motion.header>

      {/* Main Content - Asymmetric Grid */}
      <div className="landing-main">
        {/* Left Column - Hero */}
        <motion.div
          className="landing-hero"
          initial={{ opacity: 0, x: -40 }}
          animate={{ opacity: 1, x: 0 }}
          transition={springHero}
        >
          <h1 className="landing-title">
            <span className="title-gradient">BATTLE</span>
            <span className="title-gradient">ROYALE</span>
          </h1>
          <p className="landing-subtitle">
            Win <span className="highlight">10x</span> Your Entry
          </p>

          {/* Live Stats */}
          <motion.div
            className="live-stats"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3, ...springHero }}
          >
            <LiveCounter count={playersOnline} label="Playing Now" icon={Users} />
            <LiveCounter count={gamesToday} label="Games Today" icon={Lightning} />
          </motion.div>
        </motion.div>

        {/* Right Column - 2x2 Tier Grid */}
        <motion.div
          className="tier-grid"
          variants={staggerContainer}
          initial="hidden"
          animate="show"
        >
          {TIERS.map((tier, index) => (
            <motion.button
              key={tier.name}
              className={`tier-card ${selectedTier === index ? 'active' : ''}`}
              onClick={() => handleTierSelect(index)}
              variants={staggerItem}
              whileHover={{ scale: 1.05, y: -4 }}
              whileTap={{ scale: 0.98 }}
              style={{
                '--tier-accent': tier.accent,
              } as React.CSSProperties}
            >
              <span className="tier-name">{tier.name}</span>
              <span className="tier-entry">${tier.usd}</span>
              <span className="tier-prize">
                <Trophy size={12} weight="fill" />
                ${tier.prize}
              </span>
            </motion.button>
          ))}
        </motion.div>
      </div>

      {/* Bottom Section - Prize + CTA + Trust */}
      <motion.div
        className="landing-bottom"
        initial={{ opacity: 0, y: 40 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4, ...springHero }}
      >
        {/* Prize Display */}
        <div className="prize-cta-row">
          <div className="prize-display">
            <div className="prize-icon">
              <Trophy weight="fill" size={28} />
            </div>
            <div className="prize-content">
              <div className="prize-label">PRIZE POOL</div>
              <div className="prize-amount">${selected.prize}</div>
            </div>
          </div>

          {/* CTA Button */}
          <motion.button
            className="cta-btn"
            onClick={() => onWallet?.(selected.usd)}
            whileHover={{ scale: 1.02, y: -2 }}
            whileTap={{ scale: 0.98 }}
            style={{
              '--tier-accent': selected.accent,
            } as React.CSSProperties}
          >
            <Coin weight="fill" size={20} />
            <span>Join ${selected.usd}</span>
          </motion.button>
        </div>

        {/* Secondary Action */}
        {onPractice && (
          <motion.button
            className="practice-btn"
            onClick={onPractice}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            <Lightning weight="fill" size={18} />
            <span>Practice Free</span>
          </motion.button>
        )}

        {/* Trust Badges */}
        <div className="trust-badges">
          <TrustBadge icon={ShieldCheck} label="On-Chain Verified" />
          <TrustBadge icon={Lightning} label="Instant Payouts" />
          <TrustBadge icon={CurrencyCircleDollar} label="Solana Powered" />
        </div>
      </motion.div>
    </motion.div>
  );
});

export default PremiumLandingScreen;
