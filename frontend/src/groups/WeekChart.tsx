'use client'

import { useQuery } from '@tanstack/react-query'
import { useEffect, useRef, useState, type CSSProperties, type PointerEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { useUser } from '@/auth/session-context'
import { currentLanguage } from '@/i18n'
import { api } from '@/lib/api'
import { formatNumber } from '@/lib/format'
import { Avatar } from '@/ui/Avatar'
import { GroupIcon } from '@/ui/icons'
import type { RankedMember } from './useGroups'
import styles from './WeekChart.module.css'

/** GET /api/group/history?id=: each member's balance this week, as [ms, balance] points. */
interface History {
  from: number
  to: number
  now: number
  series: { userId: string; nombre: string; points: [number, number][] }[]
}

// One per place in the ranking; the rest share the last one.
const COLORS = ['#f2c14e', '#7dd3fc', '#c4b5fd', '#fdba74', '#86efac', '#fda4af', '#5eead4', '#f0abfc']
const REST = '#6b7280'
const START = 1000
const HEIGHT = 190
const TOP = 10
const BOTTOM = 24
// Room on the right for the balance labels.
const GUTTER = 44

/** Under the prefix of the group's own query, so whatever refreshes the ranking refreshes this too. */
function useGroupHistory(id: string) {
  const user = useUser()
  return useQuery({
    queryKey: ['group', user.id, id, 'history'],
    queryFn: () => api<History>(`/group/history?id=${encodeURIComponent(id)}`),
  })
}

/** The balance at `at`: it stays put between changes. */
function balanceAt(points: [number, number][], at: number) {
  let balance = points[0]?.[1] ?? START
  for (const [time, value] of points) {
    if (time > at) break
    balance = value
  }
  return balance
}

/**
 * The week's time axis isn't linear: every stretch between two changes gets a width that
 * grows with the square root of how long it lasted. A burst of hands in half an hour
 * spreads out, and a quiet night shrinks to a sliver.
 */
interface Warp {
  times: number[]
  /** Where each of `times` falls, from 0 to 1. */
  at: number[]
}

// The rest of the week, still to be played, takes less room than time that has passed.
const FUTURE_WEIGHT = 0.5

function buildWarp(from: number, to: number, now: number, changes: number[]): Warp {
  const times = [...new Set([from, ...changes.filter((time) => time > from && time < now), now, to])].sort((a, b) => a - b)
  const widths = times.slice(1).map((time, i) => Math.sqrt(time - times[i]) * (times[i] >= now ? FUTURE_WEIGHT : 1))
  const total = widths.reduce((sum, width) => sum + width, 0) || 1
  const at = [0]
  for (const width of widths) at.push(at[at.length - 1] + width / total)
  return { times, at }
}

/** Linear between the two neighbouring stops of a piecewise map. */
function interpolate(xs: number[], ys: number[], value: number) {
  if (value <= xs[0]) return ys[0]
  for (let i = 1; i < xs.length; i++) {
    if (value <= xs[i]) {
      const span = xs[i] - xs[i - 1]
      return ys[i - 1] + (span ? ((value - xs[i - 1]) / span) * (ys[i] - ys[i - 1]) : 0)
    }
  }
  return ys[ys.length - 1]
}

function compact(value: number) {
  return new Intl.NumberFormat(currentLanguage(), { notation: 'compact', maximumFractionDigits: 1 }).format(value)
}

/**
 * Everyone's balance over the week, one line each, Monday to Sunday. Those in `picked` are
 * drawn in colour and set the scale; the rest stay as faint lines. With nobody picked,
 * everyone is in colour.
 */
export function WeekChart({
  groupId,
  ranking,
  picked,
  onPick,
  onShowAll,
}: {
  groupId: string
  ranking: RankedMember[]
  picked: string[]
  onPick: (userId: string) => void
  onShowAll: () => void
}) {
  const { t } = useTranslation()
  const me = useUser()
  const { data } = useGroupHistory(groupId)
  const box = useRef<HTMLDivElement>(null)
  const [width, setWidth] = useState(0)
  // The moment being looked at, while a finger or the mouse is on the chart.
  const [cursor, setCursor] = useState<number | null>(null)
  const language = currentLanguage()

  useEffect(() => {
    const element = box.current
    if (!element) return
    setWidth(element.clientWidth)
    const observer = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width))
    observer.observe(element)
    return () => observer.disconnect()
  }, [])

  const place = new Map(ranking.map((member, i) => [member.userId, i]))
  const color = (userId: string) => COLORS[place.get(userId) ?? COLORS.length] ?? REST
  // Drawn last to first, with the player's own line on top.
  const order = (userId: string) => (userId === me.id ? -1 : (place.get(userId) ?? ranking.length))
  const everyone = [...(data?.series ?? [])].sort((a, b) => order(b.userId) - order(a.userId))
  const shown = everyone.filter((line) => picked.includes(line.userId))
  // Those picked, or everyone if nobody is (or the picked ones haven't played yet).
  const series = shown.length ? shown : everyone
  const faint = shown.length ? everyone.filter((line) => !picked.includes(line.userId)) : []
  const member = new Map(ranking.map((m) => [m.userId, m]))

  const plot = Math.max(0, width - GUTTER)
  // Everyone sets the scale, so the faint lines fit too.
  const values = everyone.flatMap((line) => line.points.map(([, value]) => value)).concat(everyone.length ? [] : [START])
  const high = Math.max(...values)
  const low = Math.min(...values)
  const pad = (high - low) * 0.1 || 200
  const top = high + pad
  // Not down to the edge, so a line at 0 still shows.
  const bottom = low - pad
  const warp = data
    ? buildWarp(data.from, data.to, data.now, series.flatMap((line) => line.points.slice(1, -1).map(([time]) => time)))
    : null
  const x = (at: number) => (warp ? interpolate(warp.times, warp.at, at) * plot : 0)
  const y = (value: number) => TOP + ((top - value) / (top - bottom || 1)) * (HEIGHT - TOP - BOTTOM)

  const day = data ? (data.to - data.from) / 7 : 0
  const weekdays = new Intl.DateTimeFormat(language, { weekday: 'narrow' })
  const timeFormat = new Intl.DateTimeFormat(language, { weekday: 'short', hour: '2-digit', minute: '2-digit' })

  const at = cursor ?? data?.now ?? 0
  const legend = everyone
    .map((line) => ({ ...line, balance: balanceAt(line.points, at) }))
    .sort((a, b) => b.balance - a.balance)
  const average = legend.length ? Math.round(legend.reduce((sum, line) => sum + line.balance, 0) / legend.length) : START
  // With one person picked, the dashed line is their balance instead of the group's average.
  const marked = shown.length === 1 ? (legend.find((line) => line.userId === shown[0].userId)?.balance ?? START) : average

  // Steps, not slopes: the balance only moves when a hand ends or the pay comes in.
  const stepPath = (points: [number, number][]) =>
    points.map(([time, value], i) => (i === 0 ? `M${x(time)},${y(value)}` : `H${x(time)}V${y(value)}`)).join('')

  const onPointer = (event: PointerEvent<SVGSVGElement>) => {
    if (!data || !warp || plot === 0) return
    const left = event.currentTarget.getBoundingClientRect().left
    const time = interpolate(warp.at, warp.times, (event.clientX - left) / plot)
    setCursor(Math.min(data.now, Math.max(data.from, time)))
  }

  return (
    <div className={`card ${styles.card}`}>
      <div className={styles.head}>
        <span className="label">{t('ranking.chartTitle')}</span>
        <span className={styles.when}>{cursor === null ? t('ranking.now') : timeFormat.format(cursor)}</span>
      </div>

      <div ref={box} className={styles.box}>
        {data && plot > 0 && (
          <svg
            className={styles.chart}
            width={width}
            height={HEIGHT}
            role="img"
            aria-label={t('ranking.chartLabel')}
            onPointerDown={onPointer}
            onPointerMove={onPointer}
            onPointerLeave={() => setCursor(null)}
            onPointerCancel={() => setCursor(null)}
          >
            {/* The days keep their order but not their width: a busy one takes more room. */}
            {Array.from({ length: 7 }, (_, i) => {
              const start = x(data.from + i * day)
              const end = x(data.from + (i + 1) * day)
              return (
                <g key={i}>
                  {i % 2 === 0 && <rect x={start} y={0} width={end - start} height={HEIGHT - BOTTOM + 4} className={styles.band} />}
                  {end - start >= 9 && (
                    <text x={(start + end) / 2} y={HEIGHT - 6} className={styles.day}>
                      {weekdays.format(new Date(data.from + (i + 0.5) * day))}
                    </text>
                  )}
                </g>
              )
            })}

            <line x1={0} x2={plot} y1={y(marked)} y2={y(marked)} className={styles.average} />
            {[high, marked, low]
              .filter((value, i, all) => all.indexOf(value) === i)
              .filter((value) => value === marked || Math.abs(y(value) - y(marked)) > 12)
              .map((value) => (
                <text key={value} x={plot + 6} y={y(value) + 4} className={`${styles.tick} ${value === marked ? styles.averageTick : ''}`}>
                  {compact(value)}
                </text>
              ))}

            {faint.map((line) => (
              <path key={line.userId} d={stepPath(line.points)} className={styles.faint} />
            ))}

            {series.map((line) => {
              const d = stepPath(line.points)
              const last = line.points[line.points.length - 1]
              const mine = line.userId === me.id
              return (
                <g key={line.userId} style={{ color: color(line.userId) }}>
                  <path d={d} className={`${styles.line} ${mine ? styles.mine : ''}`} />
                  {cursor === null && <circle cx={x(last[0])} cy={y(last[1])} r={mine ? 4 : 3} className={styles.dot} />}
                </g>
              )
            })}

            {cursor !== null && (
              <>
                <line x1={x(cursor)} x2={x(cursor)} y1={0} y2={HEIGHT - BOTTOM + 4} className={styles.cursor} />
                {series.map((line) => (
                  <circle
                    key={line.userId}
                    cx={x(cursor)}
                    cy={y(balanceAt(line.points, cursor))}
                    r={3.5}
                    className={styles.dot}
                    style={{ color: color(line.userId) }}
                  />
                ))}
              </>
            )}
          </svg>
        )}
      </div>

      {/* Tapping someone adds their line or takes it off. */}
      <ul className={styles.legend} aria-label={t('ranking.chartPick')}>
        {legend.map((line) => {
          const on = shown.some((s) => s.userId === line.userId)
          const who = member.get(line.userId)
          return (
            <li key={line.userId}>
              <button
                type="button"
                className={`${styles.person} ${shown.length && !on ? styles.faded : ''}`}
                style={{ '--swatch': color(line.userId) } as CSSProperties}
                aria-pressed={on}
                onClick={() => onPick(line.userId)}
              >
                <Avatar seed={line.userId} name={line.nombre} src={who?.avatarUrl} size={24} className={styles.chipAvatar} />
                <span className={styles.name}>{line.userId === me.id ? t('ranking.you') : line.nombre}</span>
                <b>{formatNumber(line.balance, language)}</b>
              </button>
            </li>
          )
        })}
      </ul>
      <div className={styles.foot}>
        <span className={styles.hint}>{t('ranking.chartHint')}</span>
        {shown.length > 0 && shown.length < everyone.length && (
          <button type="button" className={styles.showAll} onClick={onShowAll}>
            <GroupIcon width={16} height={16} aria-hidden="true" />
            {t('ranking.showAll')}
          </button>
        )}
      </div>
    </div>
  )
}
