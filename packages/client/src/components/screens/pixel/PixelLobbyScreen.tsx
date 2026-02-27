/**
 * PixelLobbyScreen - Retro pixel art lobby
 * 16x16 pixel sprite avatars, countdown timer, player slot grid
 */

import { useState, useEffect, memo } from 'react';
import { Atom, Users, Trophy, ArrowLeft, Clock } from 'phosphor-react';
import { PixelButton, PixelCard, PixelBadge } from '../../ui/pixel';
import { useWs } from '../../../WsProvider';
import './PixelLobbyScreen.css';

export interface PixelLobbyScreenProps {
  onStart?: () => void;
  onBack: () => void;
}

interface PlayerSlot {
  id: string;
  name: string;
  isMe: boolean;
  isBot: boolean;
  color?: string;
}

export const PixelLobbyScreen = memo(function PixelLobbyScreen({
  onStart,
  onBack,
}: PixelLobbyScreenProps) {
  const { state } = useWs();
  const players = state.lobby?.players || [];
  const realPlayers = players.filter((p: string) => !String(p).startsWith('BOT_'));
  const winnerPayoutUsd = state.lobby
    ? Math.max(0, Math.floor((state.lobby.entryFee as number) * 10))
    : 0;
  const lobbyMode = (state.lobby as any)?.mode as ('practice' | 'tournament' | undefined);
  const practiceMissingPlayers = lobbyMode === 'practice' ? Math.max(0, 2 - realPlayers.length) : 0;

  const maxPlayers = state.lobby?.maxPlayers ?? 32;
  const countdown = state.countdown?.remaining ?? 0;
  const playersNeeded = Math.max(0, maxPlayers - players.length);

  // Build player slots
  const [playerSlots, setPlayerSlots] = useState<PlayerSlot[]>([]);

  useEffect(() => {
    const slots: PlayerSlot[] = players.map((pid: string, index: number) => {
      const isMe = pid === state.playerId;
      const isBot = typeof pid === 'string' && pid.startsWith('BOT_');
      const name = state.lobby?.playerNames?.[pid] ||
        (typeof pid === 'string' && pid.startsWith('guest-') ? 'Guest' :
          (typeof pid === 'string' && pid.length >= 8 ? `${pid.slice(0, 4)}…${pid.slice(-4)}` : pid));
      return {
        id: pid,
        name,
        isMe,
        isBot,
        color: `hsl(${(index * 37) % 360}, 70%, 60%)`,
      };
    });

    // Add empty slots
    const emptyCount = Math.min(playersNeeded, 16);
    for (let i = 0; i < emptyCount; i++) {
      slots.push({
        id: `empty-${i}`,
        name: 'WAITING…',
        isMe: false,
        isBot: false,
      });
    }

    setPlayerSlots(slots.slice(0, 16));
  }, [players, playersNeeded, state.playerId, state.lobby?.playerNames]);

  const canStart = lobbyMode === 'practice' ? realPlayers.length >= 2 : players.length >= 2;

  return (
    <div className="pixel-lobby-screen">
      {/* Pixel grid background */}
      <div className="pixel-grid-bg" aria-hidden="true" />

      <div className="pixel-lobby-content">
        {/* Header */}
        <header className="pixel-lobby-header">
          <PixelButton
            variant="secondary"
            size="sm"
            onClick={onBack}
            className="pixel-back-btn"
          >
            <ArrowLeft size={16} weight="bold" />
            BACK
          </PixelButton>

          {/* Mode badge */}
          {lobbyMode && (
            <PixelBadge
              variant={lobbyMode === 'tournament' ? 'primary' : 'success'}
              size="md"
              className="pixel-mode-badge"
            >
              {lobbyMode === 'tournament' ? (
                <>
                  <Trophy size={14} weight="fill" />
                  <span>TOURNAMENT</span>
                </>
              ) : (
                <>
                  <Users size={14} weight="fill" />
                  <span>PRACTICE</span>
                </>
              )}
            </PixelBadge>
          )}
        </header>

        {/* Title */}
        <div className="pixel-lobby-title">
          <div className="pixel-lobby-icon">
            <Atom size={32} weight="duotone" />
          </div>
          <h1 className="pixel-title crt-text">LOBBY</h1>
        </div>

        {/* Stats bar */}
        <PixelCard variant="dark" padding="sm" className="pixel-lobby-stats">
          <div className="pixel-lobby-stat">
            <span className="pixel-stat-label">PLAYERS</span>
            <span className="pixel-stat-value">{players.length}/{maxPlayers}</span>
          </div>
          <div className="pixel-lobby-divider" />
          {lobbyMode === 'tournament' && (
            <>
              <div className="pixel-lobby-stat">
                <span className="pixel-stat-label">PAYOUT</span>
                <span className="pixel-stat-value pixel-stat-prize">${winnerPayoutUsd}</span>
              </div>
              <div className="pixel-lobby-divider" />
            </>
          )}
          <div className="pixel-lobby-stat">
            <span className="pixel-stat-label">STATUS</span>
            <span className="pixel-stat-value">
              {canStart ? 'READY' : 'WAITING'}
            </span>
          </div>
        </PixelCard>

        {/* Player grid */}
        <div className="pixel-player-grid" role="list" aria-label={`Players in lobby: ${players.length} of ${maxPlayers}`}>
          {playerSlots.map((slot) => (
            <div
              key={slot.id}
              className={`pixel-player-slot ${slot.isMe ? 'pixel-player-me' : ''} ${slot.name === 'WAITING…' ? 'pixel-player-empty' : ''}`}
              role="listitem"
            >
              {/* Pixel avatar */}
              <div className="pixel-player-avatar">
                {slot.name === 'WAITING…' ? (
                  <div className="pixel-avatar-empty">?</div>
                ) : (
                  <svg
                    viewBox="0 0 16 16"
                    className="pixel-avatar-svg"
                    style={{ color: slot.color }}
                  >
                    {/* Pixel sperm avatar */}
                    <rect x="6" y="2" width="4" height="4" fill="currentColor" />
                    <rect x="5" y="3" width="1" height="2" fill="currentColor" />
                    <rect x="10" y="3" width="1" height="2" fill="currentColor" />
                    <rect x="4" y="4" width="8" height="2" fill="currentColor" />
                    <rect x="4" y="7" width="2" height="2" fill="currentColor" />
                    <rect x="2" y="9" width="2" height="2" fill="currentColor" />
                    {/* Eye */}
                    <rect x="7" y="4" width="1" height="1" fill="#1d2b53" />
                  </svg>
                )}
              </div>

              {/* Player name */}
              <span className="pixel-player-name">{slot.name}</span>

              {/* Me badge */}
              {slot.isMe && (
                <span className="pixel-me-badge">YOU</span>
              )}
            </div>
          ))}
        </div>

        {/* Countdown */}
        <div className="pixel-countdown">
          {countdown > 0 ? (
            <>
              <div className="pixel-countdown-label">STARTING IN</div>
              <div className="pixel-countdown-value pixel-blink">{countdown}</div>
            </>
          ) : (
            <div className="pixel-countdown-waiting">
              {lobbyMode === 'practice' && practiceMissingPlayers > 0
                ? `NEED ${practiceMissingPlayers} MORE PLAYER${practiceMissingPlayers === 1 ? '' : 'S'}`
                : 'WAITING FOR PLAYERS…'}
              {lobbyMode === 'practice' && practiceMissingPlayers > 0 && (
                <div className="pixel-countdown-note">Practice requires 2+ players</div>
              )}
            </div>
          )}
        </div>

        {/* Action button */}
        {canStart && (
          <PixelButton
            variant="accent"
            size="lg"
            fullWidth
            onClick={onStart}
            className="pixel-start-btn"
          >
            {countdown > 0 ? (
              <>
                <Clock size={20} weight="fill" />
                <span>GAME STARTING…</span>
              </>
            ) : (
              <span>START GAME</span>
            )}
          </PixelButton>
        )}
      </div>
    </div>
  );
});

PixelLobbyScreen.displayName = 'PixelLobbyScreen';
