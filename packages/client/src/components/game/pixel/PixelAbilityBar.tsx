/**
 * PixelAbilityBar - Blocky cooldown bar for abilities
 * Retro segmented bar showing boost/ability cooldown
 */

import { memo } from 'react';
import './PixelAbilityBar.css';

export interface PixelAbilityBarProps {
  /** Boost/ability percentage (0-100) */
  boostPercent: number;
  /** Additional CSS class name */
  className?: string;
  /** Label to show */
  label?: string;
}

export const PixelAbilityBar = memo(function PixelAbilityBar({
  boostPercent,
  className,
  label = 'BOOST',
}: PixelAbilityBarProps) {
  const clampedPercent = Math.max(0, Math.min(100, boostPercent));
  const segments = 10; // 10 blocky segments
  const filledSegments = Math.ceil((clampedPercent / 100) * segments);

  return (
    <div className={`pixel-ability-bar ${className || ''}`}>
      {/* Label */}
      <div className="pixel-ability-label">{label}</div>

      {/* Bar container */}
      <div className="pixel-ability-container" aria-hidden="true">
        {Array.from({ length: segments }).map((_, index) => (
          <div
            key={index}
            className={`pixel-ability-segment ${index < filledSegments ? 'pixel-filled' : ''}`}
          />
        ))}
      </div>

      {/* Percentage text */}
      <div className="pixel-ability-percent">{Math.round(clampedPercent)}%</div>
    </div>
  );
});

PixelAbilityBar.displayName = 'PixelAbilityBar';
