import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

/**
 * Build architecture notes
 * ------------------------
 * - manualChunks keeps heavy, rarely-changing vendors (React, Framer Motion,
 *   epub.js + JSZip) in separate long-lived cacheable chunks. epub.js is only
 *   pulled in by the lazily loaded Reader route, so the library screen never
 *   pays for it.
 * - The service worker precaches the app shell and the bundled sample book.
 *   User books live in IndexedDB, so they are always available offline.
 * - registerType "prompt": we never reload under the reader's feet. The app
 *   shows a toast and lets the user apply the update.
 */
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'prompt',
      includeAssets: ['icon.svg', 'apple-touch-icon.png', 'sample.epub'],
      manifest: {
        name: 'Folio — EPUB Reader',
        short_name: 'Folio',
        description: 'A calm, offline-first EPUB reader with highlights and notes.',
        theme_color: '#ffffff',
        background_color: '#ffffff',
        display: 'standalone',
        orientation: 'any',
        start_url: '/',
        scope: '/',
        categories: ['books', 'lifestyle'],
        icons: [
          { src: 'pwa-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'pwa-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
          { src: 'icon.svg', sizes: 'any', type: 'image/svg+xml' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,epub,woff2}'],
        navigateFallback: '/index.html',
        cleanupOutdatedCaches: true,
      },
    }),
  ],
  build: {
    target: 'es2020',
    sourcemap: true,
    chunkSizeWarningLimit: 600,
    rollupOptions: {
      output: {
        manualChunks: {
          react: ['react', 'react-dom'],
          motion: ['framer-motion'],
          epub: ['epubjs', 'jszip'],
        },
      },
    },
  },
});
