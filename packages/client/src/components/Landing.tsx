/**
 * Landing Page Component
 * Dopamine-max landing for SpermRace.io
 * Fully responsive for PC and mobile
 */

import { useState, useEffect } from 'react';
import { Modes } from './Modes';
import './Landing.css';

interface LandingProps {
  solPrice: number | null;
  onPractice: () => void;
  onWallet: () => void;
  onLeaderboard?: () => void;
}

export function Landing({ solPrice, onPractice, onWallet, onLeaderboard }: LandingProps) {
  const [activeFeature, setActiveFeature] = useState(0);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth <= 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Auto-rotate features
  useEffect(() => {
    const interval = setInterval(() => {
      setActiveFeature((prev) => (prev + 1) % 4);
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  const features = [
    {
      icon: '⚡',
      title: 'INSTANT ACTION',
      desc: '30-second matches. No waiting.',
      color: '#00ffff',
    },
    {
      icon: '💀',
      title: 'SLITHER COMBAT',
      desc: 'Cut enemies with your tail. Avoid theirs.',
      color: '#ff4444',
    },
    {
      icon: '🏆',
      title: 'WIN CRYPTO',
      desc: '85% prize pools. Instant SOL payouts.',
      color: '#ffd700',
    },
    {
      icon: '🎮',
      title: '3 CLASSES',
      desc: 'Sprinter, Tank, or Balanced. Your style.',
      color: '#bf00ff',
    },
  ];

  return (
    <div className="landing">
      {/* Animated background */}
      <div className="landing-bg">
        <div className="landing-gradient" />
        <div className="landing-grid" />
        <div className="landing-glow landing-glow-1" />
        <div className="landing-glow landing-glow-2" />
      </div>

      {/* Hero Section */}
      <section className="hero">
        <div className="hero-content">
          {/* Logo/Title */}
          <header className="hero-logo">
            <div className="hero-icon">🏁</div>
            <h1 className="hero-title brand-title" data-text="SPERM RACE" aria-label="SPERM RACE">
              <span className="hero-title-main">SPERM</span>
              <span className="hero-title-outline">RACE</span>
            </h1>
            <p className="hero-tagline">BATTLE ROYALE • WIN CRYPTO</p>
          </header>

          {/* Animated sperm preview */}
          <div className="hero-preview">
            <div className="preview-arena">
              <div className="preview-sperm preview-sperm-1" />
              <div className="preview-sperm preview-sperm-2" />
              <div className="preview-sperm preview-sperm-3" />
              <div className="preview-trail preview-trail-1" />
              <div className="preview-trail preview-trail-2" />
              <div className="preview-zone" />
            </div>
          </div>

          {/* CTA Buttons */}
          <div className="hero-cta">
            <button className="cta-primary" onClick={onPractice}>
              <span className="cta-icon">▶</span>
              <span className="cta-text">PLAY NOW</span>
              <span className="cta-hint">Free Practice</span>
            </button>
            <button className="cta-secondary" onClick={onWallet}>
              <span className="cta-icon">💰</span>
              <span className="cta-text">TOURNAMENTS</span>
              <span className="cta-hint">Win SOL</span>
            </button>
          </div>

          {/* Live stats */}
          <div className="hero-stats">
            <div className="stat">
              <div className="stat-value">30s</div>
              <div className="stat-label">Matches</div>
            </div>
            <div className="stat-divider" />
            <div className="stat">
              <div className="stat-value">85%</div>
              <div className="stat-label">Prize Pool</div>
            </div>
            <div className="stat-divider" />
            <div className="stat">
              <div className="stat-value">{solPrice ? `$${solPrice.toFixed(0)}` : '—'}</div>
              <div className="stat-label">SOL</div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="features">
        <h2 className="section-title">HOW IT WORKS</h2>
        <div className="features-grid">
          {features.map((feature, index) => (
            <div
              key={index}
              className={`feature-card ${activeFeature === index ? 'active' : ''}`}
              style={{ '--feature-color': feature.color } as React.CSSProperties}
              onMouseEnter={() => setActiveFeature(index)}
            >
              <div className="feature-icon">{feature.icon}</div>
              <h3 className="feature-title">{feature.title}</h3>
              <p className="feature-desc">{feature.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Tournament Tiers */}
      <section className="tournaments">
        <h2 className="section-title">TOURNAMENT TIERS</h2>
        <p className="section-subtitle">Connect wallet • Pay entry • Win big</p>
        <Modes />
      </section>

      {/* How to Play */}
      <section className="howto">
        <h2 className="section-title">CONTROLS</h2>
        <div className="howto-grid">
          <div className="howto-card">
            <div className="howto-icon">{isMobile ? '👆' : '🖱️'}</div>
            <h3>{isMobile ? 'DRAG TO STEER' : 'MOUSE TO STEER'}</h3>
            <p>Point where you want to go</p>
          </div>
          <div className="howto-card">
            <div className="howto-icon">{isMobile ? '🔘' : '⎵'}</div>
            <h3>{isMobile ? 'TAP TO BOOST' : 'SPACE TO BOOST'}</h3>
            <p>Speed burst when you need it</p>
          </div>
          <div className="howto-card">
            <div className="howto-icon">💥</div>
            <h3>CUT TO KILL</h3>
            <p>Your tail is your weapon</p>
          </div>
          <div className="howto-card">
            <div className="howto-icon">👑</div>
            <h3>LAST ONE WINS</h3>
            <p>Survive the shrinking zone</p>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="landing-footer">
        <div className="footer-links">
          <button className="footer-link" onClick={onPractice}>Practice</button>
          <button className="footer-link" onClick={onWallet}>Wallet</button>
          {onLeaderboard && (
            <button className="footer-link" onClick={onLeaderboard}>Leaderboard</button>
          )}
        </div>
        <div className="footer-sol">
          SOL: {solPrice != null ? `$${solPrice.toFixed(2)}` : '—'}
        </div>
        <div className="footer-copy">
          © 2024 SpermRace.io • Built on Solana
        </div>
      </footer>
    </div>
  );
}

export default Landing;
