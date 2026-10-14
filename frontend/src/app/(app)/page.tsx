'use client'

import { useTranslation } from 'react-i18next'
import { useProfile } from '@/profile/useProfile'
import styles from './pages.module.css'

export default function HomePage() {
  const { t } = useTranslation()
  const { data: profile } = useProfile()

  return (
    <div className={styles.page}>
      <h1 className={styles.heading}>{t('home.greeting', { name: profile?.nombre ?? '' })}</h1>

      <section className="card">
        <h2 className="card-title">{t('home.noGroupTitle')}</h2>
        <p className="muted">{t('home.noGroupText')}</p>
        <div className={styles.actions}>
          {/* Groups arrive in phase 2. */}
          <button className="btn btn-primary" disabled title={t('common.soon')}>
            {t('home.createGroup')}
          </button>
          <button className="btn btn-secondary" disabled title={t('common.soon')}>
            {t('home.joinGroup')}
          </button>
        </div>
        <p className={`muted ${styles.soon}`}>{t('common.soon')}</p>
      </section>
    </div>
  )
}
