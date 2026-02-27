/**
 * PixelButton - Retro pixel art style button
 * Chunky borders, pressed states, 2-frame hover animation
 */

import { forwardRef, ButtonHTMLAttributes } from 'react';
import { classNames } from '../../../utils/classNames';

export interface PixelButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** Button variant */
  variant?: 'primary' | 'secondary' | 'accent' | 'success' | 'ghost';
  /** Button size */
  size?: 'sm' | 'md' | 'lg';
  /** Full width button */
  fullWidth?: boolean;
  /** Disable pixel shadow */
  noShadow?: boolean;
}

export const PixelButton = forwardRef<HTMLButtonElement, PixelButtonProps>(
  (
    {
      children,
      variant = 'secondary',
      size = 'md',
      fullWidth = false,
      noShadow = false,
      className,
      disabled,
      ...props
    },
    ref
  ) => {
    const baseClasses = 'pixel-btn';
    const variantClasses = {
      primary: 'pixel-btn-primary',
      secondary: '',
      accent: 'pixel-btn-accent',
      success: 'pixel-btn-success',
      ghost: 'pixel-btn-ghost',
    };
    const sizeClasses = {
      sm: 'pixel-btn-sm',
      md: 'pixel-btn-md',
      lg: 'pixel-btn-lg',
    };

    return (
      <button
        ref={ref}
        className={classNames(
          baseClasses,
          variantClasses[variant],
          sizeClasses[size],
          fullWidth && 'pixel-btn-full',
          noShadow && 'pixel-btn-no-shadow',
          disabled && 'pixel-btn-disabled',
          className
        )}
        disabled={disabled}
        {...props}
      >
        {children}
      </button>
    );
  }
);

PixelButton.displayName = 'PixelButton';
