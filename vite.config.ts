import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  publicDir: 'public',
  optimizeDeps: {
    exclude: ['web-tree-sitter', '@mlc-ai/web-llm'],
  },
  build: {
    target: 'esnext',
    minify: false,
    rollupOptions: {
      output: {
        format: 'es',
        manualChunks(id) {
          // Separate vendor code
          if (id.includes('node_modules')) {
            return 'vendor';
          }
        },
      },
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
  base: './',
  server: {
    fs: {
      allow: ['.'],
    },
  },
});