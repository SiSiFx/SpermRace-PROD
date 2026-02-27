/**
 * PixelKillFeed - Scrolling pixel text death notifications
 * Kill feed with pixel skull icons for in-game events
 */

import { useState, useEffect, memo } from 'react';
import './PixelKillFeed.css';

export interface PixelKillFeedEntry {
  killer: string;
  victim: string;
  time: number;
}

export interface PixelKillFeedProps {
  entries: PixelKillFeedEntry[];
  maxEntries?: number;
}

export const PixelKillFeed = memo(function PixelKillFeed({
  entries,
  maxEntries = 5,
}: PixelKillFeedProps) {
  const [visibleEntries, setVisibleEntries] = useState<typeof entries>([]);

  useEffect(() => {
    // Show recent entries
    const recent = entries.slice(-maxEntries);
    setVisibleEntries(recent);
  }, [entries, maxEntries]);

  if (visibleEntries.length === 0) return null;

  return (
    <div className="pixel-kill-feed">
      {visibleEntries.map((entry, index) => (
        <div
          key={`${entry.victim}-${entry.time}`}
          className="pixel-kill-entry"
          style={{ animationDelay: `${index * 50}ms` }}
        >
          {/* Pixel skull icon */}
          <svg
            className="pixel-kill-skull"
            viewBox="0 0 16 16"
            fill="currentColor"
            aria-hidden="true"
          >
            <rect x="4" y="4" width="8" height="6" fill="currentColor" />
            <rect x="2" y="3" width="2" height="2" fill="currentColor" />
            <rect x="12" y="3" width="2" height="2" fill="currentColor" />
            <rect x="3" y="2" width="10" height="2" fill="currentColor" />
            <rect x="5" y="11" width="6" height="1" fill="currentColor" />
            {/* Eye sockets */}
            <rect x="5" y="6" width="2" height="2" fill="#1d2b53" />
            <rect x="9" y="6" width="2" height="2" fill="#1d2b53" />
          </svg>

          <span className="pixel-kill-killer">{entry.killer}</span>
          <span className="pixel-kill-x">×</span>
          <span className="pixel-kill-victim">{entry.victim}</span>
        </div>
      ))}
    </div>
  );
});

PixelKillFeed.displayName = 'PixelKillFeed';
