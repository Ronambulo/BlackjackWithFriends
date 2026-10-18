'use client'

import Link from 'next/link'
import { useTranslation } from 'react-i18next'
import { Achievements } from '@/achievements/Achievements'
import { useIsAdmin } from '@/admin/useAdmin'
import { useUser } from '@/auth/session-context'
import { AvatarPicker } from '@/profile/AvatarPicker'
import { StatsPanel } from '@/profile/StatsPanel'
import { useProfile } from '@/profile/useProfile'
import { Trophies } from '@/season/Trophies'
import { BrushIcon, ChevronRightIcon, GearIcon, SlidersIcon } from '@/ui/icons'
import styles from '../pages.module.css'

export default function ProfilePage() {
  const { t } = useTranslation()
  const user = useUser()
  const { data: profile } = useProfile()
  const admin = useIsAdmin()
  const name = profile?.nombre ?? ''
  const handle = user.displayUsername ?? user.username

  return (
    <div className={styles.page}>
      <div className={styles.headerRow}>
        <h1 className={styles.title}>{t('profile.title')}</h1>
        <div className={styles.headerSide}>
          <Link href="/estilos" className={styles.iconButton} aria-label={t('profile.styles')}>
            <BrushIcon width={20} height={20} />
          </Link>
          <Link href="/ajustes" className={styles.iconButton} aria-label={t('profile.settings')}>
            <GearIcon width={20} height={20} />
          </Link>
        </div>
      </div>

      <section className={styles.profileHead}>
        <AvatarPicker size={76} className={styles.ringed} />
        <div className={styles.who}>
          <p className={styles.name}>{name}</p>
          {handle && <p className={`muted ${styles.handle}`}>@{handle}</p>}
        </div>
      </section>

      <StatsPanel />

      <Trophies />

      <Achievements />

      <div className={styles.list}>
        <Link className={styles.listRow} href="/estilos">
          <BrushIcon width={20} height={20} />
          <span className={styles.listText}>{t('profile.styles')}</span>
          <ChevronRightIcon className={styles.chevron} width={18} height={18} />
        </Link>
        <Link className={styles.listRow} href="/ajustes">
          <SlidersIcon width={20} height={20} />
          <span className={styles.listText}>{t('profile.settings')}</span>
          <ChevronRightIcon className={styles.chevron} width={18} height={18} />
        </Link>
        {admin && (
          <Link className={styles.listRow} href="/admin">
            <GearIcon width={20} height={20} />
            <span className={styles.listText}>{t('admin.title')}</span>
            <ChevronRightIcon className={styles.chevron} width={18} height={18} />
          </Link>
        )}
      </div>
    </div>
  )
}
