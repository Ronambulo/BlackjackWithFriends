'use client'

import { useEffect } from 'react'

const BUILD_ID = process.env.NEXT_PUBLIC_BUILD_ID
const CHECK_EVERY_MS = 5 * 60 * 1000
const RELOAD_GUARD_KEY = 'reloaded-for-build'
/** If a reload still came back with the old build (a stale cache), try again after this long. */
const RETRY_AFTER_MS = 60 * 1000
const VERSION_PARAM = '_v'

/**
 * Registers /sw.js and reloads the app when a new deploy is live, so the
 * installed PWA never gets stuck on an old version. Production only: in dev the
 * build id never changes and a service worker just gets in the way.
 */
export function RegisterServiceWorker() {
  useEffect(() => {
    if (process.env.NODE_ENV !== 'production') return

    // Drop the cache-busting parameter a reload for a new build added.
    const url = new URL(window.location.href)
    if (url.searchParams.has(VERSION_PARAM)) {
      url.searchParams.delete(VERSION_PARAM)
      window.history.replaceState(window.history.state, '', url)
    }

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
        // Don't loop if a cache keeps serving the old page, but don't give up on the
        // build either: an iOS home-screen app keeps its session for days.
        const [lastBuild, lastAt] = (sessionStorage.getItem(RELOAD_GUARD_KEY) ?? '').split('@')
        if (lastBuild === buildId && Date.now() - Number(lastAt) < RETRY_AFTER_MS) return
        sessionStorage.setItem(RELOAD_GUARD_KEY, `${buildId}@${Date.now()}`)
        // A new URL, so iOS can't answer the reload from its own cache.
        const next = new URL(window.location.href)
        next.searchParams.set(VERSION_PARAM, buildId)
        window.location.replace(next)
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
    // iOS reopens a home-screen app from its back/forward cache without a visibilitychange.
    window.addEventListener('pageshow', checkForUpdate)
    return () => {
      window.clearInterval(interval)
      document.removeEventListener('visibilitychange', checkForUpdate)
      window.removeEventListener('focus', checkForUpdate)
      window.removeEventListener('pageshow', checkForUpdate)
    }
  }, [])

  return null
}
