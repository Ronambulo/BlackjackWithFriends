import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  // In development /api goes to the local backend (npm run dev at the repo root).
  // In production frontend/vercel.json rewrites /api to the backend project.
  const apiOrigin = loadEnv(mode, process.cwd(), '').API_ORIGIN || 'http://localhost:3001'

  return {
    server: {
      proxy: { '/api': { target: apiOrigin, changeOrigin: true } },
    },
    preview: {
      proxy: { '/api': { target: apiOrigin, changeOrigin: true } },
    },
    plugins: [
      react(),
      VitePWA({
        registerType: 'autoUpdate',
        // Registered from src/pwa/registerServiceWorker.ts so we can check for updates.
        injectRegister: false,
        workbox: {
          cleanupOutdatedCaches: true,
          // The plugin only sets these itself when it injects the registration,
          // so with injectRegister: false they must be explicit for autoUpdate.
          skipWaiting: true,
          clientsClaim: true,
          // Let the API (and the invite previews it serves) reach the network
          // instead of being answered with the cached app shell.
          navigateFallbackDenylist: [/^\/api\//, /^\/i\//],
        },
        includeAssets: [
          'favicon.ico',
          'icon.svg',
          'apple-touch-icon-180x180.png',
          // iOS also requests these default paths, whatever the <link> says.
          'apple-touch-icon.png',
          'apple-touch-icon-precomposed.png',
        ],
        manifest: {
          id: '/',
          name: 'Blackjack with Friends',
          short_name: 'Blackjack',
          description: 'Juega al blackjack con tus amigos',
          lang: 'es',
          start_url: '/',
          scope: '/',
          display: 'standalone',
          orientation: 'portrait',
          background_color: '#0b6b3a',
          theme_color: '#0b6b3a',
          icons: [
            { src: 'pwa-64x64.png?v=3', sizes: '64x64', type: 'image/png', purpose: 'any' },
            { src: 'pwa-192x192.png?v=3', sizes: '192x192', type: 'image/png', purpose: 'any' },
            { src: 'pwa-512x512.png?v=3', sizes: '512x512', type: 'image/png', purpose: 'any' },
            {
              src: 'maskable-icon-512x512.png?v=3',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'maskable',
            },
          ],
        },
      }),
    ],
  }
})
