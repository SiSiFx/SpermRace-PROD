import { useState, useEffect } from 'react';
import { Trophy, Skull } from 'phosphor-react';
import { useWs } from '../../WsProvider';
import { useWallet } from '../../WalletProvider';
import { isMobileDevice } from '../../deviceDetection';

// Solana cluster for links
const SOLANA_CLUSTER: 'devnet' | 'mainnet' = (() => {
  const env = (import.meta as any).env?.VITE_SOLANA_CLUSTER as string | undefined;
  if (env && /^(devnet|mainnet)$/i.test(env)) return env.toLowerCase() as any;
  try {
    const host = (window?.location?.hostname || '').toLowerCase();
    return host.includes('dev.spermrace.io') ? 'devnet' : 'mainnet';
  } catch {}
  return 'devnet';
})();

interface ResultsProps {
  onPlayAgain: () => void;
  onChangeTier: () => void;
}

export function Results({ onPlayAgain, onChangeTier }: ResultsProps) {
  const isMobile = isMobileDevice();
  const { state: wsState } = useWs() as any;
  const { publicKey } = useWallet() as any;
  
  const tx = wsState.lastRound?.txSignature;
  const winner = wsState.lastRound?.winnerId;
  const prize = wsState.lastRound?.prizeAmount;
  const solscan = tx ? `https://solscan.io/tx/${tx}${SOLANA_CLUSTER === 'devnet' ? '?cluster=devnet' : ''}` : null;
  const selfId = wsState.playerId || publicKey || '';
  const isWinner = !!winner && winner === selfId;
  
  const [animatedPrize, setAnimatedPrize] = useState(0);
  
  // Animated prize counter (mobile)
  useEffect(() => {
    if (isMobile && typeof prize === 'number' && prize > 0) {
      const duration = 1500;
      const steps = 60;
      const increment = prize / steps;
      let current = 0;
      const timer = setInterval(() => {
        current += increment;
        if (current >= prize) {
          setAnimatedPrize(prize);
          clearInterval(timer);
        } else {
          setAnimatedPrize(current);
        }
      }, duration / steps);
      return () => clearInterval(timer);
    }
  }, [prize, isMobile]);
  
  // Calculate rank
  let myRank = 0;
  let totalPlayers = 0;
  let rankText: string | null = null;
  
  try {
    const initial = wsState.initialPlayers || [];
    const order = wsState.eliminationOrder || [];
    totalPlayers = initial.length;
    
    if (initial.length) {
      const uniqueOrder: string[] = [];
      for (const pid of order) { if (pid && !uniqueOrder.includes(pid)) uniqueOrder.push(pid); }
      const rankMap: Record<string, number> = {};
      if (winner) rankMap[winner] = 1;
      let r = 2;
      for (let i = uniqueOrder.length - 1; i >= 0; i--) {
        const pid = uniqueOrder[i];
        if (pid && !rankMap[pid]) { rankMap[pid] = r; r++; }
      }
      myRank = rankMap[selfId] || 0;
      if (myRank) rankText = `Your rank: #${myRank}`;
    }
  } catch {}
  
  const myKills = wsState.kills?.[selfId] || 0;

  // Mobile Results
  if (isMobile) {
    return (
      <div className="screen active mobile-results-screen" style={{
        background: 'linear-gradient(180deg, #030712 0%, #0a1628 100%)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px 16px',
        overflowY: 'auto',
      }}>
        <div style={{
          maxWidth: 480,
          width: '100%',
          display: 'flex',
          flexDirection: 'column',
          gap: 20,
        }}>
          {/* Victory/Defeat Banner */}
          <div style={{
            textAlign: 'center',
            padding: '24px 16px',
            borderRadius: 16,
            background: isWinner 
              ? 'linear-gradient(135deg, rgba(16,185,129,0.2), rgba(34,211,238,0.2))'
              : 'linear-gradient(135deg, rgba(239,68,68,0.15), rgba(168,85,247,0.15))',
            border: `2px solid ${isWinner ? 'rgba(16,185,129,0.5)' : 'rgba(239,68,68,0.4)'}`,
            boxShadow: `0 8px 32px ${isWinner ? 'rgba(16,185,129,0.3)' : 'rgba(239,68,68,0.2)'}`,
          }}>
            {isWinner ? (
              <Trophy size={48} weight="fill" color="#10b981" style={{ marginBottom: 12 }} />
            ) : (
              <Skull size={48} weight="fill" color="#ef4444" style={{ marginBottom: 12 }} />
            )}
            <h1 style={{
              fontSize: 32,
              fontWeight: 900,
              color: '#fff',
              margin: 0,
              marginBottom: 8,
              textShadow: `0 0 20px ${isWinner ? 'rgba(16,185,129,0.6)' : 'rgba(239,68,68,0.6)'}`,
            }}>
              {isWinner ? 'VICTORY!' : 'ELIMINATED'}
            </h1>
            <div style={{ fontSize: 14, color: 'rgba(255,255,255,0.7)', marginBottom: 16 }}>
              #{myRank} of {totalPlayers} players • {myKills} kills
            </div>
            
            {typeof prize === 'number' && prize > 0 && isWinner && (
              <div style={{
                padding: '16px 24px',
                background: 'rgba(0,0,0,0.4)',
                borderRadius: 12,
                border: '1px solid rgba(16,185,129,0.3)',
              }}>
                <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)', marginBottom: 4 }}>Prize Won</div>
                <div style={{
                  fontSize: 36,
                  fontWeight: 900,
                  color: '#10b981',
                  fontFamily: '"JetBrains Mono", monospace',
                  textShadow: '0 0 20px rgba(16,185,129,0.8)',
                }}>
                  +{animatedPrize.toFixed(4)} SOL
                </div>
              </div>
            )}
          </div>
          
          {solscan && (
            <a 
              href={solscan} 
              target="_blank" 
              rel="noreferrer"
              style={{
                display: 'block',
                textAlign: 'center',
                color: '#22d3ee',
                fontSize: 13,
                textDecoration: 'none',
              }}
            >
              View payout on Solscan →
            </a>
          )}
          
          {/* Actions */}
          <div className="mobile-result-actions" style={{ display: 'flex', gap: 12 }}>
            <button
              onClick={onPlayAgain}
              className="mobile-btn-primary"
              style={{
                flex: 1,
                padding: '16px 24px',
                fontSize: 16,
                fontWeight: 700,
                borderRadius: 12,
                background: 'linear-gradient(135deg, #22d3ee, #6366f1)',
                border: 'none',
                color: '#fff',
                cursor: 'pointer',
              }}
            >
              Play Again
            </button>
            <button
              onClick={onChangeTier}
              className="mobile-btn-secondary"
              style={{
                flex: 1,
                padding: '16px 24px',
                fontSize: 16,
                fontWeight: 600,
                borderRadius: 12,
                background: 'rgba(255,255,255,0.1)',
                border: '1px solid rgba(255,255,255,0.2)',
                color: '#fff',
                cursor: 'pointer',
              }}
            >
              Exit
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Desktop Results
  return (
    <div className="screen active" id="round-end">
      <div className="modal-card">
        <div className="modal-header">
          <h2 className={`round-result ${isWinner ? 'victory' : 'defeat'}`}>
            {isWinner ? 'Fertilization!' : 'Eliminated'}
          </h2>
          <p className="round-description">
            Winner: {winner ? `${winner.slice(0,4)}…${winner.slice(-4)}` : '—'}
            {typeof prize === 'number' ? ` • Prize: ${prize.toFixed(4)} SOL` : ''}
          </p>
        </div>
        {solscan && (
          <div className="modal-subtitle">
            <a href={solscan} target="_blank" rel="noreferrer">View payout on Solscan</a>
          </div>
        )}
        {rankText && (
          <div className="modal-subtitle">{rankText} • Kills: {myKills}</div>
        )}
        <div className="round-actions">
          <button className="btn-primary" onClick={onPlayAgain}>Replay</button>
          <button className="btn-secondary" onClick={onChangeTier}>Quit</button>
        </div>
      </div>
    </div>
  );
}

export default Results;
