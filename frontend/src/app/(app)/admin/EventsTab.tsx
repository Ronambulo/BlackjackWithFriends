'use client'

import { useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { number } from '@/admin/format'
import { can, useAdminEventBoxes, useSetEventBox, type AdminEventBox } from '@/admin/useAdmin'
import { StylePreview } from '@/cosmetics/StylePreview'
import type { EventId, StyleId } from '@/cosmetics/useCosmetics'
import { EventBadge, lastDayOf } from '@/events/EventBox'
import { currentLanguage } from '@/i18n'
import { ChevronLeftIcon, ChevronRightIcon } from '@/ui/icons'
import styles from './admin.module.css'
import { useAdminPanel } from './context'

/** An ISO date as the value of a datetime-local input, in the admin's own time. */
const toLocal = (iso: string) => {
  const date = new Date(iso)
  return new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 16)
}

/**
 * Every event, past and coming, and the one picked: its box on the home screen, on or off,
 * its price and date, what's in it and what has come out. An event added on the server shows up here by itself.
 */
export function EventsTab() {
  const { t } = useTranslation()
  const { role } = useAdminPanel()
  const { data: events, isPending, isError, refetch } = useAdminEventBoxes()
  const [picked, setPicked] = useState<EventId | null>(null)
  const data = events?.find((event) => event.id === picked)

  if (isPending) return <section className={`card ${styles.placeholder}`} aria-busy="true" />
  if (isError || !events)
    return (
      <section className="card">
        <p className={styles.dim}>{t('common.error')}</p>
        <button className="btn btn-secondary" type="button" onClick={() => void refetch()}>
          {t('common.retry')}
        </button>
      </section>
    )

  if (!data) return <EventList events={events} onPick={setPicked} />

  const owner = can(role, 'dueno')
  return (
    <>
      <button className={`${styles.back} ${styles.full}`} type="button" onClick={() => setPicked(null)}>
        <ChevronLeftIcon width={18} height={18} /> {t('admin.events.all')}
      </button>
      <section className={styles.tiles}>
        <Tile value={number(data.cajas)} label={t('admin.events.boxes')} />
        <Tile value={number(data.monedas)} label={t('admin.events.coins')} />
        <Tile value={number(data.jugadores)} label={t('admin.events.players')} />
        <Tile value={number(data.completos)} label={t('admin.events.complete')} />
      </section>
      <Settings key={`${data.id}${data.activa}${data.precio}${data.subida}${data.hasta}`} data={data} owner={owner} />
      <Contents data={data} owner={owner} />
    </>
  )
}

/** Every event, with its box: whether it's on Home now, off or over, and how many have been opened. */
function EventList({ events, onPick }: { events: AdminEventBox[]; onPick: (id: EventId) => void }) {
  const { t } = useTranslation()
  const lang = currentLanguage()
  const status = (event: AdminEventBox) => {
    const date = lastDayOf(event.hasta, lang)
    if (event.abierta) return `${t('admin.events.live')} · ${t('admin.events.until', { date })}`
    if (new Date(event.hasta).getTime() <= Date.now()) return t('admin.events.ended', { date })
    return `${t('admin.events.off')} · ${t('admin.events.until', { date })}`
  }

  return (
    <ul className={`${styles.users} ${styles.full}`} aria-label={t('admin.events.list')}>
      {events.map((event) => (
        <li key={event.id}>
          <button className={`card ${styles.row}`} type="button" onClick={() => onPick(event.id)}>
            <EventBadge id={event.id} />
            <span className={styles.userName}>
              <b className={styles.ellipsis}>{t(`eventNames.${event.id}`)}</b>
              <small className={styles.ellipsis}>{status(event)}</small>
            </span>
            <span className={styles.rowNumbers}>
              <b>{t('admin.events.opened', { count: event.cajas, n: number(event.cajas) })}</b>
              <small>{t('admin.events.inBox', { n: event.items.length - event.fuera.length, total: event.items.length })}</small>
            </span>
            <ChevronRightIcon width={18} height={18} aria-hidden="true" />
          </button>
        </li>
      ))}
    </ul>
  )
}

function Tile({ value, label }: { value: string; label: string }) {
  return (
    <div className={styles.tile}>
      <span className={styles.tileValue}>{value}</span>
      <span className={styles.tileLabel}>{label}</span>
    </div>
  )
}

