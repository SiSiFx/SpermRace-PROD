/**
 * PremiumAbilityBar - Dark Casino Style Boost Bar
 * Sleek horizontal boost/ability indicator
 */

import { memo } from 'react';
import { Lightning } from 'phosphor-react';
import './PremiumAbilityBar.css';

interface PremiumAbilityBarProps {
  /** Boost percentage (0-100) */
  boostPercent: number;
  /** Additional class name */
  className?: string;
}

export const PremiumAbilityBar = memo(function PremiumAbilityBar({
  boostPercent,
  className = '',
}: PremiumAbilityBarProps) {
  const percent = Math.max(0, Math.min(100, boostPercent));
  const isLow = percent < 25;
  const isReady = percent >= 100;

  return (
    <div className={`premium-ability-bar ${isLow ? 'low' : ''} ${isReady ? 'ready' : ''} ${className}`}>
      <div className="premium-ability-icon">
        <Lightning size={16} weight={isReady ? 'fill' : 'duotone'} />
      </div>
      <div className="premium-ability-track">
        <div
          className="premium-ability-fill"
          style={{ width: `${percent}%` }}
        />
        <div className="premium-ability-glow" style={{ width: `${percent}%` }} />
      </div>
      <div className="premium-ability-percent">
        {Math.round(percent)}%
      </div>
    </div>
  );
});

PremiumAbilityBar.displayName = 'PremiumAbilityBar';
