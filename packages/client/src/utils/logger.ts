/**
 * Production-safe logger utility
 * Automatically gates console logs based on environment
 */

import { captureError } from './sentry';

const isDev = import.meta.env.DEV || import.meta.env.MODE === 'development';
const isDebug = () => {
  try {
    return localStorage.getItem('SR_DEBUG') === '1' || new URLSearchParams(window.location.search).get('debug') === '1';
  } catch {
    return false;
  }
};

export const logger = {
  log: (...args: any[]) => {
    if (isDev || isDebug()) {
      console.log(...args);
    }
  },
  
  warn: (...args: any[]) => {
    if (isDev || isDebug()) {
      console.warn(...args);
    }
  },
  
  error: (...args: any[]) => {
    // Always log errors, even in production
    console.error(...args);
    
    // Send to Sentry in production
    try {
      const error = args[0];
      if (error instanceof Error) {
        captureError(error);
      } else if (typeof error === 'string') {
        captureError(error);
      }
    } catch {
      // Silently fail if Sentry isn't initialized
    }
  },
  
  debug: (...args: any[]) => {
    if (isDebug()) {
      console.log('[DEBUG]', ...args);
    }
  },
  
  info: (...args: any[]) => {
    if (isDev) {
      console.info(...args);
    }
  }
};

// Shorthand exports
export const log = logger.log;
export const warn = logger.warn;
export const error = logger.error;
export const debug = logger.debug;
export const info = logger.info;
