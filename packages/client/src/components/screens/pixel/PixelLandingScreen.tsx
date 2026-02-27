/**
 * PixelLandingScreen - Retro tournament landing page
 * Pixel art trophy, tier cards grid, INSERT COIN style CTAs
 */

import { useState, useEffect, memo } from 'react';
import {
  Trophy,
  GameController,
  Sparkle,
  Info,
} from 'phosphor-react';
import { PixelButton, PixelCard, PixelBadge } from '../../ui/pixel';
import { PixelIcons } from '../../ui/pixel/PixelIcon';
import './PixelLandingScreen.css';

export interface PixelLandingScreenProps {
  solPrice?: number | null;
  onPractice?: () => void;
  onWallet?: (entryFee?: number) => void;
  onLeaderboard?: () => void;
  onBack?: () => void;
}

interface Tier {
  name: string;
  usd: number;
  max: number;
  prize: number;
  popular: boolean;
  desc: string;
}

export const PixelLandingScreen = memo(function PixelLandingScreen({
  solPrice,
  onPractice,
  onWallet,
  onLeaderboard,
  onBack,
}: PixelLandingScreenProps) {
  const [isLoaded, setIsLoaded] = useState(false);
  const [selectedTier, setSelectedTier] = useState(0);
  const [coinBounce, setCoinBounce] = useState(false);
  const [trophyGlow, setTrophyGlow] = useState(true);

  const tiers: Tier[] = [
    { name: 'MICRO', usd: 1, max: 16, prize: 10, popular: true, desc: 'Perfect for beginners' },
    { name: 'NANO', usd: 5, max: 32, prize: 50, popular: false, desc: 'Most competitive' },
    { name: 'MEGA', usd: 25, max: 32, prize: 250, popular: false, desc: 'High stakes action' },
    { name: 'ELITE', usd: 100, max: 16, prize: 1000, popular: false, desc: 'Ultimate challenge' },
  ];

  const selected = tiers[selectedTier];

  // Initial load
  useEffect(() => {
    setIsLoaded(true);
  }, []);

  // Trophy glow animation
  useEffect(() => {
    const interval = setInterval(() => {
      setTrophyGlow(prev => !prev);
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  // Coin bounce when tier changes
  useEffect(() => {
    setCoinBounce(true);
    const timeout = setTimeout(() => setCoinBounce(false), 300);
    return () => clearTimeout(timeout);
  }, [selectedTier]);

  const handleJoin = () => {
    onWallet?.(selected.usd);
  };

  return (
    <div className={`pixel-landing-screen ${isLoaded ? 'pixel-loaded' : ''}`}>
      {/* Pixel grid background */}
      <div className="pixel-grid-bg" aria-hidden="true" />

      <div className="pixel-landing-content">
        {/* Header with back button */}
        <header className="pixel-landing-header">
          {onBack && (
            <PixelButton
              variant="secondary"
              size="sm"
              onClick={onBack}
              className="pixel-back-btn"
            >
              ← BACK
            </PixelButton>
          )}
        </header>

        {/* Hero Section */}
        <div className="pixel-landing-hero">
          {/* Pixel Trophy Icon */}
          <div className={`pixel-trophy-icon ${trophyGlow ? 'pixel-glow' : ''}`}>
            <svg viewBox="0 0 32 32" className="pixel-trophy-svg" fill="currentColor">
              {/* Trophy cup */}
              <rect x="8" y="4" width="16" height="12" fill="#ffa300" />
              <rect x="6" y="2" width="20" height="4" fill="#ffec27" />
              {/* Trophy handles */}
              <rect x="4" y="6" width="2" height="6" fill="#ffa300" />
              <rect x="26" y="6" width="2" height="6" fill="#ffa300" />
              {/* Trophy base */}
              <rect x="12" y="16" width="8" height="2" fill="#ab5236" />
              <rect x="10" y="18" width="12" height="4" fill="#ab5236" />
              {/* Stars */}
              <rect x="12" y="6" width="2" height="2" fill="#fff1e8" />
              <rect x="18" y="6" width="2" height="2" fill="#fff1e8" />
              <rect x="15" y="9" width="2" height="2" fill="#fff1e8" />
            </svg>
          </div>

          <h1 className="pixel-landing-title crt-text">TOURNAMENTS</h1>
          <p className="pixel-landing-subtitle">WIN REAL CRYPTO IN MINUTES</p>
        </div>

        {/* Prize Pool Display */}
        <div className="pixel-prize-display">
        <div className="pixel-prize-label">
          <Sparkle size={16} weight="fill" />
          <span>WINNER PAYOUT • FIXED 10X</span>
        </div>
          <div className={`pixel-prize-amount ${coinBounce ? 'pixel-bounce' : ''}`}>
            ${selected.prize}
          </div>
        </div>

        {/* Tier Selection Grid */}
        <div className="pixel-tier-grid" role="group" aria-label="Tournament tier selection">
          {tiers.map((tier, index) => (
            <button
              key={tier.name}
              className={`pixel-tier-card ${index === selectedTier ? 'pixel-tier-selected' : ''}`}
              onClick={() => setSelectedTier(index)}
              aria-pressed={index === selectedTier}
              aria-label={`Select ${tier.name} tier - $${tier.usd} entry, $${tier.prize} prize`}
            >
              {tier.popular && (
                <PixelBadge variant="popular" size="sm" className="pixel-tier-badge">
                  POPULAR
                </PixelBadge>
              )}
              <div className="pixel-tier-name">{tier.name}</div>
              <div className="pixel-tier-entry">${tier.usd}</div>
              <div className="pixel-tier-prize">${tier.prize}</div>
              <div className="pixel-tier-desc">{tier.desc}</div>
              <div className="pixel-tier-players">{tier.max} PLAYERS</div>
            </button>
          ))}
        </div>

        {/* Selected Tier Info */}
        <PixelCard variant="dark" padding="md" className="pixel-tier-info">
          <div className="pixel-tier-info-row">
            <span className="pixel-tier-info-label">TURN</span>
            <span className="pixel-tier-info-value">${selected.usd}</span>
            <span className="pixel-tier-info-into">INTO</span>
            <span className="pixel-tier-info-value pixel-tier-info-prize">${selected.prize}</span>
          </div>
          <div className="pixel-tier-info-detail">
            Join {selected.max} players racing for the prize pool
          </div>
        </PixelCard>

        {/* Action Buttons */}
        <div className="pixel-landing-actions">
          <PixelButton
            variant="accent"
            size="lg"
            fullWidth
            onClick={handleJoin}
            className="pixel-join-btn"
          >
            <Trophy size={24} weight="fill" />
            <span>JOIN TOURNAMENT</span>
          </PixelButton>

          {onPractice && (
            <PixelButton
              variant="secondary"
              size="lg"
              fullWidth
              onClick={onPractice}
              className="pixel-practice-btn"
            >
              <GameController size={24} weight="fill" />
              <span>PRACTICE MODE</span>
            </PixelButton>
          )}

          {/* INSERT COIN style text */}
          <div className="pixel-insert-coin pixel-blink">
            {'> INSERT COIN TO PLAY <'}
          </div>
        </div>

        {/* Feature Pills */}
        <div className="pixel-features">
          <div className="pixel-feature-pill">
            <span>⚡</span>
            <span>INSTANT PAYOUTS</span>
          </div>
          <div className="pixel-feature-pill">
            <span>🏆</span>
            <span>WINNER TAKES ALL</span>
          </div>
          <div className="pixel-feature-pill">
            <span>🔒</span>
            <span>PROVABLY FAIR</span>
          </div>
          <div className="pixel-feature-pill">
            <span>⏱️</span>
            <span>3-MIN MATCHES</span>
          </div>
        </div>
      </div>
    </div>
  );
});

PixelLandingScreen.displayName = 'PixelLandingScreen';
