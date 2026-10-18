'use client'

import { useTranslation } from 'react-i18next'
import styles from './Daily.module.css'

/** A square per hand: green won, red lost, grey push; the one in play glows. */
export function Progress({ results, total, current = -1 }: { results: string; total: number; current?: number }) {
  const { t } = useTranslation()
  return (
    <ol className={styles.progress} aria-label={t('daily.progress', { done: results.length, total })}>
      {Array.from({ length: total }, (_, i) => (
        <li key={i} className={`${styles.square} ${styles[results[i] ?? (i === current ? 'now' : 'empty')]}`} />
      ))}
    </ol>
  )
}
