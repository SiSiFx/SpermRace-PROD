import React from 'react';

interface PlayerCardProps {
  playerId: string;
  playerName: string;
  isMe: boolean;
  isReady?: boolean;
  index?: number;
  playerColor?: string;
}

/**
 * PlayerCard - An animated data card displaying player information
 *
 * Features:
 * - Animated entrance with staggered delays
 * - Hover effects with lift and glow
 * - Status indicators (you, ready, bot)
 * - Player color preview
 * - Responsive design
 */
export const PlayerCard: React.FC<PlayerCardProps> = ({
  playerId,
  playerName,
  isMe,
  isReady = true,
  index = 0,
  playerColor = '#00F0FF',
}) => {
  const isBot = playerId.startsWith('BOT_') || playerId.startsWith('guest-');

  // Generate deterministic animation delay based on index
  const animationDelay = `${index * 0.08}s`;

  // Extract initials for avatar
  const getInitials = (name: string): string => {
    if (isBot) return '🤖';
    const parts = name.toUpperCase().split(' ');
    if (parts.length >= 2) {
      return (parts[0][0] + parts[parts.length - 1][0]).slice(0, 2);
    }
    return name.slice(0, 2).toUpperCase();
  };

  // Generate a consistent color based on player ID
  const getPlayerColor = (id: string): string => {
    if (isBot) return '#8A8A9B';
    if (playerColor && playerColor !== '#00F0FF') return playerColor;

    // Generate color from ID hash
    let hash = 0;
    for (let i = 0; i < id.length; i++) {
      hash = id.charCodeAt(i) + ((hash << 5) - hash);
    }
    const hue = Math.abs(hash % 360);
    return `hsl(${hue}, 70%, 60%)`;
  };

  const avatarColor = getPlayerColor(playerId);

  return (
    <div
      className="player-card"
      style={{
        '--animation-delay': animationDelay,
        '--player-color': avatarColor,
      } as React.CSSProperties}
    >
      {/* Animated border effect */}
      <div className="player-card-border" />

      {/* Card content */}
      <div className="player-card-content">
        {/* Avatar section */}
        <div className="player-card-avatar">
          <div
            className="player-avatar-circle"
            style={{
              background: `linear-gradient(135deg, ${avatarColor}22, ${avatarColor}44)`,
              borderColor: avatarColor,
            }}
          >
            <span className="player-avatar-text">{getInitials(playerName)}</span>
          </div>
          {/* Status indicator dot */}
          <div
            className={`player-status-dot ${isReady ? 'ready' : 'waiting'} ${
              isMe ? 'me' : ''
            }`}
            style={{
              backgroundColor: isReady ? avatarColor : '#8A8A9B',
            }}
          />
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
              <span className="stat-label">Status</span>
              <span
                className={`stat-value ${isReady ? 'ready' : 'waiting'}`}
                style={{ color: isReady ? avatarColor : '#8A8A9B' }}
              >
                {isReady ? 'Ready' : 'Waiting'}
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
};

export default PlayerCard;
