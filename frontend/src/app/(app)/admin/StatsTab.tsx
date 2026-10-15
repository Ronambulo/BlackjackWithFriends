'use client'

import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useAdminStats, useModeration, type AdminStats } from '@/admin/useAdmin'
import { ago, delta, duration, number, percent } from '@/admin/format'
import { currentLanguage } from '@/i18n'
import { formatNumber } from '@/lib/format'
import { Avatar } from '@/ui/Avatar'
import styles from './admin.module.css'
import { flagText, flagTitle } from './ModerationTab'

type TopKey = keyof AdminStats['tops']
type Metric = 'players' | 'hands' | 'signups' | 'minutes'

const TOPS: TopKey[] = ['week', 'allTime', 'coins', 'hands', 'wagered']
const METRICS: Metric[] = ['players', 'hands', 'signups', 'minutes']

/** Columns for one number per day, scaled to the busiest; the last seven in gold. */
function Bars({ values, labels }: { values: number[]; labels: string[] }) {
  const max = Math.max(1, ...values)
  return (
    <div className={styles.bars}>
      {values.map((value, i) => (
        <div key={i} className={styles.barSlot} title={`${labels[i]}: ${value}`}>
          <span className={styles.barValue}>{value || ''}</span>
          <span
            className={`${styles.bar} ${i < values.length - 7 ? styles.barOld : ''}`}
            style={{ height: `${(value / max) * 100}%` }}
          />
          <span className={styles.barLabel}>{labels[i]}</span>
        </div>
      ))}
    </div>
  )
}

function Kpi({ label, value, change }: { label: string; value: string; change?: { text: string; up: boolean | null } }) {
  return (
    <div className={styles.tile}>
      <span className={styles.tileLabel}>{label}</span>
      <span className={styles.tileValue}>{value}</span>
      {change && (
        <span className={change.up === null ? styles.flat : change.up ? styles.up : styles.down}>{change.text}</span>
      )}
    </div>
  )
}

function countdown(ms: number) {
  const hours = Math.max(0, Math.floor(ms / 3_600_000))
  return hours >= 24 ? `${Math.floor(hours / 24)} d ${hours % 24} h` : `${hours} h`
}

