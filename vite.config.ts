import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

// Hosted at https://peterskopal.github.io/lapse/
export default defineConfig({
  base: '/lapse/',
  server: { port: 5173, strictPort: true },
  plugins: [
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'apple-touch-icon-180.png'],
      manifest: {
        name: 'Lapse — Interval Trainer',
        short_name: 'Lapse',
        description: 'A focused interval timer for laps, exercises and breaks.',
        theme_color: '#0b0d12',
        background_color: '#0b0d12',
        display: 'standalone',
        orientation: 'portrait',
        start_url: '.',
        scope: '.',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
          {
            src: 'icon-512-maskable.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,ico,woff2}'],
      },
    }),
  ],
});
