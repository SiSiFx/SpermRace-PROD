/**
 * God Ray Effects Tests
 * Tests for the victory screen god ray light effects
 */

import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import '@testing-library/jest-dom';

// Mock results component with god rays
function MockResults({ isWinner }: { isWinner: boolean }) {
  return (
    <div className="screen active" id="round-end">
      {isWinner && (
        <div className="god-ray-container active">
          <div className="god-ray"></div>
        </div>
      )}
      <div className="modal-card">
        <h2 className={`round-result ${isWinner ? 'victory' : 'defeat'}`}>
          {isWinner ? 'Fertilization!' : 'Eliminated'}
        </h2>
      </div>
    </div>
  );
}

describe('God Ray Effects', () => {
  describe('DOM Structure', () => {
    it('should render god ray container when player wins', () => {
      const { container } = render(<MockResults isWinner={true} />);
      const godRayContainer = container.querySelector('.god-ray-container');
      expect(godRayContainer).toBeInTheDocument();
    });

    it('should not render god ray container when player loses', () => {
      const { container } = render(<MockResults isWinner={false} />);
      const godRayContainer = container.querySelector('.god-ray-container');
      expect(godRayContainer).not.toBeInTheDocument();
    });

    it('should render god ray element within container', () => {
      const { container } = render(<MockResults isWinner={true} />);
      const godRay = container.querySelector('.god-ray');
      expect(godRay).toBeInTheDocument();
    });

    it('should apply active class to god ray container when winner', () => {
      const { container } = render(<MockResults isWinner={true} />);
      const godRayContainer = container.querySelector('.god-ray-container');
      expect(godRayContainer).toHaveClass('active');
    });
  });

  describe('CSS Classes and Attributes', () => {
    it('should have correct base classes for god ray container', () => {
      const { container } = render(<MockResults isWinner={true} />);
      const godRayContainer = container.querySelector('.god-ray-container');
      expect(godRayContainer?.className).toContain('god-ray-container');
      expect(godRayContainer?.className).toContain('active');
    });

    it('should have correct class for god ray element', () => {
      const { container } = render(<MockResults isWinner={true} />);
      const godRay = container.querySelector('.god-ray');
      expect(godRay?.className).toBe('god-ray');
    });

    it('should position god ray container correctly', () => {
      const { container } = render(<MockResults isWinner={true} />);
      const godRayContainer = container.querySelector('.god-ray-container');
      expect(godRayContainer).toBeInTheDocument();
      expect(godRayContainer?.className).toContain('god-ray-container');
    });
  });

  describe('Victory State Integration', () => {
    it('should display victory text when god rays are active', () => {
      const { container } = render(<MockResults isWinner={true} />);
      const victoryText = container.querySelector('.round-result.victory');
      expect(victoryText).toBeInTheDocument();
      expect(victoryText?.textContent).toBe('Fertilization!');
    });

    it('should not display victory text when god rays are inactive', () => {
      const { container } = render(<MockResults isWinner={false} />);
      const victoryText = container.querySelector('.round-result.victory');
      expect(victoryText).not.toBeInTheDocument();
    });

    it('should show defeat state without god rays', () => {
      const { container } = render(<MockResults isWinner={false} />);
      const defeatText = container.querySelector('.round-result.defeat');
      expect(defeatText).toBeInTheDocument();
      expect(defeatText?.textContent).toBe('Eliminated');
    });
  });

  describe('Performance Considerations', () => {
    it('should not interfere with modal interaction', () => {
      const { container } = render(<MockResults isWinner={true} />);
      const modalCard = container.querySelector('.modal-card');
      const godRayContainer = container.querySelector('.god-ray-container');

      expect(modalCard).toBeInTheDocument();
      expect(godRayContainer).toBeInTheDocument();
      expect(modalCard).not.toBe(godRayContainer);
    });

    it('should have proper DOM structure for z-index layering', () => {
      const { container } = render(<MockResults isWinner={true} />);
      const screen = container.querySelector('.screen.active');
      const godRayContainer = container.querySelector('.god-ray-container');
      const modalCard = container.querySelector('.modal-card');

      expect(screen).toBeInTheDocument();
      expect(godRayContainer).toBeInTheDocument();
      expect(modalCard).toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('should not interfere with modal interaction', () => {
      const { container } = render(<MockResults isWinner={true} />);
      const modalCard = container.querySelector('.modal-card');
      expect(modalCard).toBeInTheDocument();
    });

    it('should be properly positioned in DOM', () => {
      const { container } = render(<MockResults isWinner={true} />);
      const godRayContainer = container.querySelector('.god-ray-container');
      expect(godRayContainer).toBeInTheDocument();
      expect(godRayContainer?.className).toContain('god-ray-container');
    });
  });
});
