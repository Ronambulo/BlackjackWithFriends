'use client'

import { useTranslation } from 'react-i18next'
import { RankChange } from '@/groups/RankChange'
import type { GroupSummary } from '@/groups/useGroups'
import { currentLanguage } from '@/i18n'
import { formatNumber } from '@/lib/format'
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
    <section className={`card ${styles.card}`} aria-busy={!league}>
      <div className={styles.top}>
        <span className={styles.label}>{t('league.balance')}</span>
        {dayChange !== undefined && dayChange !== 0 && (
          <span className={dayChange > 0 ? styles.up : styles.down}>
            {t('league.today', { change: `${dayChange > 0 ? '+' : '−'}${fmt(Math.abs(dayChange))}` })}
          </span>
        )}
      </div>
      <p className={styles.balance}>
        <span className={styles.chip} aria-hidden="true" />
        {league ? fmt(league.balance) : '—'}
      </p>
      <div className={styles.meta}>
        {group && (
          <span className={styles.position}>
            {t('league.position', { rank: group.rank, total: group.members })}
            <RankChange change={group.rankChange} />
          </span>
        )}
        {countdown && <span className="muted">⏱ {t('league.closesIn', { time: countdown })}</span>}
      </div>
      {league &&
        (league.pendingPay > 0 ? (
          <button className="btn btn-primary btn-block" disabled={claimPay.isPending} onClick={() => claimPay.mutate()}>
            {t('league.claim', { amount: fmt(league.pendingPay) })}
          </button>
        ) : (
          <p className={`muted ${styles.claimed}`}>{t('league.claimed', { amount: fmt(league.dailyPay) })}</p>
        ))}
      {claimPay.isError && (
        <p className="error-text" role="alert">
          {t('common.error')}
        </p>
      )}
    </section>
  )
}
