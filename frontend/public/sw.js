// Minimal service worker: makes the app installable, keeps the icons
// offline and shows push notifications. Pages and /api always go to the network
// so a deploy shows up on the next open (the client also reloads itself when /version changes).
const CACHE_NAME = 'bwf-shell-v6'
const APP_SHELL = [
  '/manifest.webmanifest',
  '/icon.svg?v=4',
  '/favicon.ico?v=4',
  '/pwa-192x192.png?v=4',
  '/pwa-512x512.png?v=4',
  '/maskable-icon-512x512.png?v=4',
  '/apple-touch-icon-180x180.png?v=4',
]

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting()),
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  )
})

self.addEventListener('fetch', (event) => {
  const { request } = event
  if (request.method !== 'GET') return

  const url = new URL(request.url)
  if (url.origin !== self.location.origin) return
  if (!APP_SHELL.includes(url.pathname + url.search)) return

  event.respondWith(caches.match(request).then((cached) => cached ?? fetch(request)))
})

// A notification from the backend (lib/push.ts): { title, body, url, tag, quiet }.
self.addEventListener('push', (event) => {
  let data = {}
  try {
    data = event.data ? event.data.json() : {}
  } catch {
    data = { body: event.data ? event.data.text() : '' }
  }
  const show = () =>
    self.registration.showNotification(data.title || 'Blackjack with Friends', {
      body: data.body || '',
      tag: data.tag,
      // A newer one replacing another (same chat) still buzzes.
      renotify: !!data.tag,
      icon: '/pwa-192x192.png?v=4',
      badge: '/pwa-64x64.png',
      data: { url: data.url || '/' },
    })
  event.waitUntil(
    // Chat ones aren't needed while the app is open in front: the chat updates live.
    data.quiet
      ? self.clients
          .matchAll({ type: 'window', includeUncontrolled: true })
          .then((windows) => (windows.some((client) => client.visibilityState === 'visible' && client.focused) ? undefined : show()))
      : show(),
  )
})

// Tapping it brings the app to the front on that page, opening it if it isn't.
self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const url = new URL(event.notification.data?.url || '/', self.location.origin).href
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windows) => {
      const open = windows.find((client) => new URL(client.url).origin === self.location.origin)
      if (!open) return self.clients.openWindow(url)
      return open.focus().then((client) => (client.url === url ? client : client.navigate(url)))
    }),
  )
})
