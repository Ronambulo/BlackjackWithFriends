'use client'

import { useDeferredValue, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useAdminShop, useShopBuyers, type AdminShopItem, type ShopBuyer } from '@/admin/useAdmin'
import { date, number } from '@/admin/format'
import { StylePreview } from '@/cosmetics/StylePreview'
import { KINDS, type CosmeticKind } from '@/cosmetics/themes'
import type { StyleId } from '@/cosmetics/useCosmetics'
import { Avatar } from '@/ui/Avatar'
import { SearchIcon } from '@/ui/icons'
import styles from './admin.module.css'
import { useAdminPanel } from './context'

type Kind = CosmeticKind | 'all'
type Sort = 'spent' | 'items' | 'recent'
const SORTS: Sort[] = ['spent', 'items', 'recent']

const sold = (item: AdminShopItem) => item.from === 'tienda'
const lastAt = (buyer: ShopBuyer) => Math.max(...buyer.items.map((item) => item.at))

/** How the styles sell, and who has bought what. */
export function StylesTab() {
  const { t } = useTranslation()
  const shop = useAdminShop()
  const buyers = useShopBuyers()

  if (shop.isPending || buyers.isPending) return <section className={`card ${styles.placeholder}`} aria-busy="true" />
  if (shop.isError || buyers.isError || !shop.data || !buyers.data)
    return (
      <section className="card">
        <p className={styles.dim}>{t('common.error')}</p>
        <button
          className="btn btn-secondary"
          type="button"
          onClick={() => {
            void shop.refetch()
            void buyers.refetch()
          }}
        >
          {t('common.retry')}
        </button>
      </section>
    )

  const list = buyers.data
  const purchases = list.reduce((sum, buyer) => sum + buyer.items.length, 0)
  const spent = list.reduce((sum, buyer) => sum + buyer.spent, 0)

  return (
    <>
      <section className={styles.shopTiles}>
        <Tile value={number(list.length)} label={t('admin.styleStats.buyers')} />
        <Tile value={number(purchases)} label={t('admin.shop.purchases')} />
        <Tile value={number(spent)} label={t('admin.shop.spent')} />
        <Tile value={number(list.length ? Math.round(spent / list.length) : 0)} label={t('admin.styleStats.perBuyer')} />
      </section>
      <Buyers buyers={list} />
      <section className={`card ${styles.block}`}>
        <ShopStats items={shop.data.items} />
      </section>
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

/** Every player who has bought something, with each style they bought. */
function Buyers({ buyers }: { buyers: ShopBuyer[] }) {
  const { t } = useTranslation()
  const { openUser } = useAdminPanel()
  const [query, setQuery] = useState('')
  const [kind, setKind] = useState<Kind>('all')
  const [sort, setSort] = useState<Sort>('spent')
  const [open, setOpen] = useState<string | null>(null)
  const q = useDeferredValue(query.trim().toLowerCase())

  const name = (id: StyleId) => t(`styles.items.${id}`)
  // A search finds the player or the style; a kind keeps only those styles.
  const shown = buyers
    .map((buyer) => {
      const byPlayer = !q || buyer.username.toLowerCase().includes(q) || !!buyer.nombre?.toLowerCase().includes(q)
      const items = buyer.items.filter(
        (item) => (kind === 'all' || item.tipo === kind) && (byPlayer || name(item.id).toLowerCase().includes(q)),
      )
      return { ...buyer, items }
    })
    .filter((buyer) => buyer.items.length > 0)
    .sort((a, b) =>
      sort === 'items'
        ? b.items.length - a.items.length || b.spent - a.spent
        : sort === 'recent'
          ? lastAt(b) - lastAt(a)
          : b.spent - a.spent || b.items.length - a.items.length,
    )

  return (
    <section className={`card ${styles.block}`}>
      <div className={styles.toolbar}>
        <h2 className="label">{t('admin.styleStats.who')}</h2>
        <div className={styles.toolbarEnd}>
          <label className={styles.searchBox}>
            <SearchIcon width={18} height={18} className={styles.dim} />
            <input
              type="search"
              placeholder={t('admin.styleStats.search')}
              aria-label={t('admin.styleStats.search')}
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
          </label>
          <button className="btn btn-secondary" type="button" onClick={() => setSort(SORTS[(SORTS.indexOf(sort) + 1) % SORTS.length])}>
            {t(`admin.styleStats.sort.${sort}`)}
          </button>
        </div>
      </div>
      <div className={styles.shopFilters} role="group" aria-label={t('styles.kinds')}>
        {(['all', ...KINDS] as Kind[]).map((k) => (
          <button key={k} type="button" aria-pressed={kind === k} onClick={() => setKind(k)}>
            {k === 'all' ? t('admin.shop.filters.all') : t(`admin.shop.kinds.${k}`)}
          </button>
        ))}
      </div>

      {shown.length === 0 ? (
        <p className={styles.dim}>{buyers.length ? t('admin.styleStats.noMatch') : t('admin.shop.nothingYet')}</p>
      ) : (
        <ul className={styles.buyerList}>
          {shown.map((buyer) => {
            const expanded = open === buyer.id
            const spent = buyer.items.reduce((sum, item) => sum + item.monedas, 0)
            return (
              <li key={buyer.id} className={styles.buyer}>
                <button type="button" className={styles.buyerHead} aria-expanded={expanded} onClick={() => setOpen(expanded ? null : buyer.id)}>
                  <Avatar seed={buyer.id} name={buyer.nombre ?? buyer.username} src={buyer.avatarUrl} size={40} />
                  <span className={styles.userName}>
                    <b>{buyer.nombre ?? buyer.username}</b>
                    <small>
                      @{buyer.username} · {t('admin.shop.boughtN', { count: buyer.items.length, n: number(buyer.items.length) })}
                    </small>
                  </span>
                  <span className={styles.buyerMinis} aria-hidden="true">
                    {buyer.items.slice(0, 4).map((item) => (
                      <StylePreview key={item.id} id={item.id} tipo={item.tipo} className={styles.buyerMini} spot={false} />
                    ))}
                  </span>
                  <span className={styles.buyerSpent}>
                    <b>
                      <span className={styles.shopCoin} aria-hidden="true" />
                      {number(spent)}
                    </b>
                    <small className={styles.dim}>{t('admin.styleStats.left', { n: number(buyer.monedas) })}</small>
                  </span>
                </button>
                {expanded && (
                  <div className={styles.buyerBody}>
                    <ul className={styles.buyerItems}>
                      {buyer.items.map((item) => (
                        <li key={item.id}>
                          <StylePreview id={item.id} tipo={item.tipo} className={styles.shopMini} />
                          <span className={styles.userName}>
                            <b>{name(item.id)}</b>
                            <small>
                              {t(`styles.kind.${item.tipo}`)} · {date(item.at)}
                            </small>
                          </span>
                          {item.wearing && <span className={styles.buyerWearing}>{t('admin.styleStats.wearing')}</span>}
                          <b className={styles.shopPrice}>
                            <span className={styles.shopCoin} aria-hidden="true" />
                            {number(item.monedas)}
                          </b>
                        </li>
                      ))}
                    </ul>
                    <button className={styles.linkButton} type="button" onClick={() => openUser({ id: buyer.id, username: buyer.username })}>
                      {t('admin.styleStats.openPlayer')}
                    </button>
                  </div>
                )}
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}

/** How the shop sells: coins per kind, and the styles that sell, are worn and earn the most. */
function ShopStats({ items }: { items: AdminShopItem[] }) {
  const { t } = useTranslation()
  const perKind = KINDS.map((kind) => {
    const of = items.filter((item) => item.tipo === kind)
    return { kind, coins: of.reduce((sum, item) => sum + item.coins, 0), bought: of.reduce((sum, item) => sum + item.bought, 0) }
  })
  const most = Math.max(1, ...perKind.map((row) => row.coins))
  // Only what can be bought: the free styles everyone starts with would top "most worn".
  const top = (key: 'bought' | 'wearing' | 'coins') =>
    items
      .filter((item) => sold(item) && item[key] > 0)
      .sort((a, b) => b[key] - a[key])
      .slice(0, 5)
  const never = items.filter((item) => sold(item) && !item.retirado && item.bought === 0).length

  return (
    <div className={styles.shopStats}>
      <section className={styles.shopStatsWide}>
        <h3 className="label">{t('admin.shop.byKind')}</h3>
        {perKind.map((row) => (
          <div key={row.kind} className={styles.shopBarRow}>
            <b>{t(`styles.kind.${row.kind}`)}</b>
            <span className={styles.shopBarTrack}>
              <span style={{ width: `${(row.coins / most) * 100}%` }} />
            </span>
            <span>
              {number(row.coins)} <small className={styles.dim}>· {t('admin.shop.boughtN', { count: row.bought, n: number(row.bought) })}</small>
            </span>
          </div>
        ))}
        <small className={styles.dim}>{t('admin.shop.neverBought', { count: never })}</small>
      </section>
      <div className={styles.shopRankings}>
        {(['bought', 'wearing', 'coins'] as const).map((key) => {
          const rows = top(key)
          return (
            <section key={key} className={styles.shopRanking}>
              <h3 className="label">{t(`admin.shop.top.${key}`)}</h3>
              {rows.length === 0 ? (
                <p className={styles.dim}>{t('admin.shop.nothingYet')}</p>
              ) : (
                <ol>
                  {rows.map((item, i) => (
                    <li key={item.id}>
                      <span className={styles.dim}>{i + 1}</span>
                      <StylePreview id={item.id} tipo={item.tipo} className={styles.shopMini} />
                      <span className={styles.userName}>
                        <b>{t(`styles.items.${item.id}`)}</b>
                        <small>{t(`styles.kind.${item.tipo}`)}</small>
                      </span>
                      <b>{number(item[key])}</b>
                    </li>
                  ))}
                </ol>
              )}
            </section>
          )
        })}
      </div>
    </div>
  )
}
