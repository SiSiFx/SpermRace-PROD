import { memo } from 'react';
import { motion } from 'framer-motion';
import { ArrowLeft, Trophy, Users } from 'phosphor-react';
import { useWs } from '../../../WsProvider';
import './PremiumLobbyScreen.css';

const springPage = { type: 'spring' as const, stiffness: 110, damping: 18 };
const staggerContainer = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.045 },
  },
};
const staggerItem = {
  hidden: { opacity: 0, y: 18 },
  show: { opacity: 1, y: 0 },
};

type LobbyMode = 'practice' | 'tournament' | undefined;

interface PlayerSlot {
  id: string;
  name: string;
  isMe: boolean;
  isBot: boolean;
  isEmpty: boolean;
  note: string;
  color?: string;
}

interface PreviewLobby {
  players: string[];
  maxPlayers: number;
  entryFee: number;
  mode: LobbyMode;
  playerNames: Record<string, string>;
}

interface PreviewSnapshot {
  countdown: number;
  lobby: PreviewLobby;
  playerId: string;
}

export interface PremiumLobbyScreenProps {
  onStart?: () => void;
  onBack: () => void;
}

function getInitialHue(index: number): string {
  const hue = (36 + index * 43) % 360;
  return `hsl(${hue} 72% 64%)`;
}

function getPreviewLobby(): PreviewSnapshot | null {
  if (!(import.meta as any).env?.DEV) return null;

  try {
    const params = new URLSearchParams(window.location.search);
    const preview = params.get('previewLobby');
    if (!preview) return null;

    if (preview === 'practice') {
      return {
        countdown: 0,
        playerId: 'guest-apex',
        lobby: {
          players: ['guest-apex', 'guest-sable', 'BOT_PIVOT', 'BOT_REEF'],
          maxPlayers: 12,
          entryFee: 0,
          mode: 'practice',
          playerNames: {
            'guest-apex': 'Apex',
            'guest-sable': 'Sable',
            BOT_PIVOT: 'Pivot',
            BOT_REEF: 'Reef',
          },
        },
      };
    }

    return {
      countdown: 7,
      playerId: '6Kk8previewSelf',
      lobby: {
        players: [
          '6Kk8previewSelf',
          '3Ajt7quillRook',
          '7Mns2vantaGrid',
          'BOT_DRIFT',
          'BOT_THRUM',
          '9Qrj1mireLash',
        ],
        maxPlayers: 32,
        entryFee: 5,
        mode: 'tournament',
        playerNames: {
          '6Kk8previewSelf': 'You',
          '3Ajt7quillRook': 'Rook',
          '7Mns2vantaGrid': 'Grid',
          BOT_DRIFT: 'Drift',
          BOT_THRUM: 'Thrum',
          '9Qrj1mireLash': 'Lash',
        },
      },
    };
  } catch {
    return null;
  }
}

function formatEntry(value: number): string {
  return value <= 0 ? 'FREE' : `$${value}`;
}

function buildPlayerSlots(
  players: string[],
  playerNames: Record<string, string> | undefined,
  playerId: string | null,
  maxPlayers: number
): PlayerSlot[] {
  const slots: PlayerSlot[] = players.map((pid, index) => {
    const isBot = pid.startsWith('BOT_');
    const isMe = pid === playerId;
    const fallbackName = pid.startsWith('guest-')
      ? 'Guest'
      : pid.length >= 8
        ? `${pid.slice(0, 4)}…${pid.slice(-4)}`
        : pid;

    return {
      id: pid,
      name: playerNames?.[pid] || fallbackName,
      isMe,
      isBot,
      isEmpty: false,
      note: isMe ? 'Your lane' : isBot ? 'AI opponent' : 'Human entrant',
      color: getInitialHue(index),
    };
  });

  const visibleSlots = Math.min(Math.max(maxPlayers, 8), 12);
  const openSlots = Math.max(0, visibleSlots - slots.length);

  for (let index = 0; index < openSlots; index += 1) {
    slots.push({
      id: `open-${index}`,
      name: 'Open lane',
      isMe: false,
      isBot: false,
      isEmpty: true,
      note: 'Waiting for entry',
    });
  }

  return slots.slice(0, visibleSlots);
}

