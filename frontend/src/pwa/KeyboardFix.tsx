'use client'

import { useEffect } from 'react'

const TYPING = 'input, textarea, select, [contenteditable="true"]'

/**
 * iOS scrolls the whole page up to show the keyboard and doesn't always scroll
 * it back when the keyboard closes, leaving the app shifted up with the top bar
 * out of reach. Once nothing is being typed into, put the page back where it was.
 */
export function KeyboardFix() {
  useEffect(() => {
    let timer: number | undefined
    const reset = () => {
      window.clearTimeout(timer)
      // Wait for focus to land: moving between two fields also fires focusout.
      timer = window.setTimeout(() => {
        if (document.activeElement?.matches(TYPING)) return
        // Only screens that fit: the login and onboarding pages may really be scrolled.
        const fits = document.documentElement.scrollHeight <= window.innerHeight + 1
        if (fits && window.scrollY !== 0) window.scrollTo(0, 0)
      }, 100)
    }

    document.addEventListener('focusout', reset)
    window.visualViewport?.addEventListener('resize', reset)
    return () => {
      window.clearTimeout(timer)
      document.removeEventListener('focusout', reset)
      window.visualViewport?.removeEventListener('resize', reset)
    }
  }, [])

  return null
}
