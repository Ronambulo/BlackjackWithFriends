'use client'

import Link from 'next/link'
import { useTranslation } from 'react-i18next'
import { Ranking } from '@/groups/Ranking'
import { useCurrentGroup, useGroup, useGroups } from '@/groups/useGroups'
import { useCountdown } from '@/league/useCountdown'
import { useLeague } from '@/league/useLeague'
import { EmptyState } from '@/ui/EmptyState'
import { GearIcon, PodiumIcon } from '@/ui/icons'
import styles from '../pages.module.css'

export default function RankingPage() {
  const { t } = useTranslation()
  const groups = useGroups()
  const current = useCurrentGroup()
  const group = useGroup(current?.id)
  const { data: league } = useLeague()
  const countdown = useCountdown(league?.weekEndsAt)

  if (groups.data?.length === 0) {
    return (
      <div className={styles.page}>
        <EmptyState icon={<PodiumIcon />} title={t('ranking.title')} text={t('ranking.empty')} />
        <div className={styles.actions}>
          <Link className="btn btn-primary" href="/grupos/nuevo">
            {t('home.createGroup')}
          </Link>
          <Link className="btn btn-secondary" href="/grupos/unirse">
            {t('home.joinGroup')}
          </Link>
        </div>
      </div>
    )
  }

  const error = groups.isError || group.isError
  return (
    <div className={styles.page}>
      <div className={styles.headerRow}>
        <h1 className={styles.heading}>{current?.nombre ?? t('ranking.title')}</h1>
        {current && (
          <Link className={styles.iconButton} href="/grupo" aria-label={t('ranking.settings')}>
            <GearIcon width={20} height={20} />
          </Link>
        )}
      </div>
      <div className={styles.headerRow}>
        <span className={styles.live}>{t('ranking.live')}</span>
        {countdown && <span className="muted">{t('league.closesIn', { time: countdown })}</span>}
      </div>

      {error ? (
        <section className="card">
          <p className="muted">{t('common.error')}</p>
          <button
            className="btn btn-secondary"
            onClick={() => {
              void groups.refetch()
              void group.refetch()
            }}
          >
            {t('common.retry')}
          </button>
        </section>
      ) : group.data ? (
        <Ranking members={group.data.ranking} />
      ) : (
        <p className="muted" aria-busy="true">
          …
        </p>
      )}

      <p className={`muted ${styles.rules}`}>{t('league.rules')}</p>
    </div>
  )
}
