import { expect, afterEach, vi } from 'vitest';
import { cleanup } from '@testing-library/react';
import * as matchers from '@testing-library/jest-dom/matchers';

expect.extend(matchers);

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
  value: 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15',
});

// Mock viewport for mobile dimensions
Object.defineProperty(window, 'innerWidth', {
  writable: true,
  value: 390,
});

Object.defineProperty(window, 'innerHeight', {
  writable: true,
  value: 844,
});
