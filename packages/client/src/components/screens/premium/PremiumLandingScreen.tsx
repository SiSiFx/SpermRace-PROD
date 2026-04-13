import { memo, useCallback, useState } from 'react';
import './PremiumLandingScreen.css';
import { SpermBackground } from './SpermBackground';

type Tier = {
  name: string;
  usd: number;
  prize: string | null;
  recommended?: boolean;
};

const TIERS: Tier[] = [
  { name: 'Practice', usd: 0,   prize: null   },
  { name: '$1',       usd: 1,   prize: '$8'   },
  { name: '$5',       usd: 5,   prize: '$42',  recommended: true },
  { name: '$25',      usd: 25,  prize: '$212' },
  { name: '$100',     usd: 100, prize: '$850' },
];

export interface PremiumLandingScreenProps {
  solPrice?: number | null;
  onPractice?: () => void;
  onWallet?: (tier: { usd: number; prize: string }) => void;
  onLeaderboard?: () => void;
  onHelp?: () => void;
  isNewPlayer?: boolean;
}

export const PremiumLandingScreen = memo(function PremiumLandingScreen({
  onPractice,
  onWallet,
  onLeaderboard,
}: PremiumLandingScreenProps) {
  const [selected, setSelected] = useState(2); // default: $5
  const tier = TIERS[selected];

  const handlePrimary = useCallback(() => {
    if (tier.usd === 0) onPractice?.();
    else onWallet?.({ usd: tier.usd, prize: tier.prize ?? '$42' });
  }, [onPractice, onWallet, tier]);

  return (
    <div className="landing-root">
      <SpermBackground />

      <div className="landing-shell">
        <header className="landing-header">
          <span className="landing-logo">SpermRace.io</span>
          <button className="landing-nav-btn" onClick={onLeaderboard}>
            Leaderboard
          </button>
        </header>

        <main className="landing-hero">
          <h1 className="landing-headline">
            12 enter.<br />
            <span className="landing-headline-gold">1 gets paid.</span>
          </h1>

          <div className="landing-tiers" role="group" aria-label="Choose room">
            <span className="landing-tiers-label">Choose your room</span>
            {TIERS.map((t, i) => (
              <button
                key={t.name}
                className={`landing-tier-btn${selected === i ? ' is-active' : ''}${t.recommended ? ' is-recommended' : ''}`}
                onClick={() => setSelected(i)}
                aria-pressed={selected === i}
              >
                {t.name}
                {t.prize && <span className="landing-tier-prize">win {t.prize}</span>}
              </button>
            ))}
          </div>

          <div className="landing-actions">
            <button className="landing-cta-primary" onClick={handlePrimary}>
              <span key={tier.usd} className="landing-cta-content">
                {tier.usd === 0 ? 'Start practice' : `Enter ${tier.name} room`}
                {tier.prize && <span className="landing-cta-prize">→ win {tier.prize}</span>}
              </span>
            </button>
            {tier.usd !== 0 && (
              <button className="landing-cta-secondary" onClick={onPractice}>
                Practice free
              </button>
            )}
          </div>
        </main>
      </div>
    </div>
  );
});
