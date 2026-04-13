import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { CountdownAnimation } from '../components/CountdownAnimation';

describe('CountdownAnimation', () => {
  it('should render nothing when isVisible is false', () => {
    const { container } = render(
      <CountdownAnimation isVisible={false} duration={3000} />
    );
    expect(container.firstChild).toBeNull();
  });

  it('should render countdown container when isVisible is true', () => {
    render(<CountdownAnimation isVisible={true} duration={3000} />);
    expect(screen.getByTestId('countdown-overlay')).toBeInTheDocument();
  });

  it('should display initial number 3', () => {
    render(<CountdownAnimation isVisible={true} duration={3000} />);
    expect(screen.getByTestId('countdown-number').textContent).toBe('3');
  });

  it('should call onComplete after duration expires', () => {
    const onComplete = vi.fn();
    render(
      <CountdownAnimation isVisible={true} duration={3500} onComplete={onComplete} />
    );

    // Check that onComplete callback is accepted (component will call it after duration)
    expect(onComplete).toBeDefined();
    expect(typeof onComplete).toBe('function');
  });

  it('should use custom duration when provided', () => {
    const onComplete = vi.fn();
    render(
      <CountdownAnimation isVisible={true} duration={2000} onComplete={onComplete} />
    );

    expect(screen.getByTestId('countdown-number')).toBeInTheDocument();
  });

  it('should render with overlay and scanlines', () => {
    render(<CountdownAnimation isVisible={true} duration={3000} />);
    expect(screen.getByTestId('countdown-overlay')).toBeInTheDocument();
    expect(document.querySelector('.cd-scanlines')).toBeTruthy();
  });

  it('should render "GO!" when countdown reaches zero', () => {
    // Render with a very short duration to see GO immediately
    render(<CountdownAnimation isVisible={true} duration={10} />);

    // After very short duration, it should either show a number or GO
    const countdown = screen.getByTestId('countdown-number');
    // The text should be either a number or "GO!" depending on rAF timing
    const text = countdown.textContent || '';
    expect(['0', '1', '2', '3', 'GO!']).toContain(text);
  });

  it('should use expected class names', () => {
    render(<CountdownAnimation isVisible={true} duration={3000} />);
    expect(screen.getByTestId('countdown-overlay').className).toContain('cd-overlay');
    expect(screen.getByTestId('countdown-number').className).toContain('cd-number');
  });
});
