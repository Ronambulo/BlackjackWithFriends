'use client'

import type { Card } from '@bwf/engine'
import Link from 'next/link'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useUser } from '@/auth/session-context'
import { Chip, StylePreview } from '@/cosmetics/StylePreview'
import { KINDS, themeStyle, type CosmeticKind, type Equipped } from '@/cosmetics/themes'
import { useBuy, useCosmetics, useEquip, type CosmeticItem } from '@/cosmetics/useCosmetics'
import { currentLanguage } from '@/i18n'
import { ApiError } from '@/lib/api'
import { formatNumber } from '@/lib/format'
import { useProfile } from '@/profile/useProfile'
import { PlayingCard } from '@/table/PlayingCard'
import { Avatar } from '@/ui/Avatar'
import { ConfirmSheet, SheetIcon } from '@/ui/ConfirmSheet'
import { CheckIcon, ChevronLeftIcon, LockIcon } from '@/ui/icons'
import styles from './styles.module.css'

const SHOWN_CHIPS = [5, 25, 100, 500] as const

const DEALER: (Card | null)[] = [null, { rank: '7', suit: 'C' }]
const PLAYER: Card[] = [
  { rank: 'A', suit: 'H' },
  { rank: 'K', suit: 'S' },
  { rank: '10', suit: 'D' },
]

/** The cosmetics shop: try each style on a small table, buy it with coins, wear it. */
export default function StylesPage() {
  const { t } = useTranslation()
  const lang = currentLanguage()
  const { data, isPending, isError, refetch } = useCosmetics()
  const [kind, setKind] = useState<CosmeticKind>('tapete')
  const [picked, setPicked] = useState<string | null>(null)
  const [buying, setBuying] = useState<CosmeticItem | null>(null)
  const equip = useEquip()
  const buy = useBuy()
  const failed = buy.error ?? equip.error

  const items = data?.items.filter((item) => item.tipo === kind) ?? []
  const selected = items.find((item) => item.id === picked) ?? items.find((item) => item.id === data?.equipped[kind])
  const trying = data && selected ? { ...data.equipped, [kind]: selected.id } : data?.equipped

  const pick = (next: CosmeticKind) => {
    setKind(next)
    setPicked(null)
  }

  return (
    <div className={styles.page}>
      <div className={styles.titleRow}>
        <Link href="/perfil" className={styles.backButton} aria-label={t('common.back')}>
          <ChevronLeftIcon width={22} height={22} />
        </Link>
        <h1 className={styles.title}>{t('styles.title')}</h1>
        {data && (
          <span className={styles.balance} aria-label={t('common.coins', { count: data.monedas })}>
            <span className={styles.coin} aria-hidden="true" />
            {formatNumber(data.monedas, lang)}
          </span>
        )}
      </div>

      <Showcase equipped={trying} />

      {selected && data && (
        <SelectedBar
          item={selected}
          worn={data.equipped[kind] === selected.id}
          coins={data.monedas}
          busy={equip.isPending}
          onEquip={() => equip.mutate({ id: selected.id })}
          onBuy={() => setBuying(selected)}
        />
      )}

      {failed && (
        <p className="error-text" role="alert">
          {failed instanceof ApiError && failed.status === 402
            ? t('styles.notEnough')
            : failed instanceof ApiError && failed.status === 409
              ? t('styles.priceChanged')
              : failed instanceof ApiError && failed.status === 410
                ? t('styles.gone')
                : t('common.error')}
        </p>
      )}

      <div className={`segmented ${styles.kinds}`} role="group" aria-label={t('styles.kinds')}>
        {KINDS.map((k) => (
          <button key={k} type="button" aria-pressed={kind === k} onClick={() => pick(k)}>
            {t(`styles.kind.${k}`)}
          </button>
        ))}
      </div>

      {isPending ? (
        <div className={styles.grid} aria-busy="true">
          {Array.from({ length: 6 }, (_, i) => (
            <div key={i} className={`${styles.tile} ${styles.skeleton}`} />
          ))}
        </div>
      ) : isError || !data ? (
        <section className="card">
          <p className="muted">{t('common.error')}</p>
          <button className="btn btn-secondary" type="button" onClick={() => void refetch()}>
            {t('common.retry')}
          </button>
        </section>
      ) : (
        <div className={styles.grid}>
          {items.map((item) => (
            <Tile
              key={item.id}
              item={item}
              equipped={data.equipped}
              worn={data.equipped[kind] === item.id}
              picked={selected?.id === item.id}
              onPick={() => setPicked(item.id)}
            />
          ))}
        </div>
      )}

      <ConfirmSheet
        open={buying !== null}
        tone="accent"
        icon={
          <SheetIcon tone="accent">
            <span className={styles.coinBig} />
          </SheetIcon>
        }
        title={buying ? t('styles.buyTitle', { name: t(`styles.items.${buying.id}`) }) : ''}
        text={
          buying?.from === 'tienda' && data
            ? t('styles.buyText', {
                price: formatNumber(buying.precio, lang),
                left: formatNumber(data.monedas - buying.precio, lang),
              })
            : ''
        }
        confirm={buying?.from === 'tienda' ? t('styles.buyConfirm', { price: formatNumber(buying.precio, lang) }) : ''}
        busy={buy.isPending}
        onConfirm={() =>
          buying?.from === 'tienda' && buy.mutate({ id: buying.id, precio: buying.precio }, { onSettled: () => setBuying(null) })
        }
        onCancel={() => setBuying(null)}
      />
    </div>
  )
}

