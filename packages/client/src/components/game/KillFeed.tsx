/**
 * KillFeed.tsx - Real-time Elimination Feed
 * Shows eliminations as they happen with brutal aesthetic
 * PERFORMANCE: Uses React.memo to prevent unnecessary re-renders
 */

import { useEffect, useState, memo, useRef } from 'react';
import './KillFeed.css';

export interface KillFeedEntry {
  id: string;
  victimName: string;
  victimColor: number;
  killerName: string | null; // null = self-elimination
  killerColor: number | null;
  timestamp: number;
  ownTrail: boolean;
}

interface KillFeedProps {
  entries: KillFeedEntry[];
  isMobile?: boolean;
}

/**
 * Kill feed component - shows real-time eliminations
 * PERFORMANCE: Memoized to prevent unnecessary re-renders
 */
export const KillFeed = memo(function KillFeed({ entries, isMobile = false }: KillFeedProps) {
  const [visibleEntries, setVisibleEntries] = useState<KillFeedEntry[]>([]);
  // Track processed entry IDs to avoid re-adding
  const processedIdsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    // Remove old entries after 5 seconds
    const now = Date.now();
    setVisibleEntries(prev => prev.filter(e => now - e.timestamp < 5000));

    // Add new entries that haven't been processed yet
    const newEntries = entries.filter(entry => !processedIdsRef.current.has(entry.id));
    if (newEntries.length > 0) {
      // Mark all current entries as processed
      entries.forEach(entry => processedIdsRef.current.add(entry.id));

      setVisibleEntries(prev => {
        // Add new entries and keep only last 5
        const updated = [...prev, ...newEntries].slice(-5);
        return updated;
      });
    }
  }, [entries]);

  if (visibleEntries.length === 0) return null;

  // Mobile: Show only last 3 entries, more compact
  const mobileEntries = isMobile ? visibleEntries.slice(-3) : visibleEntries;

  return (
    <div className={`kill-feed${isMobile ? ' kill-feed-mobile' : ''}`} role="log" aria-live="polite" aria-atomic="false">
      {mobileEntries.map((entry, index) => (
        <div
          key={entry.id}
          className="kill-feed-entry"
          style={{ animationDelay: `${index * 50}ms` }}
          aria-label={
            entry.ownTrail
              ? `${entry.victimName} crashed into their own trail`
              : entry.killerName
              ? `${entry.killerName} eliminated ${entry.victimName}`
              : `${entry.victimName} was eliminated`
          }
        >
          {/* Killer */}
          {entry.killerName && (
            <>
              <span
                className="kill-feed-color"
                style={{ background: `#${entry.killerColor!.toString(16).padStart(6, '0')}` }}
              />
              <span className="kill-feed-name killer">{entry.killerName}</span>
              <span className="kill-feed-action">ELIMINATED</span>
            </>
          )}

          {/* Self-elimination */}
          {entry.ownTrail && (
            <>
              <span className="kill-feed-name victim">{entry.victimName}</span>
              <span className="kill-feed-action">CRASHED</span>
            </>
          )}

          {/* Victim */}
          {!entry.ownTrail && (
            <>
              <span
                className="kill-feed-color"
                style={{ background: `#${entry.victimColor.toString(16).padStart(6, '0')}` }}
              />
              <span className="kill-feed-name victim">{entry.victimName}</span>
            </>
          )}
        </div>
      ))}
    </div>
  );
});

/**
 * Hook to manage kill feed state
 */
export function useKillFeed() {
  const [entries, setEntries] = useState<KillFeedEntry[]>([]);

  const addKill = (
    victimName: string,
    victimColor: number,
    killerName: string | null,
    killerColor: number | null,
    ownTrail: boolean
  ) => {
    const entry: KillFeedEntry = {
      id: `${Date.now()}-${Math.random()}`,
      victimName,
      victimColor,
      killerName,
      killerColor,
      timestamp: Date.now(),
      ownTrail,
    };
    setEntries(prev => [...prev, entry]);
  };

  const clearKills = () => {
    setEntries([]);
  };

  return {
    entries,
    addKill,
    clearKills,
  };
}

export default KillFeed;
