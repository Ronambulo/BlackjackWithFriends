'use client'

import { useEffect, useId, useRef, useState, type PointerEvent, type WheelEvent } from 'react'
import { createPortal } from 'react-dom'
import { useTranslation } from 'react-i18next'
import styles from './PhotoCropper.module.css'

/** The square to keep, in the photo's own pixels. */
export interface Crop {
  x: number
  y: number
  side: number
}

// Side of the frame on screen, and how far in you can zoom from "just fills it".
const FRAME = 300
const MAX_ZOOM = 5

interface View {
  /** Screen pixels per photo pixel. */
  scale: number
  /** Where the photo's top-left corner sits, from the frame's top-left. */
  x: number
  y: number
}

/**
 * Lets the player pick which square of the photo becomes the avatar: drag to move,
 * pinch, scroll or use the slider to zoom. The photo always fills the frame.
 */
export function PhotoCropper({ file, onDone, onCancel }: { file: File; onDone: (crop: Crop) => void; onCancel: () => void }) {
  const { t } = useTranslation()
  const id = useId()
  const [url, setUrl] = useState<string | null>(null)
  const [size, setSize] = useState<{ width: number; height: number } | null>(null)
  const [view, setView] = useState<View | null>(null)
  const pointers = useRef(new Map<number, { x: number; y: number }>())
  const frame = useRef<HTMLDivElement>(null)

  // Made and freed here, so React's double mount in development can't free it too early.
  useEffect(() => {
    const objectUrl = URL.createObjectURL(file)
    // oxlint-disable-next-line react/set-state-in-effect -- the URL is an outside resource tied to this effect
    setUrl(objectUrl)
    return () => URL.revokeObjectURL(objectUrl)
  }, [file])

  // Escape closes.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onCancel()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onCancel])

  const minScale = size ? FRAME / Math.min(size.width, size.height) : 1

  /** Keeps the photo covering the whole frame. */
  function clamp(next: View): View {
    if (!size) return next
    const scale = Math.min(Math.max(next.scale, minScale), minScale * MAX_ZOOM)
    return {
      scale,
      x: Math.min(0, Math.max(FRAME - size.width * scale, next.x)),
      y: Math.min(0, Math.max(FRAME - size.height * scale, next.y)),
    }
  }

  /** Zooms by `factor` keeping the point (cx, cy) of the frame still. */
  function zoomBy(factor: number | ((view: View) => number), cx = FRAME / 2, cy = FRAME / 2) {
    setView((from) => {
      if (!from) return from
      const wanted = typeof factor === 'number' ? factor : factor(from)
      const ratio = Math.min(Math.max(from.scale * wanted, minScale), minScale * MAX_ZOOM) / from.scale
      return clamp({ scale: from.scale * ratio, x: cx - (cx - from.x) * ratio, y: cy - (cy - from.y) * ratio })
    })
  }

  function local(event: { clientX: number; clientY: number }) {
    const box = frame.current!.getBoundingClientRect()
    // The frame may be drawn smaller than FRAME on narrow screens.
    const k = FRAME / box.width
    return { x: (event.clientX - box.left) * k, y: (event.clientY - box.top) * k }
  }

  function onPointerDown(event: PointerEvent) {
    event.currentTarget.setPointerCapture(event.pointerId)
    pointers.current.set(event.pointerId, local(event))
  }

  function onPointerMove(event: PointerEvent) {
    const previous = pointers.current.get(event.pointerId)
    if (!previous) return
    const point = local(event)
    const others = [...pointers.current.entries()].filter(([key]) => key !== event.pointerId).map(([, p]) => p)
    pointers.current.set(event.pointerId, point)
    if (others.length === 0) {
      setView((view) => view && clamp({ ...view, x: view.x + point.x - previous.x, y: view.y + point.y - previous.y }))
      return
    }
    // Two fingers: zoom by how much they spread, around the point between them.
    const other = others[0]
    const before = Math.hypot(previous.x - other.x, previous.y - other.y)
    const after = Math.hypot(point.x - other.x, point.y - other.y)
    if (before > 0) zoomBy(after / before, (point.x + other.x) / 2, (point.y + other.y) / 2)
  }

  function onPointerUp(event: PointerEvent) {
    pointers.current.delete(event.pointerId)
  }

  function onWheel(event: WheelEvent) {
    const point = local(event)
    zoomBy(Math.exp(-event.deltaY * 0.002), point.x, point.y)
  }

  function onLoad(image: HTMLImageElement) {
    const natural = { width: image.naturalWidth, height: image.naturalHeight }
    const scale = FRAME / Math.min(natural.width, natural.height)
    setSize(natural)
    // Starts filling the frame, centred.
    setView({ scale, x: (FRAME - natural.width * scale) / 2, y: (FRAME - natural.height * scale) / 2 })
  }

  function done() {
    if (!view) return
    onDone({ x: -view.x / view.scale, y: -view.y / view.scale, side: FRAME / view.scale })
  }

  const zoom = view ? view.scale / minScale : 1

  return createPortal(
    <div className={styles.overlay} onClick={onCancel}>
      <section
        className={styles.sheet}
        role="dialog"
        aria-modal="true"
        aria-labelledby={`${id}-title`}
        onClick={(event) => event.stopPropagation()}
      >
        <span className={styles.grab} aria-hidden="true" />
        <h2 id={`${id}-title`} className={styles.title}>
          {t('settings.cropTitle')}
        </h2>
        <p className={styles.hint}>{t('settings.cropHint')}</p>

        <div
          ref={frame}
          className={styles.frame}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          onWheel={onWheel}
        >
          {url && (
            // oxlint-disable-next-line nextjs/no-img-element -- a local blob, nothing for next/image to do
            <img
              src={url}
              alt=""
              draggable={false}
              className={styles.photo}
              onLoad={(event) => onLoad(event.currentTarget)}
              style={
                view && size
                  ? {
                      width: `${(size.width * view.scale * 100) / FRAME}%`,
                      left: `${(view.x * 100) / FRAME}%`,
                      top: `${(view.y * 100) / FRAME}%`,
                    }
                  : { opacity: 0 }
              }
            />
          )}
          <span className={styles.ring} aria-hidden="true" />
        </div>

        <input
          className={styles.zoom}
          type="range"
          min={1}
          max={MAX_ZOOM}
          step={0.01}
          value={zoom}
          aria-label={t('settings.zoom')}
          onChange={(event) => {
            const target = minScale * Number(event.target.value)
            zoomBy((from) => target / from.scale)
          }}
        />

        <div className={styles.buttons}>
          <button className="btn btn-primary" type="button" disabled={!view} onClick={done}>
            {t('settings.usePhoto')}
          </button>
          <button className={`btn ${styles.cancel}`} type="button" onClick={onCancel}>
            {t('common.cancel')}
          </button>
        </div>
      </section>
    </div>,
    document.body,
  )
}
