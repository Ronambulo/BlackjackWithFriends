'use client'

import Link from 'next/link'
import { useTranslation } from 'react-i18next'
import { StatsDetail } from '@/profile/StatsDetail'
import { ChevronLeftIcon } from '@/ui/icons'
import styles from '../pages.module.css'

/** The player's numbers in detail, opened from the profile. */
export default function StatsPage() {
  const { t } = useTranslation()

  return (
    <div className={styles.page}>
      <div className={styles.titleRow}>
        <Link href="/perfil" className={styles.backButton} aria-label={t('common.back')}>
          <ChevronLeftIcon width={22} height={22} />
        </Link>
        <h1 className={styles.title}>{t('profile.stats')}</h1>
      </div>

      <StatsDetail />
    </div>
  )
}
