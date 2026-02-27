/**
 * PremiumLobbyScreen - Dark Casino Style Lobby
 * Staggered player grid, spring countdown, urgency states
 */

import { useState, useEffect, memo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Atom, Users, Trophy, ArrowLeft, Clock, Timer, Crown } from 'phosphor-react';
import { GlassCard, PremiumButton, ProgressBar } from '../../ui/premium';
import { useWs } from '../../../WsProvider';
import './PremiumLobbyScreen.css';

// Spring animation configs
const springPage = { type: 'spring' as const, stiffness: 100, damping: 20 };
const springCountdown = { type: 'spring' as const, stiffness: 300, damping: 20 };
const staggerContainer = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.04 },
  },
};
const staggerItem = {
  hidden: { opacity: 0, y: 20, scale: 0.9 },
  show: { opacity: 1, y: 0, scale: 1 },
};

export interface PremiumLobbyScreenProps {
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

export const PremiumLobbyScreen = memo(function PremiumLobbyScreen({
  onStart,
  onBack,
}: PremiumLobbyScreenProps) {
  const { state } = useWs();
  const [isLoaded, setIsLoaded] = useState(false);

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
  const fillProgress = (players.length / maxPlayers) * 100;

  // Build player slots
  const [playerSlots, setPlayerSlots] = useState<PlayerSlot[]>([]);

  // Initial load animation
  useEffect(() => {
    const timer = setTimeout(() => setIsLoaded(true), 100);
    return () => clearTimeout(timer);
  }, []);

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

    // Add empty slots (show up to 12 total)
    const emptyCount = Math.min(playersNeeded, Math.max(0, 12 - slots.length));
    for (let i = 0; i < emptyCount; i++) {
      slots.push({
        id: `empty-${i}`,
        name: 'Waiting...',
        isMe: false,
        isBot: false,
      });
    }

    setPlayerSlots(slots.slice(0, 12));
  }, [players, playersNeeded, state.playerId, state.lobby?.playerNames]);

  const canStart = lobbyMode === 'practice' ? realPlayers.length >= 2 : players.length >= 2;

  const isUrgent = fillProgress >= 80;

