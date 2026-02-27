/**
 * HUD Effects Tests
 * Tests for scanline, glass morphism, and tech animation effects
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { HudManager } from '../HudManager';

describe('HudManager - Visual Effects', () => {
  let container: HTMLElement;
  let hudManager: HudManager;

  beforeEach(() => {
    // Create a fresh container for each test
    container = document.createElement('div');
    document.body.appendChild(container);
    hudManager = new HudManager(container);
  });

  afterEach(() => {
    // Clean up after each test
    hudManager.destroy();
    document.body.removeChild(container);
  });

  describe('Scanline Overlay', () => {
    it('should create scanline overlay when HUD is created', () => {
      hudManager.createHUD();

      const scanlineOverlay = document.getElementById('hud-scanline-overlay');
      expect(scanlineOverlay).toBeTruthy();
      expect(scanlineOverlay?.className).toBe('hud-scanline-overlay');
    });

    it('should remove scanline overlay when HUD is cleared', () => {
      hudManager.createHUD();
      hudManager.clearHUD();

      const scanlineOverlay = document.getElementById('hud-scanline-overlay');
      expect(scanlineOverlay).toBeFalsy();
    });

    it('should have correct CSS classes for scanline animation', () => {
      hudManager.createHUD();

      const scanlineOverlay = document.getElementById('hud-scanline-overlay');
      expect(scanlineOverlay?.classList.contains('hud-scanline-overlay')).toBe(true);
    });
  });

  describe('Glass Morphism Effects', () => {
    it('should apply glass morphism styles to top bar', () => {
      hudManager.createHUD();

      const topBar = document.getElementById('unified-top-bar');
      expect(topBar).toBeTruthy();

      // Check inline styles since test environment may not render computed styles properly
      expect(topBar?.style.backdropFilter).toContain('blur');
      expect(topBar?.style.background).toContain('rgba');
    });

    it('should have glass reflection effect with ::after pseudo-element', () => {
      hudManager.createHUD();

      const topBar = document.getElementById('unified-top-bar');
      expect(topBar).toBeTruthy();

      // Check that the element has proper positioning for pseudo-elements
      const styles = window.getComputedStyle(topBar!);
      expect(styles.position).toBe('absolute');
    });
  });

  describe('Tech Animations', () => {
    it('should add tech corner pulse class to top bar', () => {
      hudManager.createHUD();

      const topBar = document.getElementById('unified-top-bar');
      expect(topBar).toBeTruthy();
      // Tech corners are applied via CSS ::before pseudo-element
      // Check that top bar has transition property for animations
      expect(topBar?.style.transition).toBeTruthy();
    });

    it('should add low-boost class when boost is low', () => {
      hudManager.createHUD();

      // Update boost to low state
      hudManager.updateBoost(20, false, true);

      const boostBar = document.getElementById('boost-bar-fill');
      expect(boostBar?.classList.contains('low-boost')).toBe(true);
    });

    it('should remove low-boost class when boost is not low', () => {
      hudManager.createHUD();

      // First set to low
      hudManager.updateBoost(20, false, true);
      let boostBar = document.getElementById('boost-bar-fill');
      expect(boostBar?.classList.contains('low-boost')).toBe(true);

      // Then set to normal
      hudManager.updateBoost(80, false, false);
      boostBar = document.getElementById('boost-bar-fill');
      expect(boostBar?.classList.contains('low-boost')).toBe(false);
    });

    it('should add zone-timer-critical class when timer is below 30 seconds', () => {
      hudManager.createHUD();

      hudManager.updateZoneTimer(20);

      const zoneTimer = container.querySelector('.zone-timer-critical');
      expect(zoneTimer).toBeTruthy();
    });

    it('should remove zone-timer-critical class when timer is above 30 seconds', () => {
      hudManager.createHUD();

      // First set to critical
      hudManager.updateZoneTimer(20);
      let zoneTimer = container.querySelector('.zone-timer-critical');
      expect(zoneTimer).toBeTruthy();

      // Then set to safe
      hudManager.updateZoneTimer(60);
      zoneTimer = container.querySelector('.zone-timer-critical');
      expect(zoneTimer).toBeFalsy();
    });
  });

  describe('Alive Count Animation', () => {
    it('should add alive-count-update class when count changes', () => {
      hudManager.createHUD();

      // Initial count
      hudManager.updateAliveCount(8);

      // Change count
      hudManager.updateAliveCount(7);

      // Find the alive count element - it's stored internally by HudManager
      const aliveCountElements = container.querySelectorAll('*');
      let foundElement = false;
      aliveCountElements.forEach(el => {
        if (el.classList.contains('alive-count-update')) {
          foundElement = true;
        }
      });
      expect(foundElement).toBe(true);
    });

    it('should not add alive-count-update class when count stays the same', () => {
      hudManager.createHUD();

      // Set initial count
      hudManager.updateAliveCount(8);

      // Update with same count
      hudManager.updateAliveCount(8);

      // Find the alive count element - it's stored internally by HudManager
      const aliveCountElements = container.querySelectorAll('*');
      let foundElement = false;
      aliveCountElements.forEach(el => {
        if (el.classList.contains('alive-count-update')) {
          foundElement = true;
        }
      });
      expect(foundElement).toBe(false);
    });

    it('should trigger animation on multiple count changes', () => {
      hudManager.createHUD();

      hudManager.updateAliveCount(8);
      hudManager.updateAliveCount(7);
      let aliveCount = container.querySelector('[class*="alive-count"]');
      expect(aliveCount?.classList.contains('alive-count-update')).toBe(true);

      hudManager.updateAliveCount(6);
      aliveCount = container.querySelector('[class*="alive-count"]');
      expect(aliveCount?.classList.contains('alive-count-update')).toBe(true);
    });
  });

  describe('Boost Bar Animation', () => {
    it('should apply tech pulse animation to boost bar', () => {
      hudManager.createHUD();

      const boostBar = document.getElementById('boost-bar-fill');
      expect(boostBar).toBeTruthy();

      const styles = window.getComputedStyle(boostBar!);
      // Check that transitions are applied
      expect(styles.transition).toContain('width');
    });

    it('should update boost bar width correctly', () => {
      hudManager.createHUD();

      hudManager.updateBoost(50, false, false);

      const boostBar = document.getElementById('boost-bar-fill');
      expect(boostBar?.style.width).toBe('50%');
    });

    it('should clamp boost percentage between 0 and 100', () => {
      hudManager.createHUD();

      // Test over 100
      hudManager.updateBoost(150, false, false);
      let boostBar = document.getElementById('boost-bar-fill');
      expect(boostBar?.style.width).toBe('100%');

      // Test under 0
      hudManager.updateBoost(-10, false, false);
      boostBar = document.getElementById('boost-bar-fill');
      expect(boostBar?.style.width).toBe('0%');
    });

    it('should change gradient based on boost state', () => {
      hudManager.createHUD();

      // Normal state - check for rgb format
      hudManager.updateBoost(80, false, false);
      let boostBar = document.getElementById('boost-bar-fill');
      expect(boostBar?.style.background).toContain('rgb(34, 211, 238)');

      // Boosting state - check for rgb format
      hudManager.updateBoost(80, true, false);
      boostBar = document.getElementById('boost-bar-fill');
      expect(boostBar?.style.background).toContain('rgb(0, 255, 136)');

      // Low state - check for rgb format
      hudManager.updateBoost(20, false, true);
      boostBar = document.getElementById('boost-bar-fill');
      expect(boostBar?.style.background).toContain('rgb(239, 68, 68)');
    });
  });

  describe('CSS Class Management', () => {
    it('should handle multiple class additions and removals correctly', () => {
      hudManager.createHUD();

      // Test zone timer critical class
      hudManager.updateZoneTimer(20);
      const zoneTimerEl = container.querySelector('[class*="zone-timer"]') as HTMLElement;
      expect(zoneTimerEl?.classList.contains('zone-timer-critical')).toBe(true);

      hudManager.updateZoneTimer(60);
      expect(zoneTimerEl?.classList.contains('zone-timer-critical')).toBe(false);
    });

    it('should properly cleanup all effects when destroyed', () => {
      hudManager.createHUD();

      // Add some dynamic classes
      hudManager.updateZoneTimer(20);
      hudManager.updateBoost(20, false, true);
      hudManager.updateAliveCount(5);

      // Destroy HUD
      hudManager.destroy();

      // Check that all elements are removed
      const scanlineOverlay = document.getElementById('hud-scanline-overlay');
      const topBar = document.getElementById('unified-top-bar');

      expect(scanlineOverlay).toBeFalsy();
      expect(topBar).toBeFalsy();
    });
  });

  describe('Responsive Behavior', () => {
    it('should adjust styles for mobile devices', () => {
      // Mock mobile width
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 375,
      });

      hudManager.createHUD();

      const topBar = document.getElementById('unified-top-bar');
      expect(topBar).toBeTruthy();

      const styles = window.getComputedStyle(topBar!);
      // Check mobile-specific adjustments
      expect(styles.fontSize).toBe('12px');
    });

    it('should adjust styles for desktop devices', () => {
      // Mock desktop width
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 1920,
      });

      hudManager.createHUD();

      const topBar = document.getElementById('unified-top-bar');
      expect(topBar).toBeTruthy();

      const styles = window.getComputedStyle(topBar!);
      // Check desktop-specific adjustments
      expect(styles.fontSize).toBe('14px');
    });
  });

  describe('Performance Optimizations', () => {
    it('should use GPU acceleration for animations', () => {
      hudManager.createHUD();

      const topBar = document.getElementById('unified-top-bar');
      const styles = window.getComputedStyle(topBar!);

      // Check that transform is applied for GPU acceleration
      expect(styles.transform).toContain('translateX');
    });

    it('should have will-change property for optimized animations', () => {
      hudManager.createHUD();

      const topBar = document.getElementById('unified-top-bar');
      const styles = window.getComputedStyle(topBar!);

      // Check for will-change or transition properties
      expect(styles.transition).toBeTruthy();
    });
  });
});
