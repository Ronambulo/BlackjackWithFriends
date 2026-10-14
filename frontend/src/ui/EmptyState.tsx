import type { ReactNode } from 'react'
import styles from './EmptyState.module.css'

/** Placeholder for a screen whose content arrives in a later phase. */
export function EmptyState({ icon, title, text }: { icon: ReactNode; title: string; text: string }) {
  return (
    <section className={styles.empty}>
      <div className={styles.icon}>{icon}</div>
      <h1 className={styles.title}>{title}</h1>
      <p className="muted">{text}</p>
    </section>
  )
}
