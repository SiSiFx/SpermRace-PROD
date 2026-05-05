/**
 * MobileErrorHandler.tsx
 * Graceful error handling with mobile-friendly error states
 */

import { Component, type ReactNode } from 'react';
import './MobileErrorHandler.css';

export interface ErrorInfo {
  message: string;
  type?: 'network' | 'wallet' | 'game' | 'unknown';
  code?: string;
  retryable?: boolean;
}

interface MobileErrorHandlerProps {
  children: ReactNode;
  fallback?: (error: ErrorInfo, retry: () => void) => ReactNode;
  onError?: (error: ErrorInfo) => void;
}

interface MobileErrorHandlerState {
  error: ErrorInfo | null;
}

/**
 * Enhanced error boundary specifically for mobile with recoverable error states
 */
export class MobileErrorHandler extends Component<
  MobileErrorHandlerProps,
  MobileErrorHandlerState
> {
  constructor(props: MobileErrorHandlerProps) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error: Error): MobileErrorHandlerState {
    // Determine error type from error message
    let type: ErrorInfo['type'] = 'unknown';
    const message = error.message.toLowerCase();

    if (message.includes('network') || message.includes('fetch') || message.includes('websocket')) {
      type = 'network';
    } else if (message.includes('wallet') || message.includes('signature') || message.includes('phantom')) {
      type = 'wallet';
    } else if (message.includes('game') || message.includes('player') || message.includes('lobby')) {
      type = 'game';
    }

    return {
      error: {
        message: error.message || 'An unexpected error occurred',
        type,
        retryable: type !== 'wallet', // Wallet errors usually require user action
      },
    };
  }

  componentDidCatch(error: Error, errorInfo: any) {
    console.error('[MobileErrorHandler] Caught error:', error, errorInfo);

    // Notify parent component
    this.props.onError?.(this.state.error!);

    // Log to analytics if available
    try {
      if (typeof window !== 'undefined' && (window as any).gtag) {
        (window as any).gtag('event', 'exception', {
          description: error.message,
          fatal: false,
        });
      }
    } catch {
      // Silently fail if analytics not available
    }
  }

  handleRetry = () => {
    this.setState({ error: null });
  };

  render() {
    if (this.state.error) {
      if (this.props.fallback) {
        return this.props.fallback(this.state.error, this.handleRetry);
      }
      return <MobileErrorState error={this.state.error} onRetry={this.handleRetry} />;
    }

    return this.props.children;
  }
}

/**
 * Default mobile-friendly error display component
 */
interface MobileErrorStateProps {
  error: ErrorInfo;
  onRetry: () => void;
}

export function MobileErrorState({ error, onRetry }: MobileErrorStateProps) {
  const getErrorTitle = () => {
    switch (error.type) {
      case 'network':
        return 'Connection Error';
      case 'wallet':
        return 'Wallet Error';
      case 'game':
        return 'Game Error';
      default:
        return 'Something Went Wrong';
    }
  };

  const getErrorIcon = () => {
    switch (error.type) {
      case 'network':
        return '📡';
      case 'wallet':
        return '👛';
      case 'game':
        return '🎮';
      default:
        return '⚠️';
    }
  };

  const getSuggestion = () => {
    switch (error.type) {
      case 'network':
        return 'Check your internet connection and try again.';
      case 'wallet':
        return 'Make sure your wallet is unlocked and try again.';
      case 'game':
        return 'The game session may have ended. Please rejoin.';
      default:
        return 'If this continues, try restarting the app.';
    }
  };

  return (
    <div className="mobile-error-state">
      <div className="error-state-content">
        {/* Animated error icon */}
        <div className="error-icon-container">
          <div className="error-icon-pulse" />
          <span className="error-icon">{getErrorIcon()}</span>
        </div>

        {/* Error title */}
        <h2 className="error-title">{getErrorTitle()}</h2>

        {/* Error message */}
        <p className="error-message">{error.message}</p>

        {/* Suggestion */}
        <p className="error-suggestion">{getSuggestion()}</p>

        {/* Action buttons */}
        <div className="error-actions">
          {error.retryable && (
            <button className="error-btn error-btn-primary" onClick={onRetry}>
              <span className="btn-icon">↻</span>
              <span className="btn-text">Try Again</span>
            </button>
          )}
          <button
            className="error-btn error-btn-secondary"
            onClick={() => window.location.reload()}
          >
            <span className="btn-icon">⌂</span>
            <span className="btn-text">Reload App</span>
          </button>
        </div>
      </div>

      {/* Decorative background elements */}
      <div className="error-bg-grid" />
      <div className="error-bg-glow" />
    </div>
  );
}

/**
 * Hook for showing temporary error toasts
 */
interface ToastOptions {
  duration?: number;
  type?: 'error' | 'warning' | 'info' | 'success';
}

let toastShown = false;

export function showErrorToast(message: string, options: ToastOptions = {}) {
  if (toastShown || typeof document === 'undefined') return;

  toastShown = true;
  const { duration = 3000, type = 'error' } = options;

  // Create toast element with safe DOM manipulation (prevent XSS)
  const toast = document.createElement('div');
  toast.className = `mobile-error-toast toast-${type}`;

  // Safe text content for message (prevents XSS from user-controlled error messages)
  const messageSpan = document.createElement('span');
  messageSpan.className = 'toast-message';
  messageSpan.textContent = message;

  const closeBtn = document.createElement('button');
  closeBtn.className = 'toast-close';
  closeBtn.setAttribute('aria-label', 'Close');
  closeBtn.textContent = '×';

  toast.appendChild(messageSpan);
  toast.appendChild(closeBtn);

  document.body.appendChild(toast);

  // Trigger animation
  requestAnimationFrame(() => {
    toast.classList.add('toast-visible');
  });

  // Handle close button
  const closeButton = toast.querySelector('.toast-close');
  closeButton?.addEventListener('click', () => {
    toast.classList.remove('toast-visible');
    setTimeout(() => {
      toast.remove();
      toastShown = false;
    }, 300);
  });

  // Auto-dismiss
  setTimeout(() => {
    if (toast.parentElement) {
      toast.classList.remove('toast-visible');
      setTimeout(() => {
        toast.remove();
        toastShown = false;
      }, 300);
    }
  }, duration);
}

/**
 * HOC for wrapping components with error boundary
 */
export function withMobileErrorBoundary<P extends object>(
  Component: React.ComponentType<P>,
  fallback?: (error: ErrorInfo, retry: () => void) => ReactNode
) {
  return function WithErrorBoundary(props: P) {
    return (
      <MobileErrorHandler fallback={fallback}>
        <Component {...props} />
      </MobileErrorHandler>
    );
  };
}

export default MobileErrorHandler;
