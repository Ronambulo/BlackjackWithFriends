'use client'

import { useQueryClient } from '@tanstack/react-query'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import styles from './PullToRefresh.module.css'

// How far the finger has to drag the page down (after damping) to reload it.
const TRIGGER = 64
const MAX = 96

/**
 * Pulling the page down from the top reloads what's on screen: every query in use,
 * so the coins in the top bar too. The scroll container is the app's <main>.
 * With `fill` the page is at least as tall as the screen, for a footer at the bottom.
 */
export function PullToRefresh({ children, fill = false }: { children: ReactNode; fill?: boolean }) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const root = useRef<HTMLDivElement>(null)
  const [pull, setPull] = useState(0)
  const [refreshing, setRefreshing] = useState(false)
  const busy = useRef(false)

  useEffect(() => {
    const scroller = root.current?.closest('main')
    if (!scroller) return
    let startY: number | null = null
    let distance = 0

    const onStart = (event: TouchEvent) => {
      startY = !busy.current && scroller.scrollTop <= 0 ? event.touches[0].clientY : null
      distance = 0
    }
    const onMove = (event: TouchEvent) => {
      if (startY === null) return
      const dy = event.touches[0].clientY - startY
      if (dy <= 0 || scroller.scrollTop > 0) {
        if (distance) setPull(0)
        distance = 0
        return
      }
      // Ours, not the browser's rubber band.
      if (event.cancelable) event.preventDefault()
      distance = Math.min(MAX, dy * 0.5)
      setPull(distance)
    }
    const onEnd = async () => {
      if (startY === null) return
      startY = null
      if (distance < TRIGGER) return setPull(0)
      busy.current = true
      setRefreshing(true)
      setPull(TRIGGER)
      try {
        await queryClient.refetchQueries({ type: 'active' })
      } finally {
        busy.current = false
        setRefreshing(false)
        setPull(0)
      }
    }

    scroller.addEventListener('touchstart', onStart, { passive: true })
    scroller.addEventListener('touchmove', onMove, { passive: false })
    scroller.addEventListener('touchend', onEnd)
    scroller.addEventListener('touchcancel', onEnd)
    return () => {
      scroller.removeEventListener('touchstart', onStart)
      scroller.removeEventListener('touchmove', onMove)
      scroller.removeEventListener('touchend', onEnd)
      scroller.removeEventListener('touchcancel', onEnd)
    }
  }, [queryClient])

  const dragging = pull > 0 && !refreshing
  return (
    <div ref={root} className={`${styles.root} ${fill ? styles.fill : ''}`}>
      <div
        className={`${styles.indicator} ${refreshing ? styles.spinning : ''}`}
        style={{ opacity: Math.min(1, pull / TRIGGER), transform: `translateY(${pull - 44}px)` }}
        role={refreshing ? 'status' : undefined}
        aria-label={refreshing ? t('common.refreshing') : undefined}
      >
        <span
          className={styles.ring}
          style={{ transform: refreshing ? undefined : `rotate(${pull * 4}deg)` }}
          data-ready={pull >= TRIGGER}
        />
      </div>
      <div className={`${styles.body} ${dragging ? styles.dragging : ''}`} style={{ transform: pull ? `translateY(${pull}px)` : undefined }}>
        {children}
      </div>
    </div>
  )
}
