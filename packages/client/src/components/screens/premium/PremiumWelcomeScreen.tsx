/**
 * PremiumWelcomeScreen - Dark Casino Style Main Menu
 * Stake.com / Limbo aesthetic with glass morphism and smooth animations
 */

import { useState, useEffect, memo } from 'react';
import {
  Trophy,
  GameController,
  ChartLineUp,
  Crown,
  Users,
  TrendUp,
} from 'phosphor-react';
import { GlassCard, PremiumButton, StatBadge } from '../../ui/premium';
import './PremiumWelcomeScreen.css';

export interface PremiumWelcomeScreenProps {
  onTournament?: () => void;
  onPractice?: () => void;
  onLeaderboard?: () => void;
  solPrice?: number | null;
}

export const PremiumWelcomeScreen = memo(function PremiumWelcomeScreen({
  onTournament,
  onPractice,
  onLeaderboard,
  solPrice,
}: PremiumWelcomeScreenProps) {
  const [isLoaded, setIsLoaded] = useState(false);
  const [totalPaid, setTotalPaid] = useState(847000);
  const [playersOnline, setPlayersOnline] = useState(247);

  // Animate stats
  useEffect(() => {
    const interval = setInterval(() => {
      setPlayersOnline(prev => {
        const change = Math.floor(Math.random() * 5) - 2;
        return Math.max(180, Math.min(320, prev + change));
      });
    }, 3000);

    return () => clearInterval(interval);
  }, []);

  // Initial load animation
  useEffect(() => {
    const timer = setTimeout(() => setIsLoaded(true), 100);
    return () => clearTimeout(timer);
  }, []);

  const formatNumber = (num: number): string => {
    if (num >= 1000000) return `$${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `$${(num / 1000).toFixed(0)}K`;
    return `$${num}`;
  };

  return (
    <>
      <a href="#main-menu" className="premium-skip-link">Skip to main menu</a>
      <div className={`premium-welcome-screen ${isLoaded ? 'loaded' : ''}`}>
        {/* Background */}
        <div className="premium-background" aria-hidden="true">
          <div className="premium-grid-overlay" />
          <div className="premium-glow-orb premium-glow-orb-1" />
          <div className="premium-glow-orb premium-glow-orb-2" />
        </div>

        <div className="premium-welcome-content">
          {/* Logo Section */}
          <div className="premium-logo-section">
            {/* Animated Sperm Icon */}
            <div className="premium-logo-icon">
              <svg
                viewBox="0 0 64 64"
                className="premium-sperm-logo"
                fill="currentColor"
              >
                {/* Modern sperm head - gradient applied via CSS */}
                <ellipse cx="32" cy="20" rx="16" ry="18" className="sperm-head" />
                {/* Highlight */}
                <ellipse cx="26" cy="14" rx="4" ry="5" fill="rgba(255,255,255,0.3)" />
                {/* Tail - curved path */}
                <path
                  d="M 32 38 Q 24 50 16 54 Q 8 58 4 52"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="6"
                  strokeLinecap="round"
                  className="sperm-tail"
                />
              </svg>
            </div>

            {/* Title */}
            <h1 className="premium-title">
              <span className="premium-title-sperm">SPERM</span>
              <span className="premium-title-race">RACE</span>
            </h1>

            {/* Tagline */}
            <p className="premium-tagline">BATTLE ROYALE RACING</p>

            {/* Pulsing CTA */}
            <div className="premium-cta-hint">
              <span className="premium-cta-dot" />
              <span>READY TO PLAY</span>
            </div>
          </div>

          {/* Menu Buttons */}
          <nav
            id="main-menu"
            className="premium-menu"
            aria-label="Main navigation"
          >
            {/* Tournament */}
            <div className="premium-menu-item stagger-1">
              <PremiumButton
                variant="primary"
                size="lg"
                fullWidth
                glow
                onClick={onTournament}
                className="premium-menu-btn"
              >
                <Trophy size={24} weight="fill" />
                <span>TOURNAMENTS</span>
              </PremiumButton>
              <span className="premium-menu-sub">$1 - $100 ENTRY • WIN 10X</span>
            </div>

            {/* Practice */}
            <div className="premium-menu-item stagger-2">
              <PremiumButton
                variant="success"
                size="lg"
                fullWidth
                glow
                onClick={onPractice}
                className="premium-menu-btn"
              >
                <GameController size={24} weight="fill" />
                <span>PRACTICE MODE</span>
              </PremiumButton>
              <span className="premium-menu-sub">FREE TO PLAY • NO RISK</span>
            </div>

            {/* Leaderboard */}
            {onLeaderboard && (
              <div className="premium-menu-item stagger-3">
                <PremiumButton
                  variant="secondary"
                  size="lg"
                  fullWidth
                  onClick={onLeaderboard}
                  className="premium-menu-btn"
                >
                  <ChartLineUp size={24} weight="fill" />
                  <span>LEADERBOARD</span>
                </PremiumButton>
                <span className="premium-menu-sub">TOP PLAYERS & RANKINGS</span>
              </div>
            )}
          </nav>

          {/* Stats Panel */}
          <div className="premium-stats stagger-4" role="region" aria-label="Game Statistics">
            <GlassCard variant="dark" padding="md" blur={8}>
              <div className="premium-stats-grid">
                {/* Total Paid */}
                <div className="premium-stat">
                  <div className="premium-stat-icon">
                    <Crown size={20} weight="fill" />
                  </div>
                  <div className="premium-stat-info">
                    <div className="premium-stat-value">{formatNumber(totalPaid)}</div>
                    <div className="premium-stat-label">PAID OUT</div>
                  </div>
                </div>

                {/* Divider */}
                <div className="premium-stat-divider" />

                {/* Players Online */}
                <div className="premium-stat">
                  <div className="premium-stat-icon online">
                    <Users size={20} weight="fill" />
                  </div>
                  <div className="premium-stat-info">
                    <div className="premium-stat-value">{playersOnline}</div>
                    <div className="premium-stat-label">ONLINE</div>
                  </div>
                </div>

                {/* SOL Price */}
                {solPrice && (
                  <>
                    <div className="premium-stat-divider" />
                    <div className="premium-stat">
                      <div className="premium-stat-icon sol">
                        <TrendUp size={20} weight="fill" />
                      </div>
                      <div className="premium-stat-info">
                        <div className="premium-stat-value">${solPrice.toFixed(0)}</div>
                        <div className="premium-stat-label">SOL</div>
                      </div>
                    </div>
                  </>
                )}
              </div>
            </GlassCard>
          </div>
        </div>

        {/* Footer */}
        <footer className="premium-footer">
          <span>POWERED BY SOLANA</span>
          <span className="premium-footer-dot" />
          <span>FAIR PLAY</span>
          <span className="premium-footer-dot" />
          <span>INSTANT PAYOUTS</span>
        </footer>
      </div>
    </>
  );
});

PremiumWelcomeScreen.displayName = 'PremiumWelcomeScreen';
