/**
 * PixelIcon - SVG icons rendered as pixel art
 * Wraps Phosphor icons with pixel-specific rendering
 */

import { forwardRef, SVGProps } from 'react';
import { classNames } from '../../../utils/classNames';

export interface PixelIconProps extends SVGProps<SVGSVGElement> {
  /** Icon name (maps to Phosphor icon) */
  icon?: string;
}

/**
 * Pixel icon wrapper that ensures pixel-perfect rendering
 * Use with Phosphor icons or custom SVG paths
 */
export const PixelIcon = forwardRef<SVGSVGElement, PixelIconProps>(
  ({ className, style, children, ...props }, ref) => {
    return (
      <svg
        ref={ref}
        viewBox="0 0 24 24"
        fill="currentColor"
        className={classNames('pixel-icon', className)}
        style={{
          // Ensure pixel-perfect rendering
          imageRendering: 'pixelated',
          shapeRendering: 'crispEdges',
          ...style,
        }}
        {...props}
      >
        {children}
      </svg>
    );
  }
);

PixelIcon.displayName = 'PixelIcon';

/**
 * Pre-defined pixel icon paths
 * These are simplified pixel-art versions of common icons
 */
export const PixelIcons = {
  // Game icons
  trophy: (
    <path d="M12 2L8 6h8l-4-4zm-2 5v10h4V7H10zm6 2h2v6h-2V9zM6 9h2v6H6V9zm2 10h8v2H8v-2z" />
  ),
  gamepad: (
    <path d="M6 8h12v8H6V8zm2 2v4h2v-4H8zm6 0v4h2v-4h-2z" />
  ),
  skull: (
    <path d="M8 8a4 4 0 014-4 4 4 0 014 4v4H8V8zm0 6v2h8v-2H8z" />
  ),
  lightning: (
    <path d="M13 2l-6 10h5l-2 8 8-12h-5l2-6h-2z" />
  ),
  sword: (
    <path d="M10 4l4 4-6 6-4-4 6-6zm2 2l-2 2 4 4 2-2-4-4z" />
  ),
  chart: (
    <path d="M4 18h4v-8H4v8zm6 0h4v-12h-4v12zm6 0h4v-4h-4v4z" />
  ),
  users: (
    <path d="M8 8a2 2 0 100-4 2 2 0 000 4zm8 0a2 2 0 100-4 2 2 0 000 4zM8 10c-3 0-4 2-4 4v2h8v-2c0-2-1-4-4-4zm8 0c-3 0-4 2-4 4v2h8v-2c0-2-1-4-4-4z" />
  ),
  wallet: (
    <path d="M4 8h16v8H4V8zm2 2v4h4v-4H6z" />
  ),
  crown: (
    <path d="M4 8l4-4 4 4 4-4 4 4v8H4V8z" />
  ),
  target: (
    <path d="M12 4a8 8 0 100 16 8 8 0 000-16zm0 4a4 4 0 110 8 4 4 0 010-8zm0 2a2 2 0 100 4 2 2 0 000-4z" />
  ),
  close: (
    <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2" />
  ),
  arrowLeft: (
    <path d="M10 6L4 12l6 6M4 12h16" stroke="currentColor" strokeWidth="2" />
  ),
  arrowRight: (
    <path d="M14 6l6 6-6 6M4 12h16" stroke="currentColor" strokeWidth="2" />
  ),
  check: (
    <path d="M4 12l4 4 8-8" stroke="currentColor" strokeWidth="2" fill="none" />
  ),
  warning: (
    <path d="M12 2L2 20h20L12 2zm0 6v6m0 4h.01" stroke="currentColor" strokeWidth="2" />
  ),
  info: (
    <path d="M12 2a10 10 0 100 20 10 10 0 000-20zm1 15h-2v-6h2v6zm0-8h-2v-2h2v2z" />
  ),
  home: (
    <path d="M4 10l8-6 8 6v8H4v-8zm4 6h8v-4H8v4z" />
  ),
  refresh: (
    <path d="M4 12a8 8 0 1116 0M4 12V8m0 4h4" stroke="currentColor" strokeWidth="2" />
  ),
  settings: (
    <path d="M12 2a2 2 0 012 2v2a2 2 0 01-2 2 2 2 0 01-2-2V4a2 2 0 012-2zm0 14a2 2 0 012 2v2a2 2 0 01-2 2 2 2 0 01-2-2v-2a2 2 0 012-2zM2 12a2 2 0 012-2h2a2 2 0 012 2 2 2 0 01-2 2H4a2 2 0 01-2-2zm14 0a2 2 0 012-2h2a2 2 0 012 2 2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
  ),
};
