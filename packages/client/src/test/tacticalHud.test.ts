/**
 * Tactical HUD Tests
 * Tests for the tactical pilot display theme and HUD manager
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { HudManager, HudTheme } from '../HudManager';

// Mock DOM environment
const getMockContainer = () => {
  const container = document.createElement('div');
  container.id = 'test-container';
  document.body.appendChild(container);
  return container;
};

describe('HudManager - Tactical Theme', () => {
  let container: HTMLElement;
  let hudManager: HudManager;

  beforeEach(() => {
    container = getMockContainer();
    // Mock window.innerWidth
    Object.defineProperty(window, 'innerWidth', {
      writable: true,
      configurable: true,
      value: 1024,
    });
  });

  afterEach(() => {
    if (hudManager) {
      hudManager.destroy();
    }
    if (container && container.parentNode) {
      container.parentNode.removeChild(container);
    }
    // Clean up any tactical styles
    const tacticalStyles = document.getElementById('tactical-hud-styles');
    if (tacticalStyles) {
      tacticalStyles.remove();
    }
    const scanlines = document.getElementById('tactical-scanlines');
    if (scanlines) {
      scanlines.remove();
    }
  });

  describe('Constructor and Initialization', () => {
    it('should create HUD manager with default theme', () => {
      hudManager = new HudManager(container);
      hudManager.createHUD();

      const topBar = document.getElementById('unified-top-bar');
      expect(topBar).toBeTruthy();
      expect(topBar?.classList.contains('tactical-hud')).toBe(false);
    });

    it('should create HUD manager with tactical theme', () => {
      hudManager = new HudManager(container, 'tactical');
      hudManager.createHUD();

      const topBar = document.getElementById('unified-top-bar');
      expect(topBar).toBeTruthy();
      expect(topBar?.classList.contains('tactical-hud')).toBe(true);
    });

    it('should load tactical CSS styles when tactical theme is used', () => {
      hudManager = new HudManager(container, 'tactical');
      hudManager.createHUD();

      const tacticalStyles = document.getElementById('tactical-hud-styles');
      expect(tacticalStyles).toBeTruthy();
    });

    it('should create tactical overlay elements', () => {
      hudManager = new HudManager(container, 'tactical');
      hudManager.createHUD();

      expect(document.getElementById('tactical-grid')).toBeTruthy();
      expect(document.getElementById('tactical-readout')).toBeTruthy();
      expect(document.getElementById('tactical-compass')).toBeTruthy();
      expect(document.getElementById('tactical-reticle')).toBeTruthy();
      expect(document.getElementById('tactical-alert')).toBeTruthy();
    });

    it('should create corner brackets for tactical theme', () => {
      hudManager = new HudManager(container, 'tactical');
      hudManager.createHUD();

      const corners = container.querySelectorAll('.tactical-corner');
      expect(corners.length).toBe(4); // tl, tr, bl, br
    });

    it('should add scanline overlay for tactical theme', () => {
      hudManager = new HudManager(container, 'tactical');
      hudManager.createHUD();

      const scanlines = document.getElementById('tactical-scanlines');
      expect(scanlines).toBeTruthy();
      expect(scanlines?.classList.contains('tactical-scanlines')).toBe(true);
    });
  });

  describe('Styling and Colors', () => {
    it('should apply tactical color scheme to top bar', () => {
      hudManager = new HudManager(container, 'tactical');
      hudManager.createHUD();

      const topBar = document.getElementById('unified-top-bar');
      expect(topBar?.style.background).toContain('0, 20, 0');
      expect(topBar?.style.border).toContain('0, 255, 65');
      expect(topBar?.style.fontFamily).toContain('Courier New');
    });

    it('should apply monospace font for tactical theme', () => {
      hudManager = new HudManager(container, 'tactical');
      hudManager.createHUD();

      const topBar = document.getElementById('unified-top-bar');
      expect(topBar?.style.fontFamily).toContain('monospace');
    });

    it('should apply uppercase text transform for tactical theme', () => {
      hudManager = new HudManager(container, 'tactical');
      hudManager.createHUD();

      const topBar = document.getElementById('unified-top-bar');
      expect(topBar?.style.textTransform).toBe('uppercase');
    });

    it('should apply tactical green color to zone timer', () => {
      hudManager = new HudManager(container, 'tactical');
      hudManager.createHUD();

      const zoneTimer = container.querySelector('.zone-timer');
      expect(zoneTimer?.textContent).toBe('TIME 1:30');
    });

    it('should apply tactical colors to boost bar', () => {
      hudManager = new HudManager(container, 'tactical');
      hudManager.createHUD();

      const boostBarFill = document.getElementById('boost-bar-fill');
      expect(boostBarFill?.style.background).toContain('0, 217, 38');
    });

    it('should apply tactical green to alive counter', () => {
      hudManager = new HudManager(container, 'tactical');
      hudManager.createHUD();

      const aliveCounter = container.querySelector('.alive-counter');
      expect(aliveCounter?.textContent).toBe('8 ALIVE');
    });
  });

  describe('Zone Timer Updates', () => {
    it('should display safe time in tactical green', () => {
      hudManager = new HudManager(container, 'tactical');
      hudManager.createHUD();
      hudManager.updateZoneTimer(60);

      const zoneTimer = container.querySelector('.zone-timer');
      expect(zoneTimer?.textContent).toContain('SAFE TIME');
      expect(zoneTimer?.style.color).toBe('rgb(0, 255, 65)');
    });

    it('should display shrinking time in tactical red with alert class', () => {
      hudManager = new HudManager(container, 'tactical');
      hudManager.createHUD();
      hudManager.updateZoneTimer(15);

      const zoneTimer = container.querySelector('.zone-timer');
      expect(zoneTimer?.textContent).toContain('SHRINKING');
      expect(zoneTimer?.classList.contains('alert')).toBe(true);
      expect(zoneTimer?.style.color).toBe('rgb(255, 51, 51)');
    });

    it('should display zone collapse in tactical red', () => {
      hudManager = new HudManager(container, 'tactical');
      hudManager.createHUD();
      hudManager.updateZoneTimer(0);

      const zoneTimer = container.querySelector('.zone-timer');
      expect(zoneTimer?.textContent).toBe('ZONE COLLAPSE');
      expect(zoneTimer?.classList.contains('alert')).toBe(true);
    });
  });

  describe('Boost Bar Updates', () => {
    it('should display normal boost in tactical green', () => {
      hudManager = new HudManager(container, 'tactical');
      hudManager.createHUD();
      hudManager.updateBoost(75, false, false);

      const boostBarFill = document.getElementById('boost-bar-fill');
      expect(boostBarFill?.style.width).toBe('75%');
      expect(boostBarFill?.style.background).toContain('0, 217, 38');
      expect(boostBarFill?.className).toBe('');
    });

    it('should display boosting state in cyan with class', () => {
      hudManager = new HudManager(container, 'tactical');
      hudManager.createHUD();
      hudManager.updateBoost(50, true, false);

      const boostBarFill = document.getElementById('boost-bar-fill');
      expect(boostBarFill?.style.background).toContain('0, 255, 255');
      expect(boostBarFill?.classList.contains('boosting')).toBe(true);
    });

    it('should display low boost in tactical red with class', () => {
      hudManager = new HudManager(container, 'tactical');
      hudManager.createHUD();
      hudManager.updateBoost(20, false, true);

      const boostBarFill = document.getElementById('boost-bar-fill');
      expect(boostBarFill?.style.background).toContain('255, 51, 51');
      expect(boostBarFill?.classList.contains('low')).toBe(true);
    });
  });

  describe('Alive Counter Updates', () => {
    it('should display high count in tactical green', () => {
      hudManager = new HudManager(container, 'tactical');
      hudManager.createHUD();
      hudManager.updateAliveCount(8);

      const aliveCounter = container.querySelector('.alive-counter');
      expect(aliveCounter?.textContent).toBe('8 ALIVE');
      expect(aliveCounter?.style.color).toBe('rgb(0, 255, 65)');
      expect(aliveCounter?.className).toBe('alive-counter');
    });

    it('should display medium count in tactical orange with warning class', () => {
      hudManager = new HudManager(container, 'tactical');
      hudManager.createHUD();
      hudManager.updateAliveCount(3);

      const aliveCounter = container.querySelector('.alive-counter');
      expect(aliveCounter?.textContent).toBe('3 ALIVE');
      expect(aliveCounter?.style.color).toBe('rgb(255, 170, 0)');
      expect(aliveCounter?.classList.contains('warning')).toBe(true);
    });

    it('should display low count in tactical red with critical class', () => {
      hudManager = new HudManager(container, 'tactical');
      hudManager.createHUD();
      hudManager.updateAliveCount(2);

      const aliveCounter = container.querySelector('.alive-counter');
      expect(aliveCounter?.textContent).toBe('2 ALIVE');
      expect(aliveCounter?.style.color).toBe('rgb(255, 51, 51)');
      expect(aliveCounter?.classList.contains('critical')).toBe(true);
    });
  });

  describe('Tactical Readouts', () => {
    it('should update speed display', () => {
      hudManager = new HudManager(container, 'tactical');
      hudManager.createHUD();
      hudManager.updateTacticalReadouts(250.5, 0);

      const speedEl = document.getElementById('tactical-speed');
      expect(speedEl?.textContent).toBe('251');
    });

    it('should update heading display in degrees', () => {
      hudManager = new HudManager(container, 'tactical');
      hudManager.createHUD();

      // Test 0 degrees
      hudManager.updateTacticalReadouts(200, 0);
      let headingEl = document.getElementById('tactical-heading');
      expect(headingEl?.textContent).toBe('000°');

      // Test 90 degrees (PI/2 radians)
      hudManager.updateTacticalReadouts(200, Math.PI / 2);
      headingEl = document.getElementById('tactical-heading');
      expect(headingEl?.textContent).toBe('090°');

      // Test 180 degrees (PI radians)
      hudManager.updateTacticalReadouts(200, Math.PI);
      headingEl = document.getElementById('tactical-heading');
      expect(headingEl?.textContent).toBe('180°');

      // Test 270 degrees (3*PI/2 radians)
      hudManager.updateTacticalReadouts(200, 3 * Math.PI / 2);
      headingEl = document.getElementById('tactical-heading');
      expect(headingEl?.textContent).toBe('270°');
    });

    it('should normalize negative angles', () => {
      hudManager = new HudManager(container, 'tactical');
      hudManager.createHUD();

      hudManager.updateTacticalReadouts(200, -Math.PI / 2);
      const headingEl = document.getElementById('tactical-heading');
      expect(headingEl?.textContent).toBe('270°');
    });

    it('should not update readouts in default theme', () => {
      hudManager = new HudManager(container, 'default');
      hudManager.createHUD();

      const originalText = 'ORIGINAL';
      const speedEl = document.createElement('div');
      speedEl.id = 'tactical-speed';
      speedEl.textContent = originalText;
      container.appendChild(speedEl);

      hudManager.updateTacticalReadouts(250, 0);

      expect(speedEl.textContent).toBe(originalText);
    });
  });

  describe('Tactical Alerts', () => {
    it('should show alert banner with message', () => {
      hudManager = new HudManager(container, 'tactical');
      hudManager.createHUD();

      hudManager.showTacticalAlert('MISSILE LOCK', 3000);

      const alertEl = document.getElementById('tactical-alert');
      expect(alertEl?.textContent).toBe('MISSILE LOCK');
      expect(alertEl?.classList.contains('active')).toBe(true);
    });

    it('should hide alert banner after duration', () => {
      hudManager = new HudManager(container, 'tactical');
      hudManager.createHUD();

      vi.useFakeTimers();
      hudManager.showTacticalAlert('WARNING', 1000);

      const alertEl = document.getElementById('tactical-alert');
      expect(alertEl?.classList.contains('active')).toBe(true);

      vi.advanceTimersByTime(1000);
      expect(alertEl?.classList.contains('active')).toBe(false);

      vi.useRealTimers();
    });

    it('should not show alerts in default theme', () => {
      hudManager = new HudManager(container, 'default');
      hudManager.createHUD();

      const alertEl = document.createElement('div');
      alertEl.id = 'tactical-alert';
      container.appendChild(alertEl);

      hudManager.showTacticalAlert('WARNING', 3000);

      expect(alertEl.classList.contains('active')).toBe(false);
    });
  });

  describe('Cleanup', () => {
    it('should remove all tactical elements on clearHUD', () => {
      hudManager = new HudManager(container, 'tactical');
      hudManager.createHUD();

      expect(document.getElementById('tactical-grid')).toBeTruthy();
      expect(document.getElementById('tactical-readout')).toBeTruthy();
      expect(document.getElementById('tactical-compass')).toBeTruthy();
      expect(document.getElementById('tactical-reticle')).toBeTruthy();
      expect(document.getElementById('tactical-alert')).toBeTruthy();

      hudManager.clearHUD();

      expect(document.getElementById('tactical-grid')).toBeFalsy();
      expect(document.getElementById('tactical-readout')).toBeFalsy();
      expect(document.getElementById('tactical-compass')).toBeFalsy();
      expect(document.getElementById('tactical-reticle')).toBeFalsy();
      expect(document.getElementById('tactical-alert')).toBeFalsy();
    });

    it('should remove corner brackets on clearHUD', () => {
      hudManager = new HudManager(container, 'tactical');
      hudManager.createHUD();

      expect(container.querySelectorAll('.tactical-corner').length).toBe(4);

      hudManager.clearHUD();

      expect(container.querySelectorAll('.tactical-corner').length).toBe(0);
    });

    it('should remove tactical CSS on destroy', () => {
      hudManager = new HudManager(container, 'tactical');
      hudManager.createHUD();

      expect(document.getElementById('tactical-hud-styles')).toBeTruthy();

      hudManager.destroy();

      expect(document.getElementById('tactical-hud-styles')).toBeFalsy();
    });

    it('should remove scanlines on destroy', () => {
      hudManager = new HudManager(container, 'tactical');
      hudManager.createHUD();

      expect(document.getElementById('tactical-scanlines')).toBeTruthy();

      hudManager.destroy();

      expect(document.getElementById('tactical-scanlines')).toBeFalsy();
    });
  });

  describe('Separators', () => {
    it('should create tactical-style separators', () => {
      hudManager = new HudManager(container, 'tactical');
      hudManager.createHUD();

      const separators = container.querySelectorAll('.separator');
      expect(separators.length).toBeGreaterThan(0);

      const firstSeparator = separators[0] as HTMLElement;
      expect(firstSeparator.style.width).toBe('2px');
      expect(firstSeparator.style.background).toContain('0, 255, 65');
    });
  });

  describe('Mobile Responsiveness', () => {
    it('should use mobile dimensions on small screens', () => {
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 600,
      });

      hudManager = new HudManager(container, 'tactical');
      hudManager.createHUD();

      const topBar = document.getElementById('unified-top-bar');
      expect(topBar?.style.padding).toContain('6px');
    });
  });

  describe('Type Definition', () => {
    it('should accept valid theme types', () => {
      const theme1: HudTheme = 'default';
      const theme2: HudTheme = 'tactical';

      expect(theme1).toBe('default');
      expect(theme2).toBe('tactical');
    });
  });
});
