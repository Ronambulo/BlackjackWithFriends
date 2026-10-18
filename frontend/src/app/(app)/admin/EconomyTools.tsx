'use client'

import { useState, type FormEvent } from 'react'
import type { TFunction } from 'i18next'
import { useTranslation } from 'react-i18next'
import { compact, date, number, percent } from '@/admin/format'
import { can, useAdminShop } from '@/admin/useAdmin'
import {
  useCoinFlow,
  useDeleteEvent,
  useEndTest,
  useEvents,
  usePostEvent,
  usePostTest,
  useTests,
  type AdminEvent,
  type CoinFlow,
  type EventKind,
  type PriceTest,
} from '@/admin/useAdminTools'
import { KINDS, type CosmeticKind } from '@/cosmetics/themes'
import { currentLanguage } from '@/i18n'
import styles from './admin.module.css'
import { useAdminPanel } from './context'
import ui from './tools.module.css'

const DAY = 24 * 60 * 60 * 1000
const SOURCES = ['challenges', 'daily', 'achievements', 'season', 'admin'] as const
/** How long a price test should run before its numbers mean something. */
const TEST_DAYS = 14

/** Coins in and out each week, and how fast they pile up. */
export function CoinFlowCard({ flow }: { flow: CoinFlow }) {
  const { t } = useTranslation()
  const weeks = flow.flow
  const totalIn = (w: CoinFlow['flow'][number]) => SOURCES.reduce((sum, key) => sum + w.in[key], 0)
  const max = Math.max(1, ...weeks.map((w) => Math.max(totalIn(w), w.out.shop)))
  const last = weeks.at(-1)
  const before = weeks.at(-2)
  // What's left of the week's coins after the shop, from −100 % (spent more than came in) to 100 %.
  const net = (w: (typeof flow.flow)[number]) => {
    const top = Math.max(totalIn(w), w.out.shop)
    return top ? (totalIn(w) - w.out.shop) / top : null
  }
  const inflation = last ? net(last) : null
  const inflationBefore = before ? net(before) : null
  const daysToBuy = flow.coinsPerActiveDay ? flow.averagePrice / flow.coinsPerActiveDay : null
  const language = currentLanguage()
  const short = new Intl.DateTimeFormat(language, { day: 'numeric', month: 'short' })

  return (
    <>
      <div className={`card ${styles.tiles} ${styles.full}`}>
        <div className={styles.tile} data-warn={inflation !== null && inflation > 0.4}>
          <span className={styles.tileLabel}>{t('panel.eco.inflation')}</span>
          <span className={styles.tileValue}>{percent(inflation)}</span>
          <span className={styles.dim}>
            {inflationBefore === null ? t('panel.eco.inflationHint') : t('panel.eco.lastWeek', { value: percent(inflationBefore) })}
          </span>
        </div>
        <div className={styles.tile}>
          <span className={styles.tileLabel}>{t('panel.eco.perDay')}</span>
          <span className={styles.tileValue}>{number(flow.coinsPerActiveDay)}</span>
          <span className={styles.dim}>{t('panel.eco.perDayHint', { count: flow.active })}</span>
        </div>
        <div className={styles.tile}>
          <span className={styles.tileLabel}>{t('panel.eco.avgPrice')}</span>
          <span className={styles.tileValue}>{number(flow.averagePrice)}</span>
          <span className={styles.dim}>{daysToBuy === null ? '—' : t('panel.eco.daysToBuy', { n: number(daysToBuy, 1) })}</span>
        </div>
        <div className={styles.tile} data-warn={flow.broke > 0}>
          <span className={styles.tileLabel}>{t('panel.eco.broke')}</span>
          <span className={styles.tileValue}>{number(flow.broke)}</span>
          <span className={styles.dim}>{t('panel.eco.brokeHint')}</span>
        </div>
      </div>

      <section className={`card ${styles.block} ${styles.span2}`}>
        <div className={styles.sectionHead}>
          <h2 className="label">{t('panel.eco.flow')}</h2>
          <div className={ui.legend}>
            {SOURCES.map((key) => (
              <span key={key}>
                <i data-source={key} /> {t(`panel.eco.source.${key}`)}
              </span>
            ))}
            <span>
              <i data-source="shop" /> {t('panel.eco.source.shop')}
            </span>
          </div>
        </div>
        <div className={ui.flow}>
          {weeks.map((w) => (
            <div key={w.week} className={ui.flowWeek}>
              <div className={ui.flowBars}>
                <span className={ui.flowStack} title={`${t('panel.eco.in')}: ${number(totalIn(w))}`}>
                  {SOURCES.map((key) =>
                    w.in[key] ? <i key={key} data-source={key} style={{ height: `${(w.in[key] / max) * 100}%` }} /> : null,
                  )}
                </span>
                <span className={ui.flowStack} title={`${t('panel.eco.out')}: ${number(w.out.shop)}`}>
                  <i data-source="shop" style={{ height: `${(w.out.shop / max) * 100}%` }} />
                </span>
              </div>
              <small className={styles.dim}>{short.format(new Date(`${w.week}T12:00:00`))}</small>
            </div>
          ))}
        </div>
        {last && (
          <p className={styles.dim}>
            {t('panel.eco.flowHint', { in: compact(totalIn(last)), out: compact(last.out.shop) })}
          </p>
        )}
      </section>
    </>
  )
}

