import { memo } from 'react';
import { motion } from 'framer-motion';
import { ArrowLeft, Sword, Timer, Trophy, Users } from 'phosphor-react';
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
  const roomLabel = lobbyMode === 'practice'
    ? 'Practice chamber'
    : lobby
      ? `${formatEntry(entryFee)} room`
      : 'Tournament chamber';
  const winnerLabel = lobbyMode === 'tournament' ? `$${winnerPayoutUsd}` : 'No payout';
  const headline = countdown > 0
    ? lobbyMode === 'practice' ? 'Ready. Starting soon.' : 'Chamber armed.'
    : canStart
      ? lobbyMode === 'practice' ? 'Ready to launch.' : 'Room is live-ready.'
      : 'Forming the hunt.';
  const subtitle = countdown > 0
    ? lobbyMode === 'practice'
      ? `Launching in ${countdown}s — ${players.length} AI opponents loaded.`
      : 'Read the first cut before the room closes around you.'
    : canStart
      ? lobbyMode === 'practice'
        ? 'All AI opponents loaded. Launch when ready.'
        : 'Threshold hit. The server can drop this match at any moment.'
      : `Need ${armThresholdMissing} more ${lobbyMode === 'practice' ? 'real player' : 'entrant'}${armThresholdMissing === 1 ? '' : 's'} to start.`;
  const boardFooter = lobbyMode === 'practice'
    ? 'Solo practice — you vs AI. No entry fee, no payout.'
    : 'Live rooms are short, lethal, and server-authoritative. Two entrants arms the queue.';
  const autoFlowLabel = countdown > 0
    ? 'Auto launch engaged'
    : canStart
      ? (onStart ? 'Manual launch available' : 'Waiting for server handoff')
      : 'Queue still gathering';
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
            <p className="premium-lobby-eyebrow">
              {lobbyMode === 'practice' ? 'Practice mode · Free' : 'Live kill room'}
            </p>

            <h1 className="premium-lobby-title">
              {headline}
              <span>{roomLabel}</span>
            </h1>

            <p className="premium-lobby-subtitle">{subtitle}</p>

            {refundCountdown !== undefined && refundCountdown > 0 && entryFee > 0 && (
              <p className="premium-lobby-refund-warning">
                No other players joined. Your ${entryFee} will be refunded in {refundCountdown}s.
              </p>
            )}

            <div className="premium-lobby-strips" aria-label="Lobby summary">
              <div className="premium-lobby-strip">
                <span className="premium-lobby-strip-label">Inside</span>
                <strong className="premium-lobby-strip-value">{players.length}/{maxPlayers}</strong>
              </div>
              <div className="premium-lobby-strip">
                <span className="premium-lobby-strip-label">Winner</span>
                <strong className="premium-lobby-strip-value">{winnerLabel}</strong>
              </div>
              <div className="premium-lobby-strip">
                <span className="premium-lobby-strip-label">Starts with</span>
                <strong className="premium-lobby-strip-value">
                  {lobbyMode === 'practice' ? '1 player' : '2 entrants'}
                </strong>
              </div>
            </div>

            <div className="premium-lobby-command">
              <div className="premium-lobby-command-display">
                <span className="premium-lobby-command-kicker">Status</span>
                <strong className="premium-lobby-command-value">
                  {countdown > 0 ? countdown : canStart ? 'ARMED' : armThresholdMissing}
                </strong>
                <span className="premium-lobby-command-caption">
                  {countdown > 0 ? 'Seconds to release' : canStart ? 'Queue threshold hit' : 'More needed'}
                </span>
              </div>

              <div className="premium-lobby-command-copy">
                <div className="premium-lobby-command-headline">
                  <span>Capacity</span>
                  <strong>{players.length} of {maxPlayers}</strong>
                </div>

                <div className="premium-lobby-track" aria-hidden="true">
                  <span style={{ width: `${Math.max(6, Math.min(fillProgress, 100))}%` }} />
                </div>

                <p className="premium-lobby-command-note">{boardFooter}</p>

                {onStart && canStart ? (
                  <button type="button" className="premium-lobby-launch" onClick={onStart}>
                    <Sword size={18} weight="bold" />
                    <span>{countdown > 0 ? 'Launch armed room' : 'Launch room'}</span>
                  </button>
                ) : (
                  <div className="premium-lobby-autoflow">
                    <Timer size={18} weight="fill" />
                    <span>{autoFlowLabel}</span>
                  </div>
                )}
              </div>
            </div>
          </motion.section>

          <motion.section
            className="premium-lobby-board"
            initial={{ opacity: 0, y: 32 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.12, ...springPage }}
          >
            <div className="premium-lobby-board-head">
              <div>
                <p className="premium-lobby-board-kicker">Roster</p>
                <h2 className="premium-lobby-board-title">Inside the chamber</h2>
              </div>

              <div className="premium-lobby-board-summary">
                <span>{players.length} active</span>
                <span>{visibleSlots} visible lanes</span>
              </div>
            </div>

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
                      <span className="premium-lobby-slot-note">{slot.note}</span>
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

            <div className="premium-lobby-board-footer">
              <p>{boardFooter}</p>
              <div className="premium-lobby-rule">
                <Sword size={16} weight="bold" />
                <span>Any trail touch kills. Read bodies, not just lanes.</span>
              </div>
            </div>
          </motion.section>
        </main>
      </div>
    </motion.div>
  );
});

PremiumLobbyScreen.displayName = 'PremiumLobbyScreen';
