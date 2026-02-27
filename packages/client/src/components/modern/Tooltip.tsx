/**
 * Tooltip - Brutal Bet Style
 * Black/white/red/yellow, thick borders, offset shadows, bold uppercase
 */

import { useState, useRef, useEffect } from 'react';
import { Info } from 'phosphor-react';
import './Tooltip.css';

export type TooltipPosition = 'top' | 'bottom' | 'left' | 'right';

export interface TooltipProps {
  content: string | React.ReactNode;
  position?: TooltipPosition;
  delay?: number;
  disabled?: boolean;
  children: React.ReactElement;
  className?: string;
}

export function Tooltip({ content, position = 'top', delay = 200, disabled = false, children, className = '' }: TooltipProps) {
  const [isVisible, setIsVisible] = useState(false);
  const timeoutRef = useRef<number | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const handleMouseEnter = () => {
    if (disabled) return;
    timeoutRef.current = window.setTimeout(() => {
      setIsVisible(true);
    }, delay);
  };

  const handleMouseLeave = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    setIsVisible(false);
  };

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  return (
    <div
      ref={containerRef}
      className={`tooltip-container ${className}`}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {children}
      {isVisible && !disabled && (
        <div className={`brutal-tooltip brutal-tooltip-${position}`}>
          <div className="brutal-tooltip-content">
            {content}
          </div>
          <div className={`brutal-tooltip-arrow brutal-tooltip-arrow-${position}`} />
        </div>
      )}
    </div>
  );
}

// Info icon with tooltip variant
export interface InfoTooltipProps {
  content: string | React.ReactNode;
  position?: TooltipPosition;
  className?: string;
}

export function InfoTooltip({ content, position = 'top', className = '' }: InfoTooltipProps) {
  return (
    <Tooltip content={content} position={position} className={className}>
      <button className="brutal-info-btn">
        <Info size={16} weight="fill" />
      </button>
    </Tooltip>
  );
}

// Simple tooltip for quick use
export function SimpleTooltip({ children, content, position = 'top' }: Omit<TooltipProps, 'delay' | 'disabled'>) {
  return <Tooltip content={content} position={position}>{children}</Tooltip>;
}

export default Tooltip;
