/**
 * GlassCard - Premium glass morphism card component
 * Semi-transparent dark backgrounds with backdrop blur
 */

import { forwardRef, type HTMLAttributes } from 'react';
import { classNames } from '../../../utils/classNames';

export interface GlassCardProps extends HTMLAttributes<HTMLDivElement> {
  /** Card variant affecting background darkness */
  variant?: 'default' | 'dark' | 'darker' | 'accent';
  /** Blur intensity in pixels */
  blur?: 4 | 8 | 12;
  /** Background opacity (0-1) */
  opacity?: number;
  /** Enable glow effect */
  glow?: boolean;
  /** Glow color */
  glowColor?: 'red' | 'green' | 'blue' | 'purple' | 'yellow';
  /** Padding size */
  padding?: 'none' | 'sm' | 'md' | 'lg' | 'xl';
  /** Enable hover lift effect */
  hoverable?: boolean;
  /** Make the card clickable */
  clickable?: boolean;
  /** Border style */
  border?: 'none' | 'subtle' | 'accent';
}

export const GlassCard = forwardRef<HTMLDivElement, GlassCardProps>(
  (
    {
      children,
      variant = 'default',
      blur = 4,
      opacity = 0.85,
      glow = false,
      glowColor = 'red',
      padding = 'md',
      hoverable = false,
      clickable = false,
      border = 'subtle',
      className,
      style,
      ...props
    },
    ref
  ) => {
    const variantStyles: Record<string, { bg: string }> = {
      default: { bg: `rgba(0, 0, 0, ${opacity})` },
      dark: { bg: `rgba(10, 14, 23, ${opacity})` },
      darker: { bg: `rgba(0, 0, 0, ${Math.min(opacity + 0.1, 1)})` },
      accent: { bg: `rgba(220, 38, 38, ${opacity * 0.15})` },
    };

    const glowColors: Record<string, string> = {
      red: 'rgba(220, 38, 38, 0.5)',
      green: 'rgba(16, 185, 129, 0.5)',
      blue: 'rgba(59, 130, 246, 0.5)',
      purple: 'rgba(139, 92, 246, 0.5)',
      yellow: 'rgba(245, 158, 11, 0.5)',
    };

    const paddingSizes: Record<string, string> = {
      none: '0',
      sm: '12px',
      md: '16px',
      lg: '24px',
      xl: '32px',
    };

    const borderStyles: Record<string, string> = {
      none: 'none',
      subtle: '1px solid rgba(255, 255, 255, 0.1)',
      accent: '2px solid rgba(220, 38, 38, 0.5)',
    };

    const cardStyle: React.CSSProperties = {
      background: variantStyles[variant].bg,
      backdropFilter: `blur(${blur}px)`,
      WebkitBackdropFilter: `blur(${blur}px)`,
      border: borderStyles[border],
      borderRadius: '8px',
      padding: paddingSizes[padding],
      boxShadow: glow
        ? `0 4px 20px rgba(0, 0, 0, 0.5), 0 0 20px ${glowColors[glowColor]}`
        : '0 4px 20px rgba(0, 0, 0, 0.5)',
      transition: 'all 0.3s ease-out',
      cursor: clickable ? 'pointer' : 'default',
      ...style,
    };

    return (
      <div
        ref={ref}
        className={classNames(
          'glass-card',
          hoverable && 'glass-card-hoverable',
          clickable && 'glass-card-clickable',
          className
        )}
        style={cardStyle}
        {...props}
      >
        {children}
      </div>
    );
  }
);

GlassCard.displayName = 'GlassCard';