export function StatsTab({ onSeeAll }: { onSeeAll: () => void }) {
  const { t } = useTranslation()
  const { data, isError, refetch } = useAdminStats()
  const [top, setTop] = useState<TopKey>('week')
  const [metric, setMetric] = useState<Metric>('players')
  const { data: moderation } = useModeration()

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
  if (!data) return <section className={`card ${styles.placeholder}`} aria-busy="true" />

  const language = currentLanguage()
  const { current: now7, previous: before7 } = data.weeks
  const weekday = new Intl.DateTimeFormat(language, { weekday: 'narrow' })
  const days = data.activity.map((day) => weekday.format(new Date(`${day.day}T12:00:00`)))
  const betTotal = data.bets.reduce((sum, bucket) => sum + bucket.hands, 0)
  const perPlayer = (w: AdminStats['weeks']['current']) => (w.players ? w.playMs / w.players : 0)
  const minutes = (value: number) => duration(value)

  const kpis = [
    { label: t('admin.users'), value: number(data.users), change: delta(now7.signups, before7.signups, number) },
    { label: t('admin.active7'), value: number(now7.players), change: delta(now7.players, before7.players) },
    { label: t('admin.hands7'), value: number(now7.hands), change: delta(now7.hands, before7.hands) },
    { label: t('admin.playTimePerPlayer'), value: duration(perPlayer(now7)), change: delta(perPlayer(now7), perPlayer(before7), minutes) },
    {
      label: t('admin.returning'),
      value: percent(now7.returning),
      change: delta(now7.returning ?? 0, before7.returning ?? 0, (v) => percent(v)),
    },
    { label: t('admin.houseEdge'), value: percent(now7.houseEdge, 1), change: delta(now7.houseEdge ?? 0, before7.houseEdge ?? 0, (v) => percent(v, 1)) },
  ]

  // This week against the one before, for the bars' caption.
  const half = (key: Metric, from: number) => data.activity.slice(from, from + 7).reduce((sum, day) => sum + day[key], 0) / 7
  const funnel = [
    ['signedUp', data.funnel.signedUp],
    ['played', data.funnel.played],
    ['inAGroup', data.funnel.inAGroup],
    ['nextDay', data.funnel.nextDay],
    ['regulars', data.funnel.regulars],
  ] as const
  const alerts = [
    ...(moderation?.flags ?? []).map((flag, i) => ({ key: `f${i}`, level: flag.level, title: flagTitle(t, flag), text: flagText(t, flag) })),
    ...data.sharedIps.map((entry) => ({ key: entry.ip, level: 'mid' as const, title: t('admin.sharedIp', { count: entry.accounts }), text: entry.ip })),
  ].slice(0, 3)
  const heatMax = Math.max(1, ...data.heatmap.flat())
  const dayNames = Array.from({ length: 7 }, (_, i) =>
    new Intl.DateTimeFormat(language, { weekday: 'short' }).format(new Date(Date.UTC(2024, 0, 1 + i, 12))),
  )

  return (
    <>
      <div className={styles.live}>
        <span className={styles.liveDot} data-on={data.live.players > 0} />
        <b>{t('admin.liveNow', { count: data.live.players })}</b>
        <span>{t('admin.liveOpen', { count: data.live.open })}</span>
        <span>{t('admin.lastHand', { when: ago(data.live.lastHandAt, data.now) })}</span>
        <span className={styles.liveEnd}>{t('admin.closeIn', { time: countdown(data.weekEndsAt - data.now) })}</span>
      </div>

      <div className={`card ${styles.tiles}`}>
        {kpis.map((kpi) => (
          <Kpi key={kpi.label} {...kpi} />
        ))}
      </div>

      <section className={`card ${styles.block} ${styles.full}`}>
        <div className={styles.sectionHead}>
          <h2 className="label">{t('admin.activity')}</h2>
          <div className={`segmented ${styles.inlineSeg}`} role="group" aria-label={t('admin.activity')}>
          {METRICS.map((key) => (
            <button key={key} type="button" aria-pressed={metric === key} onClick={() => setMetric(key)}>
                {t(`admin.metric.${key}`)}
              </button>
            ))}
          </div>
        </div>
        <Bars values={data.activity.map((day) => day[metric])} labels={days} />
        <p className="muted">
          {t('admin.weekAverage', { now: number(half(metric, 7), 1), before: number(half(metric, 0), 1) })}
        </p>
      </section>

      <section className={`card ${styles.block}`}>
        <div className={styles.sectionHead}>
          <h2 className="label">{t('admin.attention')}</h2>
          <button type="button" className={styles.link} onClick={onSeeAll}>
            {t('admin.seeAllAlerts')}
          </button>
        </div>
        {alerts.length === 0 ? (
          <p className="muted">{t('admin.noFlags')}</p>
        ) : (
          <ul className={styles.alerts}>
            {alerts.map((alert) => (
              <li key={alert.key}>
                <span className={styles.alertDot} data-level={alert.level} />
                <span className={styles.userName}>
                  <b>{alert.title}</b>
                  <small className={styles.ellipsis}>{alert.text}</small>
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className={`card ${styles.block}`}>
        <h2 className="label">{t('admin.funnel')}</h2>
        <ul className={styles.stack}>
          {funnel.map(([key, value]) => {
            const share = data.funnel.signedUp ? value / data.funnel.signedUp : 0
            return (
              <li key={key}>
                <span className={styles.stackHead}>
                  <span>{t(`admin.funnelStep.${key}`)}</span>
                  <span>
                    <b>{number(value)}</b> <span className="muted">· {percent(share)}</span>
                  </span>
                </span>
                <span className={styles.meter}>
                  <span style={{ width: `${share * 100}%` }} />
                </span>
              </li>
            )
          })}
        </ul>
      </section>

      <section className={`card ${styles.block}`}>
        <h2 className="label">{t('admin.cohorts')}</h2>
        <div className={styles.scroll}>
          <table className={styles.cohorts}>
            <thead>
              <tr>
                <th scope="col">{t('admin.cohortWeek')}</th>
                {data.cohorts.map((_, k) => (
                  <th key={k} scope="col">
                    S{k}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.cohorts.map((row) => (
                <tr key={row.week}>
                  <th scope="row">
                    {new Intl.DateTimeFormat(language, { day: 'numeric', month: 'short' }).format(new Date(`${row.week}T12:00:00`))}
                    <small> · {row.size}</small>
                  </th>
                  {data.cohorts.map((_, k) => {
                    const value = row.weeks[k]
                    return (
                      <td
                        key={k}
                        style={value ? { background: `color-mix(in srgb, var(--accent) ${Math.round(value * 70)}%, transparent)` } : undefined}
                      >
                        {value === undefined || value === null ? '' : percent(value)}
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className={`card ${styles.block}`}>
        <h2 className="label">{t('admin.busyHours')}</h2>
        <div className={styles.scroll}>
          <div className={styles.heat}>
            {data.heatmap.map((row, day) => (
              <div key={day} className={styles.heatRow}>
                <span className={styles.heatDay}>{dayNames[day]}</span>
                {row.map((value, hour) => (
                  <span
                    key={hour}
                    className={styles.heatCell}
                    title={`${dayNames[day]} ${hour}:00 · ${value}`}
                    style={{ background: value ? `color-mix(in srgb, var(--accent) ${Math.round(12 + (value / heatMax) * 88)}%, transparent)` : undefined }}
                  />
                ))}
              </div>
            ))}
            <div className={styles.heatRow}>
              <span className={styles.heatDay} />
              {Array.from({ length: 24 }, (_, hour) => (
                <span key={hour} className={styles.heatHour}>
                  {hour % 6 === 0 ? hour : ''}
                </span>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className={`card ${styles.block}`}>
        <h2 className="label">{t('admin.busyGroups')}</h2>
        {data.busyGroups.every((group) => group.hands === 0) ? (
          <p className="muted">{t('admin.nobody')}</p>
        ) : (
          <ol className={styles.top}>
            {data.busyGroups
              .filter((group) => group.hands > 0)
              .map((group, i) => (
                <li key={group.id}>
                  <span className={styles.place}>{i + 1}</span>
                  <span className={styles.userName}>
                    <b className={styles.ellipsis}>{group.nombre}</b>
                    <small>{t('admin.members', { count: group.members })}</small>
                  </span>
                  <b>{t('admin.handsCount', { count: group.hands, n: number(group.hands) })}</b>
                </li>
              ))}
          </ol>
        )}
      </section>

      <section className={`card ${styles.block}`}>
        <h2 className="label">{t('admin.bets')}</h2>
        <ul className={styles.meters}>
          {data.bets.map((bucket) => (
            <li key={bucket.from}>
              <span className={styles.meterLabel}>
                {bucket.to === null ? `${number(bucket.from)}+` : `${number(bucket.from)}–${number(bucket.to)}`}
              </span>
              <span className={styles.meter}>
                <span style={{ width: `${betTotal ? (bucket.hands / betTotal) * 100 : 0}%` }} />
              </span>
              <b>{number(bucket.hands)}</b>
            </li>
          ))}
        </ul>
      </section>

      <section className={`card ${styles.block}`}>
        <h2 className="label">{t('admin.tops')}</h2>
        <div className={styles.chips} role="group" aria-label={t('admin.tops')}>
          {TOPS.map((key) => (
            <button key={key} type="button" aria-pressed={top === key} onClick={() => setTop(key)}>
              {t(`admin.top.${key}`)}
            </button>
          ))}
        </div>
        {data.tops[top].length === 0 ? (
          <p className="muted">{t('admin.nobody')}</p>
        ) : (
          <ol className={styles.top}>
            {data.tops[top].map((entry, i) => (
              <li key={entry.userId}>
                <span className={styles.place}>{i + 1}</span>
                <Avatar seed={entry.userId} name={entry.nombre} size={28} />
                <span className={styles.ellipsis}>{entry.nombre}</span>
                <b>{formatNumber(entry.value, language)}</b>
              </li>
            ))}
          </ol>
        )}
      </section>

      <section className={`card ${styles.block} ${styles.full}`}>
        <div className={styles.sectionHead}>
          <h2 className="label">{t('admin.export.title')}</h2>
          <div className={styles.headActions}>
            <a className="btn btn-secondary" href="/api/admin/export?what=players" download>
              {t('admin.export.players')}
            </a>
            <a className="btn btn-secondary" href="/api/admin/export?what=days" download>
              {t('admin.export.days')}
            </a>
          </div>
        </div>
        <p className={styles.dim}>{t('admin.export.hint')}</p>
      </section>
    </>
  )
}
