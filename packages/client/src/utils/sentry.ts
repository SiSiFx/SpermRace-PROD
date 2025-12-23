import * as Sentry from "@sentry/react";

export function initSentry() {
  // Only initialize in production or when explicitly enabled
  const isDev = import.meta.env.DEV || import.meta.env.MODE === 'development';
  const forceEnable = localStorage.getItem('SENTRY_ENABLED') === '1';
  
  if (!isDev || forceEnable) {
    Sentry.init({
      dsn: "https://7b26bd07a64c3a30c6857ede0f660faa@o4510460703473664.ingest.de.sentry.io/4510460715204688",
      
      integrations: [
        // Automatic instrumentation
        Sentry.browserTracingIntegration(),
        
        // Session Replay - see what users experienced
        Sentry.replayIntegration({
          maskAllText: true, // Privacy: mask all text
          blockAllMedia: true, // Privacy: don't record images/video
        }),
      ],

      // Send default PII (IP addresses, user info)
      sendDefaultPii: true,
      
      // Performance Monitoring
      tracesSampleRate: 0.1, // Capture 10% of transactions for performance monitoring
      
      // Session Replay - only replay sessions with errors
      replaysSessionSampleRate: 0.0, // Don't replay normal sessions (save quota)
      replaysOnErrorSampleRate: 1.0, // Replay 100% of error sessions
      
      // Environment
      environment: import.meta.env.MODE || 'production',
      
      // Release tracking (for better debugging)
      release: `spermrace@${import.meta.env.VITE_APP_VERSION || '1.0.0'}`,
      
      // Configure which errors to send
      beforeSend(event) {
        // Filter out localhost errors (unless forced)
        if (!forceEnable && window.location.hostname === 'localhost') {
          return null;
        }
        
        // Filter out browser extension errors
        if (event.exception) {
          const values = event.exception.values || [];
          for (const value of values) {
            if (value.stacktrace?.frames) {
              const frames = value.stacktrace.frames;
              // Check if error is from extension
              if (frames.some(frame => frame.filename?.includes('extension://'))) {
                return null; // Don't send
              }
            }
          }
        }
        
        // Add custom context
        event.contexts = event.contexts || {};
        event.contexts.game = {
          screen_width: window.innerWidth,
          screen_height: window.innerHeight,
          device_pixel_ratio: window.devicePixelRatio,
          connection: (navigator as any).connection?.effectiveType || 'unknown',
        };
        
        return event;
      },
      
      // Ignore common noisy errors
      ignoreErrors: [
        // Browser extensions
        'top.GLOBALS',
        'chrome-extension://',
        'moz-extension://',
        // Network errors that are expected
        'NetworkError',
        'Failed to fetch',
        // WebGL context loss (we handle this)
        'WebGL context lost',
        // Wallet errors (user cancelled, expected)
        'User rejected',
        'User canceled',
        'User declined',
      ],
      
      // Don't send breadcrumbs for these actions (privacy)
      beforeBreadcrumb(breadcrumb) {
        // Don't log keypresses (privacy)
        if (breadcrumb.category === 'ui.input') {
          return null;
        }
        return breadcrumb;
      },
    });
    
    // Set user context when available (after wallet connection)
    // You can call this from your wallet connection code:
    // Sentry.setUser({ id: walletPublicKey });
  }
}

// Helper to manually capture errors (use in catch blocks)
export function captureError(error: Error | string, context?: Record<string, any>) {
  if (typeof error === 'string') {
    Sentry.captureMessage(error, {
      level: 'error',
      contexts: context ? { extra: context } : undefined,
    });
  } else {
    Sentry.captureException(error, {
      contexts: context ? { extra: context } : undefined,
    });
  }
}

// Helper to add breadcrumbs (for debugging)
export function addBreadcrumb(message: string, data?: Record<string, any>) {
  Sentry.addBreadcrumb({
    message,
    data,
    level: 'info',
  });
}

// Helper to set user context
export function setSentryUser(publicKey: string | null) {
  if (publicKey) {
    Sentry.setUser({ id: publicKey });
  } else {
    Sentry.setUser(null);
  }
}

// Helper to add tags
export function setSentryTag(key: string, value: string) {
  Sentry.setTag(key, value);
}
