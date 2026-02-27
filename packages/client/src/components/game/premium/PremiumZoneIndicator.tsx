/**
 * PremiumZoneIndicator - Dark Casino Style Zone Warning
 * Shows zone shrink warnings with urgency levels
 */

import { memo } from 'react';
import { Warning, Timer } from 'phosphor-react';
import './PremiumZoneIndicator.css';

interface PremiumZoneIndicatorProps {
  /** Zone percentage (0-100) */
  zonePercent: number;
  /** Time remaining in seconds */
  timeRemaining?: number;
}

export const PremiumZoneIndicator = memo(function PremiumZoneIndicator({
  zonePercent,
  timeRemaining,
}: PremiumZoneIndicatorProps) {
  const percent = Math.max(0, Math.min(100, zonePercent));
  const isDanger = percent <= 25;
  const isWarning = percent <= 50 && !isDanger;

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className={`premium-zone-indicator ${isDanger ? 'danger' : isWarning ? 'warning' : ''}`}>
      <div className="premium-zone-icon">
        <Warning size={18} weight="fill" />
      </div>
      <div className="premium-zone-content">
        <div className="premium-zone-label">ZONE SHRINKING</div>
        <div className="premium-zone-progress">
          <div className="premium-zone-track">
            <div
              className="premium-zone-fill"
              style={{ width: `${percent}%` }}
            />
          </div>
          <span className="premium-zone-percent">{Math.round(percent)}%</span>
        </div>
      </div>
      {typeof timeRemaining === 'number' && (
        <div className="premium-zone-timer">
          <Timer size={14} weight="bold" />
          <span>{formatTime(timeRemaining)}</span>
        </div>
      )}
    </div>
  );
});

PremiumZoneIndicator.displayName = 'PremiumZoneIndicator';
