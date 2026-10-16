'use client'

import { useEffect, useId, useRef, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { useTranslation } from 'react-i18next'
import { CloseIcon } from './icons'
import styles from './Modal.module.css'

/**
 * A dialog for a form: centred on wide screens, a bottom sheet on a phone.
 * Escape or a tap outside closes it.
 */
export function Modal({
  title,
  eyebrow,
  wide = false,
  onClose,
  children,
}: {
  title: string
  /** A small line above the title */
  eyebrow?: string
  /** Room for a picture beside the form */
  wide?: boolean
  onClose: () => void
  children: ReactNode
}) {
  const { t } = useTranslation()
  const id = useId()
  const panel = useRef<HTMLElement>(null)

  useEffect(() => {
    panel.current?.focus()
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  return createPortal(
    <div className={styles.overlay} onClick={onClose}>
      <section
        ref={panel}
        className={`${styles.panel} ${wide ? styles.wide : ''}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby={`${id}-title`}
        tabIndex={-1}
        onClick={(event) => event.stopPropagation()}
      >
        <span className={styles.grab} aria-hidden="true" />
        <header className={styles.head}>
          <div className={styles.titles}>
            {eyebrow && <span className={styles.eyebrow}>{eyebrow}</span>}
            <h2 id={`${id}-title`} className={styles.title}>
              {title}
            </h2>
          </div>
          <button className={styles.close} type="button" aria-label={t('common.close')} onClick={onClose}>
            <CloseIcon width={18} height={18} />
          </button>
        </header>
        {children}
      </section>
    </div>,
    document.body,
  )
}
