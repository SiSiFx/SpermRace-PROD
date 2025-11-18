export type ModeKey = 'warmup' | 'blitz' | 'apex' | 'grand';

type ModesProps = {
  onModeSelect?: (mode: ModeKey) => void;
};

type ModeCard = {
  key: ModeKey;
  name: string;
  entry: string;
  prize: string;
  description: string;
};

const MODE_CARDS: ModeCard[] = [
  {
    key: 'warmup',
    name: 'Warmup',
    entry: '$0.00',
    prize: 'Practice only',
    description: 'No stakes. Learn the drift, feel the arena.',
  },
  {
    key: 'blitz',
    name: 'Blitz',
    entry: '$1.00',
    prize: 'Micro prize pool',
    description: 'Short rounds, fast matches, high turnover.',
  },
  {
    key: 'apex',
    name: 'Apex',
    entry: '$5.00',
    prize: 'Mid-tier pool',
    description: 'Sweat lobby. Aggressive players only.',
  },
  {
    key: 'grand',
    name: 'Grand',
    entry: '$25.00+',
    prize: 'High-roller pool',
    description: 'Single mistake, permanent exit.',
  },
];

export default function Modes({ onModeSelect }: ModesProps) {
  return (
    <div
      className="mode-grid"
      style={{
        maxWidth: 960,
        margin: '32px auto 24px',
      }}
    >
      {MODE_CARDS.map((mode) => (
        <button
          key={mode.key}
          type="button"
          className="mode-card"
          style={{
            background: 'transparent',
            borderRadius: 16,
            border: '1px solid rgba(255,255,255,0.1)',
            padding: '18px 18px',
            cursor: 'pointer',
            textAlign: 'left',
            boxShadow: 'none',
            transition: 'border-color 0.15s ease, background-color 0.15s ease',
          }}
          onClick={() => onModeSelect?.(mode.key)}
          onMouseEnter={(e) => {
            e.currentTarget.style.borderColor = 'rgba(255,255,255,0.6)';
            e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.02)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)';
            e.currentTarget.style.backgroundColor = 'transparent';
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <div>
              <div
                style={{
                  fontSize: 12,
                  letterSpacing: 4,
                  textTransform: 'uppercase',
                  color: 'var(--text-muted)',
                  marginBottom: 6,
                }}
              >
                {mode.name}
              </div>
              <div
                style={{
                  fontSize: 20,
                  fontWeight: 700,
                  color: 'var(--text-primary)',
                  letterSpacing: 1,
                }}
              >
                {mode.description}
              </div>
            </div>
          </div>

          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginTop: 12,
              fontFamily: '"JetBrains Mono", ui-monospace, SFMono-Regular, Menlo, monospace',
              fontSize: 11,
              color: 'var(--text-secondary)',
            }}
          >
            <div>
              <div style={{ opacity: 0.7 }}>Entry Fee</div>
              <div style={{ color: 'var(--primary)', marginTop: 2 }}>{mode.entry}</div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ opacity: 0.7 }}>Prize Pool</div>
              <div style={{ color: 'var(--primary)', marginTop: 2 }}>{mode.prize}</div>
            </div>
          </div>
        </button>
      ))}
    </div>
  );
}
