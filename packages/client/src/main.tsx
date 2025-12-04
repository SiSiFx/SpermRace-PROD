import React from 'react';
import { createRoot } from 'react-dom/client';
console.log('[BUILD] SpermRace wallet refactor bundle loaded');
import { Buffer } from 'buffer';
import { isMobileDevice } from './deviceDetection';
import '/style.css';
import { initSentry } from './utils/sentry';

// Initialize Sentry error tracking FIRST (before any errors can occur)
initSentry();

// Ensure Buffer is available for Solana/web3 dependencies running in the browser.
if (typeof globalThis !== 'undefined' && !(globalThis as any).Buffer) {
  (globalThis as any).Buffer = Buffer;
}

// Lightweight client error ingestion to backend analytics (no third-party)
// Only enable if API endpoint is configured
const ANALYTICS_API_BASE: string | null = (() => {
  // For any spermrace.io host (prod/dev/www), always go through same-origin /api
  // so Vercel/hosting can proxy and we avoid CORS with api.* origins.
  try {
    const host = (window?.location?.hostname || '').toLowerCase();
    if (host.endsWith('spermrace.io')) return '/api';
  } catch {}

  const env = (import.meta as any).env?.VITE_API_BASE as string | undefined;
  if (env && typeof env === 'string' && env.trim()) return env.trim();

  try {
    const host = (window?.location?.hostname || '').toLowerCase();
    if (host.includes('dev.spermrace.io')) return 'https://dev.spermrace.io/api';
    if (host.includes('spermrace.io')) return 'https://spermrace.io/api';
  } catch {}
  return '/api';
})();

if ((import.meta as any).env?.PROD === true && ANALYTICS_API_BASE) {
  try {
    let errorCount = 0;
    const MAX_ERRORS_PER_SESSION = 10;
    
    const send = (type: string, payload: any) => {
      // Rate limiting - don't spam analytics
      if (errorCount >= MAX_ERRORS_PER_SESSION) return;
      
      try {
        errorCount++;
        fetch(`${ANALYTICS_API_BASE}/analytics`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ type, payload }),
          mode: 'no-cors' // Prevent CORS errors
        }).catch(() => {}); // Silently fail
      } catch {}
    };
    
    window.addEventListener('error', (e) => {
      // Ignore analytics fetch errors to prevent loops
      if (e?.message?.includes('Failed to fetch') || e?.message?.includes('analytics')) {
        return;
      }
      
      const msg = e?.message || 'unknown';
      const src = (e as any)?.filename || '';
      const ln = (e as any)?.lineno || 0;
      send('client_error', { msg, src, ln });
    });
    
    window.addEventListener('unhandledrejection', (e: any) => {
      // Ignore analytics errors
      const reason = e?.reason?.message || String(e?.reason || 'unknown');
      if (reason.includes('Failed to fetch') || reason.includes('analytics')) {
        return;
      }
      send('client_unhandled_rejection', { reason });
    });
  } catch {}
} else if ((import.meta as any).env?.PROD === true && !ANALYTICS_API_BASE) {
  console.log('[Analytics] Disabled - VITE_API_BASE not configured');
}

// Detect device type and load appropriate UI
const isMobile = isMobileDevice();

// Log which version is loading
console.log(`🎮 Loading ${isMobile ? 'MOBILE' : 'PC'} optimized UI`);

// Dynamically import the appropriate App component and styles
const loadApp = async () => {
  const rootEl = document.getElementById('root');
  if (!rootEl) return;

  const root = createRoot(rootEl);
  
  if (isMobile) {
    // Load mobile-specific styles and component
    await import('./mobile-game-fixes.css');
    await import('./styles-mobile.css');
    await import('./mobile-controls.css');
    const { default: AppMobile } = await import('./AppMobile');
    console.log('📱 Mobile app loaded');
    root.render(<AppMobile />);
  } else {
    // Load PC-specific styles and component
    await import('./styles-pc.css');
    const { default: AppPC } = await import('./AppPC');
    console.log('🖥️ PC app loaded');
    root.render(<AppPC />);
  }
};

loadApp();

