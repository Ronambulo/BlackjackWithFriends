'use client'

import Link from 'next/link'
import { useTranslation } from 'react-i18next'
import { Achievements } from '@/achievements/Achievements'
import { useAchievements } from '@/achievements/useAchievements'
import { ChevronLeftIcon } from '@/ui/icons'
import styles from '../pages.module.css'

/** Every achievement, opened from the profile's card. */
export default function AchievementsPage() {
  const { t } = useTranslation()
  const { data } = useAchievements()

  return (
    <div className={styles.page}>
      <div className={styles.titleRow}>
        <Link href="/perfil" className={styles.backButton} aria-label={t('common.back')}>
          <ChevronLeftIcon width={22} height={22} />
        </Link>
        <h1 className={styles.title} style={{ flex: 1 }}>
          {t('achievements.title')}
        </h1>
        {data && (
          <span
            aria-label={t('achievements.progress', { done: data.filter((a) => a.unlockedAt).length, total: data.length })}
            style={{ fontWeight: 800, fontVariantNumeric: 'tabular-nums' }}
          >
            {data.filter((a) => a.unlockedAt).length}
            <span className="muted" style={{ fontWeight: 600 }}>
              /{data.length}
            </span>
          </span>
        )}
      </div>

      <Achievements />
    </div>
  )
}
