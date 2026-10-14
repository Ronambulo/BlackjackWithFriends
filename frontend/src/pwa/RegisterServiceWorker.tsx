'use client'

import { useEffect } from 'react'

const BUILD_ID = process.env.NEXT_PUBLIC_BUILD_ID
const CHECK_EVERY_MS = 5 * 60 * 1000
const RELOAD_GUARD_KEY = 'reloaded-for-build'

/**
 * Registers /sw.js and reloads the app when a new deploy is live, so the
 * installed PWA never gets stuck on an old version. Production only: in dev the
 * build id never changes and a service worker just gets in the way.
 */
export function RegisterServiceWorker() {
  useEffect(() => {
    if (process.env.NODE_ENV !== 'production') return

    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(() => {
        // Not fatal: the app works without it, it just isn't installable.
      })
    }

    let checking = false
    const checkForUpdate = async () => {
      if (checking || document.visibilityState !== 'visible') return
      checking = true
      try {
        const response = await fetch('/version', { cache: 'no-store' })
        if (!response.ok) return
        const { buildId } = (await response.json()) as { buildId: string }
        if (!buildId || buildId === BUILD_ID) return
        // Only reload once per new build, in case the CDN serves a stale page.
        if (sessionStorage.getItem(RELOAD_GUARD_KEY) === buildId) return
        sessionStorage.setItem(RELOAD_GUARD_KEY, buildId)
        window.location.reload()
      } catch {
        // Offline: try again later.
      } finally {
        checking = false
      }
    }

    void checkForUpdate()
    const interval = window.setInterval(checkForUpdate, CHECK_EVERY_MS)
    document.addEventListener('visibilitychange', checkForUpdate)
    window.addEventListener('focus', checkForUpdate)
    return () => {
      window.clearInterval(interval)
      document.removeEventListener('visibilitychange', checkForUpdate)
      window.removeEventListener('focus', checkForUpdate)
    }
  }, [])

  return null
}
