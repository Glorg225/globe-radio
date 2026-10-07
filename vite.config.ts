import { VitePWA } from 'vite-plugin-pwa';
import { defineConfig } from 'vitest/config';
import { buildManifest } from './src/pwa/manifest';
import { SW_GLOB_IGNORES, SW_NAVIGATE_DENYLIST } from './src/pwa/sw-config';

const base = process.env.BASE_PATH ?? '/';

export default defineConfig({
  base,
  plugins: [
    VitePWA({
      registerType: 'prompt',
      injectRegister: false,
      manifest: buildManifest(base),
      includeAssets: ['icons/apple-touch-icon.png'],
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,jpg,woff2}'],
        globIgnores: SW_GLOB_IGNORES,
        maximumFileSizeToCacheInBytes: 4 * 1024 * 1024,
        navigateFallback: 'index.html',
        navigateFallbackDenylist: SW_NAVIGATE_DENYLIST,
        runtimeCaching: [
          {
            urlPattern: ({ url, sameOrigin }) => sameOrigin && url.pathname.includes('/data/'),
            handler: 'NetworkFirst',
            options: { cacheName: 'station-data', networkTimeoutSeconds: 6, expiration: { maxEntries: 300 } },
          },
          {
            urlPattern: /^https:\/\/fonts\.(googleapis|gstatic)\.com\//,
            handler: 'StaleWhileRevalidate',
            options: { cacheName: 'fonts', expiration: { maxEntries: 20 } },
          },
        ],
      },
    }),
  ],
  test: { environment: 'jsdom' },
});
