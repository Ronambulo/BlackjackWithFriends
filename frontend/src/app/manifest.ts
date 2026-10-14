import type { MetadataRoute } from 'next'

// Only opaque PNGs: iOS and some Android launchers draw transparent areas black.
// The ?v= query busts the home-screen icon caches when the artwork changes.
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: '/',
    name: 'Blackjack with Friends',
    short_name: 'Blackjack',
    description: 'Tu liga semanal de blackjack con amigos.',
    lang: 'es',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#0a0c0f',
    theme_color: '#0a0c0f',
    icons: [
      { src: '/apple-touch-icon-180x180.png?v=4', sizes: '180x180', type: 'image/png' },
      { src: '/pwa-192x192.png?v=4', sizes: '192x192', type: 'image/png' },
      { src: '/pwa-512x512.png?v=4', sizes: '512x512', type: 'image/png' },
      { src: '/maskable-icon-512x512.png?v=4', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  }
}
