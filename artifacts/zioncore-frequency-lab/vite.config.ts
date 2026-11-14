import path from 'path';
import { gzipSync } from 'node:zlib';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig, type Plugin } from 'vite';

import runtimeErrorOverlay from '@replit/vite-plugin-runtime-error-modal';
import {
  assertNoStartupGenesis,
  assertStartupBudget,
  collectStartupChunks,
} from './src/lib/startup-bundle';

const rawPort = process.env.PORT;

if (!rawPort) {
  throw new Error(
    'PORT environment variable is required but was not provided.',
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

const basePath = process.env.BASE_PATH;

if (!basePath) {
  throw new Error(
    'BASE_PATH environment variable is required but was not provided.',
  );
}

const seoLandingSlugs = new Set([
  'audio-spectrum-analyzer',
  'online-tone-generator',
  'sound-message-encoder',
  'spiritual-frequency-exploration',
  'plant-bioacoustics',
  'frequency-signal-guide',
]);

function seoLandingPageRoutes(): Plugin {
  const basePrefix = basePath.replace(/\/+$/, '');
  return {
    name: 'zioncore-seo-landing-page-routes',
    configureServer(server) {
      server.middlewares.use((request, _response, next) => {
        if (!request.url) return next();
        const queryIndex = request.url.indexOf('?');
        const pathname = queryIndex < 0 ? request.url : request.url.slice(0, queryIndex);
        const query = queryIndex < 0 ? '' : request.url.slice(queryIndex);
        const routePath = basePrefix && pathname.startsWith(`${basePrefix}/`)
          ? pathname.slice(basePrefix.length)
          : pathname;
        const slug = routePath.replace(/^\/+|\/+$/g, '');
        if (seoLandingSlugs.has(slug)) {
          request.url = `/${slug}/index.html${query}`;
        }
        next();
      });
    },
  };
}

export default defineConfig({
  base: basePath,
  plugins: [
    {
      name: 'zioncore-startup-budget',
      apply: 'build',
      generateBundle(_options, bundle) {
        const chunks = collectStartupChunks(bundle);
        assertNoStartupGenesis(chunks);
        const bytes = chunks.reduce((total, chunk) => total + Buffer.byteLength(chunk.code), 0);
        const gzipBytes = chunks.reduce((total, chunk) => total + gzipSync(chunk.code).length, 0);
        assertStartupBudget(gzipBytes);
        this.info(`Initial JavaScript: ${bytes} bytes; ${gzipBytes} gzip bytes across ${chunks.length} static chunk(s).`);
      },
    },
    seoLandingPageRoutes(),
    react(),
    tailwindcss(),
    runtimeErrorOverlay(),
    ...(process.env.NODE_ENV !== 'production' &&
    process.env.REPL_ID !== undefined
      ? [
          await import('@replit/vite-plugin-cartographer').then((m) =>
            m.cartographer({
              root: path.resolve(import.meta.dirname, '..'),
            }),
          ),
          await import('@replit/vite-plugin-dev-banner').then((m) =>
            m.devBanner(),
          ),
        ]
      : []),
  ],
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, 'src'),
      '@assets': path.resolve(
        import.meta.dirname,
        '..',
        '..',
        'attached_assets',
      ),
    },
    dedupe: ['react', 'react-dom'],
  },
  root: path.resolve(import.meta.dirname),
  build: {
    outDir: path.resolve(import.meta.dirname, 'dist/public'),
    emptyOutDir: true,
  },
  server: {
    port,
    strictPort: true,
    host: '0.0.0.0',
    allowedHosts: true,
    fs: {
      strict: true,
    },
  },
  preview: {
    port,
    host: '0.0.0.0',
    allowedHosts: true,
  },
});
