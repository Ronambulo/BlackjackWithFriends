import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
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
      },
      includeAssets: ['favicon.ico', 'apple-touch-icon-180x180.png', 'icon.svg'],
      manifest: {
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
          { src: 'pwa-64x64.png', sizes: '64x64', type: 'image/png' },
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
          {
            src: 'maskable-icon-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
    }),
  ],
})