export const PremiumLobbyScreen = memo(function PremiumLobbyScreen({
  onStart,
  onBack,
}: PremiumLobbyScreenProps) {
  const { state } = useWs();
  const preview = getPreviewLobby();
  const lobby = state.lobby || preview?.lobby || null;
  const playerId = state.playerId || preview?.playerId || null;
  const countdown = state.countdown?.remaining ?? preview?.countdown ?? 0;

  const players = lobby?.players || [];
  const playerNames = (lobby as { playerNames?: Record<string, string> } | null)?.playerNames;
  const realPlayers = players.filter((pid) => !String(pid).startsWith('BOT_'));
  const lobbyMode = (lobby as any)?.mode as LobbyMode;
  const entryFee = Number((lobby as any)?.entryFee || 0);
  const maxPlayers = lobby?.maxPlayers ?? 12;
  const visibleSlots = Math.min(Math.max(maxPlayers, 8), 12);
  const winnerPayoutUsd = lobbyMode === 'tournament' ? Math.max(0, Math.floor(entryFee * 10)) : 0;
  const armThresholdMissing = lobbyMode === 'practice'
    ? Math.max(0, 1 - realPlayers.length)   // practice: 1 real player arms the room (bots fill rest)
    : Math.max(0, 2 - players.length);
  const canStart = armThresholdMissing === 0;
  const fillProgress = maxPlayers > 0 ? (players.length / maxPlayers) * 100 : 0;
  const roomLabel = lobbyMode === 'practice' ? 'Practice' : `${formatEntry(entryFee)} room`;
  const winnerLabel = lobbyMode === 'tournament' ? `$${winnerPayoutUsd}` : null;
  const statusLine = countdown > 0
    ? `Starting in ${countdown}s`
    : canStart
      ? lobbyMode === 'practice' ? 'Ready to start' : 'Room is full — starting soon'
      : `Waiting for ${armThresholdMissing} more player${armThresholdMissing === 1 ? '' : 's'}`;
  const playerSlots = buildPlayerSlots(players, playerNames, playerId, maxPlayers);
  const refundCountdown = (state.lobby as any)?.refundCountdown as number | undefined;

  return (
    <motion.div
      className={`premium-lobby-screen${countdown > 0 ? ' is-armed' : ''}`}
      initial={{ opacity: 0, scale: 0.985 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={springPage}
    >
      <div className="premium-lobby-backdrop" aria-hidden="true">
        <div className="premium-lobby-grid" />
        <div className="premium-lobby-orb premium-lobby-orb--gold" />
        <div className="premium-lobby-orb premium-lobby-orb--steel" />
      </div>

      <div className="premium-lobby-shell">
        <header className="premium-lobby-topbar">
          <button type="button" className="premium-lobby-back" onClick={onBack}>
            <ArrowLeft size={16} weight="bold" />
            <span>Back</span>
          </button>

          <div className="premium-lobby-topbar-right">
            <div className={`premium-lobby-mode premium-lobby-mode--${lobbyMode || 'tournament'}`}>
              {lobbyMode === 'practice' ? <Users size={14} weight="fill" /> : <Trophy size={14} weight="fill" />}
              <span>{lobbyMode === 'practice' ? 'Practice' : 'Tournament'}</span>
            </div>
            <div className="premium-lobby-room-chip">{roomLabel}</div>
          </div>
        </header>

        <main className="premium-lobby-main">
          <motion.section
            className="premium-lobby-hero"
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05, ...springPage }}
          >
            <h1 className="premium-lobby-title">{roomLabel}</h1>

            <p className="premium-lobby-subtitle">{statusLine}</p>

            {refundCountdown !== undefined && refundCountdown > 0 && entryFee > 0 && (
              <p className="premium-lobby-refund-warning">
                No other players joined. Your ${entryFee} will be refunded in {refundCountdown}s.
              </p>
            )}

            <div className="premium-lobby-strips" aria-label="Lobby summary">
              <div className="premium-lobby-strip">
                <span className="premium-lobby-strip-label">Players</span>
                <strong className="premium-lobby-strip-value">{players.length}/{maxPlayers}</strong>
              </div>
              {winnerLabel && (
                <div className="premium-lobby-strip">
                  <span className="premium-lobby-strip-label">Winner gets</span>
                  <strong className="premium-lobby-strip-value">{winnerLabel}</strong>
                </div>
              )}
            </div>

            {onStart && canStart && (
              <button type="button" className="premium-lobby-launch" onClick={onStart}>
                <span>Start</span>
              </button>
            )}
          </motion.section>

          <motion.section
            className="premium-lobby-board"
            initial={{ opacity: 0, y: 32 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.12, ...springPage }}
          >
            <motion.div
              className="premium-lobby-roster"
              role="list"
              aria-label={`Players in lobby: ${players.length} of ${maxPlayers}`}
              variants={staggerContainer}
              initial="hidden"
              animate="show"
            >
              {playerSlots.map((slot, index) => (
                <motion.div
                  key={slot.id}
                  className={`premium-lobby-slot${slot.isMe ? ' is-me' : ''}${slot.isEmpty ? ' is-empty' : ''}`}
                  variants={staggerItem}
                  whileHover={{ x: 3 }}
                  role="listitem"
                >
                  <span className="premium-lobby-slot-index">
                    {String(index + 1).padStart(2, '0')}
                  </span>

                  <div className="premium-lobby-slot-core">
                    <span
                      className="premium-lobby-slot-marker"
                      style={{ background: slot.color || 'rgba(255, 255, 255, 0.18)' }}
                    />

                    <div className="premium-lobby-slot-copy">
                      <span className="premium-lobby-slot-name">{slot.name}</span>
                    </div>
                  </div>

                  <div className="premium-lobby-slot-tags">
                    {slot.isMe && <span className="premium-lobby-tag premium-lobby-tag--you">You</span>}
                    {slot.isBot && <span className="premium-lobby-tag">Bot</span>}
                    {slot.isEmpty && <span className="premium-lobby-tag premium-lobby-tag--empty">Open</span>}
                  </div>
                </motion.div>
              ))}
            </motion.div>

          </motion.section>
        </main>
      </div>
    </motion.div>
  );
});

PremiumLobbyScreen.displayName = 'PremiumLobbyScreen';
