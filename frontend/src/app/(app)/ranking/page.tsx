'use client'

import Link from 'next/link'
import { Trans, useTranslation } from 'react-i18next'
import { useUser } from '@/auth/session-context'
import { Podium, Ranking } from '@/groups/Ranking'
import { useCurrentGroup, useGroup, useGroups } from '@/groups/useGroups'
import { currentLanguage } from '@/i18n'
import { useCountdown } from '@/league/useCountdown'
import { useLeague } from '@/league/useLeague'
import { formatNumber } from '@/lib/format'
import { EmptyState } from '@/ui/EmptyState'
import { GearIcon, PodiumIcon, TimerIcon } from '@/ui/icons'
import styles from '../pages.module.css'

export default function RankingPage() {
  const { t } = useTranslation()
  const me = useUser()
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

  const ranking = group.data?.ranking ?? []
  const mineIndex = ranking.findIndex((member) => member.userId === me.id)
  // Whoever is just above the player, to say how far they are.
  const ahead = mineIndex > 0 ? ranking[mineIndex - 1] : undefined
  const gap = ahead ? ahead.balance - ranking[mineIndex].balance : 0

  const error = groups.isError || group.isError
  return (
    <div className={styles.page}>
      <div className={styles.headerRow}>
        <h1 className={styles.heading}>{t('ranking.title')}</h1>
        <div className={styles.headerSide}>
          <span className={styles.live}>{t('ranking.live')}</span>
          {current && (
            <Link className={styles.iconButton} href="/grupo" aria-label={t('ranking.settings')}>
              <GearIcon width={20} height={20} />
            </Link>
          )}
        </div>
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
        <>
          <Podium members={ranking.slice(0, 3)} />
          {ranking.length > 3 && <Ranking members={ranking.slice(3)} />}
        </>
      ) : (
        <p className="muted" aria-busy="true">
          …
        </p>
      )}

      {countdown && (
        <div className={styles.notice}>
          <TimerIcon width={20} height={20} />
          <p>
            {t('league.closesIn', { time: countdown })}.{' '}
            {ahead && gap > 0 && (
              <Trans
                i18nKey="ranking.toCatch"
                values={{ amount: formatNumber(gap, currentLanguage()), name: ahead.nombre }}
                components={{ b: <b /> }}
              />
            )}
          </p>
        </div>
      )}

      <p className={`muted ${styles.rules}`}>{t('league.rules')}</p>
    </div>
  )
}
