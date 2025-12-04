import { AnimatedCounter } from './AnimatedCounter';

interface StatsGridProps {
  totalGames: number;
  winRate: string;
  totalKills: number;
  variant?: 'default' | 'mobile' | 'pc';
}

export function StatsGrid({ totalGames, winRate, totalKills, variant = 'default' }: StatsGridProps) {
  if (totalGames === 0) return null;

  const isMobile = variant === 'mobile';
  const isPC = variant === 'pc';

  if (isPC) {
    return (
      <section style={{ marginTop: 32 }}>
        <div className="pc-stats-grid">
          <div className="pc-stat-card">
            <div className="stat-label">Practice Games</div>
            <div className="stat-value">
              <AnimatedCounter value={totalGames} duration={1000} />
            </div>
          </div>
          <div className="pc-stat-card highlight">
            <div className="stat-label">Practice Win%</div>
            <div className="stat-value">
              <AnimatedCounter value={parseFloat(winRate)} duration={1200} decimals={1} suffix="%" />
            </div>
          </div>
          <div className="pc-stat-card">
            <div className="stat-label">Practice Kills</div>
            <div className="stat-value">
              <AnimatedCounter value={totalKills} duration={1400} />
            </div>
          </div>
        </div>
      </section>
    );
  }

  if (isMobile) {
    return (
      <div
        style={{
          marginTop: 10,
          display: 'flex',
          justifyContent: 'center',
        }}
      >
        <div
          style={{
            padding: '10px 12px',
            borderRadius: 12,
            background: 'rgba(15,23,42,0.9)',
            border: '1px solid rgba(148,163,184,0.45)',
            display: 'flex',
            gap: 10,
            minWidth: 0,
          }}
        >
          <div className="mobile-stat">
            <div className="label">Practice Games</div>
            <div className="value">
              <AnimatedCounter value={totalGames} duration={1000} />
            </div>
          </div>
          <div className="mobile-stat">
            <div className="label">Practice Win%</div>
            <div className="value">
              <AnimatedCounter value={parseFloat(winRate)} duration={1200} decimals={1} suffix="%" />
            </div>
          </div>
          <div className="mobile-stat">
            <div className="label">Practice Kills</div>
            <div className="value">
              <AnimatedCounter value={totalKills} duration={1400} />
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Default variant
  return (
    <div
      style={{
        marginTop: 16,
        display: 'flex',
        justifyContent: 'center',
        gap: 16,
        flexWrap: 'wrap',
      }}
    >
      <div className="stat-card">
        <div className="stat-label">Practice Games</div>
        <div className="stat-value">
          <AnimatedCounter value={totalGames} duration={1000} />
        </div>
      </div>
      <div className="stat-card">
        <div className="stat-label">Win Rate</div>
        <div className="stat-value">
          <AnimatedCounter value={parseFloat(winRate)} duration={1200} decimals={1} suffix="%" />
        </div>
      </div>
      <div className="stat-card">
        <div className="stat-label">Total Kills</div>
        <div className="stat-value">
          <AnimatedCounter value={totalKills} duration={1400} />
        </div>
      </div>
    </div>
  );
}

export default StatsGrid;
