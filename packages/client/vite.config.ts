import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Vite config for the canvas-test client.
 * Optimized for performance and production builds.
 */
export default defineConfig({
  plugins: [react()],
  root: '.',               // default, but explicit for clarity
  resolve: {
    alias: {
      buffer: 'buffer/',
      shared: path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../shared/src'),
    },
  },
  server: {
    port: 5174,            // align with package.json scripts
    strictPort: true,
    host: true,
    proxy: {
      '/api': {
        target: 'http://localhost:8080',
        changeOrigin: false,
        secure: false,
      },
      '/ws': {
        target: 'ws://localhost:8080',
        ws: true,
        changeOrigin: false,
        secure: false,
      },
    }
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    sourcemap: true,
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: false,
        pure_funcs: [ 'console.debug', 'console.info' ],
      },
    },
    rollupOptions: {
      output: {
        manualChunks: undefined, // Bundle everything together for this small game
        assetFileNames: 'assets/[name].[hash][extname]',
        chunkFileNames: 'js/[name].[hash].js',
        entryFileNames: 'js/[name].[hash].js',
      },
    },
    target: 'es2020', // Target modern browsers for better performance
    assetsInlineLimit: 4096, // Inline small assets
  },
  optimizeDeps: {
    include: ['buffer'], // Ensure Buffer polyfill is bundled
  },
  esbuild: {
    target: 'es2020',
    legalComments: 'none',
  },
});