/** What the shop would cost if a style took so many days to earn, and setting it for Monday. */
export function Simulator({ flow }: { flow: CoinFlow }) {
  const { t } = useTranslation()
  const { role } = useAdminPanel()
  const post = usePostEvent()
  const current = flow.coinsPerActiveDay ? flow.averagePrice / flow.coinsPerActiveDay : 7
  const [days, setDays] = useState(() => Math.max(1, Math.min(30, Math.round(current))))
  const target = flow.coinsPerActiveDay * days
  const valor = flow.averagePrice ? Math.max(20, Math.min(500, Math.round((target / flow.averagePrice) * 100))) : 100
  const owner = can(role, 'dueno')

  return (
    <section className={`card ${styles.block}`}>
      <div className={styles.headStack}>
        <h2 className="label">{t('panel.eco.sim')}</h2>
        <span className={styles.dim}>{t('panel.eco.simHint')}</span>
      </div>
      <label className={styles.formField}>
        {t('panel.eco.simDays', { count: days })}
        <input type="range" min={1} max={30} value={days} onChange={(e) => { setDays(Number(e.target.value)); post.reset() }} />
      </label>
      <dl className={styles.factGrid}>
        <div>
          <dt>{t('panel.eco.simNow')}</dt>
          <dd>{t('panel.eco.days', { n: number(current, 1) })}</dd>
        </div>
        <div>
          <dt>{t('panel.eco.simPrice')}</dt>
          <dd>
            {number(flow.averagePrice)} → <b>{number(Math.round((flow.averagePrice * valor) / 100))}</b>
          </dd>
        </div>
        <div>
          <dt>{t('panel.eco.simChange')}</dt>
          <dd className={valor === 100 ? styles.flat : valor > 100 ? styles.down : styles.up}>
            {valor === 100 ? '=' : `${valor > 100 ? '+' : '−'}${Math.abs(valor - 100)} %`}
          </dd>
        </div>
      </dl>
      {post.isError && <p className="error-text">{post.error instanceof Error && post.error.message ? post.error.message : t('common.error')}</p>}
      {post.isSuccess && <p className={styles.up}>{t('panel.eco.simDone', { date: flow.nextWeek })}</p>}
      <div className={styles.formActions}>
        <button
          className="btn btn-primary"
          type="button"
          disabled={!owner || valor === 100 || post.isPending || post.isSuccess}
          onClick={() =>
            post.mutate({ tipo: 'precios', titulo: t('panel.eco.simTitle', { pct: valor }), inicio: flow.nextWeekAt, valor })
          }
        >
          {t('panel.eco.simApply')}
        </button>
      </div>
      {!owner && <p className={styles.dim}>{t('panel.auto.ownerOnly')}</p>}
    </section>
  )
}

