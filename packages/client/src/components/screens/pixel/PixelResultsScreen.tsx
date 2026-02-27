/**
 * PixelResultsScreen - Retro post-game results screen
 * VICTORY/GAME OVER in pixel letters, pixel trophy/skull, retro fireworks
 */

import { useState, useEffect, memo } from 'react';
import { Trophy, Skull, Target, Sword, ArrowCounterClockwise, House, Sparkle } from 'phosphor-react';
import { PixelButton, PixelCard } from '../../ui/pixel';
import { useWallet } from '../../../WalletProvider';
import { useWs } from '../../../WsProvider';
import './PixelResultsScreen.css';

export interface PixelResultsScreenProps {
  onPlayAgain: () => void;
  onChangeTier: () => void;
}

const SOLANA_CLUSTER: 'devnet' | 'mainnet' = (globalThis as any).SOLANA_CLUSTER || 'mainnet';

export const PixelResultsScreen = memo(function PixelResultsScreen({
  onPlayAgain,
  onChangeTier,
}: PixelResultsScreenProps) {
  const { state: wsState } = useWs();
  const { publicKey } = useWallet();
  const tx = wsState.lastRound?.txSignature;
  const winner = wsState.lastRound?.winnerId;
  const prize = wsState.lastRound?.prizeAmount;
  const solscan = tx ? `https://solscan.io/tx/${tx}${SOLANA_CLUSTER === 'devnet' ? '?cluster=devnet' : ''}` : null;
  const selfId = wsState.playerId || publicKey || '';
  const isWinner = !!winner && winner === selfId;
  const [playAgainBusy, setPlayAgainBusy] = useState(false);
  const [confettiActive, setConfettiActive] = useState(false);

  useEffect(() => {
    if (isWinner) {
      setConfettiActive(true);
      const timer = setTimeout(() => {
        setConfettiActive(false);
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [isWinner]);

  const handlePlayAgain = async () => {
    if (playAgainBusy) return;
    if (wsState.phase !== 'ended') {
      onPlayAgain();
      return;
    }
    setPlayAgainBusy(true);
    // Simulate rejoin logic
    await new Promise(resolve => setTimeout(resolve, 1000));
    setPlayAgainBusy(false);
    onPlayAgain();
  };

  // Calculate rank
  let rankText: string | null = null;
  try {
    const initial = wsState.initialPlayers || [];
    const order = wsState.eliminationOrder || [];
    if (initial.length) {
      const uniqueOrder: string[] = [];
      for (const pid of order) {
        if (pid && !uniqueOrder.includes(pid)) uniqueOrder.push(pid);
      }
      const rankMap: Record<string, number> = {};
      if (winner) rankMap[winner] = 1;
      let r = 2;
      for (let i = uniqueOrder.length - 1; i >= 0; i--) {
        const pid = uniqueOrder[i];
        if (pid && !rankMap[pid]) {
          rankMap[pid] = r;
          r++;
        }
      }
      const myRank = rankMap[selfId];
      if (myRank) rankText = `#${myRank}`;
    }
  } catch { }

  const winnerName = winner
    ? (wsState.lobby?.playerNames?.[winner] ||
      (typeof winner === 'string' && winner.length >= 12
        ? `${winner.slice(0, 6)}…${winner.slice(-6)}`
        : winner))
    : '—';
  const myKills = wsState.kills?.[selfId] || 0;

  return (
    <div className={`pixel-results-screen ${isWinner ? 'pixel-results-winner' : ''}`}>
      {/* Background effects */}
      <div className="pixel-results-bg" aria-hidden="true">
        {isWinner && confettiActive && (
          <div className="pixel-confetti">
            {Array.from({ length: 50 }).map((_, i) => (
              <div
                key={i}
                className="pixel-confetti-piece"
                style={{
                  left: `${Math.random() * 100}%`,
                  animationDelay: `${Math.random() * 2}s`,
                  animationDuration: `${2 + Math.random() * 2}s`,
                  backgroundColor: ['#ff004d', '#ffa300', '#ffec27', '#00e436', '#29adff', '#ff77a8'][Math.floor(Math.random() * 6)],
                }}
              />
            ))}
          </div>
        )}
      </div>

      <div className="pixel-results-content">
        {/* Icon */}
        <div className="pixel-results-icon" aria-hidden="true">
          {isWinner ? (
            <svg viewBox="0 0 48 48" className="pixel-trophy-svg" fill="currentColor">
              {/* Trophy cup */}
              <rect x="12" y="8" width="24" height="16" fill="#ffa300" />
              <rect x="8" y="4" width="32" height="6" fill="#ffec27" />
              {/* Trophy handles */}
              <rect x="4" y="12" width="4" height="12" fill="#ffa300" />
              <rect x="40" y="12" width="4" height="12" fill="#ffa300" />
              {/* Trophy base */}
              <rect x="18" y="24" width="12" height="4" fill="#ab5236" />
              <rect x="14" y="28" width="20" height="8" fill="#ab5236" />
              {/* Stars */}
              <rect x="18" y="12" width="4" height="4" fill="#fff1e8" />
              <rect x="26" y="12" width="4" height="4" fill="#fff1e8" />
              <rect x="22" y="18" width="4" height="4" fill="#fff1e8" />
            </svg>
          ) : (
            <svg viewBox="0 0 48 48" className="pixel-skull-svg" fill="currentColor">
              {/* Skull */}
              <rect x="14" y="12" width="20" height="16" fill="#c2c3c7" />
              <rect x="10" y="10" width="4" height="4" fill="#c2c3c7" />
              <rect x="34" y="10" width="4" height="4" fill="#c2c3c7" />
              <rect x="6" y="14" width="4" height="12" fill="#c2c3c7" />
              <rect x="38" y="14" width="4" height="12" fill="#c2c3c7" />
              {/* Jaw */}
              <rect x="16" y="28" width="16" height="4" fill="#c2c3c7" />
              {/* Eye sockets */}
              <rect x="18" y="16" width="6" height="6" fill="#1d2b53" />
              <rect x="24" y="16" width="6" height="6" fill="#1d2b53" />
              {/* Nose */}
              <rect x="22" y="24" width="4" height="4" fill="#83769c" />
            </svg>
          )}
        </div>

        {/* Title */}
        <h1 className={`pixel-results-title ${isWinner ? 'pixel-title-victory' : 'pixel-title-defeat'} crt-text`}>
          {isWinner ? 'VICTORY!' : 'GAME OVER'}
        </h1>

        {isWinner && (
          <p className="pixel-results-subtitle pixel-blink">
            YOU DOMINATED THE ARENA!
          </p>
        )}

        {/* Winner Info Card */}
        <PixelCard variant={isWinner ? 'light' : 'dark'} padding="md" className="pixel-winner-card">
          <div className="pixel-winner-label">
            <Sparkle size={16} weight="fill" />
            <span>{isWinner ? 'YOUR PRIZE' : 'MATCH WINNER'}</span>
          </div>
          <div className="pixel-winner-content">
            <div className="pixel-winner-name">{winnerName}</div>
            {typeof prize === 'number' && (
              <div className="pixel-winner-prize">+{prize.toFixed(4)} SOL</div>
            )}
          </div>
        </PixelCard>

        {/* Stats */}
        <div className="pixel-results-stats" role="group" aria-label="Match statistics">
          {rankText && (
            <div className="pixel-result-stat">
              <div className="pixel-stat-icon pixel-stat-icon-rank" aria-hidden="true">
                <Target size={24} weight="duotone" />
              </div>
              <div className="pixel-stat-info">
                <div className="pixel-stat-label">YOUR RANK</div>
                <div className="pixel-stat-value crt-text">{rankText}</div>
              </div>
            </div>
          )}
          <div className="pixel-result-stat">
            <div className="pixel-stat-icon pixel-stat-icon-kills" aria-hidden="true">
              <Sword size={24} weight="duotone" />
            </div>
            <div className="pixel-stat-info">
              <div className="pixel-stat-label">ELIMINATIONS</div>
              <div className="pixel-stat-value crt-text">{myKills}</div>
            </div>
          </div>
        </div>

        {/* Solscan Link */}
        {solscan && (
          <a
            href={solscan}
            target="_blank"
            rel="noreferrer"
            className="pixel-results-link"
          >
            VIEW TRANSACTION ON SOLSCAN
          </a>
        )}

        {/* Action Buttons */}
        <div className="pixel-results-actions" role="group" aria-label="Game actions">
          <PixelButton
            variant={isWinner ? 'primary' : 'accent'}
            size="lg"
            fullWidth
            onClick={handlePlayAgain}
            disabled={playAgainBusy}
            className="pixel-play-again-btn"
          >
            {playAgainBusy ? (
              <>
                <div className="pixel-btn-spinner" aria-hidden="true" />
                <span>CONNECTING...</span>
              </>
            ) : (
              <>
                <ArrowCounterClockwise size={20} weight="bold" />
                <span>{isWinner ? 'DEFEND TITLE' : 'PLAY AGAIN'}</span>
              </>
            )}
          </PixelButton>

          <PixelButton
            variant="secondary"
            size="lg"
            fullWidth
            onClick={onChangeTier}
            className="pixel-menu-btn"
          >
            <House size={18} weight="bold" />
            <span>MAIN MENU</span>
          </PixelButton>
        </div>

        {/* INSERT COIN prompt */}
        {!playAgainBusy && (
          <div className="pixel-insert-coin pixel-blink">
            {'> INSERT COIN TO CONTINUE <'}
          </div>
        )}
      </div>
    </div>
  );
});

PixelResultsScreen.displayName = 'PixelResultsScreen';
