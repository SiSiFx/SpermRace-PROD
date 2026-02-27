/**
 * ProgressBar - Premium progress bar with gradient fill
 * Smooth animations, glow effects, rounded caps
 */

import { forwardRef, HTMLAttributes } from 'react';
import { classNames } from '../../../utils/classNames';

export interface ProgressBarProps extends HTMLAttributes<HTMLDivElement> {
  /** Progress value (0-100) */
  value: number;
  /** Max value for progress calculation */
  max?: number;
  /** Color theme */
  color?: 'red' | 'green' | 'blue' | 'purple' | 'yellow' | 'gradient';
  /** Size variant */
  size?: 'sm' | 'md' | 'lg';
  /** Enable glow effect */
  glow?: boolean;
  /** Show percentage label */
  showLabel?: boolean;
  /** Custom label */
  label?: string;
  /** Animate on mount */
  animated?: boolean;
}

export const ProgressBar = forwardRef<HTMLDivElement, ProgressBarProps>(
  (
    {
      value,
      max = 100,
      color = 'red',
      size = 'md',
      glow = false,
      showLabel = false,
      label,
      animated = true,
      className,
      style,
      ...props
    },
    ref
  ) => {
    const percentage = Math.min(100, Math.max(0, (value / max) * 100));

    const colorStyles: Record<string, { gradient: string; glow: string }> = {
      red: {
        gradient: 'linear-gradient(90deg, #dc2626 0%, #ef4444 100%)',
        glow: 'rgba(220, 38, 38, 0.5)',
      },
      green: {
        gradient: 'linear-gradient(90deg, #10b981 0%, #34d399 100%)',
        glow: 'rgba(16, 185, 129, 0.5)',
      },
      blue: {
        gradient: 'linear-gradient(90deg, #3b82f6 0%, #60a5fa 100%)',
        glow: 'rgba(59, 130, 246, 0.5)',
      },
      purple: {
        gradient: 'linear-gradient(90deg, #8b5cf6 0%, #a78bfa 100%)',
        glow: 'rgba(139, 92, 246, 0.5)',
      },
      yellow: {
        gradient: 'linear-gradient(90deg, #f59e0b 0%, #fbbf24 100%)',
        glow: 'rgba(245, 158, 11, 0.5)',
      },
      gradient: {
        gradient: 'linear-gradient(90deg, #dc2626 0%, #f59e0b 50%, #10b981 100%)',
        glow: 'rgba(245, 158, 11, 0.5)',
      },
    };

    const sizeStyles: Record<string, { height: string; borderRadius: string; fontSize: string }> = {
      sm: { height: '6px', borderRadius: '3px', fontSize: '10px' },
      md: { height: '10px', borderRadius: '5px', fontSize: '11px' },
      lg: { height: '16px', borderRadius: '8px', fontSize: '12px' },
    };

    const { gradient, glow: glowColor } = colorStyles[color];
    const { height, borderRadius, fontSize } = sizeStyles[size];

    const containerStyle: React.CSSProperties = {
      display: 'flex',
      flexDirection: 'column',
      gap: '6px',
      width: '100%',
      ...style,
    };

    const trackStyle: React.CSSProperties = {
      position: 'relative',
      width: '100%',
      height,
      background: 'rgba(0, 0, 0, 0.6)',
      borderRadius,
      overflow: 'hidden',
      border: '1px solid rgba(255, 255, 255, 0.1)',
    };

    const fillStyle: React.CSSProperties = {
      position: 'absolute',
      left: 0,
      top: 0,
      bottom: 0,
      width: `${percentage}%`,
      background: gradient,
      borderRadius,
      boxShadow: glow ? `0 0 12px ${glowColor}` : 'none',
      transition: animated ? 'width 0.5s ease-out' : 'none',
    };

    const labelStyle: React.CSSProperties = {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      fontFamily: "'Outfit', -apple-system, BlinkMacSystemFont, sans-serif",
      fontSize,
      fontWeight: 600,
      color: '#9ca3af',
    };

    return (
      <div
        ref={ref}
        className={classNames('progress-bar', `progress-bar-${color}`, `progress-bar-${size}`, className)}
        style={containerStyle}
        role="progressbar"
        aria-valuenow={value}
        aria-valuemin={0}
        aria-valuemax={max}
        {...props}
      >
        {(showLabel || label) && (
          <div style={labelStyle}>
            <span>{label || ''}</span>
            {showLabel && <span>{Math.round(percentage)}%</span>}
          </div>
        )}
        <div style={trackStyle}>
          <div style={fillStyle} />
        </div>
      </div>
    );
  }
);

ProgressBar.displayName = 'ProgressBar';
