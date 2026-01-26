import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['test/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts}', 'src/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts}'],
    testTimeout: 10000,
    hookTimeout: 10000,
    teardownTimeout: 5000,
    setupFiles: [],
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      'shared': path.resolve(__dirname, '../shared'),
    },
  },
  optimizeDeps: {
    disabled: true,
  },
});
