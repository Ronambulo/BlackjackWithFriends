'use client'

import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useUser } from '@/auth/session-context'
import { useAdminStats, type AdminStats } from '@/admin/useAdmin'
import { useFeed, useInbox, useLive, type FeedItem, type LiveTable } from '@/admin/useAdminTools'
import { ago, compact, delta, duration, number, percent } from '@/admin/format'
import { currentLanguage } from '@/i18n'
import { formatNumber } from '@/lib/format'
import { PlayingCard } from '@/table/PlayingCard'
import { Avatar } from '@/ui/Avatar'
import { Modal } from '@/ui/Modal'
import styles from './admin.module.css'
import { useAdminPanel } from './context'
import { InboxRow } from './InboxTab'
import ui from './tools.module.css'

type TopKey = keyof AdminStats['tops']
type Metric = 'players' | 'hands' | 'signups' | 'minutes'

const TOPS: TopKey[] = ['week', 'allTime', 'coins', 'hands', 'wagered']
const METRICS: Metric[] = ['players', 'hands', 'signups', 'minutes']
const PERIODS = [1, 7, 28, 90] as const

/** A thin line of the last days, for a key figure. */
function Spark({ values }: { values: number[] }) {
  if (values.length < 2) return null
  const max = Math.max(1, ...values)
  const step = 100 / (values.length - 1)
  const points = values.map((v, i) => `${(i * step).toFixed(1)},${(28 - (v / max) * 26).toFixed(1)}`).join(' ')
  return (
    <svg className={ui.spark} viewBox="0 0 100 30" preserveAspectRatio="none" aria-hidden="true">
      <polyline points={`0,30 ${points} 100,30`} className={ui.sparkFill} />
      <polyline points={points} className={ui.sparkLine} />
    </svg>
  )
}

function Kpi({
  label,
  value,
  change,
  values,
}: {
  label: string
  value: string
  change?: { text: string; up: boolean | null }
  values?: number[]
}) {
  return (
    <div className={`${styles.tile} ${ui.kpi}`}>
      <span className={styles.tileLabel}>{label}</span>
      <span className={styles.tileValue}>{value}</span>
      <span className={ui.kpiFoot}>
        {change && <span className={change.up === null ? styles.flat : change.up ? styles.up : styles.down}>{change.text}</span>}
        {values && <Spark values={values} />}
      </span>
    </div>
  )
}

