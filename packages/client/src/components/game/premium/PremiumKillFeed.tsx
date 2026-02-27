/**
 * PremiumKillFeed - Dark Casino Style Kill Feed
 * Real-time elimination notifications with glass morphism
 */

import { memo, useEffect, useState, useRef } from 'react';
import { Skull, Lightning } from 'phosphor-react';
import './PremiumKillFeed.css';

export interface PremiumKillFeedEntry {
  id: string;
  killer: string;
  victim: string;
  killerColor?: number;
  victimColor?: number;
  ownTrail?: boolean;
  time: number;
}

interface PremiumKillFeedProps {
  entries: PremiumKillFeedEntry[];
  isMobile?: boolean;
}

export const PremiumKillFeed = memo(function PremiumKillFeed({
  entries,
  isMobile = false,
}: PremiumKillFeedProps) {
  const [visibleEntries, setVisibleEntries] = useState<PremiumKillFeedEntry[]>([]);
  const processedIdsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    const now = Date.now();
    // Remove entries older than 5 seconds
    setVisibleEntries(prev => prev.filter(e => now - e.time < 5000));

    // Add new entries
    const newEntries = entries.filter(entry => !processedIdsRef.current.has(entry.id));
    if (newEntries.length > 0) {
      entries.forEach(entry => processedIdsRef.current.add(entry.id));
      setVisibleEntries(prev => [...prev, ...newEntries].slice(-5));
    }
  }, [entries]);

  if (visibleEntries.length === 0) return null;

  const displayEntries = isMobile ? visibleEntries.slice(-3) : visibleEntries;

  return (
    <div className={`premium-kill-feed ${isMobile ? 'is-mobile' : ''}`}>
      {displayEntries.map((entry, index) => (
        <div
          key={entry.id}
          className={`premium-kill-entry ${entry.ownTrail ? 'self-kill' : ''}`}
          style={{ animationDelay: `${index * 50}ms` }}
        >
          <div className="premium-kill-icon">
            {entry.ownTrail ? (
              <Lightning size={14} weight="fill" />
            ) : (
              <Skull size={14} weight="fill" />
            )}
          </div>

          {entry.ownTrail ? (
            <>
              <span
                className="premium-kill-name victim"
                style={entry.victimColor ? {
                  color: `#${entry.victimColor.toString(16).padStart(6, '0')}`
                } : undefined}
              >
                {entry.victim}
              </span>
              <span className="premium-kill-action">crashed</span>
            </>
          ) : (
            <>
              <span
                className="premium-kill-name killer"
                style={entry.killerColor ? {
                  color: `#${entry.killerColor.toString(16).padStart(6, '0')}`
                } : undefined}
              >
                {entry.killer}
              </span>
              <span className="premium-kill-action">eliminated</span>
              <span
                className="premium-kill-name victim"
                style={entry.victimColor ? {
                  color: `#${entry.victimColor.toString(16).padStart(6, '0')}`
                } : undefined}
              >
                {entry.victim}
              </span>
            </>
          )}
        </div>
      ))}
    </div>
  );
});

PremiumKillFeed.displayName = 'PremiumKillFeed';
