import { useState, useEffect } from 'react';

interface LeaderboardEntry {
  wallet_address: string;
  username: string | null;
  metric_value: number;
  total_games: number;
  rank?: number;
}

interface LeaderboardData {
  leaderboard: LeaderboardEntry[];
  type: string;
  count: number;
}

interface GlobalStats {
  totalGames: number;
  totalPlayers: number;
  totalPrizes: number;
}

type LeaderboardType = 'wins' | 'earnings';

interface LeaderboardProps {
  onClose: () => void;
  apiBase?: string;
  myWallet?: string | null;
  isMobile?: boolean;
}

export function Leaderboard({ onClose, apiBase = '/api', myWallet, isMobile = false }: LeaderboardProps) {
  const [activeTab, setActiveTab] = useState<LeaderboardType>('wins');
  const [data, setData] = useState<LeaderboardEntry[]>([]);
  const [stats, setStats] = useState<GlobalStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadLeaderboard(activeTab);
    loadStats();
  }, [activeTab]);

  const loadLeaderboard = async (type: LeaderboardType) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${apiBase}/leaderboard/${type}`);
      if (!res.ok) throw new Error('Failed to load leaderboard');
      const json: LeaderboardData = await res.json();
      setData(json.leaderboard);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  };

  const loadStats = async () => {
    try {
      const res = await fetch(`${apiBase}/stats`);
      if (!res.ok) return;
      const json: GlobalStats = await res.json();
      setStats(json);
    } catch (e) {
      console.error('Failed to load stats:', e);
    }
  };

  const formatWallet = (wallet: string) => {
    return wallet.slice(0, 4) + '...' + wallet.slice(-4);
  };

  const formatValue = (value: number, type: LeaderboardType) => {
    if (type === 'earnings') {
      const sol = value / 1_000_000_000;
      return sol.toFixed(4) + ' SOL';
    }
    return value.toString();
  };

  const getMetricLabel = (type: LeaderboardType) => {
    switch (type) {
      case 'wins': return 'Wins';
      case 'earnings': return 'Total Earned';
    }
  };

  const myRank = myWallet ? data.findIndex(e => e.wallet_address === myWallet) + 1 : 0;

  return (
    <div className={`leaderboard-overlay ${isMobile ? 'mobile' : ''}`}>
      <div className={`leaderboard-modal ${isMobile ? 'mobile' : ''}`}>
        {/* Header */}
        <div className="leaderboard-header">
          <h2>Leaderboard</h2>
          <button className="close-btn" onClick={onClose}>✕</button>
        </div>

        {/* Stats Bar */}
        {stats && (
          <div className="leaderboard-stats">
            <div className="stat-item">
              <span className="stat-value">{stats.totalGames}</span>
              <span className="stat-label">Games</span>
            </div>
            <div className="stat-item">
              <span className="stat-value">{stats.totalPlayers}</span>
              <span className="stat-label">Players</span>
            </div>
            <div className="stat-item">
              <span className="stat-value">{(stats.totalPrizes / 1_000_000_000).toFixed(3)}</span>
              <span className="stat-label">SOL Awarded</span>
            </div>
          </div>
        )}

        {/* My Rank */}
        {myRank > 0 && (
          <div className="my-rank">
            Your Rank: <strong>#{myRank}</strong> in {getMetricLabel(activeTab)}
          </div>
        )}

        {/* Tabs */}
        <div className="leaderboard-tabs">
          <button
            className={`tab ${activeTab === 'wins' ? 'active' : ''}`}
            onClick={() => setActiveTab('wins')}
          >
            Most Wins
          </button>
          <button
            className={`tab ${activeTab === 'earnings' ? 'active' : ''}`}
            onClick={() => setActiveTab('earnings')}
          >
            Top Earners
          </button>
        </div>

        {/* Content */}
        <div className="leaderboard-content">
          {loading && (
            <div className="loading-state">Loading...</div>
          )}

          {error && (
            <div className="error-state">
              <p>{error}</p>
              <button onClick={() => loadLeaderboard(activeTab)}>Retry</button>
            </div>
          )}

          {!loading && !error && data.length === 0 && (
            <div className="empty-state">
              <p>No games played yet.</p>
              <p style={{ fontSize: '14px', opacity: 0.7 }}>Be the first to win and claim the top spot!</p>
            </div>
          )}

          {!loading && !error && data.length > 0 && (
            <div className="leaderboard-list">
              {data.map((entry, index) => {
                const isMe = myWallet && entry.wallet_address === myWallet;
                return (
                  <div
                    key={entry.wallet_address}
                    className={`leaderboard-entry ${isMe ? 'me' : ''} ${index < 3 ? `top-${index + 1}` : ''}`}
                  >
                    <div className="rank">{`#${index + 1}`}</div>
                    <div className="player">
                      <div className="wallet">
                        {entry.username || formatWallet(entry.wallet_address)}
                        {isMe && <span className="you-badge">YOU</span>}
                      </div>
                      <div className="games">{entry.total_games} games</div>
                    </div>
                    <div className="value">
                      {formatValue(entry.metric_value, activeTab)}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="leaderboard-footer">
          <button className="btn-secondary" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
