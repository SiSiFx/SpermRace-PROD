/**
 * Leaderboard.tsx - Real-time Leaderboard with Taste-Skill
 * Shows live player rankings with kills and status
 */

'use client';

import { useEffect, useState, memo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import './Leaderboard.css';

export type SpermClassType = 'balanced' | 'sprinter' | 'tank';

const CLASS_ICONS: Record<SpermClassType, string> = {
  balanced: '●',
  sprinter: '⚡',
  tank: '◆',
};

export interface LeaderboardEntry {
  id: string;
  name: string;
  color: number;
  kills: number;
  isAlive: boolean;
  isPlayer: boolean;
  placement?: number;
  classType?: SpermClassType;
}

interface LeaderboardProps {
  entries: LeaderboardEntry[];
  totalPlayers: number;
}

export const Leaderboard = memo(function Leaderboard({ entries, totalPlayers }: LeaderboardProps) {
  const [visible, setVisible] = useState(false);
  const [sortedEntries, setSortedEntries] = useState<LeaderboardEntry[]>([]);

  const getOrdinal = useCallback((n: number): string => {
    if (!n) return '-';
    const s = ['th', 'st', 'nd', 'rd'];
    const v = n % 100;
    return n + (s[(v - 20) % 10] || s[v] || s[0]);
  }, []);

  useEffect(() => {
    const sorted = [...entries].sort((a, b) => {
      if (a.isPlayer && !b.isPlayer) return -1;
      if (!a.isPlayer && b.isPlayer) return 1;
      if (a.isAlive && !b.isAlive) return -1;
      if (!a.isAlive && b.isAlive) return 1;
      if (b.kills !== a.kills) return b.kills - a.kills;
      return a.name.localeCompare(b.name);
    });

    const withPlacement = sorted.map(entry => {
      if (!entry.isAlive && entry.placement === undefined) {
        entry.placement = totalPlayers - sorted.filter(e => e.isAlive).length;
      }
      return entry;
    });

    setSortedEntries(withPlacement);
    setVisible(entries.length >= 3);
  }, [entries, totalPlayers]);

  if (!visible || sortedEntries.length === 0) return null;

  return (
    <motion.div
      className="leaderboard"
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      transition={{ duration: 0.3 }}
      aria-live="polite"
      aria-atomic="false"
    >
      <div className="leaderboard-header">
        <span className="leaderboard-title">PLAYERS</span>
        <span className="leaderboard-alive" aria-label={`${sortedEntries.filter(e => e.isAlive).length} of ${totalPlayers} players remaining`}>
          {sortedEntries.filter(e => e.isAlive).length}/{totalPlayers}
        </span>
      </div>

      <div className="leaderboard-list" role="list">
        <AnimatePresence mode="popLayout">
          {sortedEntries.map((entry, index) => (
            <motion.div
              key={entry.id}
              className={`leaderboard-row ${entry.isPlayer ? 'player' : ''} ${!entry.isAlive ? 'dead' : ''}`}
              role="listitem"
              aria-label={`${entry.name}: ${entry.kills} kills, ${entry.isAlive ? 'alive' : 'eliminated'}`}
              layout
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              transition={{
                layout: { type: 'spring', stiffness: 300, damping: 30 },
                opacity: { duration: 0.2 },
                x: { type: 'spring', stiffness: 300, damping: 30 }
              }}
              whileHover={{ backgroundColor: entry.isPlayer ? 'rgba(34, 211, 238, 0.2)' : 'rgba(255, 255, 255, 0.06)' }}
            >
              <span className="leaderboard-rank">{index + 1}</span>
              <span
                className="leaderboard-color"
                style={{ background: `#${entry.color.toString(16).padStart(6, '0')}` }}
              />
              {entry.classType && (
                <span className={`leaderboard-class leaderboard-class-${entry.classType}`} title={entry.classType}>
                  {CLASS_ICONS[entry.classType]}
                </span>
              )}
              <span className="leaderboard-name">{entry.name}</span>
              <span className="leaderboard-kills">{entry.kills}</span>
              {!entry.isAlive && entry.placement && (
                <span className="leaderboard-placement">#{getOrdinal(entry.placement)}</span>
              )}
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </motion.div>
  );
});

export function useLeaderboard() {
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [totalPlayers, setTotalPlayers] = useState(0);

  const updateEntries = (newEntries: LeaderboardEntry[]) => {
    setEntries(newEntries);
    setTotalPlayers(newEntries.length);
  };

  const updatePlayer = (id: string, updates: Partial<LeaderboardEntry>) => {
    setEntries(prev => prev.map(e =>
      e.id === id ? { ...e, ...updates } : e
    ));
  };

  const setPlayerAlive = (id: string, isAlive: boolean, placement?: number) => {
    setEntries(prev => prev.map(e => {
      if (e.id === id) {
        const updated = { ...e, isAlive };
        if (!isAlive && placement !== undefined) {
          updated.placement = placement;
        }
        return updated;
      }
      return e;
    }));
  };

  const addKill = (id: string) => {
    setEntries(prev => prev.map(e =>
      e.id === id ? { ...e, kills: e.kills + 1 } : e
    ));
  };

  return {
    entries,
    totalPlayers,
    updateEntries,
    updatePlayer,
    setPlayerAlive,
    addKill,
  };
}

export default Leaderboard;
