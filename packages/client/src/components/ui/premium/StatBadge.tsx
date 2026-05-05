/**
 * StatBadge - Premium stat display badge
 * Glass card with icon, label, and value
 */

import { forwardRef, type HTMLAttributes, type ReactNode } from 'react';
import { classNames } from '../../../utils/classNames';

export interface StatBadgeProps extends HTMLAttributes<HTMLDivElement> {
  /** Stat label */
  label: string;
  /** Stat value */
  value: string | number;
  /** Optional icon */
  icon?: ReactNode;
  /** Color theme */
  color?: 'default' | 'red' | 'green' | 'blue' | 'purple' | 'yellow';
  /** Size variant */
  size?: 'sm' | 'md' | 'lg';
  /** Layout direction */
  direction?: 'horizontal' | 'vertical';
  /** Enable glow effect */
  glow?: boolean;
}

export const StatBadge = forwardRef<HTMLDivElement, StatBadgeProps>(
  (
    {
      label,
      value,
      icon,
      color = 'default',
      size = 'md',
      direction = 'vertical',
      glow = false,
      className,
      style,
      ...props
    },
    ref
  ) => {
    const colorStyles: Record<string, { accent: string; glow: string }> = {
      default: { accent: '#ffffff', glow: 'rgba(255, 255, 255, 0.3)' },
      red: { accent: '#dc2626', glow: 'rgba(220, 38, 38, 0.5)' },
      green: { accent: '#10b981', glow: 'rgba(16, 185, 129, 0.5)' },
      blue: { accent: '#3b82f6', glow: 'rgba(59, 130, 246, 0.5)' },
      purple: { accent: '#8b5cf6', glow: 'rgba(139, 92, 246, 0.5)' },
      yellow: { accent: '#f59e0b', glow: 'rgba(245, 158, 11, 0.5)' },
    };

    const sizeStyles: Record<string, { padding: string; fontSize: string; iconSize: string; valueFontSize: string }> = {
      sm: { padding: '8px 12px', fontSize: '10px', iconSize: '16px', valueFontSize: '14px' },
      md: { padding: '12px 16px', fontSize: '11px', iconSize: '20px', valueFontSize: '18px' },
      lg: { padding: '16px 20px', fontSize: '12px', iconSize: '24px', valueFontSize: '24px' },
    };

    const { accent, glow: glowColor } = colorStyles[color];
    const { padding, fontSize, iconSize, valueFontSize } = sizeStyles[size];

    const containerStyle: React.CSSProperties = {
      display: 'flex',
      flexDirection: direction === 'vertical' ? 'column' : 'row',
      alignItems: 'center',
      gap: direction === 'vertical' ? '4px' : '12px',
      padding,
      background: 'rgba(0, 0, 0, 0.85)',
      backdropFilter: 'blur(4px)',
      WebkitBackdropFilter: 'blur(4px)',
      border: '1px solid rgba(255, 255, 255, 0.1)',
      borderRadius: '8px',
      boxShadow: glow ? `0 4px 20px rgba(0, 0, 0, 0.5), 0 0 20px ${glowColor}` : '0 4px 20px rgba(0, 0, 0, 0.5)',
      ...style,
    };

    const iconStyle: React.CSSProperties = {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      color: accent,
      fontSize: iconSize,
      filter: glow ? `drop-shadow(0 0 8px ${glowColor})` : 'none',
    };

    const labelStyle: React.CSSProperties = {
      fontSize,
      fontWeight: 600,
      textTransform: 'uppercase',
      letterSpacing: '0.1em',
      color: '#9ca3af',
      fontFamily: "'Outfit', -apple-system, BlinkMacSystemFont, sans-serif",
    };

    const valueStyle: React.CSSProperties = {
      fontSize: valueFontSize,
      fontWeight: 600,
      color: accent,
      fontFamily: "'JetBrains Mono', monospace",
      fontVariantNumeric: 'tabular-nums',
    };

    return (
      <div
        ref={ref}
        className={classNames('stat-badge', `stat-badge-${color}`, `stat-badge-${size}`, className)}
        style={containerStyle}
        {...props}
      >
        {icon && <div style={iconStyle}>{icon}</div>}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: direction === 'vertical' ? 'center' : 'flex-start', gap: '2px' }}>
          <span style={valueStyle}>{value}</span>
          <span style={labelStyle}>{label}</span>
        </div>
      </div>
    );
  }
);

StatBadge.displayName = 'StatBadge';
