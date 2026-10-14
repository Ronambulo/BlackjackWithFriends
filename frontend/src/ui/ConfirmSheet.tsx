'use client'

import { useEffect, useId, useRef, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { useTranslation } from 'react-i18next'
import styles from './ConfirmSheet.module.css'

/**
 * A bottom sheet asking to confirm something, in place of window.confirm.
 * `tone` paints the confirm button: red for what can't be undone, gold otherwise.
 */
export function ConfirmSheet({
  open,
  icon,
  title,
  text,
  confirm,
  tone = 'danger',
  stacked = false,
  busy = false,
  onConfirm,
  onCancel,
}: {
  open: boolean
  icon: ReactNode
  title: string
  text: ReactNode
  confirm: string
  tone?: 'danger' | 'accent'
  /** One button under the other, the confirm on top */
  stacked?: boolean
  busy?: boolean
  onConfirm: () => void
  onCancel: () => void
}) {
  const { t } = useTranslation()
  const id = useId()
  const cancel = useRef<HTMLButtonElement>(null)

  // Escape cancels; focus starts on the safe choice.
  useEffect(() => {
    if (!open) return
    cancel.current?.focus()
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onCancel()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, onCancel])

  if (!open) return null

  return createPortal(
    <div className={styles.overlay} onClick={onCancel}>
      <section
        className={styles.sheet}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby={`${id}-title`}
        aria-describedby={`${id}-text`}
        onClick={(event) => event.stopPropagation()}
      >
        <span className={styles.grab} aria-hidden="true" />
        <div className={styles.icon} aria-hidden="true">
          {icon}
        </div>
        <h2 id={`${id}-title`} className={styles.title}>
          {title}
        </h2>
        <p id={`${id}-text`} className={styles.text}>
          {text}
        </p>
        <div className={`${styles.buttons} ${stacked ? styles.stacked : ''}`}>
          <button
            className={`btn ${tone === 'danger' ? 'btn-destructive' : 'btn-primary'}`}
            type="button"
            disabled={busy}
            onClick={onConfirm}
          >
            {confirm}
          </button>
          <button ref={cancel} className={`btn ${styles.cancel}`} type="button" onClick={onCancel}>
            {t('common.cancel')}
          </button>
        </div>
      </section>
    </div>,
    document.body,
  )
}

/** The rounded tile behind a sheet's icon. */
export function SheetIcon({ tone, children }: { tone: 'danger' | 'accent'; children: ReactNode }) {
  return <span className={`${styles.tile} ${tone === 'danger' ? styles.tileDanger : styles.tileAccent}`}>{children}</span>
}
