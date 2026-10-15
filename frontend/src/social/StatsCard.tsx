'use client'

import { useTranslation } from 'react-i18next'
import { currentLanguage } from '@/i18n'
import { formatNumber } from '@/lib/format'
import type { SharedStats } from './useChat'
import styles from './Chat.module.css'

/** Published stats: the result, won / pushed / lost as one bar, and the records. */
export function StatsCard({ stats }: { stats: SharedStats }) {
  const { t } = useTranslation()
  const lang = currentLanguage()
  const tone = stats.net > 0 ? styles.win : stats.net < 0 ? styles.lose : styles.push
  const signed = (value: number) =>
    value === 0 ? '±0' : `${value > 0 ? '+' : '−'}${formatNumber(Math.abs(value), lang)}`
  const parts = [
    { key: 'wins', count: stats.wins, className: styles.statsWin },
    { key: 'pushes', count: stats.pushes, className: styles.statsPush },
    { key: 'losses', count: stats.losses, className: styles.statsLoss },
  ] as const
  const tiles = [
    { label: t('stats.hands'), value: formatNumber(stats.hands, lang) },
    { label: t('stats.blackjacks'), value: formatNumber(stats.blackjacks, lang) },
    { label: t('stats.bestWin'), value: stats.bestWin > 0 ? signed(stats.bestWin) : '—' },
    { label: t('stats.bestStreak'), value: formatNumber(stats.bestStreak, lang) },
  ]

  return (
    <div className={styles.statsCard}>
      <span className={styles.statsRange}>{t(`stats.story.${stats.range}`)}</span>
      <span className={`${styles.statsNet} ${tone}`}>{signed(stats.net)}</span>
      <span className={styles.statsWagered}>
        {t('stats.wagered', { count: stats.hands, amount: formatNumber(stats.wagered, lang) })}
      </span>

      <div className={styles.statsBar} aria-hidden="true">
        {parts.map((part) => part.count > 0 && <span key={part.key} className={part.className} style={{ flex: part.count }} />)}
      </div>
      <ul className={styles.statsLegend}>
        {parts.map((part) => (
          <li key={part.key}>
            <span className={`${styles.statsDot} ${part.className}`} aria-hidden="true" />
            <b>{formatNumber(part.count, lang)}</b> {t(`stats.${part.key}`, { count: part.count })}
          </li>
        ))}
      </ul>

      <dl className={styles.statsTiles}>
        {tiles.map((tile) => (
          <div key={tile.label}>
            <dt>{tile.label}</dt>
            <dd>{tile.value}</dd>
          </div>
        ))}
      </dl>
    </div>
  )
}
