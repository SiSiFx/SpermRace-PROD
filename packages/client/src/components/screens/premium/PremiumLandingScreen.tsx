import { memo, useCallback, useState } from 'react';
import './PremiumLandingScreen.css';
import { SpermBackground } from './SpermBackground';

type Tier = {
  name: string;
  usd: number;
  prize: string | null;
  recommended?: boolean;
  players: number;
};

const TIERS: Tier[] = [
  { name: 'Free',  usd: 0,   prize: null,    players: 10  },
  { name: '$1',    usd: 1,   prize: '$10',   players: 16  },
  { name: '$5',    usd: 5,   prize: '$50',   players: 16, recommended: true },
  { name: '$25',   usd: 25,  prize: '$250',  players: 16  },
  { name: '$100',  usd: 100, prize: '$1000', players: 16  },
];

export interface PremiumLandingScreenProps {
  solPrice?: number | null;
  onPractice?: () => void;
  onWallet?: (tier: { usd: number; prize: string }) => void;
  onLeaderboard?: () => void;
  onHelp?: () => void;
  isNewPlayer?: boolean;
}

function isFirstVisit(): boolean {
  try { return !localStorage.getItem('sr_has_played'); } catch { return true; }
}

function toSol(usd: number, solPrice?: number | null): string | null {
  if (!solPrice || solPrice <= 0 || usd <= 0) return null;
  return `≈${(usd / solPrice).toFixed(4)} SOL`;
}

// ── Entry Preview Modal ──────────────────────────────────────────────────────
function EntryModal({
  tier,
  solPrice,
  onConfirm,
  onPractice,
  onClose,
}: {
  tier: Tier;
  solPrice?: number | null;
  onConfirm: () => void;
  onPractice: () => void;
  onClose: () => void;
}) {
  const solEquiv = toSol(tier.usd, solPrice);
  return (
    <div className="entry-modal-backdrop" onClick={onClose} role="dialog" aria-modal="true">
      <div className="entry-modal" onClick={e => e.stopPropagation()}>

        <button className="entry-modal-close" onClick={onClose} aria-label="Close">✕</button>

        {/* Room label */}
        <p className="entry-modal-room">{tier.name} room</p>

        {/* Prize — the only number that matters */}
        <div className="entry-modal-prize-wrap">
          <span className="entry-modal-prize-amount">{tier.prize}</span>
          <span className="entry-modal-prize-label">top prize</span>
        </div>

        {/* Simple entry → payout equation */}
        <div className="entry-modal-deal">
          <div className="entry-modal-deal-side">
            <span className="entry-modal-deal-value">{tier.name}</span>
            {solEquiv && <span className="entry-modal-sol">{solEquiv}</span>}
            <span className="entry-modal-deal-hint">you pay</span>
          </div>
          <svg className="entry-modal-deal-arrow" viewBox="0 0 44 14" fill="none" aria-hidden="true">
            <path d="M0 7h40M33 1l7 6-7 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          <div className="entry-modal-deal-side entry-modal-deal-side--win">
            <span className="entry-modal-deal-value">{tier.prize}</span>
            <span className="entry-modal-deal-hint">winner gets</span>
          </div>
        </div>

        {/* Single trust line */}
        <p className="entry-modal-meta">
          {tier.players} players · instant on-chain payout · provably fair
        </p>

        {/* CTA */}
        <button className="entry-modal-cta" onClick={onConfirm}>
          Connect Wallet &amp; Enter
        </button>
        <button className="entry-modal-practice" onClick={onPractice}>
          Try free first — no wallet needed
        </button>
      </div>
    </div>
  );
}

export const PremiumLandingScreen = memo(function PremiumLandingScreen({
  solPrice,
  onPractice,
  onWallet,
  onLeaderboard,
}: PremiumLandingScreenProps) {
  // New visitors default to Free so the first action is always zero-risk.
  // Returning players (sr_has_played set) default to $5 (recommended).
  const [selected, setSelected] = useState(() => isFirstVisit() ? 0 : 2);
  const [modalTier, setModalTier] = useState<Tier | null>(null);
  const tier = TIERS[selected];

  const handlePrimary = useCallback(() => {
    if (tier.usd === 0) {
      onPractice?.();
    } else {
      setModalTier(tier);
    }
  }, [onPractice, tier]);

  const handleConfirmEntry = useCallback(() => {
    if (!modalTier) return;
    setModalTier(null);
    try { localStorage.setItem('sr_has_played', '1'); } catch { }
    onWallet?.({ usd: modalTier.usd, prize: modalTier.prize ?? '$42' });
  }, [modalTier, onWallet]);

  const handlePractice = useCallback(() => {
    setModalTier(null);
    onPractice?.();
  }, [onPractice]);

  return (
    <div className="landing-root">
      <SpermBackground />

      {/* Entry preview modal — shown before wallet connect */}
      {modalTier && (
        <EntryModal
          tier={modalTier}
          solPrice={solPrice}
          onConfirm={handleConfirmEntry}
          onPractice={handlePractice}
          onClose={() => setModalTier(null)}
        />
      )}

      <nav className="landing-nav">
        <span className="landing-logo">SpermRace.io</span>
        <button className="landing-nav-link" onClick={onLeaderboard}>
          Leaderboard
        </button>
      </nav>

      <main className="landing-stage">
        <h1 className="landing-headline">
          <span className="landing-headline-line">16 enter.</span>
          <span className="landing-headline-line is-gold">1 gets paid.</span>
        </h1>

        <div className="landing-card">
          <div className="landing-stakes" role="group" aria-label="Choose your stake">
            {TIERS.map((t, i) => {
              const sol = toSol(t.usd, solPrice);
              return (
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
                  {sol && <span className="stake-sol">{sol}</span>}
                </button>
              );
            })}
          </div>

          <button
            className="landing-cta"
            onClick={handlePrimary}
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
            >
              Try free — no wallet needed
            </button>
          )}
        </div>
      </main>
    </div>
  );
});
