/**
 * PixelCard - Retro panel with pixel border
 * Container component for content grouping
 */

import { forwardRef, HTMLAttributes } from 'react';
import { classNames } from '../../../utils/classNames';

export interface PixelCardProps extends HTMLAttributes<HTMLDivElement> {
  /** Card variant */
  variant?: 'default' | 'light' | 'dark' | 'bordered';
  /** Padding size */
  padding?: 'none' | 'sm' | 'md' | 'lg';
}

export const PixelCard = forwardRef<HTMLDivElement, PixelCardProps>(
  (
    {
      children,
      variant = 'default',
      padding = 'md',
      className,
      ...props
    },
    ref
  ) => {
    const variantClasses = {
      default: 'pixel-card',
      light: 'pixel-card pixel-card-light',
      dark: 'pixel-card pixel-card-dark',
      bordered: 'pixel-card pixel-card-bordered',
    };
    const paddingClasses = {
      none: 'pixel-p-0',
      sm: 'pixel-p-sm',
      md: 'pixel-p-md',
      lg: 'pixel-p-lg',
    };

    return (
      <div
        ref={ref}
        className={classNames(
          variantClasses[variant],
          paddingClasses[padding],
          className
        )}
        {...props}
      >
        {children}
      </div>
    );
  }
);

PixelCard.displayName = 'PixelCard';
