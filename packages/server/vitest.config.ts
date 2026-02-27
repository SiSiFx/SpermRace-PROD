import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['test/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}', 'src/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts}'],
    setupFiles: ['test/setup.ts'],
    testTimeout: 40000,
    hookTimeout: 10000,
    teardownTimeout: 5000,
    isolate: true,
    pool: 'forks',
    singleFork: true,
    maxForks: 1,
    minForks: 1,
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      'shared/dist': path.resolve(__dirname, '../shared/src'),
      'shared': path.resolve(__dirname, '../shared/src'),
    }
  }
});
