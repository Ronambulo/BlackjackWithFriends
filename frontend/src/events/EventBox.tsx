'use client'

import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Showcase } from '@/cosmetics/Showcase'
import { StylePreview } from '@/cosmetics/StylePreview'
import { useCosmetics, useEquip, useOpenEventBox, type EventBox as Box, type EventId, type StyleId } from '@/cosmetics/useCosmetics'
import { currentLanguage } from '@/i18n'
import { ApiError } from '@/lib/api'
import { formatNumber } from '@/lib/format'
import { play } from '@/sound/sounds'
import { CheckIcon, ChevronRightIcon } from '@/ui/icons'
import { Modal } from '@/ui/Modal'
import styles from './EventBox.module.css'
import { EVENT_THEMES, eventPath } from './themes'

// The light runs over the box at least this long, so a fast answer still feels like opening something.
const SPIN_MS = 1200
// How long each style stays lit while the light runs, and the most it slows down to before it stops.
const STEP_MS = 85
const SLOWEST_MS = 420
// How long the light rests on the prize before it's shown.
const HOLD_MS = 900
const DAY = 24 * 60 * 60 * 1000

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

/** The last day a box is on, in Spain: it goes at midnight after it. */
export const lastDayOf = (hasta: string, lang: string) =>
  new Intl.DateTimeFormat(lang, { day: 'numeric', month: 'long', timeZone: 'Europe/Madrid' }).format(new Date(new Date(hasta).getTime() - 1))

const isOn = (hasta: string) => new Date(hasta).getTime() > Date.now()

/** Every event's banner on the home screen, while its box is on. */
export function EventBanners() {
  const { data } = useCosmetics()
  return data?.eventos.filter((box) => isOn(box.hasta)).map((box) => <EventBanner key={box.id} box={box} />)
}

/** An event's banner: it takes you to the box's own page. */
function EventBanner({ box }: { box: Box }) {
  const { t } = useTranslation()
  const lang = currentLanguage()
  const theme = EVENT_THEMES[box.id]
  const name = t(`eventNames.${box.id}`)
  const had = box.items.filter((item) => item.owned).length

  return (
    <Link href={eventPath(box.id)} className={`card ${styles.themed} ${styles.card} ${styles.banner}`} style={theme.style}>
      <theme.BannerArt />
      <theme.Icon className={styles.icon} />
      <span className={styles.titles}>
        <span className={styles.eyebrow}>{t('eventBox.eyebrow', { name, date: lastDayOf(box.hasta, lang) })}</span>
        <b className={styles.title}>{t(`eventTitles.${box.id}`)}</b>
        <span className={styles.text}>
          {had === box.items.length
            ? t('eventBox.all')
            : t('eventBox.banner', { name, price: formatNumber(box.precio, lang), had, total: box.items.length })}
        </span>
      </span>
      <ChevronRightIcon className={styles.chevron} width={22} height={22} aria-hidden="true" />
    </Link>
  )
}

/** An event's box on its card, small: for lists of events. */
export function EventBadge({ id }: { id: EventId }) {
  const theme = EVENT_THEMES[id]
  return (
    <span className={`${styles.themed} ${styles.badge}`} style={theme.style} aria-hidden="true">
      <theme.Icon className={styles.icon} />
    </span>
  )
}

/**
 * An event's box, on its own page until it goes: every style in it on show,
 * and a box to open for one the player doesn't have yet. What comes out leaves the box.
 */