/** On or off, the price and when it goes. */
function Settings({ data, owner }: { data: AdminEventBox; owner: boolean }) {
  const { t } = useTranslation()
  const set = useSetEventBox()
  const [precio, setPrecio] = useState(String(data.precio))
  const [subida, setSubida] = useState(String(data.subida))
  const [hasta, setHasta] = useState(toLocal(data.hasta))
  const changed = Number(precio) !== data.precio || Number(subida) !== data.subida || hasta !== toLocal(data.hasta)

  const submit = (event: FormEvent) => {
    event.preventDefault()
    set.mutate({ evento: data.id, precio: Number(precio), subida: Number(subida), hasta: new Date(hasta).toISOString() })
  }

  return (
    <form className={`card ${styles.block}`} onSubmit={submit}>
      <div className={styles.sectionHead}>
        <h2 className="label">{t('admin.events.title', { name: t(`eventNames.${data.id}`) })}</h2>
        <span className={styles.dim}>{data.abierta ? t('admin.events.live') : t('admin.events.hidden')}</span>
      </div>
      <div className={styles.switchRow}>
        <span>
          <b>{t('admin.events.on')}</b>
          <br />
          <small className={styles.dim}>{t('admin.events.onText')}</small>
        </span>
        <button
          type="button"
          role="switch"
          className={styles.switch}
          aria-checked={data.activa}
          aria-label={t('admin.events.on')}
          disabled={!owner || set.isPending}
          onClick={() => set.mutate({ evento: data.id, activa: !data.activa })}
        />
      </div>
      <label className={styles.formField}>
        {t('admin.events.price')}
        <input
          className={styles.fieldInput}
          type="number"
          min={1}
          inputMode="numeric"
          value={precio}
          disabled={!owner}
          onChange={(event) => setPrecio(event.target.value)}
        />
      </label>
      <label className={styles.formField}>
        {t('admin.events.rise')}
        <input
          className={styles.fieldInput}
          type="number"
          min={0}
          inputMode="numeric"
          value={subida}
          disabled={!owner}
          onChange={(event) => setSubida(event.target.value)}
        />
      </label>
      <label className={styles.formField}>
        {t('admin.events.goes')}
        <input
          className={styles.fieldInput}
          type="datetime-local"
          value={hasta}
          disabled={!owner}
          onChange={(event) => setHasta(event.target.value)}
        />
      </label>
      {set.error && <p className="error-text">{set.error.message || t('common.error')}</p>}
      {owner ? (
        <button className="btn btn-primary" type="submit" disabled={!changed || !hasta || !(Number(precio) >= 1) || !(Number(subida) >= 0) || set.isPending}>
          {t('common.save')}
        </button>
      ) : (
        <p className={styles.dim}>{t('panel.auto.ownerOnly')}</p>
      )}
    </form>
  )
}

/** Every style the box can hold: how many have come out, and a switch to take it out of the box. */
function Contents({ data, owner }: { data: AdminEventBox; owner: boolean }) {
  const { t } = useTranslation()
  const set = useSetEventBox()
  const inBox = data.items.filter((item) => !item.fuera).length

  const toggle = (id: StyleId, out: boolean) =>
    set.mutate({ evento: data.id, fuera: out ? [...data.fuera, id] : data.fuera.filter((other) => other !== id) })

  return (
    <section className={`card ${styles.block}`}>
      <div className={styles.sectionHead}>
        <h2 className="label">{t('admin.events.contents')}</h2>
        <span className={styles.dim}>{t('admin.events.inBox', { n: inBox, total: data.items.length })}</span>
      </div>
      <ul className={styles.top}>
        {data.items.map((item) => (
          <li key={item.id} className={styles.boxRow} data-out={item.fuera || undefined}>
            <StylePreview id={item.id} tipo={item.tipo} spot={false} className={`${styles.boxPreview} ${item.tipo === 'marco' ? styles.boxFrame : ''}`} />
            <span className={styles.userName}>
              <b className={styles.ellipsis}>{t(`styles.items.${item.id}`)}</b>
              <small className={styles.dim}>
                {t(`styles.kind.${item.tipo}`)} · {t('admin.events.out', { count: item.salidos, n: number(item.salidos) })}
              </small>
            </span>
            <button
              type="button"
              role="switch"
              className={styles.switch}
              aria-checked={!item.fuera}
              aria-label={t('admin.events.inside', { name: t(`styles.items.${item.id}`) })}
              // The box can't be left empty.
              disabled={!owner || set.isPending || (!item.fuera && inBox <= 1)}
              onClick={() => toggle(item.id, !item.fuera)}
            />
          </li>
        ))}
      </ul>
      {set.error && <p className="error-text">{set.error.message || t('common.error')}</p>}
    </section>
  )
}
