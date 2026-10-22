'use client'

import type { TFunction } from 'i18next'
import { useTranslation } from 'react-i18next'
import { currentLanguage } from '@/i18n'
import { formatNumber } from '@/lib/format'
import { CheckIcon } from '@/ui/icons'
import { useLeague, type League } from './useLeague'
import styles from './MinimumProgress.module.css'

/** What the player still needs to enter the prizes, as a sentence; null once they're in. */
export function minimumLeft(t: TFunction, league: League): string | null {
  const fmt = (n: number) => formatNumber(n, currentLanguage())
  const hands = Math.max(0, league.minHands - league.hands)
  const chips = Math.max(0, league.minWagered - league.wagered)
  if (hands > 0 && chips > 0) return t('league.minimum.leftBoth', { hands: fmt(hands), count: hands, chips: fmt(chips) })
  if (hands > 0) return t('league.minimum.leftHands', { hands: fmt(hands), count: hands })
  if (chips > 0) return t('league.minimum.leftChips', { chips: fmt(chips) })
  return null
}

function useRule() {
  const { t } = useTranslation()
  const { data: league } = useLeague()
  const fmt = (n: number) => formatNumber(n, currentLanguage())
  return league ? t('league.minimum.rule', { hands: fmt(league.minHands), chips: fmt(league.minWagered) }) : ''
}

/** The league's rules, with the week's minimum to enter the prizes. */
export function LeagueRules({ className }: { className?: string }) {
  const { t } = useTranslation()
  const { data: league } = useLeague()
  const rule = useRule()
  // Until the league loads there are no numbers to tell.
  if (!league) return null
  const fmt = (n: number) => formatNumber(n, currentLanguage())
  return <p className={className}>{`${t('league.rules', { start: fmt(league.startBalance), pay: fmt(league.dailyPay) })} ${rule}`}</p>
}

/** Just the week's minimum, as a sentence. */
export function MinimumRule({ className }: { className?: string }) {
  const rule = useRule()
  return rule ? <p className={className}>{rule}</p> : null
}

/** How far the player is from the week's minimum to enter the prizes: hands and chips wagered, a bar each. */
export function MinimumProgress({ league }: { league: League }) {
  const { t } = useTranslation()
  const lang = currentLanguage()
  const fmt = (n: number) => formatNumber(n, lang)
  const left = minimumLeft(t, league)

  if (!left) {
    return (
      <p className={styles.done}>
        <CheckIcon width={16} height={16} />
        {t('league.minimum.done')}
      </p>
    )
  }

  const bars = [
    { key: 'hands', done: league.hands, goal: league.minHands },
    { key: 'wagered', done: league.wagered, goal: league.minWagered },
  ] as const
  return (
    <div className={styles.box}>
      <p className={styles.title}>{t('league.minimum.title')}</p>
      {bars.map((bar) => (
        <div key={bar.key} className={styles.row}>
          <span className={styles.name}>{t(`league.minimum.${bar.key}`)}</span>
          <span className={styles.track} aria-hidden="true">
            <span
              className={bar.done >= bar.goal ? styles.full : undefined}
              style={{ width: `${Math.min(100, (bar.done / bar.goal) * 100)}%` }}
            />
          </span>
          <span className={styles.count}>
            {fmt(Math.min(bar.done, bar.goal))}/{fmt(bar.goal)}
          </span>
        </div>
      ))}
      <p className={styles.left}>{left}</p>
    </div>
  )
}
