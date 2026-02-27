/**
 * PremiumGameHud - Dark Casino Style Game HUD
 * Container for all in-game UI elements with glass morphism aesthetic
 */

import { useState, useEffect, memo } from 'react';
import { PremiumMinimap } from './PremiumMinimap';
import { PremiumLeaderboard } from './PremiumLeaderboard';
import { PremiumKillFeed } from './PremiumKillFeed';
import { PremiumAbilityBar } from './PremiumAbilityBar';
import { PremiumZoneIndicator } from './PremiumZoneIndicator';
import './PremiumGameHud.css';

export interface PremiumGameHudProps {
  /** Player rank */
  rank?: number;
  /** Player name */
  playerName?: string;
  /** Boost percentage (0-100) */
  boostPercent?: number;
  /** Kill count */
  kills?: number;
  /** Alive player count */
  aliveCount?: number;
  /** Total players */
  totalPlayers?: number;
  /** Zone shrinking warning */
  zoneWarning?: boolean;
  /** Zone percentage (0-100) */
  zonePercent?: number;
  /** Zone time remaining in seconds */
  zoneTimeRemaining?: number;
  /** Show minimap */
  showMinimap?: boolean;
  /** Show leaderboard */
  showLeaderboard?: boolean;
  /** Leaderboard entries */
  leaderboard?: Array<{
    id: string;
    name: string;
    kills: number;
    isAlive: boolean;
    isPlayer: boolean;
    rank?: number;
  }>;
  /** Kill feed entries */
  killFeed?: Array<{
    id: string;
    killer: string;
    victim: string;
    killerColor?: number;
    victimColor?: number;
    ownTrail?: boolean;
    time: number;
  }>;
  /** Toggle minimap */
  onToggleMinimap?: () => void;
  /** Toggle leaderboard */
  onToggleLeaderboard?: () => void;
  /** Is mobile view */
  isMobile?: boolean;
}

export const PremiumGameHud = memo(function PremiumGameHud({
  rank = 1,
  playerName = 'YOU',
  boostPercent = 100,
  kills = 0,
  aliveCount = 8,
  totalPlayers = 32,
  zoneWarning = false,
  zonePercent = 100,
  zoneTimeRemaining,
  showMinimap = true,
  showLeaderboard = false,
  leaderboard,
  killFeed,
  onToggleMinimap,
  onToggleLeaderboard,
  isMobile = false,
}: PremiumGameHudProps) {
  const [showMinimapState, setShowMinimapState] = useState(showMinimap);
  const [showLeaderboardState, setShowLeaderboardState] = useState(showLeaderboard);

  useEffect(() => {
    setShowMinimapState(showMinimap);
  }, [showMinimap]);

  useEffect(() => {
    setShowLeaderboardState(showLeaderboard);
  }, [showLeaderboard]);

  // Keyboard shortcuts (desktop only)
  useEffect(() => {
    if (isMobile) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Tab') {
        e.preventDefault();
        setShowLeaderboardState(prev => !prev);
        onToggleLeaderboard?.();
      }
      if (e.key === 'm' || e.key === 'M') {
        setShowMinimapState(prev => !prev);
        onToggleMinimap?.();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isMobile, onToggleMinimap, onToggleLeaderboard]);

  // Urgency level for alive counter
  const aliveRatio = aliveCount / totalPlayers;
  const urgencyLevel = aliveRatio <= 0.15 ? 'danger' : aliveRatio <= 0.35 ? 'warning' : 'safe';

  return (
    <div className={`premium-game-hud ${isMobile ? 'is-mobile' : ''}`}>
      {/* Top bar - Rank, Name, Kills */}
      <div className="premium-hud-top">
        <div className="premium-hud-rank-badge">
          <span className="premium-rank-hash">#</span>
          <span className="premium-rank-number">{rank}</span>
        </div>
        <div className="premium-hud-divider" />
        <div className="premium-hud-name">{playerName}</div>
        <div className="premium-hud-divider" />
        <div className="premium-hud-kills">
          <span className="premium-kills-count">{kills}</span>
          <span className="premium-kills-label">KILLS</span>
        </div>
      </div>

      {/* Alive counter - Top right */}
      <div className={`premium-hud-alive ${urgencyLevel}`}>
        <span className="premium-alive-count">{aliveCount}</span>
        <span className="premium-alive-divider">/</span>
        <span className="premium-alive-total">{totalPlayers}</span>
        <span className="premium-alive-label">ALIVE</span>
      </div>

      {/* Minimap */}
      {showMinimapState && (
        <PremiumMinimap
          className="premium-hud-minimap"
          zonePercent={zonePercent}
        />
      )}

      {/* Leaderboard overlay */}
      {showLeaderboardState && leaderboard && (
        <PremiumLeaderboard
          entries={leaderboard}
          totalPlayers={totalPlayers}
          currentPlayerId={playerName}
          onClose={() => {
            setShowLeaderboardState(false);
            onToggleLeaderboard?.();
          }}
        />
      )}

      {/* Kill feed */}
      {killFeed && <PremiumKillFeed entries={killFeed} isMobile={isMobile} />}

      {/* Zone warning */}
      {zoneWarning && (
        <PremiumZoneIndicator
          zonePercent={zonePercent}
          timeRemaining={zoneTimeRemaining}
        />
      )}

      {/* Ability/Boost bar */}
      <PremiumAbilityBar
        boostPercent={boostPercent}
        className="premium-hud-ability"
      />

      {/* HUD hints - Desktop only */}
      {!isMobile && (
        <div className="premium-hud-hints">
          <span className="premium-hint">
            <kbd>TAB</kbd> Leaderboard
          </span>
          <span className="premium-hint">
            <kbd>M</kbd> Minimap
          </span>
        </div>
      )}
    </div>
  );
});

PremiumGameHud.displayName = 'PremiumGameHud';
