'use client'

import { useId, useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { currentLanguage } from '@/i18n'
import { formatNumber } from '@/lib/format'
import { percent, signed } from './numbers'
import { Recent, type Range } from './StatsPanel'
import { STANDS, useStats, useStatsDetail, type Detail, type Tally } from './useStats'
import base from './Stats.module.css'
import styles from './StatsDetail.module.css'

const tone = (value: number) => (value > 0 ? base.up : value < 0 ? base.down : '')

/** The balance hand after hand as a line, shaded green over zero and red under it. */
function Curve({ points }: { points: number[] }) {
  const id = useId()
  const width = 300
  const height = 120
  const top = Math.max(0, ...points)
  const bottom = Math.min(0, ...points)
  const span = top - bottom || 1
  const x = (i: number) => (i / Math.max(1, points.length - 1)) * width
  const y = (v: number) => 6 + ((top - v) / span) * (height - 12)
  const line = points.map((v, i) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ')
  const zero = y(0)
  const area = `0,${zero} ${line} ${width},${zero}`
  const last = points[points.length - 1] ?? 0
  return (
    <svg className={styles.curve} viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" aria-hidden="true">
      <defs>
        <clipPath id={`${id}up`}>
          <rect x="0" y="0" width={width} height={zero} />
        </clipPath>
        <clipPath id={`${id}down`}>
          <rect x="0" y={zero} width={width} height={height - zero} />
        </clipPath>
      </defs>
      <line x1="0" x2={width} y1={zero} y2={zero} className={base.axis} />
      <polygon points={area} className={styles.areaUp} clipPath={`url(#${id}up)`} />
      <polygon points={area} className={styles.areaDown} clipPath={`url(#${id}down)`} />
      <polyline points={line} className={last >= 0 ? styles.lineUp : styles.lineDown} />
    </svg>
  )
}

/** One number with its name, and a line under the name when it needs one. */
function Row({ label, value, sub, className = '' }: { label: string; value: string; sub?: string; className?: string }) {
  return (
    <li className={styles.row}>
      <span className={styles.rowLabel}>
        {label}
        {sub && <small className="muted">{sub}</small>}
      </span>
      <b className={className}>{value}</b>
    </li>
  )
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className={`card ${styles.section}`}>
      <span className="label">{title}</span>
      <ul className={styles.rows}>{children}</ul>
    </div>
  )
}

function Sections({ detail }: { detail: Detail }) {
  const { t } = useTranslation()
  const lang = currentLanguage()
  const n = (value: number) => formatNumber(value, lang)
  const tally = (move: Tally, key: 'won' | 'paid') =>
    move.count ? t(`stats.detail.${key}`, { percent: percent(move.won, move.count) }) : undefined

  return (
    <>
      <Section title={t('stats.detail.betting')}>
        <Row label={t('stats.detail.avgBet')} value={n(detail.avgBet)} />
        <Row label={t('stats.detail.maxBet')} value={n(detail.maxBet)} />
        <Row
          label={t('stats.detail.worstHand')}
          value={detail.worstHand < 0 ? signed(detail.worstHand) : '—'}
          className={tone(detail.worstHand)}
        />
        <Row
          label={t('stats.detail.roi')}
          sub={t('stats.detail.roiHint')}
          value={`${detail.roi > 0 ? '+' : ''}${detail.roi.toLocaleString(lang)}%`}
          className={tone(detail.roi)}
        />
        <Row label={t('stats.detail.worstStreak')} value={n(detail.worstStreak)} />
      </Section>

      <Section title={t('stats.detail.moves')}>
        <Row label={t('stats.detail.doubles')} value={n(detail.doubles.count)} sub={tally(detail.doubles, 'won')} />
        <Row label={t('stats.detail.splits')} value={n(detail.splits.count)} sub={tally(detail.splits, 'won')} />
        <Row label={t('stats.detail.insurance')} value={n(detail.insurance.count)} sub={tally(detail.insurance, 'paid')} />
        <Row label={t('stats.detail.surrenders')} value={n(detail.surrenders)} />
        <Row
          label={t('stats.detail.busts')}
          value={`${percent(detail.playerBusts, detail.playerHands)}%`}
          sub={t('stats.detail.ofHands', { count: detail.playerHands, done: n(detail.playerBusts) })}
        />
      </Section>

      <Section title={t('stats.detail.dealer')}>
        <Row
          label={t('stats.detail.dealerBusts')}
          value={`${percent(detail.dealerBusts, detail.dealerPlayed)}%`}
          sub={t('stats.detail.ofPlayed', { count: detail.dealerPlayed, done: n(detail.dealerBusts) })}
        />
        <Row
          label={t('stats.detail.dealerBlackjacks')}
          value={`${percent(detail.dealerBlackjacks, detail.rounds)}%`}
          sub={t('stats.detail.ofRounds', { count: detail.rounds, done: n(detail.dealerBlackjacks) })}
        />
      </Section>

      <div className={`card ${styles.section}`}>
        <span className="label">{t('stats.detail.stands')}</span>
        <small className="muted">{t('stats.detail.standsHint')}</small>
        <ul className={styles.stands}>
          {STANDS.map((key) => {
            const stand = detail.stands[key]
            const share = percent(stand.won, stand.count)
            return (
              <li key={key}>
                <b>{key === '16' ? '≤16' : key}</b>
                <span className={styles.track} aria-hidden="true">
                  <span style={{ width: `${share}%` }} />
                </span>
                <span className={styles.share}>{stand.count ? `${share}%` : '—'}</span>
                <small className="muted">{n(stand.count)}</small>
              </li>
            )
          })}
        </ul>
      </div>
    </>
  )
}

/** Everything past the profile's result card; opened from its statistics link. */
export function StatsDetail() {
  const { t } = useTranslation()
  const lang = currentLanguage()
  const stats = useStats()
  const detail = useStatsDetail()
  const [range, setRange] = useState<Range>('week')

  if (stats.isError || detail.isError) {
    return (
      <section className="card">
        <p className="muted">{t('common.error')}</p>
        <button
          className="btn btn-secondary"
          onClick={() => {
            void stats.refetch()
            void detail.refetch()
          }}
        >
          {t('common.retry')}
        </button>
      </section>
    )
  }
  if (!stats.data || !detail.data) return <section className={`card ${base.placeholder}`} aria-busy="true" />
  if (stats.data.total.hands === 0) return <p className="muted">{t('stats.empty')}</p>

  const data = stats.data
  // Until there are hands from an earlier week, both ranges are the same numbers.
  const pastWeeks = data.total.hands > data.week.hands
  const shown = pastWeeks ? range : 'week'
  const current = data[shown]
  const more = detail.data[shown]
  const tiles = [
    { label: t('stats.hands'), value: formatNumber(current.hands, lang) },
    { label: t('stats.blackjacks'), value: formatNumber(current.blackjacks, lang) },
    { label: t('stats.bestWin'), value: current.bestWin > 0 ? signed(current.bestWin) : '—' },
    { label: t('stats.bestStreak'), value: formatNumber(current.bestStreak, lang) },
  ]

  return (
    <section className={base.panel}>
      {pastWeeks && (
        <div className="segmented" role="group" aria-label={t('profile.stats')}>
          {(['week', 'total'] as const).map((key) => (
            <button key={key} type="button" aria-pressed={range === key} onClick={() => setRange(key)}>
              {t(`stats.${key}`)}
            </button>
          ))}
        </div>
      )}

      <div className={`card ${base.tiles}`}>
        <div className={`${base.tile} ${base.wide}`}>
          <span className={`${base.tileValue} ${tone(current.net)}`}>{signed(current.net)}</span>
          <span className={base.tileLabel}>
            {shown === 'week'
              ? t('stats.detail.weekNet', { count: current.hands, n: formatNumber(current.hands, lang) })
              : t('stats.globalNet', { count: current.hands })}
          </span>
        </div>
        {tiles.map((tile) => (
          <div key={tile.label} className={base.tile}>
            <span className={base.tileValue}>{tile.value}</span>
            <span className={base.tileLabel}>{tile.label}</span>
          </div>
        ))}
      </div>

      {more.curve.length > 2 && (
        <div className={`card ${base.recent}`}>
          <div className={base.recentHead}>
            <span className="label">{t('stats.detail.balance')}</span>
            <b className={tone(current.net)}>{signed(current.net)}</b>
          </div>
          <Curve points={more.curve} />
        </div>
      )}

      {data.recent.length > 0 && (
        <div className={`card ${base.recent}`}>
          <div className={base.recentHead}>
            <span className="label">{t('stats.recent', { count: data.recent.length })}</span>
            {data.total.streak >= 2 && <span className={base.streak}>{t('stats.streak', { count: data.total.streak })}</span>}
          </div>
          <Recent nets={data.recent} />
        </div>
      )}

      {more.rounds > 0 ? <Sections detail={more} /> : <p className="muted">{t('stats.noneThisWeek')}</p>}
    </section>
  )
}
