/**
 * PixelMinimap - 64x64 pixel grid arena view
 * Retro radar-style minimap for tracking player positions
 */

import { memo } from 'react';
import './PixelMinimap.css';

export interface PixelMinimapProps {
  /** Zone/shrink percentage (0-100) */
  zonePercent?: number;
  /** Additional CSS class name */
  className?: string;
  /** Player positions on minimap */
  playerPositions?: Array<{
    x: number; // 0-100 (percentage of arena width)
    y: number; // 0-100 (percentage of arena height)
    isPlayer: boolean;
    color: string;
  }>;
}

export const PixelMinimap = memo(function PixelMinimap({
  zonePercent = 100,
  className,
  playerPositions = [],
}: PixelMinimapProps) {
  // Generate some default player positions for demo
  const positions = playerPositions.length > 0 ? playerPositions : [
    { x: 50, y: 50, isPlayer: true, color: '#29adff' },
    { x: 20, y: 30, isPlayer: false, color: '#ff004d' },
    { x: 70, y: 60, isPlayer: false, color: '#00e436' },
    { x: 40, y: 80, isPlayer: false, color: '#ffec27' },
  ];

  // Calculate zone boundary size
  const zoneSize = Math.max(20, zonePercent);

  return (
    <div className={`pixel-minimap ${className || ''}`}>
      {/* Minimap container */}
      <div className="pixel-minimap-container">
        {/* Background grid */}
        <div className="pixel-minimap-grid" aria-hidden="true">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="pixel-grid-line pixel-grid-line-h" style={{ top: `${i * 12.5}%` }} />
          ))}
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="pixel-grid-line pixel-grid-line-v" style={{ left: `${i * 12.5}%` }} />
          ))}
        </div>

        {/* Zone boundary */}
        <div
          className="pixel-minimap-zone"
          style={{
            width: `${zoneSize}%`,
            height: `${zoneSize}%`,
            left: `${(100 - zoneSize) / 2}%`,
            top: `${(100 - zoneSize) / 2}%`,
          }}
        />

        {/* Player dots */}
        {positions.map((pos, index) => (
          <div
            key={index}
            className={`pixel-player-dot ${pos.isPlayer ? 'pixel-player-me' : ''}`}
            style={{
              left: `${pos.x}%`,
              top: `${pos.y}%`,
              backgroundColor: pos.color,
            }}
            aria-hidden="true"
          />
        ))}
      </div>

      {/* Zone indicator */}
      <div className="pixel-minimap-zone-label">
        ZONE: {Math.round(zonePercent)}%
      </div>
    </div>
  );
});

PixelMinimap.displayName = 'PixelMinimap';
