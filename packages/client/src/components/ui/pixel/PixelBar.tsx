/**
 * PixelBar - Blocky progress/health bar
 * Segmented pixel fill for retro feel
 */

import { forwardRef, HTMLAttributes } from 'react';
import { classNames } from '../../../utils/classNames';

export interface PixelBarProps extends HTMLAttributes<HTMLDivElement> {
  /** Progress value (0-100) */
  value: number;
  /** Bar variant */
  variant?: 'primary' | 'success' | 'warning' | 'danger';
  /** Bar height */
  size?: 'sm' | 'md' | 'lg';
  /** Show pixel segments */
  segmented?: boolean;
}

export const PixelBar = forwardRef<HTMLDivElement, PixelBarProps>(
  (
    {
      value = 0,
      variant = 'primary',
      size = 'md',
      segmented = true,
      className,
      ...props
    },
    ref
  ) => {
    const clampedValue = Math.max(0, Math.min(100, value));
    const variantClasses = {
      primary: 'pixel-bar-fill pixel-bar-primary',
      success: 'pixel-bar-fill pixel-bar-success',
      warning: 'pixel-bar-fill pixel-bar-warning',
      danger: 'pixel-bar-fill pixel-bar-danger',
    };
    const sizeClasses = {
      sm: 'pixel-bar-sm',
      md: 'pixel-bar-md',
      lg: 'pixel-bar-lg',
    };

    return (
      <div
        ref={ref}
        className={classNames(
          'pixel-bar-container',
          sizeClasses[size],
          !segmented && 'pixel-bar-solid',
          className
        )}
        role="progressbar"
        aria-valuenow={clampedValue}
        aria-valuemin={0}
        aria-valuemax={100}
        {...props}
      >
        <div
          className={classNames(
            variantClasses[variant],
            !segmented && 'pixel-bar-fill-solid'
          )}
          style={{ width: `${clampedValue}%` }}
        />
      </div>
    );
  }
);

PixelBar.displayName = 'PixelBar';
