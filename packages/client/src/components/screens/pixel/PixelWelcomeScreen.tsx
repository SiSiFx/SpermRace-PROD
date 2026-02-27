/**
 * PixelWelcomeScreen - Retro pixel art main menu
 * 8-bit logo, chunky pixel buttons, blinking text, animated background
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
import { PixelButton, PixelCard, PixelBadge } from '../../ui/pixel';
import { PixelIcons } from '../../ui/pixel/PixelIcon';
import './PixelWelcomeScreen.css';

export interface PixelWelcomeScreenProps {
  onTournament?: () => void;
  onPractice?: () => void;
  onLeaderboard?: () => void;
  solPrice?: number | null;
}

export const PixelWelcomeScreen = memo(function PixelWelcomeScreen({
  onTournament,
  onPractice,
  onLeaderboard,
  solPrice,
}: PixelWelcomeScreenProps) {
  const [isLoaded, setIsLoaded] = useState(false);
  const [blinkState, setBlinkState] = useState(true);
  const [totalPaid, setTotalPaid] = useState(847000);
  const [playersOnline, setPlayersOnline] = useState(247);
  const [logoScale, setLogoScale] = useState(1);

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

  // Blink animation for "PRESS START" text
  useEffect(() => {
    const blinkInterval = setInterval(() => {
      setBlinkState(prev => !prev);
    }, 500);

    return () => clearInterval(blinkInterval);
  }, []);

  // Logo pulse animation
  useEffect(() => {
    const pulseInterval = setInterval(() => {
      setLogoScale(prev => prev === 1 ? 1.05 : 1);
    }, 1000);

    return () => clearInterval(pulseInterval);
  }, []);

  // Initial load animation
  useEffect(() => {
    setIsLoaded(true);
  }, []);

  const formatNumber = (num: number): string => {
    if (num >= 1000000) return `$${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `$${(num / 1000).toFixed(0)}K`;
    return `$${num}`;
  };

  return (
    <>
      <a href="#main-menu" className="pixel-skip-link">Skip to main menu</a>
      <div className={`pixel-welcome-screen ${isLoaded ? 'pixel-loaded' : ''}`}>
        {/* Pixel starfield background */}
        <div className="pixel-starfield" aria-hidden="true">
          <div className="pixel-star pixel-star-1" />
          <div className="pixel-star pixel-star-2" />
          <div className="pixel-star pixel-star-3" />
          <div className="pixel-star pixel-star-4" />
          <div className="pixel-star pixel-star-5" />
          <div className="pixel-star pixel-star-6" />
          <div className="pixel-star pixel-star-7" />
          <div className="pixel-star pixel-star-8" />
        </div>

        {/* Scanline overlay */}
        <div className="pixel-scanlines" aria-hidden="true" />

        <div className="pixel-welcome-content">
          {/* Logo Section */}
          <div className="pixel-logo-section">
            {/* Pixel Sperm Icon */}
            <div
              className="pixel-logo-icon"
              style={{ transform: `scale(${logoScale})` }}
            >
              <svg
                viewBox="0 0 32 32"
                className="pixel-sperm-logo"
                fill="currentColor"
              >
                {/* Pixel sperm head */}
                <rect x="12" y="4" width="8" height="8" fill="#29adff" />
                <rect x="10" y="6" width="2" height="4" fill="#29adff" />
                <rect x="20" y="6" width="2" height="4" fill="#29adff" />
                <rect x="8" y="8" width="16" height="4" fill="#29adff" />
                {/* Pixel sperm tail */}
                <rect x="8" y="14" width="4" height="4" fill="#29adff" />
                <rect x="4" y="18" width="4" height="4" fill="#29adff" />
                <rect x="0" y="22" width="4" height="4" fill="#29adff" />
                {/* Eye */}
                <rect x="14" y="8" width="2" height="2" fill="#1d2b53" />
                {/* Shine */}
                <rect x="12" y="6" width="2" height="2" fill="#fff1e8" opacity="0.5" />
              </svg>
            </div>

            {/* Title */}
            <h1 className="pixel-title crt-text">
              <span className="pixel-title-sperm">SPERM</span>
              <span className="pixel-title-race">RACE</span>
            </h1>

            {/* Tagline */}
            <p className="pixel-tagline">BATTLE ROYALE RACING</p>

            {/* Blinking CTA */}
            {blinkState && (
              <div className="pixel-blink-text">
                {'> PRESS START <'}
              </div>
            )}
          </div>

          {/* Menu Buttons */}
          <nav
            id="main-menu"
            className="pixel-menu"
            aria-label="Main navigation"
          >
            {/* Tournament */}
            <div className="pixel-menu-item">
              <PixelButton
                variant="primary"
                size="lg"
                fullWidth
                onClick={onTournament}
                className="pixel-menu-btn pixel-menu-tournament"
              >
                <Trophy size={24} weight="fill" />
                <span>TOURNAMENTS</span>
              </PixelButton>
              <span className="pixel-menu-sub">$1 - $100 ENTRY • WIN 10X</span>
            </div>

            {/* Practice */}
            <div className="pixel-menu-item">
              <PixelButton
                variant="success"
                size="lg"
                fullWidth
                onClick={onPractice}
                className="pixel-menu-btn pixel-menu-practice"
              >
                <GameController size={24} weight="fill" />
                <span>PRACTICE MODE</span>
              </PixelButton>
              <span className="pixel-menu-sub">FREE TO PLAY • NO RISK</span>
            </div>

            {/* Leaderboard */}
            {onLeaderboard && (
              <div className="pixel-menu-item">
                <PixelButton
                  variant="secondary"
                  size="lg"
                  fullWidth
                  onClick={onLeaderboard}
                  className="pixel-menu-btn pixel-menu-leaderboard"
                >
                  <ChartLineUp size={24} weight="fill" />
                  <span>LEADERBOARD</span>
                </PixelButton>
                <span className="pixel-menu-sub">TOP PLAYERS & RANKINGS</span>
              </div>
            )}
          </nav>

          {/* Stats Panel */}
          <div className="pixel-stats" role="region" aria-label="Game Statistics">
            <PixelCard variant="dark" padding="sm">
              <div className="pixel-stats-grid">
                {/* Total Paid */}
                <div className="pixel-stat">
                  <div className="pixel-stat-icon">
                    <Crown size={20} weight="fill" />
                  </div>
                  <div className="pixel-stat-info">
                    <div className="pixel-stat-value">{formatNumber(totalPaid)}</div>
                    <div className="pixel-stat-label">PAID OUT</div>
                  </div>
                </div>

                {/* Divider */}
                <div className="pixel-stat-divider" />

                {/* Players Online */}
                <div className="pixel-stat">
                  <div className="pixel-stat-icon">
                    <Users size={20} weight="fill" />
                  </div>
                  <div className="pixel-stat-info">
                    <div className="pixel-stat-value">{playersOnline}</div>
                    <div className="pixel-stat-label">ONLINE</div>
                  </div>
                </div>

                {/* SOL Price */}
                {solPrice && (
                  <>
                    <div className="pixel-stat-divider" />
                    <div className="pixel-stat">
                      <div className="pixel-stat-icon">
                        <TrendUp size={20} weight="fill" />
                      </div>
                      <div className="pixel-stat-info">
                        <div className="pixel-stat-value">${solPrice.toFixed(0)}</div>
                        <div className="pixel-stat-label">SOL</div>
                      </div>
                    </div>
                  </>
                )}
              </div>
            </PixelCard>
          </div>
        </div>

        {/* Footer */}
        <footer className="pixel-footer">
          POWERED BY SOLANA • FAIR PLAY • INSTANT PAYOUTS
        </footer>
      </div>
    </>
  );
});

PixelWelcomeScreen.displayName = 'PixelWelcomeScreen';
