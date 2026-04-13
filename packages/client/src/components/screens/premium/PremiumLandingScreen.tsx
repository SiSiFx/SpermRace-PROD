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
  { name: 'Free',  usd: 0,   prize: null   },
  { name: '$1',    usd: 1,   prize: '$8'   },
  { name: '$5',    usd: 5,   prize: '$42',  recommended: true },
  { name: '$25',   usd: 25,  prize: '$212' },
  { name: '$100',  usd: 100, prize: '$850' },
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

      <nav className="landing-nav">
        <span className="landing-logo">SpermRace.io</span>
        <button className="landing-nav-link" onClick={onLeaderboard}>
          Leaderboard
        </button>
      </nav>

      <main className="landing-stage">
        <h1 className="landing-headline">
          <span className="landing-headline-line">12 enter.</span>
          <span className="landing-headline-line is-gold">1 gets paid.</span>
        </h1>

        <div className="landing-card">
          <div className="landing-stakes" role="group" aria-label="Choose your stake">
            {TIERS.map((t, i) => (
              <button
                key={t.name}
                className={`landing-stake${selected === i ? ' is-active' : ''}${t.recommended ? ' is-hot' : ''}`}
                onClick={() => setSelected(i)}
                aria-pressed={selected === i}
              >
                <span className="stake-entry">{t.name}</span>
                {t.prize
                  ? <span className="stake-payout">→ {t.prize}</span>
                  : <span className="stake-payout">practice</span>
                }
              </button>
            ))}
          </div>

          <button className="landing-cta" onClick={handlePrimary}>
            {tier.usd === 0
              ? 'Start practice'
              : <>Enter {tier.name} room <span className="cta-payout">win {tier.prize}</span></>
            }
          </button>

          {tier.usd !== 0 && (
            <button className="landing-practice-link" onClick={onPractice}>
              or practice free first
            </button>
          )}
        </div>
      </main>
    </div>
  );
});
