/**
 * PixelZoneIndicator - Zone shrinking warning
 * Flashing pixel border warning when arena is shrinking
 */

import { memo } from 'react';
import { Warning } from 'phosphor-react';
import './PixelZoneIndicator.css';

export interface PixelZoneIndicatorProps {
  /** Zone percentage (0-100) */
  zonePercent?: number;
  /** Additional CSS class name */
  className?: string;
}

export const PixelZoneIndicator = memo(function PixelZoneIndicator({
  zonePercent = 50,
  className,
}: PixelZoneIndicatorProps) {
  const isDanger = zonePercent < 30;

  return (
    <div className={`pixel-zone-indicator ${isDanger ? 'pixel-zone-danger' : ''} ${className || ''}`}>
      <div className="pixel-zone-content">
        <Warning size={24} weight="fill" className="pixel-zone-icon" />
        <span className="pixel-zone-text">ZONE SHRINKING</span>
        <span className="pixel-zone-percent">{Math.round(zonePercent)}%</span>
      </div>
    </div>
  );
});

PixelZoneIndicator.displayName = 'PixelZoneIndicator';
