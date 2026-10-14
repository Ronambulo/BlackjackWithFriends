import { useCallback, useEffect, useState } from 'react'

// Chrome/Edge/Samsung Internet fire this event when the app is installable.
// It is not part of the standard TS DOM types.
interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

export type Platform = 'ios' | 'android' | 'other'

const DISMISS_KEY = 'install-banner-dismissed-at'
const DISMISS_DAYS = 7

function detectPlatform(): Platform {
  const ua = navigator.userAgent
  // iPadOS reports itself as a Mac, so check for touch support too.
  const isIos =
    /iPhone|iPad|iPod/.test(ua) || (ua.includes('Macintosh') && navigator.maxTouchPoints > 1)
  if (isIos) return 'ios'
  if (/Android/.test(ua)) return 'android'
  return 'other'
}

function isStandalone(): boolean {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  )
}

function wasRecentlyDismissed(): boolean {
  try {
    const at = Number(localStorage.getItem(DISMISS_KEY))
    return at > 0 && Date.now() - at < DISMISS_DAYS * 24 * 60 * 60 * 1000
  } catch {
    return false
  }
}

export function useInstallPrompt() {
  const [platform] = useState(detectPlatform)
  const [installed, setInstalled] = useState(isStandalone)
  const [dismissed, setDismissed] = useState(wasRecentlyDismissed)
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null)

  useEffect(() => {
    const onPrompt = (e: Event) => {
      e.preventDefault() // keep the browser's mini-infobar from showing; we use our own button
      setDeferred(e as BeforeInstallPromptEvent)
    }
    const onInstalled = () => {
      setInstalled(true)
      setDeferred(null)
    }
    window.addEventListener('beforeinstallprompt', onPrompt)
    window.addEventListener('appinstalled', onInstalled)
    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt)
      window.removeEventListener('appinstalled', onInstalled)
    }
  }, [])

  const install = useCallback(async () => {
    if (!deferred) return
    await deferred.prompt()
    const { outcome } = await deferred.userChoice
    // The event can only be used once.
    setDeferred(null)
    if (outcome === 'accepted') setInstalled(true)
  }, [deferred])

  const dismiss = useCallback(() => {
    try {
      localStorage.setItem(DISMISS_KEY, String(Date.now()))
    } catch {
      // Storage unavailable (private mode): just hide for this session.
    }
    setDismissed(true)
  }, [])

  return {
    platform,
    installed,
    dismissed,
    canPromptInstall: deferred !== null,
    install,
    dismiss,
  }
}
