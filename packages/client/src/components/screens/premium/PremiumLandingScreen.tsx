import { memo, useCallback, useEffect, useRef, useState } from 'react';
import './PremiumLandingScreen.css';
import { SpermBackground } from './SpermBackground';

function genRoomCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no 0/O/I/1 confusion
  let code = '';
  for (let i = 0; i < 4; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
}

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
  onFriendsLobby?: (roomCode: string) => void;
  onWallet?: (tier: { usd: number; prize: string }) => void;
  onLeaderboard?: () => void;
  onHelp?: () => void;
  isNewPlayer?: boolean;
}

export const PremiumLandingScreen = memo(function PremiumLandingScreen({
  onPractice,
  onFriendsLobby,
  onWallet,
  onLeaderboard,
}: PremiumLandingScreenProps) {
  const [selected, setSelected] = useState(2); // default: $5
  const tier = TIERS[selected];

  // Friend-room state
  const [friendCode, setFriendCode] = useState<string | null>(() => {
    try {
      const p = new URLSearchParams(window.location.search);
      const c = p.get('room');
      return c && /^[A-Z0-9]{2,6}$/i.test(c) ? c.toUpperCase() : null;
    } catch { return null; }
  });
  const [copied, setCopied] = useState(false);
  const copyTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // If URL had a room code, auto-joining is handled in AppUnified; just show the code.
  const isJoiningExisting = !!friendCode && (() => {
    try { return !!new URLSearchParams(window.location.search).get('room'); } catch { return false; }
  })();

  const handleCreateRoom = useCallback(() => {
    const code = genRoomCode();
    setFriendCode(code);
    onFriendsLobby?.(code);
  }, [onFriendsLobby]);

  const handleCopyLink = useCallback(() => {
    if (!friendCode) return;
    const url = `${window.location.origin}${window.location.pathname}?room=${friendCode}`;
    navigator.clipboard.writeText(url).catch(() => {});
    setCopied(true);
    if (copyTimer.current) clearTimeout(copyTimer.current);
    copyTimer.current = setTimeout(() => setCopied(false), 2000);
  }, [friendCode]);

  useEffect(() => () => { if (copyTimer.current) clearTimeout(copyTimer.current); }, []);

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

          {/* ── Friends lobby ── */}
          <div className="landing-friends">
            {!friendCode ? (
              <button className="landing-friends-btn" onClick={handleCreateRoom}>
                Play with friends
              </button>
            ) : (
              <div className="landing-friends-room">
                <span className="landing-friends-label">
                  {isJoiningExisting ? 'Joining room' : 'Room code'}
                </span>
                <span className="landing-friends-code">{friendCode}</span>
                <button className="landing-friends-copy" onClick={handleCopyLink}>
                  {copied ? 'Copied!' : 'Copy link'}
                </button>
                {!isJoiningExisting && (
                  <span className="landing-friends-hint">Share link — game starts in 30s</span>
                )}
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
});
