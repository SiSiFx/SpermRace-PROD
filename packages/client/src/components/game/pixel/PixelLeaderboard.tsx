/**
 * PixelLeaderboard - Retro high score style leaderboard
 * Pixel-bordered overlay showing player rankings
 */

import { memo } from 'react';
import { X } from 'phosphor-react';
import './PixelLeaderboard.css';

export interface PixelLeaderboardEntry {
  id: string;
  name: string;
  kills: number;
  isAlive: boolean;
  isPlayer: boolean;
  rank?: number;
}

export interface PixelLeaderboardProps {
  entries: PixelLeaderboardEntry[];
  totalPlayers: number;
  onClose?: () => void;
}

export const PixelLeaderboard = memo(function PixelLeaderboard({
  entries,
  totalPlayers,
  onClose,
}: PixelLeaderboardProps) {
  // Sort entries: player first, then alive, then by kills
  const sortedEntries = [...entries].sort((a, b) => {
    if (a.isPlayer && !b.isPlayer) return -1;
    if (!a.isPlayer && b.isPlayer) return 1;

    if (a.isAlive && !b.isAlive) return -1;
    if (!a.isAlive && b.isAlive) return 1;

    return b.kills - a.kills;
  });

  const aliveCount = entries.filter(e => e.isAlive).length;

  const getOrdinal = (n: number): string => {
    if (!n) return '-';
    const s = ['th', 'st', 'nd', 'rd'];
    const v = n % 100;
    return n + (s[(v - 20) % 10] || s[v] || s[0]);
  };

  return (
    <div className="pixel-leaderboard-overlay" onClick={onClose}>
      <div className="pixel-leaderboard" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="pixel-leaderboard-header">
          <h2 className="pixel-leaderboard-title crt-text">HIGH SCORES</h2>
          <button
            className="pixel-leaderboard-close"
            onClick={onClose}
            aria-label="Close leaderboard"
          >
            <X size={16} weight="bold" />
          </button>
        </div>

        {/* Stats bar */}
        <div className="pixel-leaderboard-stats">
          <span>ALIVE: {aliveCount}/{totalPlayers}</span>
        </div>

        {/* Header row */}
        <div className="pixel-leaderboard-row pixel-leaderboard-header-row">
          <span className="pixel-lb-rank">#</span>
          <span className="pixel-lb-name">PLAYER</span>
          <span className="pixel-lb-kills">KILLS</span>
        </div>

        {/* Entry rows */}
        <div className="pixel-leaderboard-list">
          {sortedEntries.map((entry, index) => (
            <div
              key={entry.id}
              className={`pixel-leaderboard-row ${entry.isPlayer ? 'pixel-lb-me' : ''} ${!entry.isAlive ? 'pixel-lb-dead' : ''}`}
            >
              <span className="pixel-lb-rank">
                {entry.rank || getOrdinal(index + 1)}
              </span>
              <span className="pixel-lb-name">{entry.name}</span>
              <span className="pixel-lb-kills">{entry.kills}</span>
              {!entry.isAlive && entry.rank && (
                <span className="pixel-lb-placement">#{entry.rank}</span>
              )}
            </div>
          ))}
        </div>

        {/* Footer hint */}
        <div className="pixel-leaderboard-footer">
          Press TAB to close
        </div>
      </div>
    </div>
  );
});

PixelLeaderboard.displayName = 'PixelLeaderboard';
