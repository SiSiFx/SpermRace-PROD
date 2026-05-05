/**
 * PixelBadge - 8-bit style status indicator
 * Small rectangular/square badges for labels and status
 */

import { forwardRef, type HTMLAttributes } from 'react';
import { classNames } from '../../../utils/classNames';

export interface PixelBadgeProps extends HTMLAttributes<HTMLSpanElement> {
  /** Badge variant */
  variant?: 'default' | 'primary' | 'accent' | 'success' | 'warning' | 'popular';
  /** Badge size */
  size?: 'sm' | 'md';
}

export const PixelBadge = forwardRef<HTMLSpanElement, PixelBadgeProps>(
  (
    {
      children,
      variant = 'default',
      size = 'md',
      className,
      ...props
    },
    ref
  ) => {
    const variantClasses = {
      default: 'pixel-badge',
      primary: 'pixel-badge pixel-badge-primary',
      accent: 'pixel-badge pixel-badge-accent',
      success: 'pixel-badge pixel-badge-success',
      warning: 'pixel-badge pixel-badge-warning',
      popular: 'pixel-badge pixel-badge-popular',
    };
    const sizeClasses = {
      sm: 'pixel-badge-sm',
      md: 'pixel-badge-md',
    };

    return (
      <span
        ref={ref}
        className={classNames(
          variantClasses[variant],
          sizeClasses[size],
          className
        )}
        {...props}
      >
        {children}
      </span>
    );
  }
);

PixelBadge.displayName = 'PixelBadge';
