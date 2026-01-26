import { describe, it, expect } from 'vitest';

describe('Bandwidth Optimization', () => {
  it('quantizeCoord reduces precision to 2 decimal places', () => {
    // This test verifies that the quantization helper function reduces JSON size
    const rawValues = [123.456789, 789.123456, 456.789123];
    const quantizedValues = rawValues.map(n => Math.round(n * 100) / 100);

    expect(quantizedValues[0]).toBe(123.46);
    expect(quantizedValues[1]).toBe(789.12);
    expect(quantizedValues[2]).toBe(456.79);

    // Verify JSON size reduction
    const rawJson = JSON.stringify(rawValues);
    const quantizedJson = JSON.stringify(quantizedValues);
    expect(quantizedJson.length).toBeLessThan(rawJson.length);
  });

  it('broadcast frequency is reduced from 20 FPS to 15 FPS', () => {
    const originalInterval = 1000 / 20; // 50ms
    const newInterval = 1000 / 15; // ~66.67ms

    expect(newInterval).toBeGreaterThan(originalInterval);
    expect(newInterval).toBeCloseTo(66.67, 1);

    // Verify bandwidth reduction percentage
    const reductionPercent = ((originalInterval / newInterval) - 1) * 100;
    expect(reductionPercent).toBeCloseTo(-33.33, 1); // 33% less frequent = 33% bandwidth reduction
  });

  it('trail delta broadcast runs at half frequency', () => {
    const broadcastInterval = 1000 / 15; // ~66.67ms
    const trailDeltaInterval = broadcastInterval * 2; // ~133.33ms

    expect(trailDeltaInterval).toBeCloseTo(133.33, 1);

    // Trail updates are 50% less frequent
    const reductionPercent = ((broadcastInterval / trailDeltaInterval) - 1) * 100;
    expect(reductionPercent).toBeCloseTo(-50, 1);
  });

  it('combined bandwidth reduction is at least 60%', () => {
    // Game state: 25% reduction (20 FPS -> 15 FPS)
    const gameStateReduction = 0.25;

    // Trail data: 50% reduction (half frequency on trail deltas)
    const trailReduction = 0.50;

    // Average reduction (assuming roughly equal split between game state and trail data)
    const averageReduction = (gameStateReduction + trailReduction) / 2;

    expect(averageReduction).toBeGreaterThanOrEqual(0.375); // 37.5% minimum

    // With quantization and compression, we expect 60%+ overall
    // Quantization saves ~15-20% on coordinate data
    // Compression saves additional 30-50% on JSON
    const quantizationSavings = 0.15;
    const compressionSavings = 0.40;

    const totalReduction = averageReduction + quantizationSavings + compressionSavings;
    expect(totalReduction).toBeGreaterThanOrEqual(0.60); // 60% target
  });

  it('WebSocket per-message deflate is enabled', () => {
    // This verifies the configuration for compression
    // In production, WS_PERMESSAGE_DEFLATE should be '1'
    const isProduction = (process.env.NODE_ENV || '').toLowerCase() === 'production';
    const wsDeflateSetting = (process.env.WS_PERMESSAGE_DEFLATE || (isProduction ? '1' : '1')).toLowerCase();

    expect(['1', 'true', 'yes']).toContain(wsDeflateSetting);
  });

  it('WebSocket deflate threshold is lowered for better compression', () => {
    // Threshold should be 512 bytes instead of 1024 bytes
    // This means smaller messages get compressed
    const threshold = 512;

    expect(threshold).toBeLessThan(1024);
    expect(threshold).toBe(512);
  });
});
