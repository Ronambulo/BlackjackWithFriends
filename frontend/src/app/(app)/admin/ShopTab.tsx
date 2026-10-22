'use client'

import { useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { useAdminShop, useSetShopItem, useSetShopOrder, useSetShopSale, type AdminShop, type AdminShopItem } from '@/admin/useAdmin'
import { number } from '@/admin/format'
import { StylePreview } from '@/cosmetics/StylePreview'
import type { CosmeticKind } from '@/cosmetics/themes'
import { lastDayOf } from '@/events/EventBox'
import { currentLanguage } from '@/i18n'
import { ChevronLeftIcon, ChevronRightIcon } from '@/ui/icons'
import { Modal } from '@/ui/Modal'

/** The shop's kinds in the order the tabs show them. */
const TAB_KINDS: CosmeticKind[] = ['tapete', 'dorso', 'cartas', 'fichas', 'marco']
import styles from './admin.module.css'

/** A kind's tab, or the one with every event's styles. */
type View = CosmeticKind | 'eventos'
type EventBox = AdminShop['eventos'][number]

type Filter = 'all' | 'onSale' | 'retired' | 'offer'
const FILTERS: Filter[] = ['all', 'onSale', 'retired', 'offer']
const SALE_PRESETS = [10, 20, 30, 50, 75]

const sold = (item: AdminShopItem) => item.from === 'tienda' && !item.evento
const matches = (item: AdminShopItem, filter: Filter) =>
  filter === 'all' ||
  (filter === 'onSale' && sold(item) && !item.retirado) ||
  (filter === 'retired' && item.retirado) ||
  (filter === 'offer' && !!item.oferta)

/** The style shop as a grid: tap a style to change it. How it sells is in the styles tab. */
export function ShopTab() {
  const { t, i18n } = useTranslation()
  const { data, isPending, isError, refetch } = useAdminShop()
  const [view, setView] = useState<View>('tapete')
  const [filter, setFilter] = useState<Filter>('all')
  const [editing, setEditing] = useState<string | null>(null)
  const [saleOpen, setSaleOpen] = useState(false)

  if (isPending) return <section className={`card ${styles.placeholder}`} aria-busy="true" />
  if (isError || !data)
    return (
      <section className="card">
        <p className={styles.dim}>{t('common.error')}</p>
        <button className="btn btn-secondary" type="button" onClick={() => void refetch()}>
          {t('common.retry')}
        </button>
      </section>
    )

  const shop = data.items.filter(sold)
  const ofKind = (k: CosmeticKind) => data.items.filter((item) => item.tipo === k && !item.evento)
  const kindItems = view === 'eventos' ? [] : ofKind(view)
  const shown = kindItems.filter((item) => matches(item, filter))
  const boxes = new Map(data.eventos.map((box) => [box.id, box]))
  // By name and then by date: Halloween 2026 before Halloween 2027.
  const events = [...data.eventos].sort(
    (a, b) => t(`eventNames.${a.id}`).localeCompare(t(`eventNames.${b.id}`), i18n.language) || a.hasta.localeCompare(b.hasta),
  )
  // Looked up again on every render, so the modal shows the style as it is after a save or a move.
  const edited = editing ? data.items.find((item) => item.id === editing) : undefined
  const editedList = edited ? data.items.filter((item) => item.tipo === edited.tipo) : []
  const editedBox = edited?.evento ? boxes.get(edited.evento) : undefined

  return (
    <>
      <div className={styles.shopTop}>
        <section className={styles.shopTiles}>
          <Tile value={number(shop.filter((item) => !item.retirado).length)} label={t('admin.shop.forSale')} />
          <Tile value={number(shop.filter((item) => item.retirado).length)} label={t('admin.shop.retired')} />
          <Tile value={number(data.items.reduce((sum, item) => sum + item.bought, 0))} label={t('admin.shop.purchases')} />
          <Tile value={number(data.items.reduce((sum, item) => sum + item.coins, 0))} label={t('admin.shop.spent')} />
        </section>
        <button className={styles.shopSaleButton} type="button" data-on={data.rebaja > 0} onClick={() => setSaleOpen(true)}>
          <span className={styles.shopSaleIcon} aria-hidden="true">
            %
          </span>
          <span>
            <b>{t('admin.shop.saleButton')}</b>
            <small>{data.rebaja ? t('admin.shop.saleActive', { n: data.rebaja }) : t('admin.shop.saleNone')}</small>
          </span>
        </button>
      </div>

      <section className={`card ${styles.block}`}>
        <div className={styles.shopBar}>
          <div className={`segmented ${styles.shopKinds}`} role="group" aria-label={t('styles.kinds')}>
            {TAB_KINDS.map((k) => (
              <button key={k} type="button" aria-pressed={view === k} onClick={() => setView(k)}>
                {t(`admin.shop.kinds.${k}`)}
                <span className={styles.shopCount}>{ofKind(k).length}</span>
              </button>
            ))}
            <button type="button" aria-pressed={view === 'eventos'} onClick={() => setView('eventos')}>
              {t('admin.shop.kinds.eventos')}
              <span className={styles.shopCount}>{data.items.filter((item) => item.evento).length}</span>
            </button>
          </div>
          {view !== 'eventos' && (
            <div className={styles.shopFilters} role="group" aria-label={t('admin.shop.filter')}>
              {FILTERS.map((f) => (
                <button key={f} type="button" aria-pressed={filter === f} onClick={() => setFilter(f)}>
                  {t(`admin.shop.filters.${f}`)}
                </button>
              ))}
            </div>
          )}
        </div>

        <p className={styles.shopHint}>{view === 'eventos' ? t('admin.shop.eventsHint') : t('admin.shop.gridHint')}</p>
        {view === 'eventos' ? (
          events.map((box) => (
            <EventGroup key={box.id} box={box} items={data.items.filter((item) => item.evento === box.id)} onOpen={setEditing} />
          ))
        ) : shown.length === 0 ? (
          <p className={styles.dim}>{t('admin.shop.emptyFilter')}</p>
        ) : (
          <ul className={styles.shopGrid}>
            {shown.map((item) => (
              <li key={item.id}>
                <ShopTile item={item} position={kindItems.indexOf(item)} onOpen={() => setEditing(item.id)} />
              </li>
            ))}
          </ul>
        )}
      </section>

      {edited && (
        <EditModal
          key={`${edited.id}:${edited.propio}:${edited.oferta}:${edited.retirado}`}
          item={edited}
          list={editedList}
          box={editedBox}
          onClose={() => setEditing(null)}
        />
      )}
      {saleOpen && <SaleModal rebaja={data.rebaja} onClose={() => setSaleOpen(false)} />}
    </>
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

/** The price a style sells at, or how it's had when it isn't sold. */
function PriceLine({ item }: { item: AdminShopItem }) {
  const { t } = useTranslation()
  if (item.evento) return <span className={styles.dim}>{t('admin.shop.fromBox', { name: t(`eventNames.${item.evento}`) })}</span>
  if (item.from !== 'tienda') return <span className={styles.dim}>{t(`admin.shop.from.${item.from}`)}</span>
  return (
    <span className={styles.shopPrice} data-offer={!!item.antes}>
      <span className={styles.shopCoin} aria-hidden="true" />
      {item.antes && <s>{number(item.antes)}</s>}
      {number(item.precio)}
    </span>
  )
}

function ShopTile({
  item,
  position,
  box,
  onOpen,
}: {
  item: AdminShopItem
  /** Where it goes among its kind; none for an event's style. */
  position?: number
  box?: EventBox
  onOpen: () => void
}) {
  const { t } = useTranslation()
  const name = t(`styles.items.${item.id}`)
  // An event's style isn't retired: it's in the box while the event is on, and discontinued after.
  const badge = box
    ? box.abierta
      ? 'inBox'
      : 'discontinued'
    : item.retirado
      ? 'retired'
      : item.oferta
        ? 'offer'
        : item.propio !== null
          ? 'own'
          : null
  return (
    <button
      className={styles.shopTile}
      type="button"
      data-off={box ? !box.abierta : item.retirado}
      aria-label={t('admin.shop.edit', { name })}
      onClick={onOpen}
    >
      <span className={styles.shopTileTop}>
        <StylePreview id={item.id} tipo={item.tipo} className={styles.shopPreview} spot={false} />
        {position !== undefined && (
          <span className={styles.shopPos}>{position === 0 ? t('admin.shop.free') : position + 1}</span>
        )}
        {badge && (
          <span className={styles.shopBadge} data-badge={badge}>
            {t(`admin.shop.badge.${badge}`)}
          </span>
        )}
      </span>
      <span className={styles.shopTileBody}>
        <b>{name}</b>
        <PriceLine item={item} />
        <small className={styles.dim}>
          {t('admin.shop.boughtN', { count: item.bought, n: number(item.bought) })} ·{' '}
          {t('admin.shop.wearingN', { count: item.wearing, n: number(item.wearing) })}
        </small>
      </span>
    </button>
  )
}

/** One event's styles under its name and year, Halloween 2026, and how its box is doing. */
function EventGroup({ box, items, onOpen }: { box: EventBox; items: AdminShopItem[]; onOpen: (id: string) => void }) {
  const { t } = useTranslation()
  const date = lastDayOf(box.hasta, currentLanguage())
  const year = new Date(new Date(box.hasta).getTime() - 1).getFullYear()
  const name = `${t(`eventNames.${box.id}`)} ${year}`
  const status = box.abierta
    ? t('admin.shop.eventOpen', { date })
    : box.acabado
      ? t('admin.events.ended', { date })
      : t('admin.shop.eventOff')
  return (
    <section className={styles.shopEvent} aria-label={name}>
      <h3 className={styles.shopEventHead}>
        {name}
        <small>{status}</small>
      </h3>
      <ul className={styles.shopGrid}>
        {items.map((item) => (
          <li key={item.id}>
            <ShopTile item={item} box={box} onOpen={() => onOpen(item.id)} />
          </li>
        ))}
      </ul>
    </section>
  )
}

/** One style: its price, an offer, where it goes in the shop and whether it's sold. */
function EditModal({
  item,
  list,
  box,
  onClose,
}: {
  item: AdminShopItem
  list: AdminShopItem[]
  /** The event's box, for one of its styles: not sold, so no price to set. */
  box?: EventBox
  onClose: () => void
}) {
  const { t } = useTranslation()
  const setItem = useSetShopItem()
  const setOrder = useSetShopOrder()
  const serie = item.serie ?? 0
  const [price, setPrice] = useState(String(item.propio ?? serie))
  const [offer, setOffer] = useState(item.oferta ? String(item.oferta) : '')
  const [onSale, setOnSale] = useState(!item.retirado)

  const index = list.indexOf(item)
  // The free one stays first; the rest move among themselves, and right away.
  const move = (by: number) => {
    const ids = list.map((other) => other.id)
    ids.splice(index, 1)
    ids.splice(index + by, 0, item.id)
    setOrder.mutate({ tipo: item.tipo, ids: ids.slice(1) })
  }

  const isSold = sold(item)
  const p = Number(price)
  const o = offer ? Number(offer) : null
  const priceOk = Number.isInteger(p) && p >= 1
  const offerOk = o === null || (Number.isInteger(o) && o >= 1 && o < p)
  const changed = p !== (item.propio ?? serie) || o !== item.oferta || onSale === item.retirado

  const submit = (event: FormEvent) => {
    event.preventDefault()
    if (!priceOk || !offerOk || !changed) return
    setItem.mutate({ id: item.id, precio: p === serie ? null : p, oferta: o, retirado: !onSale }, { onSuccess: onClose })
  }
  const error = setItem.error ?? setOrder.error

  return (
    <Modal title={t(`styles.items.${item.id}`)} eyebrow={t(`styles.kind.${item.tipo}`)} wide onClose={onClose}>
      <div className={styles.shopModal}>
        <StylePreview id={item.id} tipo={item.tipo} className={styles.shopModalPreview} />
        <form className={styles.shopForm} onSubmit={submit}>
          <div className={styles.shopNumbers}>
            <Stat value={number(item.bought)} label={t('admin.shop.bought')} />
            <Stat value={number(item.coins)} label={t('admin.shop.coins')} />
            <Stat value={number(item.wearing)} label={t('admin.shop.wearing')} />
          </div>

          {isSold ? (
            <div className={styles.shopFields}>
              <label className={styles.formField}>
                {t('admin.shop.priceLabel')}
                <input
                  className={`${styles.fieldInput} ${styles.numberInput}`}
                  value={price}
                  onChange={(event) => setPrice(event.target.value.replace(/\D/g, '').slice(0, 7))}
                  inputMode="numeric"
                />
                <small>{t('admin.shop.serie', { n: number(serie) })}</small>
              </label>
              <label className={styles.formField}>
                {t('admin.shop.offer')}
                <input
                  className={`${styles.fieldInput} ${styles.numberInput}`}
                  value={offer}
                  placeholder={t('admin.shop.noOffer')}
                  onChange={(event) => setOffer(event.target.value.replace(/\D/g, '').slice(0, 7))}
                  inputMode="numeric"
                />
                <small className={offerOk ? undefined : 'error-text'}>{t('admin.shop.offerHint')}</small>
              </label>
            </div>
          ) : (
            <p className={styles.dim}>
              <PriceLine item={item} />
              {box && ` · ${t(box.abierta ? 'admin.shop.badge.inBox' : 'admin.shop.badge.discontinued')}`}
            </p>
          )}

          <div className={styles.shopRowBox}>
            <span>
              <b>{t('admin.shop.position')}</b>
              <small>
                {index === 0 ? t('admin.shop.freeFirst') : t('admin.shop.positionOf', { n: index + 1, total: list.length })}
              </small>
            </span>
            <span className={styles.shopMove}>
              <button
                type="button"
                aria-label={t('admin.shop.before')}
                disabled={index <= 1 || setOrder.isPending}
                onClick={() => move(-1)}
              >
                <ChevronLeftIcon width={18} height={18} />
              </button>
              <button
                type="button"
                aria-label={t('admin.shop.after')}
                disabled={index === 0 || index === list.length - 1 || setOrder.isPending}
                onClick={() => move(1)}
              >
                <ChevronRightIcon width={18} height={18} />
              </button>
            </span>
          </div>

          {isSold && (
            <div className={styles.shopRowBox}>
              <span>
                <b>{t('admin.shop.on')}</b>
                <small>{onSale ? t('admin.shop.onHint') : t('admin.shop.offHint')}</small>
              </span>
              <button
                className={styles.switch}
                type="button"
                role="switch"
                aria-checked={onSale}
                aria-label={t('admin.shop.on')}
                onClick={() => setOnSale(!onSale)}
              />
            </div>
          )}

          {error && <p className="error-text">{error.message}</p>}

          {isSold && (
            <div className={styles.shopActions}>
              <button
                className={styles.linkButton}
                type="button"
                disabled={p === serie}
                onClick={() => setPrice(String(serie))}
              >
                {t('admin.shop.reset')}
              </button>
              <span>
                <button className="btn btn-secondary" type="button" onClick={onClose}>
                  {t('common.cancel')}
                </button>
                <button className="btn btn-primary" type="submit" disabled={!priceOk || !offerOk || !changed || setItem.isPending}>
                  {t('common.save')}
                </button>
              </span>
            </div>
          )}
        </form>
      </div>
    </Modal>
  )
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <span className={styles.shopStat}>
      <b>{value}</b>
      <small>{label}</small>
    </span>
  )
}

/** A percentage off everything sold, for an event or a weekend. */
function SaleModal({ rebaja, onClose }: { rebaja: AdminShop['rebaja']; onClose: () => void }) {
  const { t } = useTranslation()
  const save = useSetShopSale()
  const [value, setValue] = useState(String(rebaja || 20))
  const n = Number(value || 0)
  const valid = Number.isInteger(n) && n >= 0 && n <= 90
  const apply = (next: number) => save.mutate({ rebaja: next }, { onSuccess: onClose })

  const submit = (event: FormEvent) => {
    event.preventDefault()
    if (valid && n !== rebaja) apply(n)
  }
  return (
    <Modal title={t('admin.shop.sale')} onClose={onClose}>
      <form className={styles.shopForm} onSubmit={submit}>
        <p className={styles.dim}>{rebaja ? t('admin.shop.saleOn', { n: rebaja }) : t('admin.shop.saleHint')}</p>
        <label className={styles.shopPercent}>
          <span className="sr-only">{t('admin.shop.percent')}</span>
          <input
            value={value}
            placeholder="0"
            onChange={(event) => setValue(event.target.value.replace(/\D/g, '').slice(0, 2))}
            inputMode="numeric"
          />
          <span aria-hidden="true">%</span>
        </label>
        <div className={styles.shopPresets} role="group" aria-label={t('admin.shop.percent')}>
          {SALE_PRESETS.map((p) => (
            <button key={p} type="button" aria-pressed={n === p} onClick={() => setValue(String(p))}>
              {p} %
            </button>
          ))}
        </div>
        <div className={styles.shopRowBox}>
          <span>
            <b>{t('admin.shop.examples')}</b>
            {[100, 400, 1000, 1600].map((base) => (
              <small key={base} className={styles.shopExample}>
                <s>{number(base)}</s> {number(Math.max(1, Math.round((base * (100 - (valid ? n : 0))) / 100)))}
              </small>
            ))}
          </span>
        </div>
        {!valid && <p className="error-text">{t('admin.shop.percentHint')}</p>}
        {save.isError && <p className="error-text">{save.error.message}</p>}
        <div className={styles.shopActions}>
          {rebaja > 0 ? (
            <button className={styles.linkButtonDanger} type="button" disabled={save.isPending} onClick={() => apply(0)}>
              {t('admin.shop.end')}
            </button>
          ) : (
            <span />
          )}
          <span>
            <button className="btn btn-secondary" type="button" onClick={onClose}>
              {t('common.cancel')}
            </button>
            <button className="btn btn-primary" type="submit" disabled={!valid || n === rebaja || save.isPending}>
              {t('admin.shop.apply')}
            </button>
          </span>
        </div>
      </form>
    </Modal>
  )
}
