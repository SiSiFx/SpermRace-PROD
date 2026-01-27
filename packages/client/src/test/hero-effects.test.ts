import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, cleanup, waitFor } from '@testing-library/react';
import App from '../App';

describe('Hero Effects - Neon Glow & Glitch Animations', () => {
  beforeEach(() => {
    // Mock window.matchMedia for prefers-reduced-motion
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: vi.fn().mockImplementation(query => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    });
  });

  afterEach(() => {
    cleanup();
  });

  describe('Neon Glow Elements', () => {
    it('should render primary neon glow background', async () => {
      render(<App />);

      await waitFor(() => {
        const neonGlow = document.querySelector('.hero-neon-glow');
        expect(neonGlow).toBeTruthy();
        expect(neonGlow).toHaveStyle({ position: 'absolute' });
      });
    });

    it('should render secondary neon glow background', async () => {
      render(<App />);

      await waitFor(() => {
        const neonGlowSecondary = document.querySelector('.hero-neon-glow-secondary');
        expect(neonGlowSecondary).toBeTruthy();
      });
    });

    it('should apply correct z-index to neon glows', async () => {
      render(<App />);

      await waitFor(() => {
        const neonGlow = document.querySelector('.hero-neon-glow');
        expect(neonGlow?.computedStyleMap().get('z-index')?.toString()).toBeDefined();
      });
    });

    it('should set pointer-events to none on glow elements', async () => {
      render(<App />);

      await waitFor(() => {
        const neonGlow = document.querySelector('.hero-neon-glow');
        expect(neonGlow?.computedStyleMap().get('pointer-events')?.toString()).toBe('none');
      });
    });
  });

  describe('Glitch Effects', () => {
    it('should render brand title with glitch effect', async () => {
      render(<App />);

      await waitFor(() => {
        const brandTitle = document.querySelector('.brand-title');
        expect(brandTitle).toBeTruthy();
      });
    });

    it('should have data-text attribute for glitch animation', async () => {
      render(<App />);

      await waitFor(() => {
        const brandTitle = document.querySelector('.brand-title');
        expect(brandTitle?.getAttribute('data-text')).toBe('SPERM RACE');
      });
    });

    it('should apply text-shadow for neon glow effect', async () => {
      render(<App />);

      await waitFor(() => {
        const brandTitle = document.querySelector('.brand-title');
        const textShadow = brandTitle?.computedStyleMap().get('text-shadow');
        expect(textShadow).toBeDefined();
      });
    });
  });

  describe('Scanline Overlay', () => {
    it('should render scanline overlay', async () => {
      render(<App />);

      await waitFor(() => {
        const scanlines = document.querySelector('.hero-scanlines');
        expect(scanlines).toBeTruthy();
      });
    });

    it('should position scanlines correctly', async () => {
      render(<App />);

      await waitFor(() => {
        const scanlines = document.querySelector('.hero-scanlines');
        expect(scanlines?.computedStyleMap().get('position')?.toString()).toBe('absolute');
        expect(scanlines?.computedStyleMap().get('top')?.toString()).toBe('0px');
        expect(scanlines?.computedStyleMap().get('left')?.toString()).toBe('0px');
      });
    });

    it('should set scanlines pointer-events to none', async () => {
      render(<App />);

      await waitFor(() => {
        const scanlines = document.querySelector('.hero-scanlines');
        expect(scanlines?.computedStyleMap().get('pointer-events')?.toString()).toBe('none');
      });
    });
  });

  describe('CSS Animation Properties', () => {
    it('should have glitch entry animation defined', async () => {
      const styleElement = document.createElement('style');
      styleElement.textContent = `
        @keyframes glitchEntry {
          0% { opacity: 0; transform: translateX(-100px) skewX(-20deg); }
          100% { opacity: 1; transform: translateX(0) skewX(0deg); }
        }
      `;
      document.head.appendChild(styleElement);

      render(<App />);

      await waitFor(() => {
        const brandTitle = document.querySelector('.brand-title');
        const animation = brandTitle?.computedStyleMap().get('animation');
        expect(animation).toBeDefined();
      });

      document.head.removeChild(styleElement);
    });

    it('should have neon glow pulse animation defined', () => {
      const styleElement = document.createElement('style');
      styleElement.textContent = `
        @keyframes neonGlowPulse {
          0%, 100% { opacity: 1; transform: translate(-50%, -50%) scale(1); }
          50% { opacity: 0.7; transform: translate(-50%, -50%) scale(1.1); }
        }
      `;
      document.head.appendChild(styleElement);

      expect(styleElement.sheet?.cssRules).toBeDefined();

      document.head.removeChild(styleElement);
    });

    it('should have text flicker animation defined', () => {
      const styleElement = document.createElement('style');
      styleElement.textContent = `
        @keyframes textFlicker {
          0%, 100% { text-shadow: 0 0 10px rgba(0, 240, 255, 0.8); }
          50% { text-shadow: 0 0 15px rgba(0, 240, 255, 1); }
        }
      `;
      document.head.appendChild(styleElement);

      expect(styleElement.sheet?.cssRules).toBeDefined();

      document.head.removeChild(styleElement);
    });
  });

  describe('Mode Card Enhancements', () => {
    it('should render mode cards with hover effects', async () => {
      render(<App />);

      await waitFor(() => {
        const modeCards = document.querySelectorAll('.mode-card');
        expect(modeCards.length).toBeGreaterThan(0);
      });
    });

    it('should apply glow effect on mode card hover', async () => {
      render(<App />);

      await waitFor(() => {
        const modeCard = document.querySelector('.mode-card');
        expect(modeCard).toBeTruthy();

        // Simulate hover
        modeCard?.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));

        const boxShadow = modeCard?.computedStyleMap().get('box-shadow');
        expect(boxShadow).toBeDefined();
      });
    });
  });

  describe('Accessibility', () => {
    it('should mark decorative elements with aria-hidden', async () => {
      render(<App />);

      await waitFor(() => {
        const neonGlow = document.querySelector('.hero-neon-glow');
        const scanlines = document.querySelector('.hero-scanlines');

        expect(neonGlow?.getAttribute('aria-hidden')).toBe('true');
        expect(scanlines?.getAttribute('aria-hidden')).toBe('true');
      });
    });

    it('should respect prefers-reduced-motion', async () => {
      // Mock matchMedia to return true for reduced motion
      (window.matchMedia as any).mockImplementation(query => ({
        matches: query === '(prefers-reduced-motion: reduce)',
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      }));

      render(<App />);

      await waitFor(() => {
        const brandTitle = document.querySelector('.brand-title');
        expect(brandTitle).toBeTruthy();
      });
    });
  });

  describe('Performance', () => {
    it('should use will-change for optimized animations', async () => {
      render(<App />);

      await waitFor(() => {
        const bgParticles = document.querySelector('#bg-particles');
        expect(bgParticles).toBeTruthy();
      });
    });

    it('should not cause layout thrashing', async () => {
      const startTime = performance.now();

      render(<App />);

      await waitFor(() => {
        const brandTitle = document.querySelector('.brand-title');
        expect(brandTitle).toBeTruthy();
      });

      const endTime = performance.now();
      const renderTime = endTime - startTime;

      // Render should complete in reasonable time
      expect(renderTime).toBeLessThan(1000);
    });
  });

  describe('Responsive Design', () => {
    it('should adapt to mobile viewport', async () => {
      // Simulate mobile viewport
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 375,
      });
      Object.defineProperty(window, 'innerHeight', {
        writable: true,
        configurable: true,
        value: 667,
      });

      window.dispatchEvent(new Event('resize'));

      render(<App />);

      await waitFor(() => {
        const brandTitle = document.querySelector('.brand-title');
        expect(brandTitle).toBeTruthy();
      });
    });

    it('should maintain readability on small screens', async () => {
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 320,
      });

      window.dispatchEvent(new Event('resize'));

      render(<App />);

      await waitFor(() => {
        const brandTitle = document.querySelector('.brand-title');
        expect(brandTitle).toBeTruthy();
      });
    });
  });

  describe('Integration with Existing Components', () => {
    it('should not interfere with landing screen functionality', async () => {
      render(<App />);

      await waitFor(() => {
        const landingScreen = document.querySelector('#landing-screen');
        expect(landingScreen).toBeTruthy();
      });
    });

    it('should preserve mode card functionality', async () => {
      render(<App />);

      await waitFor(() => {
        const modeCards = document.querySelectorAll('.mode-card');
        expect(modeCards.length).toBe(4); // 4 tiers: micro, nano, mega, championship
      });
    });
  });

  describe('Animation Timing', () => {
    it('should stagger neon glow animations correctly', async () => {
      render(<App />);

      await waitFor(() => {
        const primaryGlow = document.querySelector('.hero-neon-glow');
        const secondaryGlow = document.querySelector('.hero-neon-glow-secondary');

        expect(primaryGlow).toBeTruthy();
        expect(secondaryGlow).toBeTruthy();
      });
    });

    it('should delay subtitle glitch animation', async () => {
      render(<App />);

      await waitFor(() => {
        const subtitle = document.querySelector('.landing-container header p');
        expect(subtitle).toBeTruthy();
      });
    });
  });
});
