'use client'

import Link from 'next/link'
import { useTranslation } from 'react-i18next'
import { useUser } from '@/auth/session-context'
import { StatsPanel } from '@/profile/StatsPanel'
import { useProfile } from '@/profile/useProfile'
import { Avatar } from '@/ui/Avatar'
import { ChevronRightIcon, GearIcon, SlidersIcon } from '@/ui/icons'
import styles from '../pages.module.css'

export default function ProfilePage() {
  const { t } = useTranslation()
  const user = useUser()
  const { data: profile } = useProfile()
  const name = profile?.nombre ?? ''
  const handle = user.displayUsername ?? user.username

  return (
    <div className={styles.page}>
      <div className={styles.headerRow}>
        <h1 className={styles.title}>{t('profile.title')}</h1>
        <Link href="/ajustes" className={styles.iconButton} aria-label={t('profile.settings')}>
          <GearIcon width={20} height={20} />
        </Link>
      </div>

      <section className={styles.profileHead}>
        <Avatar seed={user.id} name={name} size={76} className={styles.ringed} />
        <div className={styles.who}>
          <p className={styles.name}>{name}</p>
          {handle && <p className={`muted ${styles.handle}`}>@{handle}</p>}
        </div>
      </section>

      <StatsPanel />

      <section className={styles.group}>
        <h2 className="label">{t('profile.trophies')}</h2>
        <p className="muted">{t('profile.noTrophies')}</p>
      </section>

      <div className={styles.list}>
        <button className={styles.listRow} type="button" disabled>
          <span className={styles.listText}>{t('profile.styles')}</span>
          <span className={styles.listValue}>{t('common.soon')}</span>
        </button>
        <Link className={styles.listRow} href="/ajustes">
          <SlidersIcon width={20} height={20} />
          <span className={styles.listText}>{t('profile.settings')}</span>
          <ChevronRightIcon className={styles.chevron} width={18} height={18} />
        </Link>
      </div>
    </div>
  )
}