  return (
    <motion.div
      className={`premium-lobby-screen ${isLoaded ? 'loaded' : ''} ${isUrgent ? 'is-urgent' : ''}`}
      initial={{ opacity: 0, scale: 0.98 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={springPage}
    >
      {/* Background */}
      <div className="premium-background" aria-hidden="true">
        <div className="premium-grid-overlay" />
        <div className="premium-glow-orb premium-glow-orb-1" />
        <div className="premium-glow-orb premium-glow-orb-2" />
      </div>

      <div className="premium-lobby-content">
        {/* Header */}
        <motion.header
          className="premium-lobby-header"
          initial={{ y: -20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.1, ...springPage }}
        >
          <PremiumButton
            variant="ghost"
            size="sm"
            onClick={onBack}
            className="premium-back-btn"
          >
            <ArrowLeft size={18} weight="bold" />
            <span>BACK</span>
          </PremiumButton>

          {/* Mode badge */}
          {lobbyMode && (
            <motion.div
              className={`premium-mode-badge ${lobbyMode}`}
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.2, type: 'spring', stiffness: 200, damping: 15 }}
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
            </motion.div>
          )}
        </motion.header>

        {/* Title Section */}
        <div className="premium-lobby-title-section">
          <div className="premium-lobby-icon">
            <Atom size={40} weight="duotone" />
          </div>
          <h1 className="premium-lobby-title">LOBBY</h1>
          <p className="premium-lobby-subtitle">
            {countdown > 0
              ? 'Game starting soon...'
              : canStart
                ? 'Ready to start!'
                : 'Waiting for players...'}
          </p>
        </div>

        {/* Stats Cards */}
        <div className="premium-lobby-stats">
          {/* Players */}
          <GlassCard variant="dark" padding="md" className="premium-stat-card">
            <div className="premium-stat-header">
              <Users size={18} weight="fill" className="premium-stat-icon" />
              <span className="premium-stat-label">PLAYERS</span>
            </div>
            <div className="premium-stat-value">
              <span className="premium-stat-current">{players.length}</span>
              <span className="premium-stat-max">/{maxPlayers}</span>
            </div>
            <ProgressBar
              value={fillProgress}
              color={fillProgress >= 75 ? 'green' : 'blue'}
              size="sm"
              animated
            />
          </GlassCard>

          {/* Prize (Tournament only) */}
          {lobbyMode === 'tournament' && (
            <GlassCard variant="dark" padding="md" className="premium-stat-card prize">
              <div className="premium-stat-header">
                <Crown size={18} weight="fill" className="premium-stat-icon gold" />
                <span className="premium-stat-label">WINNER PAYOUT</span>
              </div>
              <div className="premium-stat-value prize">
                <span className="premium-stat-currency">$</span>
                <span className="premium-stat-amount">{winnerPayoutUsd}</span>
              </div>
              <span className="premium-stat-note">Fixed 10x payout</span>
            </GlassCard>
          )}

          {/* Status */}
          <GlassCard variant="dark" padding="md" className="premium-stat-card">
            <div className="premium-stat-header">
              <Timer size={18} weight="fill" className="premium-stat-icon" />
              <span className="premium-stat-label">STATUS</span>
            </div>
            <div className={`premium-stat-status ${canStart ? 'ready' : 'waiting'}`}>
              <span className="premium-status-dot" />
              <span>{canStart ? 'READY' : 'WAITING'}</span>
            </div>
          </GlassCard>
        </div>

        {/* Player Grid */}
        <motion.div
          className="premium-player-section"
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25, ...springPage }}
        >
          <div className="premium-section-header">
            <span className="premium-section-title">Players in Lobby</span>
            <span className="premium-section-count">{players.length} joined</span>
          </div>

          <motion.div
            className="premium-player-grid"
            role="list"
            aria-label={`Players in lobby: ${players.length} of ${maxPlayers}`}
            variants={staggerContainer}
            initial="hidden"
            animate="show"
          >
            {playerSlots.map((slot) => (
              <motion.div
                key={slot.id}
                variants={staggerItem}
                whileHover={{ scale: 1.05, y: -4 }}
                whileTap={{ scale: 0.98 }}
              >
                <GlassCard
                  variant={slot.isMe ? 'accent' : slot.name === 'Waiting...' ? 'default' : 'dark'}
                  padding="sm"
                  border={slot.isMe ? 'accent' : 'subtle'}
                  className={`premium-player-slot ${slot.isMe ? 'is-me' : ''} ${slot.name === 'Waiting...' ? 'is-empty' : ''}`}
                >
                  {/* Avatar */}
                  <div className="premium-player-avatar" style={{ backgroundColor: slot.color || 'rgba(255,255,255,0.1)' }}>
                    {slot.name === 'Waiting...' ? (
                      <span className="premium-avatar-placeholder">?</span>
                    ) : (
                      <svg viewBox="0 0 24 24" className="premium-avatar-sperm">
                        <ellipse cx="12" cy="8" rx="6" ry="7" fill="currentColor" />
                        <ellipse cx="10" cy="6" rx="1.5" ry="2" fill="rgba(255,255,255,0.4)" />
                        <path
                          d="M 12 15 Q 8 20 5 22"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2.5"
                          strokeLinecap="round"
                          opacity="0.8"
                        />
                      </svg>
                    )}
                  </div>

                  {/* Name */}
                  <span className="premium-player-name">{slot.name}</span>

                  {/* Me badge */}
                  {slot.isMe && (
                    <span className="premium-me-badge">YOU</span>
                  )}

                  {/* Bot badge */}
                  {slot.isBot && (
                    <span className="premium-bot-badge">BOT</span>
                  )}
                </GlassCard>
              </motion.div>
            ))}
          </motion.div>
        </motion.div>

        {/* Countdown Section */}
        <motion.div
          className="premium-countdown-section"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3, ...springPage }}
        >
          <AnimatePresence mode="wait">
            {countdown > 0 ? (
              <motion.div
                key="countdown"
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.8, opacity: 0 }}
              >
                <GlassCard variant="darker" padding="lg" glow glowColor="blue" className="premium-countdown-card">
                  <div className="premium-countdown-label">STARTING IN</div>
                  <motion.div
                    key={countdown}
                    className="premium-countdown-value"
                    initial={{ scale: 1.4, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={springCountdown}
                  >
                    {countdown}
                  </motion.div>
                  <div className="premium-countdown-pulse" />
                </GlassCard>
              </motion.div>
            ) : (
              <motion.div
                key="waiting"
                className="premium-countdown-waiting"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
              >
                {lobbyMode === 'practice' && practiceMissingPlayers > 0 ? (
                  <>
                    <span className="premium-waiting-text">
                      Need {practiceMissingPlayers} more player{practiceMissingPlayers === 1 ? '' : 's'}
                    </span>
                    <span className="premium-waiting-note">Practice requires 2+ players to start</span>
                  </>
                ) : (
                  <span className="premium-waiting-text">
                    {canStart ? 'Ready to begin!' : 'Waiting for players...'}
                  </span>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>

        {/* Action Button */}
        <AnimatePresence>
          {canStart && (
            <motion.div
              className="premium-action-section"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 20 }}
              transition={{ delay: 0.35, ...springPage }}
            >
              <PremiumButton
                variant="primary"
                size="xl"
                fullWidth
                glow
                onClick={onStart}
                className="premium-start-btn"
              >
                {countdown > 0 ? (
                  <>
                    <Clock size={24} weight="fill" />
                    <span>GAME STARTING...</span>
                  </>
                ) : (
                  <>
                    <Atom size={24} weight="fill" />
                    <span>START GAME</span>
                  </>
                )}
              </PremiumButton>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
});

PremiumLobbyScreen.displayName = 'PremiumLobbyScreen';
