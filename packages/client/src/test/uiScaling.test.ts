/**
 * UI Scaling System Tests
 * Tests for responsive scaling utilities and touch target compliance
 */

import {
  getCurrentBreakpoint,
  responsiveFontSize,
  responsiveSpacing,
  responsiveSize,
  responsiveContainer,
  getMobileControlsScale,
  getSafeAreaInsets,
  getTouchTargetStyles,
  generateResponsiveCSSVars,
  TOUCH_TARGETS,
  BREAKPOINTS,
} from '../uiScalingUtils';

describe('UI Scaling Utilities', () => {
  let originalInnerWidth: number;

  beforeEach(() => {
    // Store original window.innerWidth
    originalInnerWidth = window.innerWidth;
  });

  afterEach(() => {
    // Restore original window.innerWidth
    Object.defineProperty(window, 'innerWidth', {
      writable: true,
      configurable: true,
      value: originalInnerWidth,
    });
  });

  describe('BREAKPOINTS', () => {
    it('should have all expected breakpoints defined', () => {
      expect(BREAKPOINTS.XS).toBe(320);
      expect(BREAKPOINTS.SM).toBe(375);
      expect(BREAKPOINTS.MD).toBe(768);
      expect(BREAKPOINTS.LG).toBe(1024);
      expect(BREAKPOINTS.XL).toBe(1440);
    });
  });

  describe('TOUCH_TARGETS', () => {
    it('should meet WCAG 2.1 AAA minimum requirements', () => {
      expect(TOUCH_TARGETS.MIN).toBeGreaterThanOrEqual(44);
      expect(TOUCH_TARGETS.RECOMMENDED).toBeGreaterThanOrEqual(48);
      expect(TOUCH_TARGETS.COMFORTABLE).toBeGreaterThanOrEqual(56);
    });

    it('should have proper size hierarchy', () => {
      expect(TOUCH_TARGETS.MIN).toBeLessThan(TOUCH_TARGETS.RECOMMENDED);
      expect(TOUCH_TARGETS.RECOMMENDED).toBeLessThan(TOUCH_TARGETS.COMFORTABLE);
    });
  });

  describe('getCurrentBreakpoint', () => {
    it('should return XS for very small screens', () => {
      Object.defineProperty(window, 'innerWidth', { writable: true, configurable: true, value: 300 });
      expect(getCurrentBreakpoint()).toBe('XS');
    });

    it('should return SM for small phones', () => {
      Object.defineProperty(window, 'innerWidth', { writable: true, configurable: true, value: 400 });
      expect(getCurrentBreakpoint()).toBe('SM');
    });

    it('should return MD for tablets', () => {
      Object.defineProperty(window, 'innerWidth', { writable: true, configurable: true, value: 800 });
      expect(getCurrentBreakpoint()).toBe('MD');
    });

    it('should return LG for desktop', () => {
      Object.defineProperty(window, 'innerWidth', { writable: true, configurable: true, value: 1200 });
      expect(getCurrentBreakpoint()).toBe('LG');
    });

    it('should return XL for large desktop', () => {
      Object.defineProperty(window, 'innerWidth', { writable: true, configurable: true, value: 1500 });
      expect(getCurrentBreakpoint()).toBe('XL');
    });
  });

  describe('responsiveFontSize', () => {
    it('should generate valid CSS clamp syntax', () => {
      const result = responsiveFontSize(14, 18);
      expect(result).toMatch(/^clamp\(\d+px, [\d.]+vw, \d+px\)$/);
    });

    it('should use provided min and max sizes', () => {
      const result = responsiveFontSize(16, 24);
      expect(result).toContain('16px');
      expect(result).toContain('24px');
    });

    it('should use default viewport values', () => {
      const result = responsiveFontSize(14, 18);
      expect(result).toContain('2.5vw');
    });

    it('should use custom viewport values when provided', () => {
      const result = responsiveFontSize(14, 18, 3, 6);
      // The function uses the first viewport value as the preferred value
      expect(result).toMatch(/clamp\(14px, 3vw, 18px\)/);
    });
  });

  describe('responsiveSpacing', () => {
    it('should return valid pixel values', () => {
      const result = responsiveSpacing(8, 2);
      expect(result).toMatch(/^\d+px$/);
    });

    it('should scale based on breakpoint', () => {
      Object.defineProperty(window, 'innerWidth', { writable: true, configurable: true, value: 300 });
      const xsSpacing = responsiveSpacing(8, 1);

      Object.defineProperty(window, 'innerWidth', { writable: true, configurable: true, value: 1200 });
      const lgSpacing = responsiveSpacing(8, 1);

      // Desktop should have larger spacing than mobile
      expect(parseFloat(lgSpacing)).toBeGreaterThan(parseFloat(xsSpacing));
    });

    it('should use base spacing correctly', () => {
      const result = responsiveSpacing(16, 1);
      const value = parseFloat(result);
      expect(value).toBeGreaterThan(0);
    });
  });

  describe('responsiveSize', () => {
    it('should return size object with required properties', () => {
      const result = responsiveSize(40);
      expect(result).toHaveProperty('size');
      expect(result).toHaveProperty('minSize');
      expect(result).toHaveProperty('padding');
    });

    it('should enforce minimum touch target size', () => {
      const result = responsiveSize(20, 44);
      expect(parseFloat(result.size)).toBeGreaterThanOrEqual(44);
    });

    it('should scale based on viewport', () => {
      Object.defineProperty(window, 'innerWidth', { writable: true, configurable: true, value: 300 });
      const xsSize = responsiveSize(40);

      Object.defineProperty(window, 'innerWidth', { writable: true, configurable: true, value: 1200 });
      const lgSize = responsiveSize(40);

      expect(parseFloat(lgSize.size)).toBeGreaterThan(parseFloat(xsSize.size));
    });
  });

  describe('responsiveContainer', () => {
    it('should return container styles', () => {
      const result = responsiveContainer(400);
      expect(result).toHaveProperty('width');
      expect(result).toHaveProperty('maxWidth');
    });

    it('should include height when provided', () => {
      const result = responsiveContainer(400, 300);
      expect(result).toHaveProperty('height');
    });

    it('should use clamp for responsive width', () => {
      const result = responsiveContainer(400);
      expect(result.width).toMatch(/^clamp\(/);
    });
  });

  describe('getMobileControlsScale', () => {
    it('should return scale between 0 and 1', () => {
      const scale = getMobileControlsScale();
      expect(scale).toBeGreaterThan(0);
      expect(scale).toBeLessThanOrEqual(1);
    });

    it('should return smaller scale for very small screens', () => {
      Object.defineProperty(window, 'innerWidth', { writable: true, configurable: true, value: 300 });
      const xsScale = getMobileControlsScale();

      Object.defineProperty(window, 'innerWidth', { writable: true, configurable: true, value: 800 });
      const mdScale = getMobileControlsScale();

      expect(xsScale).toBeLessThan(mdScale);
    });

    it('should return 1 for tablets and larger', () => {
      Object.defineProperty(window, 'innerWidth', { writable: true, configurable: true, value: 1000 });
      const scale = getMobileControlsScale();
      expect(scale).toBe(1);
    });
  });

  describe('getSafeAreaInsets', () => {
    it('should return all safe area properties', () => {
      const insets = getSafeAreaInsets();
      expect(insets).toHaveProperty('top');
      expect(insets).toHaveProperty('right');
      expect(insets).toHaveProperty('bottom');
      expect(insets).toHaveProperty('left');
    });

    it('should use env() syntax', () => {
      const insets = getSafeAreaInsets();
      Object.values(insets).forEach(value => {
        expect(value).toMatch(/^env\(/);
      });
    });

    it('should have fallback values', () => {
      const insets = getSafeAreaInsets();
      Object.values(insets).forEach(value => {
        expect(value).toContain('0px');
      });
    });
  });

  describe('getTouchTargetStyles', () => {
    it('should return touch target styles', () => {
      const styles = getTouchTargetStyles();
      expect(styles).toHaveProperty('minHeight');
      expect(styles).toHaveProperty('minWidth');
      expect(styles).toHaveProperty('padding');
    });

    it('should meet minimum touch target requirements', () => {
      const styles = getTouchTargetStyles();
      const minHeight = parseInt(styles.minHeight);
      expect(minHeight).toBeGreaterThanOrEqual(44);
    });

    it('should scale based on viewport', () => {
      Object.defineProperty(window, 'innerWidth', { writable: true, configurable: true, value: 300 });
      const xsStyles = getTouchTargetStyles();

      Object.defineProperty(window, 'innerWidth', { writable: true, configurable: true, value: 1200 });
      const xlStyles = getTouchTargetStyles();

      expect(parseInt(xlStyles.minHeight)).toBeGreaterThanOrEqual(parseInt(xsStyles.minHeight));
    });
  });

  describe('generateResponsiveCSSVars', () => {
    it('should return CSS variable object', () => {
      const vars = generateResponsiveCSSVars();
      expect(vars).toHaveProperty('--spacing-unit');
      expect(vars).toHaveProperty('--border-radius-sm');
      expect(vars).toHaveProperty('--border-radius-md');
      expect(vars).toHaveProperty('--border-radius-lg');
      expect(vars).toHaveProperty('--touch-target-min');
      expect(vars).toHaveProperty('--touch-target-rec');
      expect(vars).toHaveProperty('--font-scale');
    });

    it('should generate valid CSS values', () => {
      const vars = generateResponsiveCSSVars();
      Object.values(vars).forEach(value => {
        // Should be px values or numbers
        expect(value).toMatch(/^(\d+px|\d+)$/);
      });
    });

    it('should scale based on viewport', () => {
      Object.defineProperty(window, 'innerWidth', { writable: true, configurable: true, value: 300 });
      const xsVars = generateResponsiveCSSVars();

      Object.defineProperty(window, 'innerWidth', { writable: true, configurable: true, value: 1200 });
      const xlVars = generateResponsiveCSSVars();

      const xsSpacing = parseFloat(xsVars['--spacing-unit']);
      const xlSpacing = parseFloat(xlVars['--spacing-unit']);

      expect(xlSpacing).toBeGreaterThan(xsSpacing);
    });

    it('should maintain minimum touch targets', () => {
      const vars = generateResponsiveCSSVars();
      expect(vars['--touch-target-min']).toContain('44');
      expect(vars['--touch-target-rec']).toContain('48');
    });
  });

  describe('Integration Tests', () => {
    it('should maintain consistent scaling across all utilities', () => {
      Object.defineProperty(window, 'innerWidth', { writable: true, configurable: true, value: 400 });

      const breakpoint = getCurrentBreakpoint();
      const controlsScale = getMobileControlsScale();
      const touchStyles = getTouchTargetStyles();
      const cssVars = generateResponsiveCSSVars();

      // All should be based on SM breakpoint
      expect(breakpoint).toBe('SM');
      expect(controlsScale).toBeLessThan(1);
      expect(parseInt(touchStyles.minHeight)).toBeGreaterThanOrEqual(44);
      expect(cssVars['--touch-target-min']).toContain('44');
    });

    it('should handle extreme viewport sizes gracefully', () => {
      // Very small screen
      Object.defineProperty(window, 'innerWidth', { writable: true, configurable: true, value: 280 });
      const xsStyles = getTouchTargetStyles();
      expect(parseInt(xsStyles.minHeight)).toBeGreaterThanOrEqual(44);

      // Very large screen
      Object.defineProperty(window, 'innerWidth', { writable: true, configurable: true, value: 2000 });
      const xlStyles = getTouchTargetStyles();
      expect(parseInt(xlStyles.minHeight)).toBeGreaterThanOrEqual(56);
    });

    it('should ensure all touch targets meet accessibility guidelines', () => {
      const viewports = [300, 400, 800, 1200, 1600];

      viewports.forEach(width => {
        Object.defineProperty(window, 'innerWidth', { writable: true, configurable: true, value: width });
        const styles = getTouchTargetStyles();
        const minSize = parseInt(styles.minHeight);

        expect(minSize).toBeGreaterThanOrEqual(44);
        expect(minSize).toBeLessThanOrEqual(56);
      });
    });
  });
});
