/**
 * Device Detection Tests
 * Tests for performance tier detection and high-performance mobile device identification
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  getPerformanceTier,
  isHighPerformanceMobile,
  getPerformanceSettings,
  getDeviceType
} from '../deviceDetection';

// Mock navigator
const mockNavigator = {
  userAgent: '',
  hardwareConcurrency: 4,
  deviceMemory: 4,
  maxTouchPoints: 0
};

describe('deviceDetection', () => {
  // Store original navigator values
  let originalUserAgent: string;
  let originalHardwareConcurrency: number;
  let originalDeviceMemory: number;

  beforeEach(() => {
    originalUserAgent = navigator.userAgent;
    originalHardwareConcurrency = (navigator as any).hardwareConcurrency;
    originalDeviceMemory = (navigator as any).deviceMemory;
  });

  afterEach(() => {
    // Restore original values
    Object.defineProperty(navigator, 'userAgent', {
      get: () => originalUserAgent,
      configurable: true
    });
    Object.defineProperty(navigator, 'hardwareConcurrency', {
      get: () => originalHardwareConcurrency,
      configurable: true
    });
    Object.defineProperty(navigator, 'deviceMemory', {
      get: () => originalDeviceMemory,
      configurable: true
    });
  });

  describe('isHighPerformanceMobile', () => {
    it('should detect iPhone 12+ as high performance', () => {
      Object.defineProperty(navigator, 'userAgent', {
        get: () => 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X) AppleWebKit/605.1.15',
        configurable: true
      });
      expect(isHighPerformanceMobile()).toBe(true);
    });

    it('should detect iPhone 13+ as high performance', () => {
      Object.defineProperty(navigator, 'userAgent', {
        get: () => 'Mozilla/5.0 (iPhone; CPU iPhone OS 15_0 like Mac OS X) AppleWebKit/605.1.15',
        configurable: true
      });
      expect(isHighPerformanceMobile()).toBe(true);
    });

    it('should detect Pixel 6 as high performance', () => {
      Object.defineProperty(navigator, 'userAgent', {
        get: () => 'Mozilla/5.0 (Linux; Android 12; Pixel 6) AppleWebKit/537.36',
        configurable: true
      });
      expect(isHighPerformanceMobile()).toBe(true);
    });

    it('should detect Pixel 7 as high performance', () => {
      Object.defineProperty(navigator, 'userAgent', {
        get: () => 'Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36',
        configurable: true
      });
      expect(isHighPerformanceMobile()).toBe(true);
    });

    it('should detect high-end Android devices (6GB+ RAM, 6+ cores)', () => {
      Object.defineProperty(navigator, 'userAgent', {
        get: () => 'Mozilla/5.0 (Linux; Android 12) AppleWebKit/537.36',
        configurable: true
      });
      Object.defineProperty(navigator, 'deviceMemory', {
        get: () => 8,
        configurable: true
      });
      Object.defineProperty(navigator, 'hardwareConcurrency', {
        get: () => 8,
        configurable: true
      });
      expect(isHighPerformanceMobile()).toBe(true);
    });

    it('should not detect low-end Android devices as high performance', () => {
      Object.defineProperty(navigator, 'userAgent', {
        get: () => 'Mozilla/5.0 (Linux; Android 10) AppleWebKit/537.36',
        configurable: true
      });
      Object.defineProperty(navigator, 'deviceMemory', {
        get: () => 3,
        configurable: true
      });
      Object.defineProperty(navigator, 'hardwareConcurrency', {
        get: () => 4,
        configurable: true
      });
      expect(isHighPerformanceMobile()).toBe(false);
    });

    it('should detect Samsung Galaxy S21+ as high performance', () => {
      Object.defineProperty(navigator, 'userAgent', {
        get: () => 'Mozilla/5.0 (Linux; Android 11; SM-G991B) AppleWebKit/537.36',
        configurable: true
      });
      expect(isHighPerformanceMobile()).toBe(true);
    });

    it('should return false for desktop devices', () => {
      Object.defineProperty(navigator, 'userAgent', {
        get: () => 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        configurable: true
      });
      expect(isHighPerformanceMobile()).toBe(false);
    });
  });

  describe('getPerformanceTier', () => {
    it('should return high tier for high-performance mobile', () => {
      Object.defineProperty(navigator, 'userAgent', {
        get: () => 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X) AppleWebKit/605.1.15',
        configurable: true
      });
      expect(getPerformanceTier()).toBe('high');
    });

    it('should return low tier for low-end mobile', () => {
      Object.defineProperty(navigator, 'userAgent', {
        get: () => 'Mozilla/5.0 (Linux; Android 9) AppleWebKit/537.36',
        configurable: true
      });
      Object.defineProperty(navigator, 'deviceMemory', {
        get: () => 2,
        configurable: true
      });
      expect(getPerformanceTier()).toBe('low');
    });

    it('should return high tier for desktop', () => {
      Object.defineProperty(navigator, 'userAgent', {
        get: () => 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        configurable: true
      });
      expect(getPerformanceTier()).toBe('high');
    });
  });

  describe('getPerformanceSettings', () => {
    it('should return high performance settings for iPhone 12+', () => {
      Object.defineProperty(navigator, 'userAgent', {
        get: () => 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X) AppleWebKit/605.1.15',
        configurable: true
      });

      const settings = getPerformanceSettings();
      expect(settings.targetFPS).toBe(60);
      expect(settings.maxParticles).toBe(200);
      expect(settings.trailQuality).toBe('high');
      expect(settings.shadowsEnabled).toBe(true);
      expect(settings.antiAliasing).toBe(true);
      expect(settings.resolution).toBe(2);
    });

    it('should return high performance settings for Pixel 6+', () => {
      Object.defineProperty(navigator, 'userAgent', {
        get: () => 'Mozilla/5.0 (Linux; Android 12; Pixel 6) AppleWebKit/537.36',
        configurable: true
      });

      const settings = getPerformanceSettings();
      expect(settings.targetFPS).toBe(60);
      expect(settings.maxParticles).toBe(200);
      expect(settings.trailQuality).toBe('high');
    });

    it('should return low performance settings for low-end mobile', () => {
      Object.defineProperty(navigator, 'userAgent', {
        get: () => 'Mozilla/5.0 (Linux; Android 9) AppleWebKit/537.36',
        configurable: true
      });
      Object.defineProperty(navigator, 'deviceMemory', {
        get: () => 2,
        configurable: true
      });

      const settings = getPerformanceSettings();
      expect(settings.targetFPS).toBe(30);
      expect(settings.maxParticles).toBe(50);
      expect(settings.trailQuality).toBe('low');
      expect(settings.shadowsEnabled).toBe(false);
      expect(settings.antiAliasing).toBe(false);
    });

    it('should return desktop performance settings for desktop', () => {
      Object.defineProperty(navigator, 'userAgent', {
        get: () => 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        configurable: true
      });

      const settings = getPerformanceSettings();
      expect(settings.targetFPS).toBe(60);
      expect(settings.maxParticles).toBe(200);
      expect(settings.trailQuality).toBe('high');
      expect(settings.shadowsEnabled).toBe(true);
    });
  });
});
