'use client'

import Link from 'next/link'
import { useTranslation } from 'react-i18next'
import { useUser } from '@/auth/session-context'
import { useProfile } from '@/profile/useProfile'
import { GearIcon } from '@/ui/icons'
import styles from '../pages.module.css'

export default function ProfilePage() {
  const { t } = useTranslation()
  const user = useUser()
  const { data: profile } = useProfile()
  const name = profile?.nombre ?? ''
  const handle = user.displayUsername ?? user.username

  // Real numbers arrive with the game (phase 3).
  const stats = [
    { label: t('profile.hands'), value: '—' },
    { label: t('profile.winRate'), value: '—' },
    { label: t('profile.blackjacks'), value: '—' },
    { label: t('profile.weeksWon'), value: '—' },
  ]

  return (
    <div className={styles.page}>
      <div className={styles.headerRow}>
        <div className={styles.profileHead}>
          <div className={styles.avatar} aria-hidden="true">
            {name.charAt(0).toUpperCase()}
          </div>
          <div style={{ minWidth: 0 }}>
            <h1 className={styles.name}>{name}</h1>
            {handle && <p className={`muted ${styles.handle}`}>@{handle}</p>}
          </div>
        </div>
        <Link href="/ajustes" className={styles.iconButton} aria-label={t('profile.settings')}>
          <GearIcon width={20} height={20} />
        </Link>
      </div>

      <section className="card">
        <h2 className="card-title">{t('profile.stats')}</h2>
        <div className={styles.stats}>
          {stats.map((stat) => (
            <div key={stat.label} className={styles.stat}>
              <div className={styles.statValue}>{stat.value}</div>
              <div className={styles.statLabel}>{stat.label}</div>
            </div>
          ))}
        </div>
      </section>

      <section className="card">
        <h2 className="card-title">{t('profile.trophies')}</h2>
        <p className="muted">{t('profile.noTrophies')}</p>
      </section>

      <button className={`btn btn-secondary ${styles.rowButton}`} disabled>
        <span>{t('profile.styles')}</span>
        <span className="muted">{t('common.soon')}</span>
      </button>
    </div>
  )
}
