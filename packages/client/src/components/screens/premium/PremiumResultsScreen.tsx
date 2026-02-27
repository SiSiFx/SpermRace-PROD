/**
 * PremiumResultsScreen - Dark Casino Style Results Screen
 * Victory/defeat display with spring animations, prize counter, blockchain badge
 */

import { useState, useEffect, memo, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Trophy, Skull, Target, Sword, ArrowCounterClockwise, House, Crown, Sparkle, ArrowSquareOut, CheckCircle } from 'phosphor-react';
import { GlassCard, PremiumButton, StatBadge } from '../../ui/premium';
import { useWallet } from '../../../WalletProvider';
import { useWs } from '../../../WsProvider';
import './PremiumResultsScreen.css';

// Spring animation configs
const springPage = { type: 'spring' as const, stiffness: 100, damping: 20 };
const springIcon = { type: 'spring' as const, stiffness: 200, damping: 12 };
const springTitle = { type: 'spring' as const, stiffness: 80, damping: 20 };

export interface PremiumResultsScreenProps {
  onPlayAgain: () => void;
  onChangeTier: () => void;
}

const SOLANA_CLUSTER: 'devnet' | 'mainnet' = (globalThis as any).SOLANA_CLUSTER || 'mainnet';

export const PremiumResultsScreen = memo(function PremiumResultsScreen({
  onPlayAgain,
  onChangeTier,
}: PremiumResultsScreenProps) {
  const { state: wsState } = useWs();
  const { publicKey } = useWallet();
  const [isLoaded, setIsLoaded] = useState(false);
  const [playAgainBusy, setPlayAgainBusy] = useState(false);
  const [confettiActive, setConfettiActive] = useState(false);

  const tx = wsState.lastRound?.txSignature;
  const winner = wsState.lastRound?.winnerId;
  const prize = wsState.lastRound?.prizeAmount;
  const solscan = tx ? `https://solscan.io/tx/${tx}${SOLANA_CLUSTER === 'devnet' ? '?cluster=devnet' : ''}` : null;
  const selfId = wsState.playerId || publicKey || '';
  const isWinner = !!winner && winner === selfId;
  const myKills = wsState.kills?.[selfId] || 0;

  // Initial load animation
  useEffect(() => {
    const timer = setTimeout(() => setIsLoaded(true), 100);
    return () => clearTimeout(timer);
  }, []);

  // Victory confetti
  useEffect(() => {
    if (isWinner) {
      setConfettiActive(true);
      const timer = setTimeout(() => setConfettiActive(false), 5000);
      return () => clearTimeout(timer);
    }
  }, [isWinner]);

  // Animated prize counter
  const [displayPrize, setDisplayPrize] = useState(0);
  const prizeRef = useRef<number | null>(null);

  useEffect(() => {
    if (typeof prize !== 'number' || prize <= 0) return;
    if (prizeRef.current === prize) return;
    prizeRef.current = prize;

    const duration = 1500; // 1.5s count-up
    const startTime = Date.now();
    const startValue = 0;

    const animate = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);
      // Ease-out cubic
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplayPrize(startValue + (prize - startValue) * eased);

      if (progress < 1) {
        requestAnimationFrame(animate);
      }
    };

    requestAnimationFrame(animate);
  }, [prize]);

  const handlePlayAgain = async () => {
    if (playAgainBusy) return;
    if (wsState.phase !== 'ended') {
      onPlayAgain();
      return;
    }
    setPlayAgainBusy(true);
    await new Promise(resolve => setTimeout(resolve, 1000));
    setPlayAgainBusy(false);
    onPlayAgain();
  };

  // Calculate rank
  let rankText: string | null = null;
  let rankNum: number | null = null;
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
      if (myRank) {
        rankText = `#${myRank}`;
        rankNum = myRank;
      }
    }
  } catch { }

  const winnerName = winner
    ? (wsState.lobby?.playerNames?.[winner] ||
      (typeof winner === 'string' && winner.length >= 12
        ? `${winner.slice(0, 6)}...${winner.slice(-6)}`
        : winner))
    : '—';

  return (
    <motion.div
      className={`premium-results-screen ${isLoaded ? 'loaded' : ''} ${isWinner ? 'is-winner' : ''}`}
      initial={{ opacity: 0, scale: 0.98 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={springPage}
    >
      {/* Background */}
      <div className="premium-background" aria-hidden="true">
        <div className="premium-grid-overlay" />
        <div className="premium-glow-orb premium-glow-orb-1" />
        <div className="premium-glow-orb premium-glow-orb-2" />
        {isWinner && <div className="premium-glow-orb premium-glow-orb-victory" />}
      </div>

      {/* Confetti */}
      <AnimatePresence>
        {isWinner && confettiActive && (
          <motion.div
            className="premium-confetti"
            aria-hidden="true"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            {Array.from({ length: 60 }).map((_, i) => (
              <div
                key={i}
                className="premium-confetti-piece"
                style={{
                  left: `${Math.random() * 100}%`,
                  animationDelay: `${Math.random() * 2}s`,
                  animationDuration: `${3 + Math.random() * 2}s`,
                  backgroundColor: ['#0ea5e9', '#f59e0b', '#fbbf24', '#10b981', '#3b82f6', '#8b5cf6'][Math.floor(Math.random() * 6)],
                }}
              />
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      <div className="premium-results-content">
        {/* Result Icon */}
        <motion.div
          className={`premium-results-icon ${isWinner ? 'winner' : 'defeat'}`}
          initial={{ scale: 0.5, rotate: -15, opacity: 0 }}
          animate={{ scale: 1, rotate: 0, opacity: 1 }}
          transition={{ delay: 0.1, ...springIcon }}
        >
          {isWinner ? (
            <Trophy size={64} weight="fill" />
          ) : (
            <Skull size={64} weight="fill" />
          )}
        </motion.div>

        {/* Title */}
        <motion.h1
          className={`premium-results-title ${isWinner ? 'victory' : 'defeat'}`}
          initial={{ y: 30, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.2, ...springTitle }}
        >
          {isWinner ? 'VICTORY' : 'GAME OVER'}
        </motion.h1>

        {/* Subtitle */}
        <motion.p
          className="premium-results-subtitle"
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.3 }}
        >
          {isWinner ? 'You dominated the arena!' : 'Better luck next time'}
        </motion.p>

        {/* Winner/Prize Card */}
        <motion.div
          initial={{ y: 30, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.35, ...springPage }}
        >
          <GlassCard
            variant={isWinner ? 'accent' : 'dark'}
            padding="lg"
            glow={isWinner}
            glowColor={isWinner ? 'yellow' : undefined}
            border={isWinner ? 'accent' : 'subtle'}
            className="premium-winner-card"
          >
            <div className="premium-winner-header">
              {isWinner ? (
                <>
                  <Crown size={20} weight="fill" className="premium-crown-icon" />
                  <span>YOUR PRIZE</span>
                </>
              ) : (
                <>
                  <Sparkle size={20} weight="fill" />
                  <span>MATCH WINNER</span>
                </>
              )}
            </div>

            <div className="premium-winner-name">{winnerName}</div>

            {typeof prize === 'number' && prize > 0 && (
              <div className={`premium-prize-amount ${isWinner ? 'winner' : ''}`}>
                <span className="premium-prize-plus">+</span>
                <span className="premium-prize-value">{displayPrize.toFixed(4)}</span>
                <span className="premium-prize-unit">SOL</span>
              </div>
            )}
          </GlassCard>
        </motion.div>

        {/* Stats */}
        <motion.div
          className="premium-results-stats"
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.4, ...springPage }}
        >
          {rankText && (
            <StatBadge
              label="YOUR RANK"
              value={rankText}
              icon={<Target size={24} weight="duotone" />}
              color={rankNum === 1 ? 'yellow' : rankNum && rankNum <= 3 ? 'green' : 'default'}
              size="lg"
              glow={rankNum === 1}
            />
          )}
          <StatBadge
            label="ELIMINATIONS"
            value={myKills}
            icon={<Sword size={24} weight="duotone" />}
            color={myKills >= 5 ? 'blue' : myKills >= 3 ? 'purple' : 'default'}
            size="lg"
            glow={myKills >= 5}
          />
        </motion.div>

        {/* Blockchain Link - Prominent Green Badge */}
        {solscan && (
          <motion.a
            href={solscan}
            target="_blank"
            rel="noreferrer"
            className="premium-tx-link"
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.45, ...springPage }}
            whileHover={{ scale: 1.02, y: -2 }}
            whileTap={{ scale: 0.98 }}
          >
            <CheckCircle size={18} weight="fill" className="tx-link-icon" />
            <span>Verified on Solana</span>
            <ArrowSquareOut size={14} weight="bold" className="tx-link-arrow" />
          </motion.a>
        )}

        {/* Action Buttons */}
        <motion.div
          className="premium-results-actions"
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.5, ...springPage }}
        >
          <PremiumButton
            variant={isWinner ? 'success' : 'primary'}
            size="xl"
            fullWidth
            glow
            loading={playAgainBusy}
            onClick={handlePlayAgain}
            className="premium-play-again-btn"
          >
            {playAgainBusy ? (
              <span>CONNECTING...</span>
            ) : (
              <>
                <ArrowCounterClockwise size={22} weight="bold" />
                <span>{isWinner ? 'DEFEND TITLE' : 'PLAY AGAIN'}</span>
              </>
            )}
          </PremiumButton>

          <PremiumButton
            variant="secondary"
            size="lg"
            fullWidth
            onClick={onChangeTier}
            className="premium-menu-btn"
          >
            <House size={20} weight="bold" />
            <span>MAIN MENU</span>
          </PremiumButton>
        </motion.div>
      </div>
    </motion.div>
  );
});

PremiumResultsScreen.displayName = 'PremiumResultsScreen';
