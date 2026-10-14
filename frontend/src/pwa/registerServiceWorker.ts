import { registerSW } from 'virtual:pwa-register'

const CHECK_INTERVAL_MS = 30 * 60 * 1000
const MIN_GAP_MS = 60 * 1000

// With registerType 'autoUpdate', once a new service worker is found it
// activates straight away and the page reloads itself with the new version.
// The browser only looks for a new service worker on navigation, though, and an
// app opened from the home screen is usually just resumed from the background
// (especially on iOS), so we also check when it comes back to the foreground
// and periodically while it stays open.
export function registerServiceWorker() {
  registerSW({
    immediate: true,
    onRegisteredSW(swUrl, registration) {
      if (!registration) return

      let lastCheck = Date.now()

      const checkForUpdate = async () => {
        if (!navigator.onLine || registration.installing) return
        if (Date.now() - lastCheck < MIN_GAP_MS) return
        lastCheck = Date.now()

        try {
          // Skip the update if the server is unreachable, so an offline
          // install doesn't throw and keeps working from cache.
          const res = await fetch(swUrl, { cache: 'no-store', headers: { 'cache-control': 'no-cache' } })
          if (res.ok) await registration.update()
        } catch {
          // Offline or flaky network: try again next time.
        }
      }

      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') checkForUpdate()
      })
      window.addEventListener('focus', checkForUpdate)
      setInterval(checkForUpdate, CHECK_INTERVAL_MS)
    },
  })
}
