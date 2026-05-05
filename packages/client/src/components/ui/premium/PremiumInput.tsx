/**
 * PremiumInput - Casino-style input field
 * Dark background, glowing focus state, clean typography
 */

import { forwardRef, type InputHTMLAttributes } from 'react';
import { classNames } from '../../../utils/classNames';

export interface PremiumInputProps extends InputHTMLAttributes<HTMLInputElement> {
  /** Input label */
  label?: string;
  /** Error message */
  error?: string;
  /** Helper text */
  helperText?: string;
  /** Size variant */
  inputSize?: 'sm' | 'md' | 'lg';
  /** Left icon */
  leftIcon?: React.ReactNode;
  /** Right icon */
  rightIcon?: React.ReactNode;
  /** Full width */
  fullWidth?: boolean;
}

export const PremiumInput = forwardRef<HTMLInputElement, PremiumInputProps>(
  (
    {
      label,
      error,
      helperText,
      inputSize = 'md',
      leftIcon,
      rightIcon,
      fullWidth = false,
      className,
      style,
      ...props
    },
    ref
  ) => {
    const sizeStyles: Record<string, { height: string; fontSize: string; padding: string; iconSize: string }> = {
      sm: { height: '36px', fontSize: '13px', padding: '8px 12px', iconSize: '16px' },
      md: { height: '44px', fontSize: '14px', padding: '10px 14px', iconSize: '18px' },
      lg: { height: '52px', fontSize: '16px', padding: '12px 16px', iconSize: '20px' },
    };

    const { height, fontSize, padding, iconSize } = sizeStyles[inputSize];

    const containerStyle: React.CSSProperties = {
      display: 'flex',
      flexDirection: 'column',
      gap: '6px',
      width: fullWidth ? '100%' : 'auto',
      ...style,
    };

    const labelStyle: React.CSSProperties = {
      fontSize: '12px',
      fontWeight: 600,
      textTransform: 'uppercase',
      letterSpacing: '0.08em',
      color: '#9ca3af',
      fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
    };

    const inputWrapperStyle: React.CSSProperties = {
      position: 'relative',
      display: 'flex',
      alignItems: 'center',
    };

    const inputStyle: React.CSSProperties = {
      width: '100%',
      height,
      padding,
      paddingLeft: leftIcon ? `calc(${padding.split(' ')[0]} + ${iconSize} + 8px)` : padding.split(' ')[0],
      paddingRight: rightIcon ? `calc(${padding.split(' ')[0]} + ${iconSize} + 8px)` : padding.split(' ')[0],
      fontSize,
      fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
      color: '#ffffff',
      background: 'rgba(0, 0, 0, 0.6)',
      border: error ? '1px solid rgba(220, 38, 38, 0.5)' : '1px solid rgba(255, 255, 255, 0.2)',
      borderRadius: '6px',
      outline: 'none',
      transition: 'all 0.2s ease-out',
    };

    const iconLeftStyle: React.CSSProperties = {
      position: 'absolute',
      left: padding.split(' ')[0],
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      color: '#6b7280',
      fontSize: iconSize,
      pointerEvents: 'none',
    };

    const iconRightStyle: React.CSSProperties = {
      position: 'absolute',
      right: padding.split(' ')[0],
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      color: '#6b7280',
      fontSize: iconSize,
    };

    const helperStyle: React.CSSProperties = {
      fontSize: '11px',
      color: error ? '#dc2626' : '#6b7280',
      fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
    };

    return (
      <div className={classNames('premium-input-container', className)} style={containerStyle}>
        {label && <label style={labelStyle}>{label}</label>}
        <div style={inputWrapperStyle}>
          {leftIcon && <span style={iconLeftStyle}>{leftIcon}</span>}
          <input
            ref={ref}
            className={classNames('premium-input', error && 'premium-input-error')}
            style={inputStyle}
            {...props}
          />
          {rightIcon && <span style={iconRightStyle}>{rightIcon}</span>}
        </div>
        {(error || helperText) && <span style={helperStyle}>{error || helperText}</span>}
      </div>
    );
  }
);

PremiumInput.displayName = 'PremiumInput';
