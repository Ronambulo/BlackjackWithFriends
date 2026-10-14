'use client'

import { useQuery } from '@tanstack/react-query'
import { useEffect, useRef, useState, type PointerEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { useUser } from '@/auth/session-context'
import { currentLanguage } from '@/i18n'
import { api } from '@/lib/api'
import { formatNumber } from '@/lib/format'
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

function compact(value: number) {
  return new Intl.NumberFormat(currentLanguage(), { notation: 'compact', maximumFractionDigits: 1 }).format(value)
}

/** Everyone's balance over the week, one line each, Monday to Sunday. */
export function WeekChart({ groupId, ranking }: { groupId: string; ranking: RankedMember[] }) {
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
  const series = [...(data?.series ?? [])].sort((a, b) => order(b.userId) - order(a.userId))

  const plot = Math.max(0, width - GUTTER)
  const values = series.flatMap((line) => line.points.map(([, value]) => value)).concat(series.length ? [] : [START])
  const high = Math.max(...values)
  const low = Math.min(...values)
  const pad = (high - low) * 0.1 || 200
  const top = high + pad
  // Not down to the edge, so a line at 0 still shows.
  const bottom = low - pad
  const x = (at: number) => (data ? ((at - data.from) / (data.to - data.from)) * plot : 0)
  const y = (value: number) => TOP + ((top - value) / (top - bottom || 1)) * (HEIGHT - TOP - BOTTOM)

  const day = data ? (data.to - data.from) / 7 : 0
  const weekdays = new Intl.DateTimeFormat(language, { weekday: 'narrow' })
  const timeFormat = new Intl.DateTimeFormat(language, { weekday: 'short', hour: '2-digit', minute: '2-digit' })

  const at = cursor ?? data?.now ?? 0
  const legend = series
    .map((line) => ({ ...line, balance: balanceAt(line.points, at) }))
    .sort((a, b) => b.balance - a.balance)
  const average = legend.length ? Math.round(legend.reduce((sum, line) => sum + line.balance, 0) / legend.length) : START

  const onPointer = (event: PointerEvent<SVGSVGElement>) => {
    if (!data || plot === 0) return
    const left = event.currentTarget.getBoundingClientRect().left
    const time = data.from + ((event.clientX - left) / plot) * (data.to - data.from)
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
            {Array.from({ length: 7 }, (_, i) => (
              <g key={i}>
                {i % 2 === 0 && <rect x={i * (plot / 7)} y={0} width={plot / 7} height={HEIGHT - BOTTOM + 4} className={styles.band} />}
                <text x={(i + 0.5) * (plot / 7)} y={HEIGHT - 6} className={styles.day}>
                  {weekdays.format(new Date(data.from + (i + 0.5) * day))}
                </text>
              </g>
            ))}

            {/* The group's average at the moment in view */}
            <line x1={0} x2={plot} y1={y(average)} y2={y(average)} className={styles.average} />
            {[high, average, low]
              .filter((value, i, all) => all.indexOf(value) === i)
              .filter((value) => value === average || Math.abs(y(value) - y(average)) > 12)
              .map((value) => (
                <text key={value} x={plot + 6} y={y(value) + 4} className={`${styles.tick} ${value === average ? styles.averageTick : ''}`}>
                  {compact(value)}
                </text>
              ))}

            {series.map((line) => {
              // Steps, not slopes: the balance only moves when a hand ends or the pay comes in.
              const d = line.points
                .map(([time, value], i) => (i === 0 ? `M${x(time)},${y(value)}` : `H${x(time)}V${y(value)}`))
                .join('')
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

      <ul className={styles.legend}>
        {legend.map((line) => (
          <li key={line.userId}>
            <span className={styles.swatch} style={{ background: color(line.userId) }} aria-hidden="true" />
            <span className={styles.name}>{line.userId === me.id ? t('ranking.you') : line.nombre}</span>
            <b>{formatNumber(line.balance, language)}</b>
          </li>
        ))}
      </ul>
    </div>
  )
}
