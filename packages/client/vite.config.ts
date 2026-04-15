import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const SERVER_PORT = process.env.SERVER_PORT || process.env.PORT || '8085';

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
    },
  },
  server: {
    port: 5174,            // align with package.json scripts
    strictPort: true,
    host: true,
    proxy: {
      '/api': {
        target: `http://localhost:${SERVER_PORT}`,
        changeOrigin: false,
        secure: false,
      },
      '/ws': {
        target: `ws://localhost:${SERVER_PORT}`,
        ws: true,
        changeOrigin: false,
        secure: false,
      },
    }
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    // Keep builds memory-friendly (CI + local). Source maps can be enabled via tooling if needed.
    sourcemap: false,
    minify: 'esbuild',
    rollupOptions: {
      output: {
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
