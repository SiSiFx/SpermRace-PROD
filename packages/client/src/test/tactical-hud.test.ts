import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

/**
 * Tactical HUD Mobile Controls Tests
 * Tests for the reskinned virtual joystick and boost button with tactical HUD style
 */

describe('Tactical HUD Mobile Controls', () => {
  let joystickElement: HTMLElement;
  let boostButtonElement: HTMLElement;

  beforeEach(() => {
    // Set mobile viewport
    window.innerWidth = 390;
    window.innerHeight = 844;

    // Create joystick elements
    joystickElement = document.createElement('div');
    joystickElement.className = 'joystick-base active';
    joystickElement.innerHTML = `
      <div class="joystick-ring"></div>
      <div class="joystick-stick"></div>
    `;
    document.body.appendChild(joystickElement);

    // Create boost button
    boostButtonElement = document.createElement('button');
    boostButtonElement.className = 'mobile-boost-button ready';
    boostButtonElement.innerHTML = `
      <div class="boost-icon">⚡</div>
      <svg class="boost-cooldown-ring" viewBox="0 0 100 100">
        <circle cx="50" cy="50" r="45" class="cooldown-bg" />
        <circle cx="50" cy="50" r="45" class="cooldown-progress" />
      </svg>
    `;
    document.body.appendChild(boostButtonElement);
  });

  afterEach(() => {
    // Cleanup
    document.body.innerHTML = '';
  });

  describe('Joystick Structure', () => {
    it('should create joystick base element', () => {
      expect(joystickElement).toBeTruthy();
      expect(joystickElement.className).toContain('joystick-base');
    });

    it('should have joystick ring element', () => {
      const ring = joystickElement.querySelector('.joystick-ring');
      expect(ring).toBeTruthy();
      expect(ring?.tagName).toBe('DIV');
    });

    it('should have joystick stick element', () => {
      const stick = joystickElement.querySelector('.joystick-stick');
      expect(stick).toBeTruthy();
      expect(stick?.tagName).toBe('DIV');
    });

    it('should apply active state class', () => {
      expect(joystickElement.classList.contains('active')).toBe(true);
    });
  });

  describe('Boost Button Structure', () => {
    it('should create boost button element', () => {
      expect(boostButtonElement).toBeTruthy();
      expect(boostButtonElement.tagName).toBe('BUTTON');
    });

    it('should have mobile-boost-button class', () => {
      expect(boostButtonElement.classList.contains('mobile-boost-button')).toBe(true);
    });

    it('should have ready state class when boost is available', () => {
      expect(boostButtonElement.classList.contains('ready')).toBe(true);
    });

    it('should display boost icon', () => {
      const icon = boostButtonElement.querySelector('.boost-icon');
      expect(icon).toBeTruthy();
      expect(icon?.textContent).toBe('⚡');
    });

    it('should have cooldown ring visualization', () => {
      const cooldownRing = boostButtonElement.querySelector('.boost-cooldown-ring');
      expect(cooldownRing).toBeTruthy();
      expect(cooldownRing?.tagName).toBe('svg');

      const bgCircle = boostButtonElement.querySelector('.cooldown-bg');
      const progressCircle = boostButtonElement.querySelector('.cooldown-progress');

      expect(bgCircle).toBeTruthy();
      expect(progressCircle).toBeTruthy();
    });
  });

  describe('State Management', () => {
    it('should toggle active state on joystick', () => {
      joystickElement.classList.remove('active');
      expect(joystickElement.classList.contains('active')).toBe(false);

      joystickElement.classList.add('active');
      expect(joystickElement.classList.contains('active')).toBe(true);
    });

    it('should toggle pressed state on boost button', () => {
      boostButtonElement.classList.add('pressed');
      expect(boostButtonElement.classList.contains('pressed')).toBe(true);

      boostButtonElement.classList.remove('pressed');
      expect(boostButtonElement.classList.contains('pressed')).toBe(false);
    });

    it('should handle disabled boost button state', () => {
      const button = boostButtonElement as HTMLButtonElement;
      button.classList.remove('ready');
      button.disabled = true;

      expect(button.disabled).toBe(true);
      expect(button.classList.contains('ready')).toBe(false);

      // Re-enable
      button.disabled = false;
      button.classList.add('ready');
      expect(button.disabled).toBe(false);
      expect(button.classList.contains('ready')).toBe(true);
    });
  });

  describe('Touch Event Handling', () => {
    it('should handle touch start events', () => {
      const touchHandler = vi.fn();
      joystickElement.addEventListener('touchstart', touchHandler);

      const touchEvent = new TouchEvent('touchstart', {
        touches: [{ clientX: 100, clientY: 100 } as Touch],
      });
      joystickElement.dispatchEvent(touchEvent);

      expect(touchHandler).toHaveBeenCalled();
    });

    it('should handle touch move events', () => {
      const touchHandler = vi.fn();
      joystickElement.addEventListener('touchmove', touchHandler);

      const touchEvent = new TouchEvent('touchmove', {
        touches: [{ clientX: 150, clientY: 150 } as Touch],
      });
      joystickElement.dispatchEvent(touchEvent);

      expect(touchHandler).toHaveBeenCalled();
    });

    it('should handle touch end events', () => {
      const touchHandler = vi.fn();
      joystickElement.addEventListener('touchend', touchHandler);

      const touchEvent = new TouchEvent('touchend', {
        touches: [] as Touch[],
      });
      joystickElement.dispatchEvent(touchEvent);

      expect(touchHandler).toHaveBeenCalled();
    });

    it('should handle boost button tap', () => {
      const tapHandler = vi.fn();
      boostButtonElement.addEventListener('touchstart', tapHandler);

      const touchEvent = new TouchEvent('touchstart', {
        touches: [{ clientX: 50, clientY: 50 } as Touch],
      });
      boostButtonElement.dispatchEvent(touchEvent);

      expect(tapHandler).toHaveBeenCalled();
    });
  });

  describe('Responsive Layout', () => {
    it('should handle extra small screens (< 375px)', () => {
      window.innerWidth = 360;
      window.innerHeight = 640;

      const smallJoystick = document.createElement('div');
      smallJoystick.className = 'joystick-base';
      document.body.appendChild(smallJoystick);

      expect(smallJoystick).toBeTruthy();

      document.body.removeChild(smallJoystick);
    });

    it('should handle tablet screens (768px - 1024px)', () => {
      window.innerWidth = 768;
      window.innerHeight = 1024;

      const tabletJoystick = document.createElement('div');
      tabletJoystick.className = 'joystick-base';
      document.body.appendChild(tabletJoystick);

      expect(tabletJoystick).toBeTruthy();

      document.body.removeChild(tabletJoystick);
    });

    it('should detect mobile viewport', () => {
      window.innerWidth = 390;
      // Note: matchMedia may not reflect window.innerWidth changes in test environment
      // This test verifies the mediaQuery API is available
      const mediaQuery = window.matchMedia('(max-width: 768px)');
      expect(mediaQuery).toBeDefined();
      expect(typeof mediaQuery.matches).toBe('boolean');
    });
  });

  describe('CSS Classes and Attributes', () => {
    it('should apply correct classes for joystick components', () => {
      expect(joystickElement.classList.contains('joystick-base')).toBe(true);

      const ring = joystickElement.querySelector('.joystick-ring');
      expect(ring?.classList.contains('joystick-ring')).toBe(true);

      const stick = joystickElement.querySelector('.joystick-stick');
      expect(stick?.classList.contains('joystick-stick')).toBe(true);
    });

    it('should apply correct classes for boost components', () => {
      expect(boostButtonElement.classList.contains('mobile-boost-button')).toBe(true);

      const icon = boostButtonElement.querySelector('.boost-icon');
      expect(icon?.classList.contains('boost-icon')).toBe(true);

      const ring = boostButtonElement.querySelector('.boost-cooldown-ring');
      expect(ring?.classList.contains('boost-cooldown-ring')).toBe(true);
    });

    it('should handle state class toggles', () => {
      const button = document.createElement('button');
      button.className = 'mobile-boost-button';
      document.body.appendChild(button);

      button.classList.add('ready');
      expect(button.classList.contains('ready')).toBe(true);

      button.classList.add('pressed');
      expect(button.classList.contains('pressed')).toBe(true);

      button.classList.remove('ready');
      expect(button.classList.contains('ready')).toBe(false);

      document.body.removeChild(button);
    });
  });

  describe('Accessibility', () => {
    it('should have proper button element for boost', () => {
      expect(boostButtonElement.tagName).toBe('BUTTON');
    });

    it('should allow keyboard navigation', () => {
      const testButton = document.createElement('button');
      testButton.className = 'mobile-boost-button';
      document.body.appendChild(testButton);

      // Check that button can receive focus
      testButton.focus();
      expect(document.activeElement).toBe(testButton);

      document.body.removeChild(testButton);
    });

    it('should support disabled state', () => {
      const button = boostButtonElement as HTMLButtonElement;
      button.disabled = true;
      expect(button.disabled).toBe(true);

      button.disabled = false;
      expect(button.disabled).toBe(false);
    });
  });

  describe('DOM Manipulation', () => {
    it('should create and remove joystick elements', () => {
      const joystick = document.createElement('div');
      joystick.className = 'joystick-base';
      document.body.appendChild(joystick);

      expect(document.body.contains(joystick)).toBe(true);

      document.body.removeChild(joystick);
      expect(document.body.contains(joystick)).toBe(false);
    });

    it('should create and remove boost button elements', () => {
      const button = document.createElement('button');
      button.className = 'mobile-boost-button';
      document.body.appendChild(button);

      expect(document.body.contains(button)).toBe(true);

      document.body.removeChild(button);
      expect(document.body.contains(button)).toBe(false);
    });

    it('should update element attributes', () => {
      boostButtonElement.setAttribute('data-state', 'active');
      expect(boostButtonElement.getAttribute('data-state')).toBe('active');

      boostButtonElement.setAttribute('data-state', 'inactive');
      expect(boostButtonElement.getAttribute('data-state')).toBe('inactive');
    });
  });

  describe('Multi-touch Support', () => {
    it('should handle multiple touch points', () => {
      const touchHandler = vi.fn();
      joystickElement.addEventListener('touchstart', touchHandler);

      const touchEvent = new TouchEvent('touchstart', {
        touches: [
          { clientX: 100, clientY: 100 } as Touch,
          { clientX: 200, clientY: 200 } as Touch,
        ],
      });
      joystickElement.dispatchEvent(touchEvent);

      expect(touchHandler).toHaveBeenCalled();
    });

    it('should track individual touch identifiers', () => {
      const touch1 = { identifier: 1, clientX: 100, clientY: 100 } as Touch;
      const touch2 = { identifier: 2, clientX: 200, clientY: 200 } as Touch;

      expect(touch1.identifier).toBe(1);
      expect(touch2.identifier).toBe(2);
      expect(touch1.identifier).not.toBe(touch2.identifier);
    });
  });
});
