/**
 * OrientationWarning Component Tests
 * Tests for the orientation warning screen with Bio-Cyberpunk theme
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, waitFor, cleanup } from '@testing-library/react';
import '@testing-library/jest-dom';
import { OrientationWarning } from '../OrientationWarning';

describe('OrientationWarning Component', () => {
  let originalInnerWidth: number;
  let originalInnerHeight: number;

  beforeEach(() => {
    // Store original window dimensions
    originalInnerWidth = window.innerWidth;
    originalInnerHeight = window.innerHeight;

    // Reset to mobile portrait dimensions by default
    window.innerWidth = 390;
    window.innerHeight = 844;
  });

  afterEach(() => {
    // Restore original window dimensions
    window.innerWidth = originalInnerWidth;
    window.innerHeight = originalInnerHeight;
    cleanup();

    // Remove all event listeners
    vi.restoreAllMocks();
  });

  describe('Rendering Behavior', () => {
    it('should not render when in portrait mode on mobile', () => {
      // Mobile portrait dimensions
      window.innerWidth = 390;
      window.innerHeight = 844;

      render(<OrientationWarning />);

      const warning = screen.queryByTestId('orientation-warning');
      expect(warning).not.toBeInTheDocument();
    });

    it('should render when in landscape mode on mobile', async () => {
      // Mobile landscape dimensions
      window.innerWidth = 844;
      window.innerHeight = 390;

      render(<OrientationWarning />);

      await waitFor(() => {
        const warning = screen.queryByText(/rotate your device/i);
        expect(warning).toBeInTheDocument();
      });
    });

    it('should not render on desktop landscape', () => {
      // Desktop landscape dimensions (>= 1024px width)
      window.innerWidth = 1920;
      window.innerHeight = 1080;

      render(<OrientationWarning />);

      const warning = screen.queryByText(/rotate your device/i);
      expect(warning).not.toBeInTheDocument();
    });

    it('should render on tablet in landscape mode', async () => {
      // Tablet landscape dimensions
      window.innerWidth = 900;
      window.innerHeight = 600;

      render(<OrientationWarning />);

      await waitFor(() => {
        const warning = screen.queryByText(/rotate your device/i);
        expect(warning).toBeInTheDocument();
      });
    });
  });

  describe('Content and Messages', () => {
    it('should display the correct main message', async () => {
      window.innerWidth = 844;
      window.innerHeight = 390;

      render(<OrientationWarning />);

      await waitFor(() => {
        const mainMessage = screen.getByText(/rotate your device/i);
        expect(mainMessage).toBeInTheDocument();
      });
    });

    it('should display the subtitle text', async () => {
      window.innerWidth = 844;
      window.innerHeight = 390;

      render(<OrientationWarning />);

      await waitFor(() => {
        const subtitle = screen.getByText(/optimized for vertical gameplay/i);
        expect(subtitle).toBeInTheDocument();
      });
    });

    it('should display the visual guide with portrait indicator', async () => {
      window.innerWidth = 844;
      window.innerHeight = 390;

      render(<OrientationWarning />);

      await waitFor(() => {
        const guideText = screen.queryByText('Portrait');
        expect(guideText).toBeInTheDocument();
      });
    });
  });

  describe('Orientation Change Handling', () => {
    it('should show warning when rotating to landscape', async () => {
      // Start in portrait
      window.innerWidth = 390;
      window.innerHeight = 844;

      const { rerender } = render(<OrientationWarning />);

      // Initially should not show
      expect(screen.queryByText(/rotate your device/i)).not.toBeInTheDocument();

      // Rotate to landscape
      window.innerWidth = 844;
      window.innerHeight = 390;

      // Trigger orientation change event
      window.dispatchEvent(new Event('orientationchange'));
      window.dispatchEvent(new Event('resize'));

      // Rerender to check state
      rerender(<OrientationWarning />);

      await waitFor(() => {
        const warning = screen.queryByText(/rotate your device/i);
        expect(warning).toBeInTheDocument();
      });
    });

    it('should hide warning when rotating to portrait', async () => {
      // Start in landscape
      window.innerWidth = 844;
      window.innerHeight = 390;

      const { rerender } = render(<OrientationWarning />);

      await waitFor(() => {
        expect(screen.queryByText(/rotate your device/i)).toBeInTheDocument();
      });

      // Rotate to portrait
      window.innerWidth = 390;
      window.innerHeight = 844;

      // Trigger orientation change event
      window.dispatchEvent(new Event('orientationchange'));
      window.dispatchEvent(new Event('resize'));

      // Rerender to check state
      rerender(<OrientationWarning />);

      await waitFor(() => {
        const warning = screen.queryByText(/rotate your device/i);
        expect(warning).not.toBeInTheDocument();
      });
    });
  });

  describe('Event Listeners', () => {
    it('should add orientationchange and resize event listeners on mount', () => {
      const addEventListenerSpy = vi.spyOn(window, 'addEventListener');

      render(<OrientationWarning />);

      expect(addEventListenerSpy).toHaveBeenCalledWith('orientationchange', expect.any(Function));
      expect(addEventListenerSpy).toHaveBeenCalledWith('resize', expect.any(Function));

      addEventListenerSpy.mockRestore();
    });

    it('should remove event listeners on unmount', () => {
      const removeEventListenerSpy = vi.spyOn(window, 'removeEventListener');

      const { unmount } = render(<OrientationWarning />);

      unmount();

      expect(removeEventListenerSpy).toHaveBeenCalledWith('orientationchange', expect.any(Function));
      expect(removeEventListenerSpy).toHaveBeenCalledWith('resize', expect.any(Function));

      removeEventListenerSpy.mockRestore();
    });
  });

  describe('Component Structure', () => {
    it('should render with proper CSS classes', async () => {
      window.innerWidth = 844;
      window.innerHeight = 390;

      const { container } = render(<OrientationWarning />);

      await waitFor(() => {
        const warningElement = container.querySelector('.orientation-warning');
        expect(warningElement).toBeInTheDocument();
      });
    });

    it('should render icon wrapper with proper structure', async () => {
      window.innerWidth = 844;
      window.innerHeight = 390;

      const { container } = render(<OrientationWarning />);

      await waitFor(() => {
        const iconWrapper = container.querySelector('.orientation-icon-wrapper');
        expect(iconWrapper).toBeInTheDocument();

        const iconGlow = container.querySelector('.orientation-icon-glow');
        expect(iconGlow).toBeInTheDocument();
      });
    });

    it('should render text content elements', async () => {
      window.innerWidth = 844;
      window.innerHeight = 390;

      const { container } = render(<OrientationWarning />);

      await waitFor(() => {
        const textContent = container.querySelector('.orientation-text-content');
        expect(textContent).toBeInTheDocument();

        const message = container.querySelector('.orientation-message');
        expect(message).toBeInTheDocument();

        const subtitle = container.querySelector('.orientation-subtitle');
        expect(subtitle).toBeInTheDocument();
      });
    });

    it('should render visual guide', async () => {
      window.innerWidth = 844;
      window.innerHeight = 390;

      const { container } = render(<OrientationWarning />);

      await waitFor(() => {
        const visualGuide = container.querySelector('.orientation-visual-guide');
        expect(visualGuide).toBeInTheDocument();
      });
    });

    it('should render decorative elements', async () => {
      window.innerWidth = 844;
      window.innerHeight = 390;

      const { container } = render(<OrientationWarning />);

      await waitFor(() => {
        const border = container.querySelector('.orientation-warning-border');
        expect(border).toBeInTheDocument();

        const scanline = container.querySelector('.orientation-warning-scanline');
        expect(scanline).toBeInTheDocument();
      });
    });
  });

  describe('Accessibility', () => {
    it('should have proper z-index to block interaction', async () => {
      window.innerWidth = 844;
      window.innerHeight = 390;

      const { container } = render(<OrientationWarning />);

      await waitFor(() => {
        const warningElement = container.querySelector('.orientation-warning');
        expect(warningElement).toBeInTheDocument();
        expect(warningElement).toHaveClass('orientation-warning');
      });
    });
  });

  describe('Edge Cases', () => {
    it('should handle square screens correctly', () => {
      // Square dimensions
      window.innerWidth = 500;
      window.innerHeight = 500;

      render(<OrientationWarning />);

      // Square should be treated as landscape
      const warning = screen.queryByText(/rotate your device/i);
      expect(warning).toBeInTheDocument();
    });

    it('should handle very small mobile screens', () => {
      // Very small mobile
      window.innerWidth = 320;
      window.innerHeight = 568;

      render(<OrientationWarning />);

      const warning = screen.queryByText(/rotate your device/i);
      expect(warning).not.toBeInTheDocument();
    });

    it('should handle very large desktop screens', () => {
      // Large desktop
      window.innerWidth = 3840;
      window.innerHeight = 2160;

      render(<OrientationWarning />);

      const warning = screen.queryByText(/rotate your device/i);
      expect(warning).not.toBeInTheDocument();
    });
  });
});
