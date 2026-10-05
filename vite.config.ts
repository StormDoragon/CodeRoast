import { defineConfig, loadEnv, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

// Social crawlers need absolute URLs for og:image.
function siteUrl(url: string): Plugin {
  return {
    name: 'coderoast-site-url',
    transformIndexHtml: (html) => html.replace(/__SITE_URL__/g, url.replace(/\/$/, '')),
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), 'VITE_');
  return {
    plugins: [react(), siteUrl(env.VITE_SITE_URL || '.')],
    // Relative base works on any host or sub-path (GitHub Pages, Vercel, Netlify).
    base: './',
    optimizeDeps: {
      exclude: ['@mlc-ai/web-llm'],
    },
    worker: {
      format: 'es',
    },
    build: {
      target: 'es2022',
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, 'src'),
      },
    },
  };
});
