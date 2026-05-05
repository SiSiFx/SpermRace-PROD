/**
 * PremiumButton - Casino-style button with glow effects
 * Gradient backgrounds, smooth hover animations
 */

import { forwardRef, type ButtonHTMLAttributes } from 'react';
import { classNames } from '../../../utils/classNames';

export interface PremiumButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** Button variant */
  variant?: 'primary' | 'secondary' | 'success' | 'danger' | 'ghost';
  /** Button size */
  size?: 'sm' | 'md' | 'lg' | 'xl';
  /** Enable glow effect */
  glow?: boolean;
  /** Full width button */
  fullWidth?: boolean;
  /** Loading state */
  loading?: boolean;
  /** Icon only button */
  iconOnly?: boolean;
}

export const PremiumButton = forwardRef<HTMLButtonElement, PremiumButtonProps>(
  (
    {
      children,
      variant = 'primary',
      size = 'md',
      glow = true,
      fullWidth = false,
      loading = false,
      iconOnly = false,
      className,
      disabled,
      style,
      ...props
    },
    ref
  ) => {
    const variantStyles: Record<string, React.CSSProperties> = {
      primary: {
        background: 'linear-gradient(135deg, #dc2626 0%, #b91c1c 100%)',
        color: '#ffffff',
        border: 'none',
        boxShadow: glow ? '0 4px 20px rgba(220, 38, 38, 0.4)' : '0 4px 12px rgba(0, 0, 0, 0.3)',
      },
      secondary: {
        background: 'rgba(0, 0, 0, 0.6)',
        color: '#ffffff',
        border: '1px solid rgba(255, 255, 255, 0.2)',
        boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3)',
      },
      success: {
        background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
        color: '#ffffff',
        border: 'none',
        boxShadow: glow ? '0 4px 20px rgba(16, 185, 129, 0.4)' : '0 4px 12px rgba(0, 0, 0, 0.3)',
      },
      danger: {
        background: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)',
        color: '#ffffff',
        border: 'none',
        boxShadow: glow ? '0 4px 20px rgba(239, 68, 68, 0.4)' : '0 4px 12px rgba(0, 0, 0, 0.3)',
      },
      ghost: {
        background: 'transparent',
        color: '#9ca3af',
        border: '1px solid transparent',
        boxShadow: 'none',
      },
    };

    const sizeStyles: Record<string, React.CSSProperties> = {
      sm: {
        padding: iconOnly ? '8px' : '8px 16px',
        fontSize: '12px',
        minHeight: '32px',
      },
      md: {
        padding: iconOnly ? '12px' : '12px 24px',
        fontSize: '14px',
        minHeight: '44px',
      },
      lg: {
        padding: iconOnly ? '14px' : '14px 32px',
        fontSize: '16px',
        minHeight: '52px',
      },
      xl: {
        padding: iconOnly ? '16px' : '16px 40px',
        fontSize: '18px',
        minHeight: '60px',
      },
    };

    const buttonStyle: React.CSSProperties = {
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      gap: '8px',
      fontFamily: "'Outfit', -apple-system, BlinkMacSystemFont, sans-serif",
      fontWeight: 700,
      textTransform: 'uppercase',
      letterSpacing: '0.05em',
      borderRadius: '8px',
      cursor: disabled || loading ? 'not-allowed' : 'pointer',
      opacity: disabled ? 0.5 : 1,
      transition: 'all 0.3s ease-out',
      width: fullWidth ? '100%' : 'auto',
      whiteSpace: 'nowrap',
      ...variantStyles[variant],
      ...sizeStyles[size],
      ...style,
    };

    return (
      <button
        ref={ref}
        className={classNames(
          'premium-button',
          `premium-button-${variant}`,
          `premium-button-${size}`,
          fullWidth && 'premium-button-full',
          loading && 'premium-button-loading',
          className
        )}
        style={buttonStyle}
        disabled={disabled || loading}
        {...props}
      >
        {loading ? (
          <span className="premium-button-spinner" />
        ) : (
          children
        )}
      </button>
    );
  }
);

PremiumButton.displayName = 'PremiumButton';
