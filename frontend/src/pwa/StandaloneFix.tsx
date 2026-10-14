'use client'

import { useEffect } from 'react'

function isIosStandalone() {
  const standalone =
    window.matchMedia('(display-mode: standalone)').matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  // iPadOS reports itself as a Mac, but with touch.
  const ios = /iPhone|iPad|iPod/.test(navigator.userAgent) || (/Macintosh/.test(navigator.userAgent) && navigator.maxTouchPoints > 1)
  return standalone && ios
}

/**
 * Two iOS home screen app quirks:
 *
 * - On launch WebKit sometimes lays the app out with a viewport that's too short,
 *   so the tab bar floats above the bottom until the first scroll. The installed
 *   app always fills the whole screen, so --app-height pins it to the screen size.
 *
 * - iOS 27 blurs the top of the app over the top bar. Sliding a fixed, almost
 *   transparent panel in and back out (and keeping it, off screen) switches the
 *   status bar area to a solid background. Not documented by Apple: see
 *   https://tips.ojapp.app/en/ios-27-pwa-top-blur-workaround-2/
 */
export function StandaloneFix() {
  useEffect(() => {
    if (!isIosStandalone()) return
    const root = document.documentElement

    const measure = () => {
      // screen.* doesn't rotate on iOS; the app is portrait-only anyway (manifest.ts).
      const portrait = window.matchMedia('(orientation: portrait)').matches
      const screenHeight = portrait ? screen.height : screen.width
      root.style.setProperty('--app-height', `${Math.max(screenHeight, window.innerHeight)}px`)
      if (window.scrollY !== 0) window.scrollTo(0, 0)
    }
    measure()
    // WebKit settles the viewport a moment after launch and after coming back.
    const timers = [100, 500, 1500].map((ms) => window.setTimeout(measure, ms))
    window.addEventListener('pageshow', measure)
    window.addEventListener('orientationchange', measure)

    const cover = document.createElement('div')
    const panel = document.createElement('div')
    cover.setAttribute('aria-hidden', 'true')
    panel.setAttribute('aria-hidden', 'true')
    Object.assign(cover.style, {
      display: 'none',
      position: 'fixed',
      inset: '0',
      zIndex: '2147483646',
      background: 'rgb(255 255 255 / 0.01)',
      pointerEvents: 'none',
    })
    Object.assign(panel.style, {
      position: 'fixed',
      top: '0',
      right: '0',
      bottom: '0',
      width: '90%',
      zIndex: '2147483647',
      background: 'rgb(255 255 255 / 0.01)',
      pointerEvents: 'none',
      transform: 'translateX(110%)',
      transition: 'transform 0.3s',
    })
    document.body.append(cover, panel)
    void panel.offsetWidth
    let slideBack: number | undefined
    const frame = requestAnimationFrame(() => {
      cover.style.display = 'block'
      panel.style.transform = 'translateX(0%)'
      slideBack = window.setTimeout(() => {
        cover.style.display = 'none'
        // Back off screen but still in the page: removing it brings the blur back.
        panel.style.transform = 'translateX(110%)'
      }, 500)
    })

    return () => {
      timers.forEach((timer) => window.clearTimeout(timer))
      window.clearTimeout(slideBack)
      cancelAnimationFrame(frame)
      window.removeEventListener('pageshow', measure)
      window.removeEventListener('orientationchange', measure)
      cover.remove()
      panel.remove()
    }
  }, [])

  return null
}
