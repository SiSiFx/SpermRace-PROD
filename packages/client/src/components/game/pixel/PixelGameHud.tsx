/**
 * PixelGameHud - Retro pixel art game HUD
 * Container for all in-game UI elements
 */

import { useState, useEffect, memo } from 'react';
import { PixelMinimap } from './PixelMinimap';
import { PixelLeaderboard } from './PixelLeaderboard';
import { PixelKillFeed } from './PixelKillFeed';
import { PixelAbilityBar } from './PixelAbilityBar';
import { PixelZoneIndicator } from './PixelZoneIndicator';
import './PixelGameHud.css';

export interface PixelGameHudProps {
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
    killer: string;
    victim: string;
    time: number;
  }>;
  /** Toggle minimap */
  onToggleMinimap?: () => void;
  /** Toggle leaderboard */
  onToggleLeaderboard?: () => void;
}

export const PixelGameHud = memo(function PixelGameHud({
  rank = 1,
  playerName = 'YOU',
  boostPercent = 100,
  kills = 0,
  aliveCount = 8,
  totalPlayers = 32,
  zoneWarning = false,
  zonePercent = 100,
  showMinimap = true,
  showLeaderboard = false,
  leaderboard,
  killFeed,
  onToggleMinimap,
  onToggleLeaderboard,
}: PixelGameHudProps) {
  const [showMinimapState, setShowMinimapState] = useState(showMinimap);
  const [showLeaderboardState, setShowLeaderboardState] = useState(showLeaderboard);

  useEffect(() => {
    setShowMinimapState(showMinimap);
  }, [showMinimap]);

  useEffect(() => {
    setShowLeaderboardState(showLeaderboard);
  }, [showLeaderboard]);

  // Keyboard shortcuts
  useEffect(() => {
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
  }, [onToggleMinimap, onToggleLeaderboard]);

  return (
    <div className="pixel-game-hud">
      {/* Top bar - Rank, Name, Boost */}
      <div className="pixel-hud-top">
        <div className="pixel-hud-rank crt-text">#{rank}</div>
        <div className="pixel-hud-name">{playerName}</div>
        <div className="pixel-hud-kills">{kills}K</div>
      </div>

      {/* Minimap */}
      {showMinimapState && (
        <PixelMinimap
          className="pixel-hud-minimap"
          zonePercent={zonePercent}
        />
      )}

      {/* Leaderboard overlay */}
      {showLeaderboardState && leaderboard && (
        <PixelLeaderboard
          entries={leaderboard}
          totalPlayers={totalPlayers}
          onClose={() => {
            setShowLeaderboardState(false);
            onToggleLeaderboard?.();
          }}
        />
      )}

      {/* Kill feed */}
      {killFeed && <PixelKillFeed entries={killFeed} />}

      {/* Ability/Boost bar */}
      <PixelAbilityBar
        boostPercent={boostPercent}
        className="pixel-hud-ability"
      />

      {/* Zone warning */}
      {zoneWarning && <PixelZoneIndicator zonePercent={zonePercent} />}

      {/* Alive counter */}
      <div className="pixel-hud-alive">
        <span className="pixel-alive-count">{aliveCount}</span>
        <span className="pixel-alive-total">/{totalPlayers}</span>
      </div>

      {/* HUD hints */}
      <div className="pixel-hud-hints">
        <span className="pixel-hint">TAB=LEADERBOARD</span>
        <span className="pixel-hint">M=MINIMAP</span>
      </div>
    </div>
  );
});

PixelGameHud.displayName = 'PixelGameHud';
