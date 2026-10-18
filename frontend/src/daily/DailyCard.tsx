'use client'

import type { Card } from '@bwf/engine'
import Link from 'next/link'
import type { CSSProperties } from 'react'
import { useTranslation } from 'react-i18next'
import { themeStyle } from '@/cosmetics/themes'
import { currentLanguage } from '@/i18n'
import { formatNumber } from '@/lib/format'
import { PlayingCard } from '@/table/PlayingCard'
import { netTone, signed } from '@/table/Table'
import { ChevronRightIcon } from '@/ui/icons'
import { Progress } from './Progress'
import { useDaily } from './useDaily'
import styles from './Daily.module.css'

// Always the default cards, whatever the player wears: it's the deck's own badge.
const BADGE = { ...themeStyle(undefined), '--card-w': '52px' } as CSSProperties

/** The daily deck on the home screen: the whole card opens it. */
export function DailyCard() {
  const { t } = useTranslation()
  const lang = currentLanguage()
  const { data } = useDaily()
  if (!data) return null
  const net = data.chips - data.start
  const started = data.results.length > 0 || data.hand !== null

  return (
    <Link href="/jugar/baraja" className={`card ${styles.card}`}>
      <span className={styles.deckCard} style={BADGE} aria-hidden="true">
        {/* The deck's number where the rank goes */}
        <PlayingCard card={{ rank: String(data.number), suit: 'H' } as unknown as Card} still />
      </span>
      <span className={styles.cardBody}>
        <span className={styles.cardTitle}>{t('daily.title', { number: data.number })}</span>
        <span className={styles.cardText}>{t('daily.subtitle')}</span>
        {started && (
          <span className={styles.cardStatus}>
            <Progress results={data.results} total={data.total} />
            {data.done ? (
              <span className={styles[netTone(net)]}>{signed(net, lang)}</span>
            ) : (
              <span>{t('daily.keepPlaying')}</span>
            )}
          </span>
        )}
        {data.yesterday?.prize ? (
          <span className={styles.prize}>{t('daily.yesterdayPrize', { amount: formatNumber(data.yesterday.prize, lang) })}</span>
        ) : null}
      </span>
      <ChevronRightIcon className={styles.chevron} width={18} height={18} />
    </Link>
  )
}
