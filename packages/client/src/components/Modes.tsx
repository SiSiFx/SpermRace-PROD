import { useEffect, useState } from 'react';
import { useWallet } from '../WalletProvider';
import { useWs } from '../WsProvider';

type ModesProps = {
  onSelect: () => void;
  onClose: () => void;
  onNotify: (msg: string, duration?: number) => void;
  apiBase: string;
};

type Tier = {
  name: string;
  usd: number;
  max: number;
  dur: string;
};

type Preflight = {
  address: string | null;
  sol: number | null;
  configured: boolean;
} | null;

const TIERS: Tier[] = [
  { name: 'Micro Race', usd: 1, max: 16, dur: '2–3 min' },
  { name: 'Nano Race', usd: 5, max: 32, dur: '3–4 min' },
  { name: 'Mega Race', usd: 25, max: 32, dur: '4–6 min' },
  { name: 'Championship', usd: 100, max: 16, dur: '5–8 min' },
];

export default function Modes({ onSelect: _onSelect, onClose, onNotify, apiBase }: ModesProps) {
  const { publicKey, connect } = useWallet();
  const { connectAndJoin, state: wsState } = useWs();
  const [isJoining, setIsJoining] = useState(false);
  const [preflight, setPreflight] = useState<Preflight>(null);
  const [preflightError, setPreflightError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const r = await fetch(`${apiBase}/prize-preflight`);
        if (!r.ok) throw new Error(`preflight ${r.status}`);
        const j = await r.json();
        if (cancelled) return;
        setPreflight(j);
        const misconfigured = !j?.configured || !j?.address || j?.sol == null;
        setPreflightError(!!misconfigured);
      } catch {
        if (!cancelled) setPreflightError(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [apiBase]);

  useEffect(() => {
    if (wsState.phase === 'lobby' || wsState.phase === 'game') setIsJoining(false);
  }, [wsState.phase]);

  const busy = isJoining || wsState.phase === 'connecting' || wsState.phase === 'authenticating';

  return (
    <div className="screen active" id="mode-screen">
      <div
        className="modes-sheet"
        style={{
          background: 'var(--bg-secondary)',
          border: '1px solid var(--border-dim)',
          borderBottom: 'none',
          borderRadius: 20,
          boxShadow: 'var(--shadow-premium)',
        }}
      >
        <div className="sheet-grip" />

        <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
          <div>
            <div style={{ fontSize: 11, letterSpacing: 4, textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 6 }}>
              Tournament Control
            </div>
            <h2
              style={{
                fontSize: 22,
                fontWeight: 700,
                letterSpacing: 2,
                textTransform: 'uppercase',
                color: 'var(--text-primary)',
              }}
            >
              Select Your Run
            </h2>
            <p style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 6 }}>
              Fixed-entry pools, instant on-chain payouts. No noise, just signal.
            </p>
          </div>
          <button
            type="button"
            className="btn-secondary"
            style={{ fontSize: 11, padding: '6px 12px' }}
            onClick={onClose}
          >
            Close
          </button>
        </header>

        {preflightError && (
          <div
            style={{
              borderRadius: 12,
              padding: '10px 12px',
              marginBottom: 16,
              border: '1px solid rgba(255, 46, 85, 0.6)',
              background: 'rgba(255, 46, 85, 0.06)',
              fontSize: 12,
              color: 'var(--text-secondary)',
            }}
          >
            Tournaments are temporarily offline while prize routing is rebalancing.
          </div>
        )}

        <div className="tournament-grid">
          {TIERS.map((tier) => {
            const prizeUsd = (tier.usd * tier.max * 0.85).toFixed(2);
            const disabled =
              busy ||
              preflightError ||
              (!!preflight && (!preflight.configured || !preflight.address || preflight.sol == null));

            return (
              <article
                key={tier.name}
                className="tournament-card"
                style={{
                  position: 'relative',
                  borderRadius: 18,
                  padding: 18,
                  background: 'var(--bg-glass)',
                  border: '1px solid var(--border-dim)',
                  boxShadow: 'var(--shadow-premium)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 14,
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div
                      style={{
                        fontSize: 11,
                        letterSpacing: 3,
                        textTransform: 'uppercase',
                        color: 'var(--text-muted)',
                        marginBottom: 4,
                      }}
                    >
                      {tier.max}-PLAYER POOL
                    </div>
                    <div
                      style={{
                        fontSize: 18,
                        fontWeight: 700,
                        letterSpacing: 1,
                        textTransform: 'uppercase',
                        color: 'var(--text-primary)',
                      }}
                    >
                      {tier.name}
                    </div>
                  </div>
                  <div
                    style={{
                      minWidth: 96,
                      textAlign: 'right',
                      fontFamily: '"JetBrains Mono", ui-monospace, SFMono-Regular, Menlo, monospace',
                      fontSize: 11,
                      color: 'var(--text-secondary)',
                    }}
                  >
                    <div style={{ opacity: 0.8 }}>Entry</div>
                    <div style={{ fontSize: 14, color: 'var(--accent)' }}>${tier.usd.toFixed(2)}</div>
                  </div>
                </div>

                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '10px 12px',
                    borderRadius: 12,
                    border: '1px solid var(--border-dim)',
                    background: 'rgba(255,255,255,0.01)',
                  }}
                >
                  <div>
                    <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: 2, color: 'var(--text-muted)' }}>
                      Max Payout
                    </div>
                    <div
                      style={{
                        fontSize: 20,
                        fontWeight: 700,
                        letterSpacing: 1,
                        color: 'var(--primary)',
                      }}
                    >
                      ${prizeUsd}
                    </div>
                  </div>
                  <div style={{ textAlign: 'right', fontSize: 11, color: 'var(--text-secondary)' }}>
                    <div>{tier.dur}</div>
                    <div style={{ opacity: 0.75 }}>85% to prize pool</div>
                  </div>
                </div>

                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    fontSize: 11,
                    color: 'var(--text-muted)',
                  }}
                >
                  <div>
                    <span style={{ opacity: 0.8 }}>Status:</span>{' '}
                    <span style={{ color: disabled ? 'var(--danger)' : 'var(--accent)' }}>
                      {disabled ? 'Locked' : 'Armed'}
                    </span>
                  </div>
                  <div style={{ fontFamily: '"JetBrains Mono", ui-monospace, SFMono-Regular, Menlo, monospace' }}>
                    x{tier.max} slots
                  </div>
                </div>

                <button
                  type="button"
                  disabled={disabled}
                  className="cta-primary"
                  style={{
                    width: '100%',
                    marginTop: 4,
                    fontSize: 13,
                    padding: '12px 18px',
                    background: disabled ? 'var(--text-muted)' : 'var(--primary)',
                    color: disabled ? 'var(--bg-primary)' : '#000',
                    boxShadow: disabled ? 'none' : 'var(--glow-subtle)',
                  }}
                  onClick={async () => {
                    setIsJoining(true);
                    const ok = publicKey ? true : await connect();
                    if (!ok) {
                      setIsJoining(false);
                      onNotify('Wallet not detected. Please install or unlock your wallet.');
                      return;
                    }
                    await connectAndJoin({ entryFeeTier: tier.usd as any, mode: 'tournament' });
                  }}
                >
                  {preflightError
                    ? 'Service unavailable'
                    : (preflight && (!preflight.configured || !preflight.address || preflight.sol == null))
                    ? 'Temporarily unavailable'
                    : busy
                    ? 'Joining…'
                    : publicKey
                    ? 'Enter Tournament'
                    : 'Connect & Join'}
                </button>
              </article>
            );
          })}
        </div>

        <div className="mode-footer" style={{ marginTop: 18 }}>
          <button className="btn-secondary" onClick={onClose}>
            Back to landing
          </button>
        </div>
      </div>
    </div>
  );
}
