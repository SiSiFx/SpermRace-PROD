/**
 * PlayerCard - Brutal Bet Style
 * An animated data card displaying player information
 * Black/white/red/yellow, thick borders, offset shadows, bold uppercase
 */

import React, { memo, useMemo } from 'react';

interface PlayerCardProps {
  playerId: string;
  playerName: string;
  isMe: boolean;
  isReady?: boolean;
  index?: number;
  playerColor?: string;
}

/**
 * PlayerCard - Brutalist styled player information card
 * Memoized to prevent unnecessary re-renders when rendered in lists
 */
export const PlayerCard = memo(function PlayerCard({
  playerId,
  playerName,
  isMe,
  isReady = true,
  index = 0,
  playerColor = '#00F0FF',
}: PlayerCardProps) {
  const isBot = playerId.startsWith('BOT_') || playerId.startsWith('guest-');

  // Generate deterministic animation delay based on index (memoized)
  const animationDelay = useMemo(() => `${index * 0.08}s`, [index]);

  // Extract initials for avatar (memoized)
  const initials = useMemo((): string => {
    if (isBot) return '🤖';
    const parts = playerName.toUpperCase().split(' ');
    if (parts.length >= 2) {
      return (parts[0][0] + parts[parts.length - 1][0]).slice(0, 2);
    }
    return playerName.slice(0, 2).toUpperCase();
  }, [isBot, playerName]);

  // Generate a consistent color based on player ID (memoized)
  const avatarColor = useMemo((): string => {
    if (isBot) return '#8A8A9B';
    if (playerColor && playerColor !== '#00F0FF') return playerColor;

    // Generate color from ID hash
    let hash = 0;
    for (let i = 0; i < playerId.length; i++) {
      hash = playerId.charCodeAt(i) + ((hash << 5) - hash);
    }
    const hue = Math.abs(hash % 360);
    return `hsl(${hue}, 70%, 60%)`;
  }, [isBot, playerColor, playerId]);

  return (
    <div
      className="player-card"
      style={{
        '--animation-delay': animationDelay,
        '--player-color': avatarColor,
      } as React.CSSProperties}
      role="listitem"
      aria-label={`${playerName}, ${isReady ? 'ready' : 'waiting'}${isMe ? ', you' : ''}${isBot ? ', bot player' : ''}`}
    >
      {/* Animated border effect */}
      <div className="player-card-border" />

      {/* Card content */}
      <div className="player-card-content">
        {/* Avatar section */}
        <div className="player-card-avatar">
          <div className="player-avatar-circle">
            <span className="player-avatar-text">{initials}</span>
          </div>
          {/* Status indicator dot */}
          <div className={`player-status-dot ${isReady ? 'ready' : 'waiting'} ${isMe ? 'me' : ''}`} />
        </div>

        {/* Player info section */}
        <div className="player-card-info">
          <div className="player-name-row">
            <span className="player-name">{playerName}</span>
            {isMe && (
              <span className="player-badge player-badge-me">YOU</span>
            )}
            {isBot && !isMe && (
              <span className="player-badge player-badge-bot">BOT</span>
            )}
          </div>

          {/* Stats row */}
          <div className="player-stats-row">
            <div className="player-stat">
              <span className="stat-label">STATUS</span>
              <span className={`stat-value ${isReady ? 'ready' : 'waiting'}`}>
                {isReady ? 'READY' : 'WAITING'}
              </span>
            </div>
          </div>
        </div>

        {/* Animated corner accents */}
        <div className="corner-accent corner-tl" />
        <div className="corner-accent corner-tr" />
        <div className="corner-accent corner-bl" />
        <div className="corner-accent corner-br" />
      </div>

      {/* Scanning line animation */}
      <div className="player-card-scan" />
    </div>
  );
});

export default PlayerCard;
