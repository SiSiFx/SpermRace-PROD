/**
 * MobileScreenWrapper.tsx
 * Provides smooth screen transitions, loading states, and animations for mobile screens
 */

import { useEffect, useState, useRef, type ReactNode } from 'react';
import './MobileScreenWrapper.css';

export type ScreenTransition = 'fade' | 'slide-up' | 'slide-down' | 'scale' | 'none';

interface MobileScreenWrapperProps {
  children: ReactNode;
  isActive: boolean;
  transition?: ScreenTransition;
  isLoading?: boolean;
  loadingMessage?: string;
  className?: string;
  onTransitionEnd?: () => void;
}

/**
 * Wrapper component that provides smooth enter/exit transitions for mobile screens
 */
export function MobileScreenWrapper({
  children,
  isActive,
  transition = 'fade',
  isLoading = false,
  loadingMessage = 'Loading...',
  className = '',
  onTransitionEnd,
}: MobileScreenWrapperProps) {
  const [isAnimating, setIsAnimating] = useState(false);
  const [showContent, setShowContent] = useState(isActive);
  const timeoutRef = useRef<number | null>(null);

  useEffect(() => {
    // Clear any existing timeout
    if (timeoutRef.current !== null) {
      window.clearTimeout(timeoutRef.current);
    }

    if (isActive) {
      // Screen is becoming active - animate in
      setIsAnimating(true);
      setShowContent(true);

      // Remove animating state after animation completes
      timeoutRef.current = window.setTimeout(() => {
        setIsAnimating(false);
        onTransitionEnd?.();
      }, 300);
    } else {
      // Screen is becoming inactive - animate out
      setIsAnimating(true);

      // Hide content after exit animation
      timeoutRef.current = window.setTimeout(() => {
        setShowContent(false);
        setIsAnimating(false);
        onTransitionEnd?.();
      }, 250);
    }

    return () => {
      if (timeoutRef.current !== null) {
        window.clearTimeout(timeoutRef.current);
      }
    };
  }, [isActive, onTransitionEnd]);

  if (!showContent && !isActive) {
    return null;
  }

  const transitionClass = transition !== 'none' ? `transition-${transition}` : '';
  const animationState = isAnimating ? (isActive ? 'animating-in' : 'animating-out') : 'active';

  return (
    <div
      className={`mobile-screen-wrapper ${transitionClass} ${animationState} ${className}`.trim()}
      aria-hidden={!isActive}
    >
      {isLoading ? (
        <div className="screen-loading-state">
          <div className="loading-spinner-wrapper">
            <div className="loading-spinner-ring" />
            <div className="loading-spinner-ring inner" />
          </div>
          {loadingMessage && (
            <p className="loading-message">{loadingMessage}</p>
          )}
        </div>
      ) : (
        children
      )}
    </div>
  );
}

/**
 * Skeleton loader component for placeholder content
 */
interface SkeletonProps {
  width?: string | number;
  height?: string | number;
  className?: string;
  variant?: 'rect' | 'circle' | 'text';
}

export function Skeleton({
  width = '100%',
  height = 20,
  className = '',
  variant = 'rect',
}: SkeletonProps) {
  const style = { width, height };

  return (
    <div
      className={`skeleton-loader skeleton-${variant} ${className}`.trim()}
      style={style}
      aria-hidden="true"
    />
  );
}

/**
 * Pressable wrapper for tap feedback on interactive elements
 */
interface PressableProps {
  children: ReactNode;
  onPress?: () => void;
  disabled?: boolean;
  className?: string;
  scaleAmount?: number;
}

export function Pressable({
  children,
  onPress,
  disabled = false,
  className = '',
  scaleAmount = 0.95,
}: PressableProps) {
  const [isPressed, setIsPressed] = useState(false);

  const handlePressStart = () => {
    if (!disabled) {
      setIsPressed(true);
      // Trigger haptic feedback on supported devices
      if ('vibrate' in navigator) {
        navigator.vibrate(5);
      }
    }
  };

  const handlePressEnd = () => {
    if (!disabled) {
      setIsPressed(false);
    }
  };

  const handleClick = () => {
    if (!disabled) {
      onPress?.();
    }
  };

  return (
    <div
      className={`pressable ${isPressed ? 'pressed' : ''} ${className}`.trim()}
      style={{ '--press-scale': scaleAmount } as any}
      onMouseDown={handlePressStart}
      onMouseUp={handlePressEnd}
      onMouseLeave={handlePressEnd}
      onTouchStart={handlePressStart}
      onTouchEnd={handlePressEnd}
      onClick={handleClick}
      role={onPress ? 'button' : undefined}
      tabIndex={onPress ? 0 : undefined}
      aria-disabled={disabled}
    >
      {children}
    </div>
  );
}

/**
 * Full-screen loading overlay with animated background
 */
interface LoadingOverlayProps {
  isVisible: boolean;
  message?: string;
  progress?: number;
  showProgress?: boolean;
}

export function LoadingOverlay({
  isVisible,
  message = 'Loading...',
  progress,
  showProgress = false,
}: LoadingOverlayProps) {
  if (!isVisible) return null;

  return (
    <div className="loading-overlay-wrapper">
      <div className="loading-overlay-content">
        {/* Animated background rings */}
        <div className="loading-rings">
          <div className="loading-ring" />
          <div className="loading-ring" style={{ animationDelay: '0.15s' }} />
          <div className="loading-ring" style={{ animationDelay: '0.3s' }} />
        </div>

        {/* Central icon/spinner */}
        <div className="loading-icon">
          <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <circle
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              className="loading-circle"
            />
          </svg>
        </div>

        {/* Loading message */}
        {message && <p className="loading-overlay-message">{message}</p>}

        {/* Progress bar */}
        {showProgress && typeof progress === 'number' && (
          <div className="loading-progress-container">
            <div className="loading-progress-bar">
              <div
                className="loading-progress-fill"
                style={{ width: `${Math.min(100, Math.max(0, progress))}%` }}
              />
            </div>
            <span className="loading-progress-text">{Math.round(progress)}%</span>
          </div>
        )}
      </div>
    </div>
  );
}

export default MobileScreenWrapper;
