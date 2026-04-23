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
  { name: '$1',    usd: 1,   prize: '$10',   players: 10  },
  { name: '$5',    usd: 5,   prize: '$50',   players: 10, recommended: true },
  { name: '$25',   usd: 25,  prize: '$250',  players: 10  },
  { name: '$100',  usd: 100, prize: '$1000', players: 10  },
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

// ── Entry Preview Modal ──────────────────────────────────────────────────────
function EntryModal({
  tier,
  onConfirm,
  onPractice,
  onClose,
}: {
  tier: Tier;
  onConfirm: () => void;
  onPractice: () => void;
  onClose: () => void;
}) {
  const pool = `$${tier.usd * tier.players}`;
  const winnerShare = Math.round(tier.usd * tier.players * 0.85);

  return (
    <div className="entry-modal-backdrop" onClick={onClose} role="dialog" aria-modal="true">
      <div className="entry-modal" onClick={e => e.stopPropagation()}>

        <button className="entry-modal-close" onClick={onClose} aria-label="Close">✕</button>

        {/* Room badge */}
        <div className="entry-modal-badge">{tier.name} ROOM</div>

        {/* Hero payout */}
        <div className="entry-modal-hero">
          <span className="entry-modal-multiplier">10×</span>
          <div className="entry-modal-win">
            <span className="entry-modal-win-label">TOP PRIZE</span>
            <span className="entry-modal-win-amount">{tier.prize}</span>
          </div>
        </div>

        <p className="entry-modal-tagline">Winner takes everything. Last cell alive.</p>

        {/* Stats strip */}
        <div className="entry-modal-stats">
          <div className="entry-modal-stat">
            <span className="entry-modal-stat-value">{tier.name}</span>
            <span className="entry-modal-stat-label">Entry</span>
          </div>
          <div className="entry-modal-stat-divider" />
          <div className="entry-modal-stat">
            <span className="entry-modal-stat-value">{pool}</span>
            <span className="entry-modal-stat-label">Prize pool</span>
          </div>
          <div className="entry-modal-stat-divider" />
          <div className="entry-modal-stat">
            <span className="entry-modal-stat-value">${winnerShare}</span>
            <span className="entry-modal-stat-label">To winner</span>
          </div>
          <div className="entry-modal-stat-divider" />
          <div className="entry-modal-stat">
            <span className="entry-modal-stat-value">{tier.players}</span>
            <span className="entry-modal-stat-label">Players</span>
          </div>
        </div>

        {/* Trust signals */}
        <ul className="entry-modal-trust">
          <li>Winner paid instantly — on-chain SOL transfer</li>
          <li>Server-authoritative — no client cheating possible</li>
          <li>85% of pool goes to winner · 15% platform fee</li>
        </ul>

        {/* Actions */}
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
  onPractice,
  onWallet,
  onLeaderboard,
  isPracticeConnecting,
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
          onConfirm={handleConfirmEntry}
          onPractice={handlePractice}
          onClose={() => setModalTier(null)}
        />
      )}

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
