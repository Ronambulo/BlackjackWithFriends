'use client'

import { useTranslation } from 'react-i18next'
import type { GroupSummary } from '@/groups/useGroups'
import { currentLanguage } from '@/i18n'
import { formatNumber } from '@/lib/format'
import { CoinsIcon, TimerIcon } from '@/ui/icons'
import { useCountdown } from './useCountdown'
import { useClaimPay, useLeague } from './useLeague'
import styles from './LeagueCard.module.css'

/** The player's league balance, their place in the group in view and the daily pay button. */
export function LeagueCard({ group, dayChange }: { group?: GroupSummary; dayChange?: number }) {
  const { t } = useTranslation()
  const lang = currentLanguage()
  const { data: league, isError, refetch } = useLeague()
  const claimPay = useClaimPay()
  const countdown = useCountdown(league?.weekEndsAt)
  const fmt = (n: number) => formatNumber(n, lang)

  if (isError) {
    return (
      <section className={`card ${styles.card}`}>
        <p className="muted">{t('common.error')}</p>
        <button className="btn btn-secondary" onClick={() => void refetch()}>
          {t('common.retry')}
        </button>
      </section>
    )
  }

  return (
    <section className={styles.card} aria-busy={!league}>
      <div className={styles.top}>
        <div>
          <p className={`label ${styles.label}`}>{t('league.balance')}</p>
          <p className={styles.balance}>{league ? fmt(league.balance) : '—'}</p>
          {dayChange !== undefined && dayChange !== 0 && (
            <p className={dayChange > 0 ? styles.up : styles.down}>
              {t('league.today', { change: `${dayChange > 0 ? '+' : '−'}${fmt(Math.abs(dayChange))}` })}
            </p>
          )}
        </div>
        {group && (
          <div className={styles.position}>
            <p aria-label={t('league.position', { rank: group.rank, total: group.members })}>
              <span aria-hidden="true">
                {group.rank}º<span className={styles.of}> {t('league.of', { total: group.members })}</span>
              </span>
            </p>
            {group.rankChange !== 0 && (
              <p className={group.rankChange > 0 ? styles.up : styles.down}>
                <span aria-hidden="true">{group.rankChange > 0 ? '▲' : '▼'}</span>{' '}
                {t(group.rankChange > 0 ? 'ranking.up' : 'ranking.down', { count: Math.abs(group.rankChange) })}
              </p>
            )}
          </div>
        )}
      </div>
      {countdown && (
        <p className={styles.countdown}>
          <TimerIcon width={16} height={16} />
          {t('league.weekClosesIn', { time: countdown })}
        </p>
      )}
      {league &&
        (league.pendingPay > 0 ? (
          <button className={`btn btn-primary btn-block ${styles.claim}`} disabled={claimPay.isPending} onClick={() => claimPay.mutate()}>
            <CoinsIcon width={20} height={20} />
            {t('league.claim', { amount: fmt(league.pendingPay) })}
          </button>
        ) : (
          <p className={styles.claimed}>{t('league.claimed', { amount: fmt(league.dailyPay) })}</p>
        ))}
      {claimPay.isError && (
        <p className="error-text" role="alert">
          {t('common.error')}
        </p>
      )}
    </section>
  )
}
