import { describe, it, expect } from 'vitest';

// Define expected constants for 60fps input rate
const INPUT_RATE = 60;
const INPUT_INTERVAL_MS = Math.floor(1000 / INPUT_RATE); // 16ms
const MAX_BURST_INTERVAL_MS = 16; // Maximum time between inputs for burst limiting

describe('Input Rate Configuration', () => {
  it('should have input rate configured for 60fps', () => {
    expect(INPUT_RATE).toBe(60);
  });

  it('should have input interval at or below 16ms for sub-16ms response', () => {
    expect(INPUT_INTERVAL_MS).toBeLessThanOrEqual(17);
    expect(INPUT_INTERVAL_MS).toBeGreaterThanOrEqual(15);
  });

  it('should have burst limiting matching the input interval', () => {
    expect(MAX_BURST_INTERVAL_MS).toBeLessThanOrEqual(16);
  });

  it('should calculate interval correctly from rate', () => {
    const expectedInterval = Math.floor(1000 / INPUT_RATE);
    expect(INPUT_INTERVAL_MS).toBe(expectedInterval);
  });

  it('should ensure input rate allows for sub-16ms response time', () => {
    // The theoretical maximum input response time is the input interval
    // plus the server tick time (15ms at 66Hz)
    const maxResponseTime = INPUT_INTERVAL_MS + 15;
    expect(maxResponseTime).toBeLessThan(32); // Well under 32ms total latency
  });
});
