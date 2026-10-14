'use client'

import Link from 'next/link'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { currentLanguage } from '@/i18n'
import { formatNumber } from '@/lib/format'
import { CardsIcon } from '@/ui/icons'
import { useStats, type Stats } from './useStats'
import styles from './Stats.module.css'

type Range = 'week' | 'total'

// As many hands as the server sends back (routes/stats.ts).
const SLOTS = 30

function signed(value: number) {
  const number = formatNumber(Math.abs(value), currentLanguage())
  return value > 0 ? `+${number}` : value < 0 ? `−${number}` : number
}

function percent(part: number, whole: number) {
  return whole ? Math.round((part / whole) * 100) : 0
}

/** Won, pushed and lost as one bar, with the shares underneath. */
function Outcomes({ stats }: { stats: Stats }) {
  const { t } = useTranslation()
  const parts = [
    { key: 'wins', count: stats.wins, className: styles.win },
    { key: 'pushes', count: stats.pushes, className: styles.push },
    { key: 'losses', count: stats.losses, className: styles.loss },
  ] as const
  return (
    <>
      <div className={styles.bar} aria-hidden="true">
        {stats.hands === 0 ? (
          <span className={styles.push} style={{ flex: 1 }} />
        ) : (
          parts.map((part) => part.count > 0 && <span key={part.key} className={part.className} style={{ flex: part.count }} />)
        )}
      </div>
      <ul className={styles.legend}>
        {parts.map((part) => (
          <li key={part.key}>
            <span className={`${styles.dot} ${part.className}`} aria-hidden="true" />
            <b>{percent(part.count, stats.hands)}%</b>
            <span>{t(`stats.${part.key}`, { count: part.count })}</span>
          </li>
        ))}
      </ul>
    </>
  )
}

/** The last hands as bars above (won) or below (lost) a middle line. */
function Recent({ nets }: { nets: number[] }) {
  const max = Math.max(1, ...nets.map(Math.abs))
  const slot = 10
  // Room for a full row from the start, so a few hands aren't drawn as fat bars.
  const offset = Math.max(0, SLOTS - nets.length)
  const width = (offset + nets.length) * slot
  return (
    <svg className={styles.chart} viewBox={`0 0 ${width} 80`} preserveAspectRatio="none" aria-hidden="true">
      <line x1="0" x2={width} y1="40" y2="40" className={styles.axis} />
      {nets.map((net, i) => {
        // Even a tiny result gets a visible bar; a push is just a notch.
        const height = net === 0 ? 2 : Math.max(4, (Math.abs(net) / max) * 38)
        return (
          <rect
            key={i}
            x={(offset + i) * slot + 2}
            y={net > 0 ? 40 - height : net < 0 ? 40 : 39}
            width={slot - 4}
            height={height}
            rx="1.5"
            className={net > 0 ? styles.win : net < 0 ? styles.loss : styles.push}
          />
        )
      })}
    </svg>
  )
}

export function StatsPanel() {
  const { t } = useTranslation()
  const { data, isError, refetch } = useStats()
  const [range, setRange] = useState<Range>('week')
  const language = currentLanguage()

  if (isError) {
    return (
      <section className="card">
        <p className="muted">{t('common.error')}</p>
        <button className="btn btn-secondary" onClick={() => void refetch()}>
          {t('common.retry')}
        </button>
      </section>
    )
  }
  if (!data) {
    return <section className={`card ${styles.placeholder}`} aria-busy="true" />
  }

  if (data.total.hands === 0) {
    return (
      <section className={`card ${styles.empty}`}>
        <CardsIcon width={28} height={28} />
        <p className="muted">{t('stats.empty')}</p>
        <Link className="btn btn-primary" href="/jugar">
          {t('stats.play')}
        </Link>
      </section>
    )
  }

  const stats = data[range]
  const tiles = [
    { label: t('stats.hands'), value: formatNumber(stats.hands, language) },
    { label: t('stats.blackjacks'), value: formatNumber(stats.blackjacks, language) },
    { label: t('stats.bestWin'), value: stats.bestWin > 0 ? signed(stats.bestWin) : '—' },
    { label: t('stats.bestStreak'), value: formatNumber(stats.bestStreak, language) },
  ]

  return (
    <section className={styles.panel} aria-label={t('profile.stats')}>
      <div className="segmented" role="group" aria-label={t('profile.stats')}>
        {(['week', 'total'] as const).map((key) => (
          <button key={key} type="button" aria-pressed={range === key} onClick={() => setRange(key)}>
            {t(`stats.${key}`)}
          </button>
        ))}
      </div>

      <div className={`card ${styles.summary}`}>
        <span className="label">{t('stats.result')}</span>
        <p className={`${styles.net} ${stats.net > 0 ? styles.up : stats.net < 0 ? styles.down : ''}`}>{signed(stats.net)}</p>
        <p className="muted">
          {stats.hands === 0
            ? t('stats.noneThisWeek')
            : t('stats.wagered', { count: stats.hands, amount: formatNumber(stats.wagered, language) })}
        </p>
        <Outcomes stats={stats} />
      </div>

      <div className={`card ${styles.tiles}`}>
        {/* Since the first hand, whichever range is in view. */}
        <div className={`${styles.tile} ${styles.wide}`}>
          <span className={`${styles.tileValue} ${data.total.net > 0 ? styles.up : data.total.net < 0 ? styles.down : ''}`}>
            {signed(data.total.net)}
          </span>
          <span className={styles.tileLabel}>{t('stats.globalNet', { count: data.total.hands })}</span>
        </div>
        {tiles.map((tile) => (
          <div key={tile.label} className={styles.tile}>
            <span className={styles.tileValue}>{tile.value}</span>
            <span className={styles.tileLabel}>{tile.label}</span>
          </div>
        ))}
      </div>

      {data.recent.length > 0 && (
        <div className={`card ${styles.recent}`}>
          <div className={styles.recentHead}>
            <span className="label">{t('stats.recent', { count: data.recent.length })}</span>
            {data.total.streak >= 2 && <span className={styles.streak}>{t('stats.streak', { count: data.total.streak })}</span>}
          </div>
          <Recent nets={data.recent} />
        </div>
      )}
    </section>
  )
}
