/**
 * UI Scaling Utilities
 * Provides responsive scaling functions for UI elements across all device sizes
 * Ensures perfect scaling and tap-friendly targets on all devices
 */

// Viewport breakpoints in pixels
export const BREAKPOINTS = {
  XS: 320,   // Very small phones
  SM: 375,   // Small phones (iPhone SE)
  MD: 768,   // Tablets
  LG: 1024,  // Desktop
  XL: 1440,  // Large desktop
} as const;

// Minimum touch target sizes (WCAG 2.1 AAA compliant)
export const TOUCH_TARGETS = {
  MIN: 44,     // iOS minimum
  RECOMMENDED: 48,  // Android Material Design
  COMFORTABLE: 56,  // Enhanced accessibility
} as const;

/**
 * Get current breakpoint based on viewport width
 */
export function getCurrentBreakpoint(): keyof typeof BREAKPOINTS {
  const width = window.innerWidth;
  if (width >= BREAKPOINTS.XL) return 'XL';
  if (width >= BREAKPOINTS.LG) return 'LG';
  if (width >= BREAKPOINTS.MD) return 'MD';
  if (width >= BREAKPOINTS.SM) return 'SM';
  return 'XS';
}

/**
 * Calculate responsive font size with clamp
 * @param minSize Minimum size in px
 * @param maxSize Maximum size in px
 * @param minViewport Minimum viewport width in vw (default 2.5)
 * @param maxViewport Maximum viewport width in vw (default 5)
 */
export function responsiveFontSize(
  minSize: number,
  maxSize: number,
  minViewport: number = 2.5,
  maxViewport: number = 5
): string {
  return `clamp(${minSize}px, ${minViewport}vw, ${maxSize}px)`;
}

/**
 * Calculate responsive spacing
 * @param base Base spacing unit
 * @param multiplier Multiplier for the spacing
 */
export function responsiveSpacing(base: number = 8, multiplier: number = 1): string {
  const breakpoint = getCurrentBreakpoint();
  const multipliers: Record<keyof typeof BREAKPOINTS, number> = {
    XS: 0.75,
    SM: 1,
    MD: 1.25,
    LG: 1.5,
    XL: 1.75,
  };
  return `${base * multiplier * (multipliers[breakpoint] || 1)}px`;
}

/**
 * Calculate responsive size for UI elements
 * Ensures minimum touch target sizes are maintained
 * @param baseSize Base size in px
 * @param minTouchTarget Minimum touch target (default 44px)
 */
export function responsiveSize(
  baseSize: number,
  minTouchTarget: number = TOUCH_TARGETS.MIN
): { size: string; minSize: string; padding: string } {
  const breakpoint = getCurrentBreakpoint();
  const scales: Record<keyof typeof BREAKPOINTS, number> = {
    XS: 0.85,
    SM: 1,
    MD: 1.1,
    LG: 1.2,
    XL: 1.3,
  };

  const scaled = Math.max(baseSize * (scales[breakpoint] || 1), minTouchTarget);
  const padding = Math.max(scaled * 0.4, 12);

  return {
    size: `${scaled}px`,
    minSize: `${minTouchTarget}px`,
    padding: `${padding * 0.75}px ${padding}px`,
  };
}

/**
 * Calculate responsive dimensions for containers
 * @param width Base width
 * @param height Base height (optional)
 */
export function responsiveContainer(
  width: number,
  height?: number
): { width: string; height?: string; maxWidth: string } {
  const breakpoint = getCurrentBreakpoint();
  const viewportFactors: Record<keyof typeof BREAKPOINTS, number> = {
    XS: 0.95,
    SM: 0.92,
    MD: 0.88,
    LG: 0.85,
    XL: 0.80,
  };

  const maxWidth = Math.min(width, window.innerWidth * (viewportFactors[breakpoint] || 0.9));

  return {
    width: `clamp(280px, 90vw, ${width}px)`,
    height: height ? `clamp(${height * 0.6}px, 80vh, ${height}px)` : undefined,
    maxWidth: `${maxWidth}px`,
  };
}

/**
 * Scale mobile controls based on device size
 * @returns Scaling factor for mobile controls
 */
export function getMobileControlsScale(): number {
  const breakpoint = getCurrentBreakpoint();
  const scales: Record<keyof typeof BREAKPOINTS, number> = {
    XS: 0.75,
    SM: 0.85,
    MD: 1,
    LG: 1,
    XL: 1,
  };
  return scales[breakpoint] || 1;
}

/**
 * Calculate safe area insets for notched devices
 */
export function getSafeAreaInsets(): {
  top: string;
  right: string;
  bottom: string;
  left: string;
} {
  return {
    top: 'env(safe-area-inset-top, 0px)',
    right: 'env(safe-area-inset-right, 0px)',
    bottom: 'env(safe-area-inset-bottom, 0px)',
    left: 'env(safe-area-inset-left, 0px)',
  };
}

/**
 * Generate responsive styles for touch targets
 * Ensures all interactive elements meet accessibility guidelines
 */
export function getTouchTargetStyles(): {
  minHeight: string;
  minWidth: string;
  padding: string;
} {
  const breakpoint = getCurrentBreakpoint();
  const sizes: Record<keyof typeof BREAKPOINTS, number> = {
    XS: TOUCH_TARGETS.MIN,
    SM: TOUCH_TARGETS.MIN,
    MD: TOUCH_TARGETS.RECOMMENDED,
    LG: TOUCH_TARGETS.RECOMMENDED,
    XL: TOUCH_TARGETS.COMFORTABLE,
  };

  const size = sizes[breakpoint] || TOUCH_TARGETS.MIN;

  return {
    minHeight: `${size}px`,
    minWidth: `${size}px`,
    padding: `${size * 0.25}px ${size * 0.5}px`,
  };
}

/**
 * Generate CSS custom properties for responsive scaling
 * Can be used to set root-level CSS variables
 */
export function generateResponsiveCSSVars(): Record<string, string> {
  const breakpoint = getCurrentBreakpoint();
  const spacingBase = 8;
  const scales: Record<keyof typeof BREAKPOINTS, number> = {
    XS: 0.75,
    SM: 1,
    MD: 1.25,
    LG: 1.5,
    XL: 1.75,
  };
  const scale = scales[breakpoint] || 1;

  return {
    '--spacing-unit': `${spacingBase * scale}px`,
    '--border-radius-sm': `${8 * scale}px`,
    '--border-radius-md': `${12 * scale}px`,
    '--border-radius-lg': `${16 * scale}px`,
    '--touch-target-min': `${TOUCH_TARGETS.MIN}px`,
    '--touch-target-rec': `${TOUCH_TARGETS.RECOMMENDED}px`,
    '--font-scale': scale.toString(),
  };
}
