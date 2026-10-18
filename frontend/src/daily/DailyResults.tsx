'use client'

import Link from 'next/link'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useUser } from '@/auth/session-context'
import { useGroups } from '@/groups/useGroups'
import { medal } from '@/groups/medal'
import { currentLanguage } from '@/i18n'
import { useCountdown } from '@/league/useCountdown'
import { formatNumber } from '@/lib/format'
import { ShareSheet } from '@/social/ShareSheet'
import { netTone, signed } from '@/table/Table'
import { Avatar } from '@/ui/Avatar'
import { ChatIcon, CheckIcon, ChevronLeftIcon, ShareIcon, TimerIcon } from '@/ui/icons'
import { Progress } from './Progress'
import { useDailyRanking, type DailyState } from './useDaily'
import ranking from '@/groups/Ranking.module.css'
import styles from './Daily.module.css'

/** Today's deck once it's played: how it went, sharing it and how the others did. */
export function DailyResults({ daily }: { daily: DailyState }) {
  const { t } = useTranslation()
  const lang = currentLanguage()
  const countdown = useCountdown(daily.endsAt)
  const net = daily.chips - daily.start
  const [publishing, setPublishing] = useState(false)
  const [published, setPublished] = useState(false)
  const [copied, setCopied] = useState(false)

  const shareOut = async () => {
    if (!daily.share) return
    const url = daily.codigo ? `${window.location.origin}/r/${daily.codigo}` : window.location.origin
    try {
      if (navigator.share) {
        await navigator.share({ text: `${daily.share}\n${url}` })
        return
      }
      await navigator.clipboard.writeText(`${daily.share}\n${url}`)
      setCopied(true)
    } catch {
      // Closed the share sheet, or no clipboard: nothing to do.
    }
  }

  return (
    <div className={styles.results}>
      <div className={styles.resultsTop}>
        <Link href="/" className={styles.back} aria-label={t('daily.backHome')}>
          <ChevronLeftIcon width={18} height={18} />
        </Link>
        <span className={styles.title}>{t('daily.title', { number: daily.number })}</span>
      </div>

      <section className={`card ${styles.summary}`}>
        <p className={styles.kicker}>{t('daily.yourResult')}</p>
        <p className={`${styles.bigNet} ${styles[netTone(net)]}`}>{signed(net, lang)}</p>
        <Progress results={daily.results} total={daily.total} />
        <p className="muted">
          {daily.results.length < daily.total
            ? t('daily.outOfChips', { count: daily.results.length })
            : t('daily.finalChips', { amount: formatNumber(daily.chips, lang) })}
        </p>
        <div className={styles.shareRow}>
          <button className="btn btn-primary" type="button" onClick={() => void shareOut()}>
            {copied ? <CheckIcon width={16} height={16} strokeWidth={3} /> : <ShareIcon width={16} height={16} />}
            {t(copied ? 'daily.copied' : 'daily.share')}
          </button>
          <button className="btn btn-secondary" type="button" disabled={published} onClick={() => setPublishing(true)}>
            {published ? <CheckIcon width={16} height={16} strokeWidth={3} /> : <ChatIcon width={16} height={16} />}
            {t(published ? 'social.published' : 'daily.publish')}
          </button>
        </div>
        {countdown && (
          <p className={styles.countdown}>
            <TimerIcon width={14} height={14} />
            {t('daily.nextIn', { time: countdown })}
          </p>
        )}
      </section>

      <DailyRankingCard />

      <p className={`muted ${styles.rules}`}>{t('daily.prizeRule', { amount: daily.prize })}</p>

      {publishing && (
        <ShareSheet
          what={{ daily: true }}
          onClose={() => setPublishing(false)}
          onShared={() => {
            setPublishing(false)
            setPublished(true)
          }}
        />
      )}
    </div>
  )
}

/** Today's ranking among friends or in one group; only shown once the player has finished. */
function DailyRankingCard() {
  const { t } = useTranslation()
  const lang = currentLanguage()
  const me = useUser()
  const { data: groups } = useGroups()
  const [group, setGroup] = useState('friends')
  const { data } = useDailyRanking(group)
  const options = [{ id: 'friends', name: t('daily.friends') }, ...(groups ?? []).map((g) => ({ id: g.id, name: g.nombre }))]

  return (
    <section className={`card ${styles.rankingCard}`}>
      <h2 className="card-title">{t('daily.rankingTitle')}</h2>
      {options.length > 1 && (
        <div className={styles.pills} role="tablist">
          {options.map((option) => (
            <button
              key={option.id}
              type="button"
              role="tab"
              aria-selected={group === option.id}
              className={`${styles.pillOption} ${group === option.id ? styles.pillOn : ''}`}
              onClick={() => setGroup(option.id)}
            >
              {option.name}
            </button>
          ))}
        </div>
      )}
      {data && data.rows.length <= 1 && <p className="muted">{t('daily.aloneSoFar')}</p>}
      {data && data.rows.length > 0 && (
        <ol className={ranking.top}>
          {data.rows.map((row) => {
            const mine = row.userId === me.id
            return (
              <li key={row.userId} className={`${ranking.topRow} ${mine ? ranking.mine : ''}`} style={medal(row.rank)}>
                <span className={ranking.place}>{row.rank}</span>
                <Avatar seed={row.userId} name={row.nombre} src={row.avatarUrl} frame={row.marco} />
                <span className={`${ranking.name} ${styles.rowName}`}>
                  {mine ? t('ranking.you') : row.nombre}
                  <span className={styles.rowSquares} aria-hidden="true">
                    <Progress results={row.results} total={row.results.length} />
                  </span>
                </span>
                <span className={`${ranking.balance} ${styles[netTone(row.net)]}`}>{signed(row.net, lang)}</span>
              </li>
            )
          })}
        </ol>
      )}
    </section>
  )
}
