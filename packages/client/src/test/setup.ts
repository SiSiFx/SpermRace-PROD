import { expect, afterEach, vi } from 'vitest';
import { cleanup } from '@testing-library/react';
import * as matchers from '@testing-library/jest-dom/matchers';

expect.extend(matchers);

// Avoid unhandled async timer side-effects from real wallet adapters during unit tests.
// Some adapters schedule background detection timers that can outlive the jsdom environment teardown.
vi.mock('../WalletProviderNew', async () => {
  const React = await import('react');
  const adapterReact = await import('@solana/wallet-adapter-react');
  const adapterUi = await import('@solana/wallet-adapter-react-ui');

  const WalletProviderNew = ({ children }: { children: React.ReactNode }) =>
    React.createElement(
      adapterReact.ConnectionProvider,
      { endpoint: 'https://api.devnet.solana.com' } as any,
      React.createElement(
        adapterReact.WalletProvider,
        { wallets: [], autoConnect: false } as any,
        React.createElement(adapterUi.WalletModalProvider, null, children)
      )
    );

  return { __esModule: true, default: WalletProviderNew, WalletProviderNew };
});

afterEach(() => {
  cleanup();
});

// Mock window.matchMedia for responsive/mobile tests
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

// Mock touch events for mobile testing
Object.defineProperty(window, 'ontouchstart', {
  writable: true,
  value: () => {},
});

// Mock mobile user agent
Object.defineProperty(navigator, 'userAgent', {
  writable: true,
  configurable: true,
  value: 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15',
});

// Mock viewport for mobile dimensions
Object.defineProperty(window, 'innerWidth', {
  writable: true,
  configurable: true,
  value: 390,
});

Object.defineProperty(window, 'innerHeight', {
  writable: true,
  configurable: true,
  value: 844,
});

// Minimal font + CSS setup for jsdom so style assertions are meaningful.
// Production CSS is loaded by Vite, but unit tests run without HTML entrypoints.
if (!document.querySelector('link[rel="stylesheet"][data-test-fonts="1"]')) {
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.setAttribute('data-test-fonts', '1');
  link.href =
    'https://fonts.googleapis.com/css2?family=Orbitron:wght@500;600;700;800;900&family=Inter:wght@400;500;600;700&display=swap';
  document.head.appendChild(link);
}

if (!document.getElementById('test-font-styles')) {
  const style = document.createElement('style');
  style.id = 'test-font-styles';
  style.textContent = `
    body {
      font-family: Inter, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      font-weight: 400;
    }
    h1, h2, h3,
    .brand-title,
    .modal-title,
    .lobby-title,
    .tournament-title,
    .mode-title {
      font-family: Orbitron, sans-serif;
      font-weight: 800;
    }
    p, button,
    .feature-chip,
    .footer-link,
    .mode-description,
    .stat-label,
    .detail-label,
    .rules-list {
      font-family: Inter, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    }
  `;
  document.head.appendChild(style);
}
