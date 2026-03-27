import { memo, useCallback, useState } from 'react';
import { ArrowRight } from 'phosphor-react';
import './PremiumLandingScreen.css';
import { SpermBackground } from './SpermBackground';

type Tier = {
  name: string;
  usd: number;
  prize: string | null;
  recommended?: boolean;
};

const TIERS: Tier[] = [
  { name: 'Practice', usd: 0,   prize: null,   },
  { name: '$1',       usd: 1,   prize: '$8'    },
  { name: '$5',       usd: 5,   prize: '$42', recommended: true },
  { name: '$25',      usd: 25,  prize: '$212'  },
  { name: '$100',     usd: 100, prize: '$850'  },
];

export interface PremiumLandingScreenProps {
  solPrice?: number | null;
  onPractice?: () => void;
  onWallet?: () => void;
  onLeaderboard?: () => void;
  onHelp?: () => void;
}

export const PremiumLandingScreen = memo(function PremiumLandingScreen({
  onPractice,
  onWallet,
  onLeaderboard,
  onHelp,
}: PremiumLandingScreenProps) {
  const [selected, setSelected] = useState(2); // default: $5
  const tier = TIERS[selected];

  const handlePrimary = useCallback(() => {
    if (tier.usd === 0) onPractice?.();
    else onWallet?.();
  }, [onPractice, onWallet, tier.usd]);

  return (
    <div className="landing-root">
      <SpermBackground />

      <div className="landing-shell">
        <header className="landing-header">
          <span className="landing-logo">SpermRace.io</span>
          <div className="landing-header-nav">
            <button className="landing-nav-btn" onClick={onLeaderboard}>
              Leaderboard
            </button>
            <button className="landing-nav-btn" onClick={onHelp}>
              How to Play
            </button>
          </div>
        </header>

        <main className="landing-hero">
          <p className="landing-eyebrow">Pick a room · last one alive wins · paid in SOL</p>

          <h1 className="landing-headline">
            One survives.<br />
            <span className="landing-headline-gold">One gets paid.</span>
          </h1>

          <p className="landing-rule">Touch any trail. Die.</p>

          <div className="landing-actions">
            <button className="landing-cta-primary" onClick={handlePrimary}>
              <span key={tier.usd} className="landing-cta-content">
                {tier.usd === 0
                  ? 'Start practice'
                  : `Enter ${tier.name} room`}
                {tier.prize && (
                  <span className="landing-cta-prize">→ {tier.prize}</span>
                )}
                {!tier.prize && <ArrowRight size={18} weight="bold" />}
              </span>
            </button>

            {tier.usd !== 0 && (
              <button className="landing-cta-secondary" onClick={onPractice}>
                Practice free
              </button>
            )}
          </div>

          <div className="landing-tiers" role="group" aria-label="Choose room">
            {TIERS.map((t, i) => (
              <button
                key={t.name}
                className={`landing-tier-btn${selected === i ? ' is-active' : ''}${t.recommended ? ' is-recommended' : ''}`}
                onClick={() => setSelected(i)}
                aria-pressed={selected === i}
              >
                {t.name}
                {t.prize && <span className="landing-tier-prize">{t.prize}</span>}
              </button>
            ))}
          </div>
        </main>
      </div>
    </div>
  );
});