/** A small table wearing the styles being tried on. */
function Showcase({ equipped }: { equipped: Equipped | undefined }) {
  const user = useUser()
  const { data: profile } = useProfile()
  return (
    <div className={styles.showcase} style={themeStyle(equipped)} aria-hidden="true">
      <div className={styles.cards}>
        {DEALER.map((card, i) => (
          <PlayingCard key={i} card={card} still />
        ))}
      </div>
      <div className={styles.cards}>
        {PLAYER.map((card, i) => (
          <PlayingCard key={i} card={card} still />
        ))}
      </div>
      <div className={styles.seat}>
        <Avatar seed={user.id} name={profile?.nombre ?? ''} src={profile?.avatar_url} size={40} frame={equipped?.marco} />
        <div className={styles.chips}>
          {SHOWN_CHIPS.map((value) => (
            <Chip key={value} value={value} />
          ))}
        </div>
      </div>
    </div>
  )
}

/** Below the showcase: what the picked style is and what can be done with it. */
function SelectedBar({
  item,
  worn,
  coins,
  busy,
  onEquip,
  onBuy,
}: {
  item: CosmeticItem
  worn: boolean
  coins: number
  busy: boolean
  onEquip: () => void
  onBuy: () => void
}) {
  const { t } = useTranslation()
  const lang = currentLanguage()
  let action
  if (worn) {
    action = (
      <span className={styles.wearing}>
        <CheckIcon width={16} height={16} /> {t('styles.wearing')}
      </span>
    )
  } else if (item.owned) {
    action = (
      <button type="button" className="btn btn-primary" disabled={busy} onClick={onEquip}>
        {t('styles.wear')}
      </button>
    )
  } else if (item.from === 'tienda') {
    action =
      coins >= item.precio ? (
        <button type="button" className="btn btn-primary" onClick={onBuy}>
          <span className={styles.coin} aria-hidden="true" />
          {t('styles.buy', { price: formatNumber(item.precio, lang) })}
        </button>
      ) : (
        <span className={styles.short}>{t('styles.short', { count: item.precio - coins, formatted: formatNumber(item.precio - coins, lang) })}</span>
      )
  } else {
    action = <span className={styles.short}><LockHint item={item} /></span>
  }
  return (
    <div className={styles.selected}>
      <div className={styles.selectedText}>
        <span className="label">{t(`styles.kind.${item.tipo}`)}</span>
        <span className={styles.selectedName}>{t(`styles.items.${item.id}`)}</span>
        {item.from === 'tienda' && item.antes && !item.owned && (
          <span className={styles.sale}>{t('styles.sale', { price: formatNumber(item.antes, lang) })}</span>
        )}
      </div>
      {action}
    </div>
  )
}

/** How a style that isn't sold is had. */
function LockHint({ item }: { item: CosmeticItem }) {
  const { t } = useTranslation()
  if (item.from === 'logro') return t('styles.fromAchievement', { name: t(`achievements.items.${item.logro}.name`) })
  if (item.from === 'trofeo') return t('styles.fromTrophies', { count: item.trofeos })
  return null
}

/** One style in the grid: a little preview, its name and whether it's had. */
function Tile({
  item,
  equipped,
  worn,
  picked,
  onPick,
}: {
  item: CosmeticItem
  equipped: Equipped
  worn: boolean
  picked: boolean
  onPick: () => void
}) {
  const { t } = useTranslation()
  const lang = currentLanguage()
  let state
  if (worn) state = <span className={styles.stateOn}>{t('styles.wearing')}</span>
  else if (item.owned) state = <span className={styles.stateOwned}>{t('styles.owned')}</span>
  else if (item.from === 'tienda')
    state = (
      <span className={styles.statePrice}>
        <span className={styles.coin} aria-hidden="true" />
        {item.antes && <s className={styles.was}>{formatNumber(item.antes, lang)}</s>}
        {formatNumber(item.precio, lang)}
      </span>
    )
  else
    state = (
      <span className={styles.stateLocked}>
        <LockIcon width={12} height={12} /> <LockHint item={item} />
      </span>
    )
  return (
    <button
      type="button"
      className={`${styles.tile} ${picked ? styles.picked : ''} ${!item.owned && item.from !== 'tienda' ? styles.locked : ''}`}
      aria-pressed={picked}
      onClick={onPick}
    >
      <StylePreview id={item.id} tipo={item.tipo} equipped={equipped} className={styles.tilePreview} />
      <span className={styles.tileName}>{t(`styles.items.${item.id}`)}</span>
      {state}
    </button>
  )
}
