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
  { name: 'Free',  usd: 0,   prize: null    },
  { name: '$1',    usd: 1,   prize: '$10'   },
  { name: '$5',    usd: 5,   prize: '$50',   recommended: true },
  { name: '$25',   usd: 25,  prize: '$250'  },
  { name: '$100',  usd: 100, prize: '$1000' },
];

export interface PremiumLandingScreenProps {
  solPrice?: number | null;
  onPractice?: () => void;
  onWallet?: (tier: { usd: number; prize: string }) => void;
  onLeaderboard?: () => void;
  onHelp?: () => void;
  isNewPlayer?: boolean;
  isPracticeConnecting?: boolean;
}

function isFirstVisit(): boolean {
  try { return !localStorage.getItem('sr_has_played'); } catch { return true; }
}

export const PremiumLandingScreen = memo(function PremiumLandingScreen({
  onPractice,
  onWallet,
  onLeaderboard,
  isPracticeConnecting,
}: PremiumLandingScreenProps) {
  // New visitors default to Free so the first action is always zero-risk.
  // Returning players (sr_has_played set) default to $5 (recommended).
  const [selected, setSelected] = useState(() => isFirstVisit() ? 0 : 2);
  const tier = TIERS[selected];

  const handlePrimary = useCallback(() => {
    if (tier.usd === 0) {
      onPractice?.();
    } else {
      try { localStorage.setItem('sr_has_played', '1'); } catch { }
      onWallet?.({ usd: tier.usd, prize: tier.prize ?? '$42' });
    }
  }, [onPractice, onWallet, tier]);

  const handlePractice = useCallback(() => {
    onPractice?.();
  }, [onPractice]);

  return (
    <div className="landing-root">
      <SpermBackground />

      {/* Full-screen connecting overlay — shown while finding a practice room */}
      {isPracticeConnecting && (
        <div className="landing-connecting-overlay" aria-live="polite">
          <div className="landing-connecting-spinner" />
          <p className="landing-connecting-label">Finding a room…</p>
        </div>
      )}

      <nav className="landing-nav">
        <span className="landing-logo">SpermRace.io</span>
        <button className="landing-nav-link" onClick={onLeaderboard}>
          Leaderboard
        </button>
      </nav>

      <main className="landing-stage">
        <h1 className="landing-headline">
          <span className="landing-headline-line">36 enter.</span>
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
                  ? <span className="stake-payout">win {t.prize}</span>
                  : <span className="stake-payout">practice</span>
                }
              </button>
            ))}
          </div>

          <button
            className="landing-cta"
            onClick={handlePrimary}
            disabled={isPracticeConnecting}
          >
            {tier.usd === 0
              ? 'Start practice'
              : <>Enter {tier.name} room <span className="cta-payout">win {tier.prize}</span></>
            }
          </button>

          {tier.usd !== 0 && (
            <button
              className="landing-practice-link"
              onClick={handlePractice}
              disabled={isPracticeConnecting}
            >
              Try free — no wallet needed
            </button>
          )}
        </div>
      </main>
    </div>
  );
});