export function EventBoxPage({ id }: { id: EventId }) {
  const { t } = useTranslation()
  const lang = currentLanguage()
  const { data } = useCosmetics()
  const open = useOpenEventBox()
  const equip = useEquip()
  const [won, setWon] = useState<StyleId | null>(null)
  // While the box opens: what the player had before, so the prize isn't stamped theirs before the light lands on it.
  const [before, setBefore] = useState<Set<StyleId> | null>(null)
  const [lit, setLit] = useState<StyleId | null>(null)
  const [landed, setLanded] = useState(false)
  // The prize just won: its stamp lands with a thud back in the box.
  const [fresh, setFresh] = useState<StyleId | null>(null)
  // The style being looked at up close, on a small table with the rest of what's worn.
  const [peek, setPeek] = useState<StyleId | null>(null)
  const alive = useRef(true)
  // Set on every mount: in development React mounts, unmounts and mounts again.
  useEffect(() => {
    alive.current = true
    return () => {
      alive.current = false
    }
  }, [])

  const theme = EVENT_THEMES[id]
  const name = t(`eventNames.${id}`)
  const box = data?.eventos.find((event) => event.id === id)
  if (!data) return null
  if (!box || !isOn(box.hasta))
    return (
      <section className={`card ${styles.themed} ${styles.card}`} style={theme.style}>
        <p className={styles.text}>{t('eventBox.gone', { name })}</p>
      </section>
    )

  const owns = (style: StyleId, owned: boolean) => (before ? before.has(style) : owned)
  const had = box.items.filter((item) => owns(item.id, item.owned)).length
  const left = box.items.length - had
  const short = data.monedas < box.precio
  const busy = before !== null || open.isPending
  const daysLeft = Math.max(1, Math.ceil((new Date(box.hasta).getTime() - Date.now()) / DAY))
  const prize = won ? box.items.find((item) => item.id === won) : undefined
  const peeked = peek ? box.items.find((item) => item.id === peek) : undefined

  /** A light runs over the styles still in the box, slows down and stops on the prize. */
  const openBox = async () => {
    const pool = box.items.filter((item) => !item.owned).map((item) => item.id)
    const n = pool.length
    const got: { won?: StyleId; failed?: boolean } = {}
    setWon(null)
    setFresh(null)
    setLanded(false)
    setBefore(new Set(box.items.filter((item) => item.owned).map((item) => item.id)))
    play('box-open')
    const request = open.mutateAsync({ evento: box.id, precio: box.precio }).then(
      (result) => void (got.won = result.won),
      () => void (got.failed = true),
    )

    // With only one left there's nothing to choose between: it just comes out.
    const spin = n > 1
    let step = Math.floor(Math.random() * n)
    const started = Date.now()
    while (spin && alive.current && !got.failed && (!got.won || Date.now() - started < SPIN_MS)) {
      setLit(pool[step++ % n])
      play('box-tick')
      await sleep(STEP_MS)
    }
    await request
    if (!alive.current) return
    const prizeId = got.won
    if (!prizeId) {
      play('lose')
      setLit(null)
      setBefore(null)
      return
    }

    if (spin) {
      // Slow down to a stop on the prize, with one more lap when it's close.
      const distance = (((pool.indexOf(prizeId) - step) % n) + n) % n
      const steps = distance + (distance < 4 ? n : 0)
      for (let k = 0; k <= steps && alive.current; k++) {
        setLit(pool[(step + k) % n])
        play('box-tick')
        if (k < steps) await sleep(STEP_MS + (k / steps) ** 2 * (SLOWEST_MS - STEP_MS))
      }
      setLanded(true)
      await sleep(HOLD_MS)
      if (!alive.current) return
    }
    setLit(null)
    setLanded(false)
    setBefore(null)
    setWon(prizeId)
    setFresh(prizeId)
    play('box-reveal')
  }

  const failed = open.error
  return (
    <div className={`${styles.themed} ${styles.box}`} style={theme.style}>
      <header className={styles.hero}>
        <theme.HeroArt />
        <theme.Icon className={`${styles.icon} ${styles.iconBig} ${busy ? styles.shaking : ''}`} />
        <span className={styles.eyebrow}>{t('eventBox.eyebrow', { name, date: lastDayOf(box.hasta, lang) })}</span>
        <h2 className={styles.heroTitle}>{t(`eventTitles.${id}`)}</h2>
        <p className={styles.heroText}>{t('eventBox.text', { name })}</p>
        <div className={styles.progress}>
          <span className={styles.bar} aria-hidden="true">
            <span style={{ width: `${(had / box.items.length) * 100}%` }} />
          </span>
          <small>
            {t('eventBox.progress', { had, total: box.items.length })} · {t('eventBox.daysLeft', { count: daysLeft })}
          </small>
        </div>
      </header>

      <section className={styles.inside} aria-labelledby="event-inside">
        <h3 id="event-inside" className={styles.insideLabel}>
          {t('eventBox.inside')}
        </h3>
        <ul className={styles.grid}>
          {box.items.map((item) => (
            <li
              key={item.id}
              className={styles.item}
              data-owned={owns(item.id, item.owned) || undefined}
              data-lit={lit === item.id || undefined}
              data-landed={(landed && lit === item.id) || undefined}
              data-fresh={fresh === item.id || undefined}
            >
              <button className={styles.itemButton} type="button" disabled={busy} onClick={() => setPeek(item.id)}>
                <StylePreview id={item.id} tipo={item.tipo} equipped={data.equipped} spot={false} className={styles.preview} />
                <span className={styles.itemName}>{t(`styles.items.${item.id}`)}</span>
                <span className={styles.itemKind}>{t(`styles.kind.${item.tipo}`)}</span>
              </button>
              {owns(item.id, item.owned) && (
                <span className={styles.stamp}>
                  <CheckIcon width={10} height={10} /> {t('styles.owned')}
                </span>
              )}
            </li>
          ))}
        </ul>
      </section>

      <div className={styles.dock}>
        {left > 0 && short && !busy && <p className={styles.hint}>{t('eventBox.short', { n: formatNumber(box.precio - data.monedas, lang) })}</p>}
        {failed && !busy && (
          <p className="error-text" role="alert">
            {failed instanceof ApiError && failed.status === 402
              ? t('styles.notEnough')
              : failed instanceof ApiError && failed.status === 409
                ? t('eventBox.changed')
                : failed instanceof ApiError && failed.status === 410
                  ? t('eventBox.gone', { name })
                  : t('common.error')}
          </p>
        )}
        {left > 0 ? (
          <button className={styles.open} type="button" disabled={busy || short} onClick={() => void openBox()}>
            {busy ? (
              t('eventBox.opening')
            ) : (
              <>
                {t('eventBox.open')}
                <span className={styles.price}>
                  <span className={styles.coin} aria-hidden="true" />
                  {formatNumber(box.precio, lang)}
                </span>
              </>
            )}
          </button>
        ) : (
          <span className={styles.done}>{t('eventBox.all')}</span>
        )}
      </div>

      {peeked && (
        <Modal title={t(`styles.items.${peeked.id}`)} eyebrow={t(`styles.kind.${peeked.tipo}`)} onClose={() => setPeek(null)}>
          <Showcase equipped={{ ...data.equipped, [peeked.tipo]: peeked.id }} className={styles.peekTable} />
          <div className={styles.peekFoot}>
            {!peeked.owned ? (
              <span className={styles.peekNote}>{t('eventBox.stillIn')}</span>
            ) : data.equipped[peeked.tipo] === peeked.id ? (
              <span className={styles.worn}>
                <CheckIcon width={14} height={14} /> {t('styles.wearing')}
              </span>
            ) : (
              <>
                <span className={styles.peekNote}>{t('eventBox.yours')}</span>
                <button className="btn btn-primary" type="button" disabled={equip.isPending} onClick={() => equip.mutate({ id: peeked.id })}>
                  {t('styles.wear')}
                </button>
              </>
            )}
          </div>
        </Modal>
      )}

      {prize && (
        <div className={styles.overlay} role="dialog" aria-modal="true" aria-labelledby="event-prize">
          <div className={styles.reveal}>
            <span className={styles.revealGlow} aria-hidden="true" />
            <span className={styles.revealLabel}>{t('eventBox.youGot')}</span>
            <StylePreview id={prize.id} tipo={prize.tipo} equipped={data.equipped} spot={false} className={styles.revealPreview} />
            <b id="event-prize" className={styles.revealName}>
              {t(`styles.items.${prize.id}`)}
            </b>
            <span className={styles.revealKind}>{t(`styles.kind.${prize.tipo}`)}</span>
            <div className={styles.revealActions}>
              {data.equipped[prize.tipo] === prize.id ? (
                <span className={styles.worn}>
                  <CheckIcon width={14} height={14} /> {t('styles.wearing')}
                </span>
              ) : (
                <button className={styles.open} type="button" disabled={equip.isPending} onClick={() => equip.mutate({ id: prize.id })}>
                  {t('styles.wear')}
                </button>
              )}
              <button className="btn btn-secondary" type="button" onClick={() => setWon(null)}>
                {t('eventBox.back')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