function eventValue(e: AdminEvent, t: TFunction) {
  if (e.tipo === 'doble_paga') return `×${e.valor ?? 2}`
  if (e.tipo === 'rebajas') return `−${e.valor ?? 0} %${e.detalle ? ` · ${t(`styles.kind.${e.detalle as CosmeticKind}`)}` : ''}`
  if (e.tipo === 'precios') return `${e.valor ?? 100} %`
  return ''
}

const toLocalInput = (ms: number) => {
  const d = new Date(ms - new Date(ms).getTimezoneOffset() * 60_000)
  return d.toISOString().slice(0, 16)
}

/** Double pay, sales and themed weeks, with a start and an end. */
export function Events() {
  const { t } = useTranslation()
  const { role } = useAdminPanel()
  const { data } = useEvents()
  const post = usePostEvent()
  const remove = useDeleteEvent()
  const owner = can(role, 'dueno')
  const [tipo, setTipo] = useState<Exclude<EventKind, 'precios'>>('doble_paga')
  const [titulo, setTitulo] = useState('')
  const [inicio, setInicio] = useState(() => toLocalInput(Date.now() + DAY))
  const [length, setLength] = useState('2')
  const [valor, setValor] = useState('2')
  const [detalle, setDetalle] = useState<CosmeticKind | ''>('')
  const now = Date.now()
  const events = data ?? []
  const state = (e: AdminEvent) => (e.inicio > now ? 'soon' : e.fin && e.fin < now ? 'past' : 'now')

  const submit = (event: FormEvent) => {
    event.preventDefault()
    const start = new Date(inicio).getTime()
    const days = Number(length)
    if (!titulo.trim() || !Number.isFinite(start) || !(days > 0)) return
    post.mutate(
      {
        tipo,
        titulo: titulo.trim(),
        inicio: start,
        fin: start + days * DAY,
        valor: tipo === 'tematico' ? null : Number(valor),
        detalle: tipo === 'rebajas' && detalle ? detalle : null,
      },
      { onSuccess: () => setTitulo('') },
    )
  }

  return (
    <section className={`card ${styles.block}`}>
      <h2 className="label">{t('panel.eco.events')}</h2>
      {events.length === 0 ? (
        <p className={styles.dim}>{t('panel.eco.noEvents')}</p>
      ) : (
        <ul className={ui.list}>
          {events.slice(0, 8).map((e) => (
            <li key={e.id} data-state={state(e)}>
              <span className={ui.eventIcon} data-kind={e.tipo}>
                {e.tipo === 'doble_paga' ? '×2' : e.tipo === 'rebajas' ? '%' : e.tipo === 'precios' ? '€' : '★'}
              </span>
              <span className={ui.grow}>
                <b>
                  {e.titulo} <span className={styles.dim}>{eventValue(e, t)}</span>
                </b>
                <small className={styles.dim}>
                  {t(`panel.eco.state.${state(e)}`)} · {date(e.inicio)}
                  {e.fin ? ` → ${date(e.fin)}` : ''}
                </small>
              </span>
              {owner && state(e) !== 'past' && (
                <button type="button" className={`btn btn-ghost btn-sm ${ui.quiet}`} disabled={remove.isPending} onClick={() => remove.mutate({ id: e.id })}>
                  {t('panel.eco.cancel')}
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
      {owner && (
        <form className={ui.eventForm} onSubmit={submit}>
          <div className={styles.chips} role="group" aria-label={t('panel.eco.kind')}>
            {(['doble_paga', 'rebajas', 'tematico'] as const).map((k) => (
              <button
                key={k}
                type="button"
                aria-pressed={tipo === k}
                onClick={() => {
                  setTipo(k)
                  setValor(k === 'doble_paga' ? '2' : '20')
                  post.reset()
                }}
              >
                {t(`panel.eco.kindName.${k}`)}
              </button>
            ))}
          </div>
          <input
            className={styles.fieldInput}
            value={titulo}
            maxLength={60}
            placeholder={t(`panel.eco.titlePlaceholder.${tipo}`)}
            aria-label={t('panel.eco.eventTitle')}
            onChange={(e) => setTitulo(e.target.value)}
          />
          <div className={ui.eventFields}>
            <label className={styles.formField}>
              {t('panel.eco.starts')}
              <input className={styles.fieldInput} type="datetime-local" value={inicio} onChange={(e) => setInicio(e.target.value)} />
            </label>
            <label className={styles.formField}>
              {t('panel.eco.lasts')}
              <select className={styles.fieldInput} value={length} onChange={(e) => setLength(e.target.value)}>
                {[1, 2, 3, 7, 14].map((n) => (
                  <option key={n} value={n}>
                    {t('panel.eco.days', { n })}
                  </option>
                ))}
              </select>
            </label>
            {tipo === 'doble_paga' && (
              <label className={styles.formField}>
                {t('panel.eco.times')}
                <select className={styles.fieldInput} value={valor} onChange={(e) => setValor(e.target.value)}>
                  {[2, 3, 4, 5].map((n) => (
                    <option key={n} value={n}>
                      ×{n}
                    </option>
                  ))}
                </select>
              </label>
            )}
            {tipo === 'rebajas' && (
              <>
                <label className={styles.formField}>
                  {t('panel.eco.off')}
                  <select className={styles.fieldInput} value={valor} onChange={(e) => setValor(e.target.value)}>
                    {[10, 20, 30, 50].map((n) => (
                      <option key={n} value={n}>
                        −{n} %
                      </option>
                    ))}
                  </select>
                </label>
                <label className={styles.formField}>
                  {t('panel.eco.what')}
                  <select className={styles.fieldInput} value={detalle} onChange={(e) => setDetalle(e.target.value as CosmeticKind | '')}>
                    <option value="">{t('panel.eco.everything')}</option>
                    {KINDS.map((k) => (
                      <option key={k} value={k}>
                        {t(`styles.kind.${k}`)}
                      </option>
                    ))}
                  </select>
                </label>
              </>
            )}
          </div>
          {post.isError && <p className="error-text">{post.error instanceof Error && post.error.message ? post.error.message : t('common.error')}</p>}
          <button className="btn btn-primary" type="submit" disabled={!titulo.trim() || post.isPending}>
            {t('panel.eco.schedule')}
          </button>
        </form>
      )}
    </section>
  )
}

/** Coins per player in each half: what the test is really about. */
const yieldOf = (half: PriceTest['a']) => (half.players ? half.coins / half.players : 0)

/** Half the players see another price for a style; which half spends more. */
export function PriceTests() {
  const { t } = useTranslation()
  const { role } = useAdminPanel()
  const { data } = useTests()
  const { data: shop } = useAdminShop()
  const start = usePostTest()
  const end = useEndTest()
  const owner = can(role, 'dueno')
  const [estilo, setEstilo] = useState('')
  const [precio, setPrecio] = useState('')
  const now = Date.now()
  const running = (data ?? []).filter((x) => !x.fin)
  const done = (data ?? []).filter((x) => x.fin).slice(0, 3)
  const forSale = (shop?.items ?? []).filter((item) => item.from === 'tienda' && !item.retirado && !running.some((x) => x.estilo === item.id))
  const name = (id: string) => t(`styles.items.${id}`, { defaultValue: id })

  const row = (test: PriceTest) => {
    const a = yieldOf(test.a)
    const b = yieldOf(test.b)
    const enough = test.a.players + test.b.players >= 20
    const winner = !enough || a === b ? null : b > a ? 'B' : 'A'
    const daysIn = Math.floor(((test.fin ?? now) - test.inicio) / DAY)
    return (
      <li key={test.id} className={ui.test}>
        <div className={ui.testHead}>
          <b>{name(test.estilo)}</b>
          {winner && <span className={ui.tagChip} data-tag="NUEVA">{t('panel.eco.winning', { half: winner })}</span>}
          <span className={`${styles.dim} ${ui.grow}`}>
            {test.fin
              ? t('panel.eco.ended', { date: date(test.fin) })
              : t('panel.eco.daysLeft', { count: Math.max(0, TEST_DAYS - daysIn) })}
          </span>
          {owner && !test.fin && (
            <button type="button" className="btn btn-ghost btn-sm" disabled={end.isPending} onClick={() => end.mutate({ id: test.id })}>
              {t('panel.eco.endTest')}
            </button>
          )}
        </div>
        <div className={ui.halves}>
          {(['a', 'b'] as const).map((key) => {
            const half = test[key]
            const price = key === 'a' ? test.precioA : test.precioB
            return (
              <div key={key} data-winner={winner === key.toUpperCase() || undefined}>
                <small>
                  {key.toUpperCase()} · {price === null ? t('panel.eco.shopPrice') : number(price)}
                </small>
                <b>{number(yieldOf(half), 1)}</b>
                <small className={styles.dim}>
                  {t('panel.eco.perPlayer')} · {t('panel.eco.buyers', { n: half.buyers, of: half.players })}
                </small>
              </div>
            )
          })}
        </div>
        {!test.fin && (
          <span className={styles.meter}>
            <span style={{ width: `${Math.min(1, daysIn / TEST_DAYS) * 100}%` }} />
          </span>
        )}
      </li>
    )
  }

  return (
    <section className={`card ${styles.block}`}>
      <div className={styles.headStack}>
        <h2 className="label">{t('panel.eco.tests')}</h2>
        <span className={styles.dim}>{t('panel.eco.testsHint', { n: TEST_DAYS })}</span>
      </div>
      {running.length + done.length === 0 ? (
        <p className={styles.dim}>{t('panel.eco.noTests')}</p>
      ) : (
        <ul className={ui.tests}>{[...running, ...done].map(row)}</ul>
      )}
      {owner && (
        <form
          className={ui.inlineForm}
          onSubmit={(event) => {
            event.preventDefault()
            const precioB = Number(precio)
            if (estilo && Number.isInteger(precioB) && precioB > 0)
              start.mutate({ estilo, precioB }, { onSuccess: () => { setEstilo(''); setPrecio('') } })
          }}
        >
          <select className={styles.fieldInput} value={estilo} aria-label={t('panel.eco.style')} onChange={(e) => setEstilo(e.target.value)}>
            <option value="">{t('panel.eco.pickStyle')}</option>
            {forSale.map((item) => (
              <option key={item.id} value={item.id}>
                {name(item.id)} · {number(item.propio ?? item.serie ?? 0)}
              </option>
            ))}
          </select>
          <input
            className={`${styles.fieldInput} ${styles.numberInput}`}
            inputMode="numeric"
            value={precio}
            placeholder={t('panel.eco.priceB')}
            aria-label={t('panel.eco.priceB')}
            onChange={(e) => setPrecio(e.target.value.replace(/\D/g, ''))}
          />
          <button type="submit" className="btn btn-secondary btn-sm" disabled={!estilo || !precio || start.isPending}>
            {t('panel.eco.startTest')}
          </button>
        </form>
      )}
      {(start.isError || end.isError) && <p className="error-text">{(start.error ?? end.error)?.message || t('common.error')}</p>}
    </section>
  )
}

/** Everything new in the economy tab, in one go. */
export function EconomyTools() {
  const { data } = useCoinFlow()
  return (
    <>
      {data && <CoinFlowCard flow={data} />}
      {data && <Simulator flow={data} />}
      <Events />
      <PriceTests />
    </>
  )
}
