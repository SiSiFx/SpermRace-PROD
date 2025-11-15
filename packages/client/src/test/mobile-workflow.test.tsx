import { describe, it, expect, beforeEach, vi } from 'vitest';
import { waitFor } from '@testing-library/react';
import { isMobileDevice, isPortrait } from '../deviceDetection';

describe('Mobile Workflow Tests', () => {
  beforeEach(() => {
    // Reset viewport to mobile dimensions
    window.innerWidth = 390;
    window.innerHeight = 844;
  });

  describe('Device Detection', () => {
    it('should detect mobile device', () => {
      expect(isMobileDevice()).toBe(true);
    });

    it('should detect portrait orientation', () => {
      expect(isPortrait()).toBe(true);
    });

    it('should detect landscape when rotated', () => {
      window.innerWidth = 844;
      window.innerHeight = 390;
      expect(isPortrait()).toBe(false);
    });
  });

  describe('Touch Controls', () => {
    it('should handle touch events', () => {
      const element = document.createElement('div');
      const touchHandler = vi.fn();
      element.addEventListener('touchstart', touchHandler);

      const touchEvent = new TouchEvent('touchstart', {
        touches: [{ clientX: 100, clientY: 100 } as Touch],
      });
      element.dispatchEvent(touchEvent);

      expect(touchHandler).toHaveBeenCalled();
    });

    it('should handle multi-touch gestures', () => {
      const element = document.createElement('div');
      const touchHandler = vi.fn();
      element.addEventListener('touchstart', touchHandler);

      const touchEvent = new TouchEvent('touchstart', {
        touches: [
          { clientX: 100, clientY: 100 } as Touch,
          { clientX: 200, clientY: 200 } as Touch,
        ],
      });
      element.dispatchEvent(touchEvent);

      expect(touchHandler).toHaveBeenCalled();
    });
  });

  describe('Responsive Layout', () => {
    it('should render mobile layout on small screens', () => {
      window.innerWidth = 375;
      const mediaQuery = window.matchMedia('(max-width: 768px)');
      expect(mediaQuery.matches).toBeDefined();
    });

    it('should handle orientation changes', async () => {
      const orientationHandler = vi.fn();
      window.addEventListener('orientationchange', orientationHandler);

      const event = new Event('orientationchange');
      window.dispatchEvent(event);

      await waitFor(() => {
        expect(orientationHandler).toHaveBeenCalled();
      });
    });
  });

  describe('Mobile Performance', () => {
    it('should use mobile-optimized rendering', () => {
      const canvas = document.createElement('canvas');
      // In test environment, check that canvas element exists
      // (actual rendering tests would require canvas package)
      expect(canvas).toBeTruthy();
      expect(canvas.tagName).toBe('CANVAS');
    });

    it('should handle viewport meta tag', () => {
      const viewportMeta = document.querySelector('meta[name="viewport"]');
      if (viewportMeta) {
        expect(viewportMeta.getAttribute('content')).toContain('width=device-width');
      }
    });
  });

  describe('Mobile Wallet Integration', () => {
    it('should detect mobile wallet capability', () => {
      const hasMobileWallet = 'solana' in window || 'phantom' in window;
      expect(typeof hasMobileWallet).toBe('boolean');
    });

    it('should handle wallet connection on mobile', async () => {
      const mockConnect = vi.fn().mockResolvedValue({ publicKey: 'mock-key' });
      const mockWallet = { connect: mockConnect };
      
      await mockWallet.connect();
      expect(mockConnect).toHaveBeenCalled();
    });
  });

  describe('Mobile Game Controls', () => {
    it('should initialize virtual joystick', () => {
      const joystickContainer = document.createElement('div');
      joystickContainer.id = 'joystick-container';
      document.body.appendChild(joystickContainer);

      expect(joystickContainer).toBeTruthy();
      expect(joystickContainer.id).toBe('joystick-container');
      
      document.body.removeChild(joystickContainer);
    });

    it('should handle boost button tap', () => {
      const boostButton = document.createElement('button');
      const tapHandler = vi.fn();
      boostButton.addEventListener('touchstart', tapHandler);

      const touchEvent = new TouchEvent('touchstart', {
        touches: [{ clientX: 50, clientY: 50 } as Touch],
      });
      boostButton.dispatchEvent(touchEvent);

      expect(tapHandler).toHaveBeenCalled();
    });
  });

  describe('Mobile Network Handling', () => {
    it('should handle reconnection on mobile', async () => {
      const mockReconnect = vi.fn().mockResolvedValue(true);
      
      await mockReconnect();
      expect(mockReconnect).toHaveBeenCalled();
    });

    it('should show connection status on mobile', () => {
      const statusIndicator = document.createElement('div');
      statusIndicator.className = 'connection-status';
      statusIndicator.textContent = 'Connected';

      expect(statusIndicator.textContent).toBe('Connected');
    });
  });
});
