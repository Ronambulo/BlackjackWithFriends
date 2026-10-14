'use client'

import { useEffect } from 'react'

/**
 * iOS Safari ignores `user-scalable=no` and `maximum-scale` (since iOS 10), and
 * standalone PWAs still pinch-zoom. Cancelling WebKit's gesture events and
 * multi-touch moves is the only reliable way to keep the layout at 1x.
 */
export function NoZoom() {
  useEffect(() => {
    const prevent = (event: Event) => event.preventDefault()
    const preventPinch = (event: TouchEvent) => {
      if (event.touches.length > 1) event.preventDefault()
    }
    const options = { passive: false } as const

    document.addEventListener('gesturestart', prevent, options)
    document.addEventListener('gesturechange', prevent, options)
    document.addEventListener('gestureend', prevent, options)
    document.addEventListener('touchmove', preventPinch, options)
    return () => {
      document.removeEventListener('gesturestart', prevent)
      document.removeEventListener('gesturechange', prevent)
      document.removeEventListener('gestureend', prevent)
      document.removeEventListener('touchmove', preventPinch)
    }
  }, [])

  return null
}