/** This week's line over last week's, one point a day. */
function Compare({ now, before, labels }: { now: number[]; before: number[]; labels: string[] }) {
  const max = Math.max(1, ...now, ...before)
  const x = (i: number) => 4 + (i * 92) / Math.max(1, now.length - 1)
  const y = (v: number) => 92 - (v / max) * 84
  const line = (values: number[]) => values.map((v, i) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ')
  return (
    <div className={ui.compare}>
      <svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
        {[0.25, 0.5, 0.75].map((f) => (
          <line key={f} x1="0" x2="100" y1={y(max * f)} y2={y(max * f)} className={ui.gridLine} />
        ))}
        <polyline points={line(before)} className={ui.lineBefore} />
        <polyline points={`${x(0)},92 ${line(now)} ${x(now.length - 1)},92`} className={ui.areaNow} />
        <polyline points={line(now)} className={ui.lineNow} />
      </svg>
      <div className={ui.compareLabels}>
        {labels.map((label, i) => (
          <span key={i} title={`${number(now[i])} · ${number(before[i])}`}>
            {label}
          </span>
        ))}
      </div>
    </div>
  )
}

function countdown(ms: number) {
  const hours = Math.max(0, Math.floor(ms / 3_600_000))
  return hours >= 24 ? `${Math.floor(hours / 24)} d ${hours % 24} h` : `${hours} h`
}

export function StatsTab() {
  const { t } = useTranslation()
  const me = useUser()
  const { go, openUser } = useAdminPanel()
  const [days, setDays] = useState<(typeof PERIODS)[number]>(7)
  const { data, isError, refetch, isFetching } = useAdminStats(days)
  const { data: inbox } = useInbox()
  const { data: live } = useLive()
  const { data: feed } = useFeed()
  const [top, setTop] = useState<TopKey>('week')
  const [metric, setMetric] = useState<Metric>('players')
  const [watching, setWatching] = useState<string | null>(null)

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
  const { current: cur, previous: prev } = data.weeks
  const weekday = new Intl.DateTimeFormat(language, { weekday: 'narrow' })
  const recent = data.activity.slice(-14)
  const labels = recent.slice(-7).map((day) => weekday.format(new Date(`${day.day}T12:00:00`)))
  const spark = (key: Metric) => data.activity.slice(-Math.max(7, Math.min(30, data.span))).map((day) => day[key])
  const betTotal = data.bets.reduce((sum, bucket) => sum + bucket.hands, 0)
  const perPlayer = (w: AdminStats['weeks']['current']) => (w.players ? w.playMs / w.players : 0)
  const hour = new Date().getHours()
  const greeting = hour < 7 ? 'night' : hour < 14 ? 'morning' : hour < 21 ? 'afternoon' : 'night'
  const urgent = inbox?.filter((item) => item.level !== 'low').length ?? 0

  const kpis = [
    { label: t('panel.kpi.players'), value: number(cur.players), change: delta(cur.players, prev.players), values: spark('players') },
    { label: t('panel.kpi.hands'), value: compact(cur.hands), change: delta(cur.hands, prev.hands), values: spark('hands') },
    { label: t('panel.kpi.signups'), value: number(cur.signups), change: delta(cur.signups, prev.signups), values: spark('signups') },
    {
      label: t('admin.playTimePerPlayer'),
      value: duration(perPlayer(cur)),
      change: delta(perPlayer(cur), perPlayer(prev), duration),
      values: spark('minutes'),
    },
    {
      label: t('admin.returning'),
      value: percent(cur.returning),
      change:
        cur.returning === null
          ? { text: t('admin.noDataYet'), up: null }
          : prev.returning === null
            ? undefined
            : delta(cur.returning, prev.returning, (v) => percent(v)),
    },
    { label: t('admin.houseEdge'), value: percent(cur.houseEdge, 1), change: delta(cur.houseEdge ?? 0, prev.houseEdge ?? 0, (v) => percent(v, 1)) },
  ]

  const funnel = [
    ['signedUp', data.funnel.signedUp],
    ['played', data.funnel.played],
    ['inAGroup', data.funnel.inAGroup],
    ['nextDay', data.funnel.nextDay],
    ['regulars', data.funnel.regulars],
  ] as const
  const heatMax = Math.max(1, ...data.heatmap.flat())
  const dayNames = Array.from({ length: 7 }, (_, i) =>
    new Intl.DateTimeFormat(language, { weekday: 'short' }).format(new Date(Date.UTC(2024, 0, 1 + i, 12))),
  )
  const sum = (values: number[]) => values.reduce((a, b) => a + b, 0)
  const nowWeek = recent.slice(-7).map((day) => day[metric])
  const lastWeek = recent.slice(0, 7).map((day) => day[metric])

  return (
    <>
      <header className={`${ui.hello} ${styles.full}`}>
        <div>
          <h2>{t(`panel.hello.${greeting}`, { name: me.username ?? me.name })}</h2>
          <p className={styles.dim}>
            {urgent > 0 ? t('panel.hello.urgent', { count: urgent }) : t('panel.hello.calm')}
            {' · '}
            {t('admin.closeIn', { time: countdown(data.weekEndsAt - data.now) })}
          </p>
        </div>
        <div className={styles.chips} role="group" aria-label={t('panel.period.label')} aria-busy={isFetching}>
          {PERIODS.map((p) => (
            <button key={p} type="button" aria-pressed={days === p} onClick={() => setDays(p)}>
              {t(`panel.period.d${p}`)}
            </button>
          ))}
        </div>
      </header>

      <div className={`${styles.live} ${ui.liveStrip}`}>
        <span>
          <span className={styles.liveDot} data-on={data.live.players > 0} />
          <b>{number(data.live.players)}</b> {t('panel.live.players', { count: data.live.players })}
        </span>
        <span>
          <b>{number(live?.tables.length ?? data.live.open)}</b> {t('panel.live.tables', { count: live?.tables.length ?? data.live.open })}
        </span>
        <span>
          {t('panel.live.lastHand')} <b>{ago(data.live.lastHandAt, data.now)}</b>
        </span>
        <span>
          {t('panel.live.peak')} <b>{number(live?.peak ?? 0)}</b>
          {live?.peakAt ? <small className={styles.dim}> · {new Intl.DateTimeFormat(language, { timeStyle: 'short' }).format(live.peakAt)}</small> : null}
        </span>
      </div>

      <div className={`card ${styles.tiles} ${styles.full}`}>
        {kpis.map((kpi) => (
          <Kpi key={kpi.label} {...kpi} />
        ))}
      </div>

      <section className={`card ${styles.block} ${styles.span2}`}>
        <div className={styles.sectionHead}>
          <h2 className="label">{t('panel.inbox.title')}</h2>
          {inbox && inbox.length > 0 && (
            <button type="button" className={styles.link} onClick={() => go('inbox')}>
              {t('panel.inbox.seeAll', { count: inbox.length })}
            </button>
          )}
        </div>
        {inbox && inbox.length === 0 ? (
          <p className={styles.dim}>{t('panel.inbox.clear')}</p>
        ) : (
          <ul className={ui.inbox}>
            {inbox?.slice(0, 4).map((item) => (
              <InboxRow key={item.key} item={item} compact />
            ))}
          </ul>
        )}
      </section>

      <section className={`card ${styles.block}`}>
        <div className={styles.sectionHead}>
          <h2 className="label">{t('panel.live.title')}</h2>
          <span className={styles.dim}>{t('panel.live.invisible')}</span>
        </div>
        {!live?.tables.length ? (
          <p className={styles.dim}>{t('panel.live.none')}</p>
        ) : (
          <ul className={ui.list}>
            {live.tables.slice(0, 6).map((table) => (
              <li key={table.id}>
                <Avatar seed={table.userId} name={table.nombre ?? table.username} src={table.avatarUrl} size={32} />
                <span className={ui.grow}>
                  <b>@{table.username}</b>
                  <small className={styles.dim}>
                    {t('panel.live.bet', { n: number(table.bet) })} · {t(`panel.live.phase.${table.view.phase}`)}
                  </small>
                </span>
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => setWatching(table.id)}>
                  {t('panel.live.watch')}
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className={`card ${styles.block} ${styles.span2}`}>
        <div className={styles.sectionHead}>
          <h2 className="label">{t('panel.compare.title')}</h2>
          <div className={`segmented ${styles.inlineSeg}`} role="group" aria-label={t('panel.compare.title')}>
            {METRICS.map((key) => (
              <button key={key} type="button" aria-pressed={metric === key} onClick={() => setMetric(key)}>
                {t(`admin.metric.${key}`)}
              </button>
            ))}
          </div>
        </div>
        <Compare now={nowWeek} before={lastWeek} labels={labels} />
        <div className={ui.compareKey}>
          <span>
            <i data-line="now" /> {t('panel.compare.now')} <b>{number(sum(nowWeek))}</b>
          </span>
          <span>
            <i data-line="before" /> {t('panel.compare.before')} <b>{number(sum(lastWeek))}</b>
          </span>
          {(() => {
            const d = delta(sum(nowWeek), sum(lastWeek))
            return <span className={d.up === null ? styles.flat : d.up ? styles.up : styles.down}>{d.text}</span>
          })()}
        </div>
      </section>

      <section className={`card ${styles.block}`}>
        <h2 className="label">{t('panel.feed.title')}</h2>
        {!feed?.length ? (
          <p className={styles.dim}>{t('admin.nobody')}</p>
        ) : (
          <ul className={ui.feed}>
            {feed.slice(0, 9).map((item, i) => (
              <li key={`${item.kind}${item.at}${i}`}>
                <span className={ui.feedIcon} data-kind={item.kind}>
                  {FEED_ICON[item.kind]}
                </span>
                <span className={ui.grow}>
                  <FeedText item={item} onUser={openUser} />
                </span>
                <small className={styles.dim}>{ago(item.at)}</small>
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

      <section className={`card ${styles.block} ${styles.span2}`}>
        <h2 className="label">{t('admin.busyHours')}</h2>
        <div className={styles.scroll}>
          <div className={styles.heat}>
            {data.heatmap.map((row, day) => (
              <div key={day} className={styles.heatRow}>
                <span className={styles.heatDay}>{dayNames[day]}</span>
                {row.map((value, h) => (
                  <span
                    key={h}
                    className={styles.heatCell}
                    title={`${dayNames[day]} ${h}:00 · ${value}`}
                    style={{ background: value ? `color-mix(in srgb, var(--accent) ${Math.round(12 + (value / heatMax) * 88)}%, transparent)` : undefined }}
                  />
                ))}
              </div>
            ))}
            <div className={styles.heatRow}>
              <span className={styles.heatDay} />
              {Array.from({ length: 24 }, (_, h) => (
                <span key={h} className={styles.heatHour}>
                  {h % 6 === 0 ? h : ''}
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

      <section className={`card ${styles.block} ${styles.full}`}>
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
          <ol className={`${styles.top} ${styles.topWide}`}>
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
            <a className="btn btn-secondary" href="/api/admin/export?what=hands" download>
              {t('admin.export.hands')}
            </a>
          </div>
        </div>
        <p className={styles.dim}>{t('admin.export.hint')}</p>
      </section>

      {watching && <Watch id={watching} onClose={() => setWatching(null)} />}
    </>
  )
}

const FEED_ICON: Record<FeedItem['kind'], string> = {
  signup: '👋',
  blackjack: '🂡',
  bigWin: '💰',
  purchase: '🛍',
  achievement: '🏅',
  daily: '📅',
  admin: '⚙',
}

function FeedText({ item, onUser }: { item: FeedItem; onUser: (who: { id: string; username: string }) => void }) {
  const { t } = useTranslation()
  const name =
    item.userId && item.username ? (
      <button type="button" className={ui.inlineUser} onClick={() => onUser({ id: item.userId!, username: item.username! })}>
        @{item.username}
      </button>
    ) : null
  const what =
    item.kind === 'admin'
      ? item.text
      : t(`panel.feed.${item.kind}`, {
          n: number(item.value ?? 0),
          what: item.kind === 'purchase' ? t(`styles.items.${item.text}`, { defaultValue: item.text ?? '' }) : t(`achievements.${item.text}.name`, { defaultValue: item.text ?? '' }),
        })
  return (
    <span className={ui.feedText}>
      {name} {what}
    </span>
  )
}

/** Watching a hand as it's played, without the player knowing. */
function Watch({ id, onClose }: { id: string; onClose: () => void }) {
  const { t } = useTranslation()
  const { data } = useLive(true)
  const table: LiveTable | undefined = data?.tables.find((row) => row.id === id)
  return (
    <Modal title={table ? `@${table.username}` : t('panel.live.title')} eyebrow={t('panel.live.watching')} onClose={onClose}>
      {!table ? (
        <p className={styles.dim}>{t('panel.live.ended')}</p>
      ) : (
        <div className={ui.felt}>
          <div className={ui.feltRow}>
            <small>
              {t('panel.live.dealer')} · {table.view.dealerValue.total}
            </small>
            <div className={ui.cards}>
              {table.view.dealer.map((card, i) => (
                <PlayingCard key={i} card={card} still />
              ))}
            </div>
          </div>
          {table.view.hands.map((hand, i) => (
            <div key={i} className={ui.feltRow} data-active={i === table.view.activeHand && table.view.phase === 'player' ? true : undefined}>
              <div className={ui.cards}>
                {hand.cards.map((card, k) => (
                  <PlayingCard key={k} card={card} still />
                ))}
              </div>
              <small>
                {hand.value.soft && hand.value.total <= 21 ? `${hand.value.total - 10}/${hand.value.total}` : hand.value.total} ·{' '}
                {t('panel.live.bet', { n: number(hand.bet) })}
                {hand.status !== 'playing' ? ` · ${t(`panel.live.status.${hand.status}`)}` : ''}
              </small>
            </div>
          ))}
          <p className={ui.feltFoot}>
            {t('panel.live.since', { time: ago(table.startedAt) })} · {t('panel.live.readOnly')}
          </p>
        </div>
      )}
    </Modal>
  )
}
