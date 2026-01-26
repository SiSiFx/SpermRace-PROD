import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { HolographicKeycard } from '../HolographicKeycard';

describe('HolographicKeycard Component', () => {
  const mockTier = {
    name: 'MICRO',
    usd: 1,
    max: 16,
    prize: 10,
    popular: true,
    desc: 'Perfect for beginners'
  };

  const mockOnClick = vi.fn();

  it('should render the keycard with tier information', () => {
    render(
      <HolographicKeycard
        tier={mockTier}
        isActive={false}
        onClick={mockOnClick}
      />
    );

    expect(screen.getByText('$1')).toBeInTheDocument();
    expect(screen.getByText('MICRO')).toBeInTheDocument();
    expect(screen.getByText('$10')).toBeInTheDocument();
    expect(screen.getByText('900% ROI')).toBeInTheDocument();
    expect(screen.getByText('Perfect for beginners')).toBeInTheDocument();
  });

  it('should show popular badge when tier is popular', () => {
    render(
      <HolographicKeycard
        tier={mockTier}
        isActive={false}
        onClick={mockOnClick}
      />
    );

    expect(screen.getByText('🔥 HOT')).toBeInTheDocument();
  });

  it('should not show popular badge when tier is not popular', () => {
    const nonPopularTier = { ...mockTier, popular: false };

    render(
      <HolographicKeycard
        tier={nonPopularTier}
        isActive={false}
        onClick={mockOnClick}
      />
    );

    expect(screen.queryByText('🔥 HOT')).not.toBeInTheDocument();
  });

  it('should call onClick when clicked', () => {
    render(
      <HolographicKeycard
        tier={mockTier}
        isActive={false}
        onClick={mockOnClick}
      />
    );

    const button = screen.getByRole('button');
    fireEvent.click(button);

    expect(mockOnClick).toHaveBeenCalledTimes(1);
  });

  it('should not call onClick when disabled', () => {
    render(
      <HolographicKeycard
        tier={mockTier}
        isActive={false}
        onClick={mockOnClick}
        disabled={true}
      />
    );

    const button = screen.getByRole('button');
    fireEvent.click(button);

    expect(mockOnClick).not.toHaveBeenCalled();
  });

  it('should calculate ROI correctly', () => {
    render(
      <HolographicKeycard
        tier={mockTier}
        isActive={false}
        onClick={mockOnClick}
      />
    );

    // ROI = (10 / 1 - 1) * 100 = 900%
    expect(screen.getByText('900% ROI')).toBeInTheDocument();
  });

  it('should render different tier names and colors', () => {
    const tiers = [
      { name: 'MICRO', usd: 1, max: 16, prize: 10, popular: false, desc: 'Test' },
      { name: 'NANO', usd: 5, max: 32, prize: 50, popular: false, desc: 'Test' },
      { name: 'MEGA', usd: 25, max: 32, prize: 250, popular: false, desc: 'Test' },
      { name: 'ELITE', usd: 100, max: 16, prize: 1000, popular: false, desc: 'Test' }
    ];

    tiers.forEach(tier => {
      const { unmount } = render(
        <HolographicKeycard
          tier={tier}
          isActive={false}
          onClick={mockOnClick}
        />
      );

      expect(screen.getByText(tier.name)).toBeInTheDocument();
      expect(screen.getByText(`$${tier.usd}`)).toBeInTheDocument();
      expect(screen.getByText(`$${tier.prize}`)).toBeInTheDocument();

      unmount();
    });
  });

  it('should handle mouse move events for 3D effect', () => {
    render(
      <HolographicKeycard
        tier={mockTier}
        isActive={false}
        onClick={mockOnClick}
      />
    );

    const button = screen.getByRole('button');

    // Simulate mouse move
    fireEvent.mouseMove(button, {
      clientX: 100,
      clientY: 100
    });

    // Component should handle the event without errors
    expect(button).toBeInTheDocument();
  });

  it('should handle mouse enter and leave events', () => {
    render(
      <HolographicKeycard
        tier={mockTier}
        isActive={false}
        onClick={mockOnClick}
      />
    );

    const button = screen.getByRole('button');

    fireEvent.mouseEnter(button);
    fireEvent.mouseLeave(button);

    expect(button).toBeInTheDocument();
  });

  it('should be disabled when disabled prop is true', () => {
    render(
      <HolographicKeycard
        tier={mockTier}
        isActive={false}
        onClick={mockOnClick}
        disabled={true}
      />
    );

    const button = screen.getByRole('button');
    expect(button).toBeDisabled();
  });

  it('should display correct ROI for different prize amounts', () => {
    const testCases = [
      { usd: 1, prize: 10, expectedROI: '900% ROI' },
      { usd: 5, prize: 50, expectedROI: '900% ROI' },
      { usd: 25, prize: 250, expectedROI: '900% ROI' },
      { usd: 100, prize: 1000, expectedROI: '900% ROI' }
    ];

    testCases.forEach(({ usd, prize, expectedROI }) => {
      const tier = { ...mockTier, usd, prize };
      const { unmount } = render(
        <HolographicKeycard
          tier={tier}
          isActive={false}
          onClick={mockOnClick}
        />
      );

      expect(screen.getByText(expectedROI)).toBeInTheDocument();
      unmount();
    });
  });
});
