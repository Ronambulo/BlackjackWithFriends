'use client'

import Link from 'next/link'
import { useTranslation } from 'react-i18next'
import type { GroupSummary } from '@/groups/useGroups'
import { currentLanguage } from '@/i18n'
import { formatNumber } from '@/lib/format'
import { ChevronRightIcon, CoinsIcon, CrownIcon, TimerIcon } from '@/ui/icons'
import { useCountdown } from './useCountdown'
import { useClaimPay, useLeague } from './useLeague'
import styles from './LeagueCard.module.css'

/** The player's league balance, their place in each of their groups and the daily pay button. */
export function LeagueCard({ groups, dayChange }: { groups?: GroupSummary[]; dayChange?: number }) {
  const { t } = useTranslation()
  const lang = currentLanguage()
  const { data: league, isError, refetch } = useLeague()
  const claimPay = useClaimPay()
  const countdown = useCountdown(league?.weekEndsAt)
  const fmt = (n: number) => formatNumber(n, lang)
  // With one group its place goes big beside the balance; with more, a row for each under it.
  const group = groups?.length === 1 ? groups[0] : undefined
  const several = groups && groups.length > 1 ? groups : undefined

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
      {several && (
        <ul className={styles.places}>
          {several.map((g) => (
            <li key={g.id}>
              <Link href={`/grupos/${g.id}`} className={styles.place}>
                <span className={styles.placeName}>{g.nombre}</span>
                <span
                  className={styles.placeRank}
                  aria-label={t('league.position', { rank: g.rank, total: g.members })}
                >
                  {g.rank === 1 && <CrownIcon width={14} height={12} />}
                  <span aria-hidden="true">
                    {g.rank}º<span className={styles.of}> {t('league.of', { total: g.members })}</span>
                  </span>
                </span>
                {g.rankChange !== 0 && (
                  <span
                    className={g.rankChange > 0 ? styles.placeUp : styles.placeDown}
                    aria-label={t(g.rankChange > 0 ? 'ranking.up' : 'ranking.down', { count: Math.abs(g.rankChange) })}
                  >
                    {g.rankChange > 0 ? '▲' : '▼'}
                    {Math.abs(g.rankChange)}
                  </span>
                )}
                <ChevronRightIcon className={styles.placeChevron} width={16} height={16} />
              </Link>
            </li>
          ))}
        </ul>
      )}
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
