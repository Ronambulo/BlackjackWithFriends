'use client'

import type { Action, Card, HandValue, Outcome } from '@bwf/engine'
import { useCallback, useEffect, useId, useState, type CSSProperties, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { UnlockToast, type Notice } from '@/achievements/UnlockToast'
import { currentLanguage } from '@/i18n'
import { useClaimPay, useLeague } from '@/league/useLeague'
import { ApiError } from '@/lib/api'
import { formatNumber } from '@/lib/format'
import { ShareSheet } from '@/social/ShareSheet'
import { play as playSound, preloadSounds, type Sound } from '@/sound/sounds'
import { CheckIcon, FlagIcon, HandIcon, PlusIcon, ShareIcon, SplitIcon } from '@/ui/icons'
import { PlayingCard } from './PlayingCard'
import { useClearFinishedHand, useClearFinishedHandOnLeave, usePlay, useTable, type HandView } from './useTable'
import styles from './Table.module.css'

// What you bet with; 1s only show up in a stack, for amounts that aren't a multiple of 5.
const CHIP_VALUES = [1, 5, 10, 25, 100, 500, 1000] as const
const STACK_VALUES = CHIP_VALUES
const LAST_BET_KEY = 'lastBet'

// ── Deal timing ─────────────────────────────────────────────────────────────
// The server answers at once with the final state; the table replays it card by
// card. Values, results and the chip count wait until the cards have landed.

/** Seconds between two cards leaving the shoe, one card's flight and the hole card's flip. */
const STEP = 0.3
const FLIGHT = 0.42
const FLIP = 0.45

interface Schedule {
  /** When each newly dealt card leaves the shoe, by card key. */
  delays: Map<string, number>
  /** When the hole card turns over, if it does in this update. */
  flipAt: number | null
  /** When everything has landed (0: nothing to animate). */
  done: number
}

const playerKey = (hand: number, index: number, card: Card) => `p${hand}-${index}-${card.rank}${card.suit}`
const dealerKey = (index: number) => `d${index}`

function cardKeys(hand: HandView): string[] {
  return [
    ...hand.hands.flatMap((h, hi) => h.cards.map((c, i) => playerKey(hi, i, c))),
    ...hand.dealer.map((_, i) => dealerKey(i)),
  ]
}

function buildSchedule(prev: HandView | null, next: HandView | null): Schedule {
  const delays = new Map<string, number>()
  if (!next) return { delays, flipAt: null, done: 0 }

  const fresh = !prev || prev.id !== next.id
  const seen = new Set(fresh ? [] : cardKeys(prev))
  let t = 0
  let done = 0
  const add = (key: string) => {
    if (seen.has(key) || delays.has(key)) return
    delays.set(key, t)
    done = t + FLIGHT
    t += STEP
  }

  const first = next.hands[0].cards
  // A new hand is dealt like at a real table: player, dealer, player, dealer.
  if (fresh) [playerKey(0, 0, first[0]), dealerKey(0), playerKey(0, 1, first[1]), dealerKey(1)].forEach(add)
  next.hands.forEach((h, hi) => h.cards.forEach((c, i) => add(playerKey(hi, i, c))))

  let flipAt: number | null = null
  if (next.dealer[1] && (fresh || !prev?.dealer[1])) {
    flipAt = done
    done = flipAt + FLIP
    t = done
  }
  next.dealer.forEach((_, i) => add(dealerKey(i)))
  return { delays, flipAt, done }
}

export function useDealTiming(hand: HandView | null) {
  // Each new state of the hand is compared with the one before it (adjusting state during render).
  const [current, setCurrent] = useState(() => ({ hand, schedule: buildSchedule(null, hand) }))
  let { schedule } = current
  if (current.hand !== hand) {
    schedule = buildSchedule(current.hand, hand)
    setCurrent({ hand, schedule })
  }
  const [finished, setFinished] = useState<Schedule | null>(null)

  useEffect(() => {
    if (schedule.done === 0) return
    const id = setTimeout(() => setFinished(schedule), schedule.done * 1000)
    return () => clearTimeout(id)
  }, [schedule])

  // Each card makes its sound as it leaves the shoe, and the hole card as it turns.
  useEffect(() => {
    const timers = [...schedule.delays.values()].map((at) => setTimeout(() => playSound('card'), at * 1000))
    if (schedule.flipAt !== null) timers.push(setTimeout(() => playSound('flip'), schedule.flipAt * 1000))
    return () => timers.forEach(clearTimeout)
  }, [schedule])

  const reducedMotion = typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
  return { schedule, ready: reducedMotion || schedule.done === 0 || finished === schedule }
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function readLastBet(): number {
  try {
    return Number(localStorage.getItem(LAST_BET_KEY)) || 0
  } catch {
    return 0
  }
}

function saveLastBet(bet: number) {
  try {
    localStorage.setItem(LAST_BET_KEY, String(bet))
  } catch {
    // Private mode: the bet just isn't remembered.
  }
}

/** 18 / 8 while an ace still counts as 11 and the hand can still draw; the plain total once it's final. */
function valueText(value: HandValue, final = false): string {
  return !final && value.soft && value.total < 21 ? `${value.total} / ${value.total - 10}` : String(value.total)
}

export function signed(n: number, lang: ReturnType<typeof currentLanguage>): string {
  if (n === 0) return '±0'
  return `${n > 0 ? '+' : '−'}${formatNumber(Math.abs(n), lang)}`
}

type ChipValue = (typeof STACK_VALUES)[number]

/** A chip's colours, from the player's chip style (cosmetics/themes.ts). */
const chipColors = (value: ChipValue) => ({
  face: `var(--chip${value}-face)`,
  // The face with the style's drawing over the whole chip, if it has one
  background: `var(--chip${value}-art, none) border-box center / 100% 100% no-repeat, var(--chip${value}-face)`,
  edge: `var(--chip${value}-edge)`,
  text: `var(--chip${value}-text)`,
  stripe: `var(--chip${value}-stripe)`,
})

/** The fewest chips that make up an amount, largest first. */
function chipsFor(amount: number): ChipValue[] {
  const chips: ChipValue[] = []
  let rest = amount
  for (const value of [...STACK_VALUES].reverse()) {
    while (rest >= value) {
      chips.push(value)
      rest -= value
    }
  }
  return chips
}

function chipLabel(n: number, lang: ReturnType<typeof currentLanguage>): string {
  return n >= 10000 ? `${Math.round(n / 1000)}K` : formatNumber(n, lang)
}

const OUTCOME_TONE: Record<Outcome, 'win' | 'lose' | 'push'> = {
  blackjack: 'win',
  win: 'win',
  push: 'push',
  lose: 'lose',
  bust: 'lose',
  surrender: 'lose',
}

// ── Table ───────────────────────────────────────────────────────────────────

export function Table() {
  const { t } = useTranslation()
  const lang = currentLanguage()
  const { data: table, isPending, isError, refetch } = useTable()
  const play = usePlay()
  const clearHand = useClearFinishedHand()
  useClearFinishedHandOnLeave()
  const { data: league } = useLeague()
  const claimPay = useClaimPay()
  // While a new hand is on its way the bet already sits on the felt, so the tap
  // answers at once instead of after the round trip.
  const pendingBet = play.isPending && play.variables.action === 'bet' ? play.variables.bet : null
  const hand = pendingBet === null ? (table?.hand ?? null) : null
  const { schedule, ready } = useDealTiming(hand)

  // The chip count catches up once the cards have shown how the hand went.
  const [shownChips, setShownChips] = useState<number | null>(null)
  if (ready && table && shownChips !== table.chips) setShownChips(table.chips)
  const chips = table ? (ready ? table.chips : (shownChips ?? table.chips)) - (pendingBet ?? 0) : 0

  // Each chip (or Repeat, Max, x2) as it went down, so a tap on the spot takes the last one back
  const [added, setAdded] = useState<number[]>([])
  const bet = added.reduce((sum, amount) => sum + amount, 0)
  const raiseBet = (amount: number) => amount > 0 && setAdded((a) => [...a, amount])
  const [lastBet, setLastBet] = useState(readLastBet)

  // The recordings are tiny: fetch them as soon as the table opens.
  useEffect(preloadSounds, [])

  // How the hand went, once the cards have shown it.
  const resultSound = hand?.phase === 'settled' && ready && pendingBet === null ? soundFor(hand) : null
  useEffect(() => {
    if (resultSound) playSound(resultSound)
  }, [resultSound, hand?.id])

  // Achievements the hand unlocked and challenges it completed, announced once the
  // cards have shown it; they outlive the hand, so going on to the next bet doesn't cut them short.
  const [toasts, setToasts] = useState<(Notice & { key: string })[]>([])
  const [announced, setAnnounced] = useState<string | null>(null)
  if (resultSound && hand && (table?.unlocked?.length || table?.challenges?.length) && announced !== hand.id) {
    setAnnounced(hand.id)
    const handId = hand.id
    const notices: Notice[] = [
      ...(table.unlocked ?? []).map((a) => ({ kind: 'achievement' as const, ...a })),
      ...(table.challenges ?? []).map((c) => ({ kind: 'challenge' as const, ...c })),
    ]
    setToasts((queue) => [...queue, ...notices.map((n) => ({ ...n, key: `${handId}-${n.kind}-${n.id}` }))])
  }
  const nextToast = useCallback(() => setToasts((queue) => queue.slice(1)), [])

  if (isPending) return <div className={styles.loading} aria-busy="true" />
  if (isError || !table) {
    return (
      <div className={styles.message}>
        <p>{t('common.error')}</p>
        <button className={styles.gold} onClick={() => void refetch()}>
          {t('common.retry')}
        </button>
      </div>
    )
  }

  const busy = play.isPending || !ready
  const fmt = (n: number) => formatNumber(n, lang)

  const deal = (amount: number) => {
    setLastBet(amount)
    saveLastBet(amount)
    setAdded([])
    play.mutate({ action: 'bet', bet: amount })
  }
  const act = (action: Action) => {
    if (!hand) return
    if (action === 'double' || action === 'split') playSound(action)
    play.mutate({ action, handId: hand.id, version: hand.version })
  }
  // The most you can put down: the table's limit, or everything you have if it's less.
  const limit = Math.min(table.maxBet, table.chips)
  const undoChip = () => {
    playSound('chip')
    setAdded((a) => a.slice(0, -1))
  }
  const addToBet = (value: number) => {
    playSound('chip')
    raiseBet(Math.min(bet + value, limit) - bet)
  }

  const settled = hand?.phase === 'settled' ? hand.settlement : null
  const errorText = play.error ? t(play.error instanceof ApiError && play.error.status === 409 ? 'play.changed' : 'common.error') : null
  const canRepeat = lastBet >= table.minBet && lastBet <= limit
  const showResult = Boolean(settled) && ready && pendingBet === null
  return (
    <div className={styles.table}>
      {toasts[0] && <UnlockToast key={toasts[0].key} notice={toasts[0]} onDone={nextToast} />}
      <section className={styles.felt}>
        <div className={styles.feltTop}>
          <div className={styles.shoe} aria-hidden="true" />
        </div>

        {hand ? (
          <FeltHand key={hand.id} hand={hand} schedule={schedule} ready={ready} />
        ) : (
          <div className={styles.idle}>
            <FeltPrint />
            {pendingBet === null && bet > 0 ? (
              <button type="button" className={`${styles.spot} ${styles.spotUndo}`} aria-label={t('play.undoChip')} onClick={undoChip}>
                <BetStack amount={bet} chips={added.toReversed().flatMap(chipsFor)} />
              </button>
            ) : (
              <div className={styles.spot}>{pendingBet !== null && <BetStack amount={pendingBet} />}</div>
            )}
            <p className={styles.spotLabel}>
              {t('play.yourBet')} · {t('play.betLimits', { min: fmt(table.minBet), max: fmt(table.maxBet) })}
            </p>
          </div>
        )}

        {/* Right above the chips you bet with */}
        <span className={styles.pill} aria-label={`${t('play.balance')}: ${t('play.chips', { count: chips })}`}>
          <span className={styles.chipIcon} aria-hidden="true" />
          {fmt(chips)}
        </span>
      </section>

      <section className={styles.rail} aria-live="polite">
        {errorText && <p className={styles.error}>{errorText}</p>}

        {!hand && table.chips < table.minBet && (
          <>
            <p className={styles.note}>{t('play.broke')}</p>
            {league && league.pendingPay > 0 ? (
              <button className={styles.gold} disabled={busy || claimPay.isPending} onClick={() => claimPay.mutate()}>
                {t('league.claim', { amount: fmt(league.pendingPay) })}
              </button>
            ) : (
              <p className={styles.note}>{t('play.waitForPay')}</p>
            )}
          </>
        )}

        {!hand && pendingBet === null && table.chips >= table.minBet && (
          <>
            <div className={styles.chipRow}>
              {CHIP_VALUES.filter((value) => value <= table.maxBet).map((value) => (
                <button
                  key={value}
                  type="button"
                  className={`${styles.chip} ${styles[`chip${value}`]}`}
                  aria-label={`+${fmt(value)}`}
                  disabled={busy || bet + value > limit}
                  onClick={() => addToBet(value)}
                >
                  {value >= 1000 ? `${value / 1000}K` : value}
                </button>
              ))}
            </div>
            <div className={styles.row}>
              {bet > 0 ? (
                <>
                  <button className={styles.wood} disabled={busy} onClick={() => setAdded([])}>
                    {t('play.clear')}
                  </button>
                  <button className={styles.wood} disabled={busy || bet * 2 > limit} onClick={() => raiseBet(bet)}>
                    {t('play.double')}
                  </button>
                </>
              ) : (
                <>
                  <button className={styles.wood} disabled={busy || !canRepeat} onClick={() => raiseBet(lastBet)}>
                    {t('play.repeat')}
                  </button>
                  <button className={styles.wood} disabled={busy} onClick={() => raiseBet(limit)}>
                    {t('play.maxBet')}
                  </button>
                </>
              )}
              <button
                className={`${styles.gold} ${styles.wide}`}
                disabled={busy || bet < table.minBet || bet > limit}
                onClick={() => deal(bet)}
              >
                {t('play.deal')}
              </button>
            </div>
          </>
        )}

        <HandControls hand={hand} pendingBet={pendingBet} busy={busy} act={act} />

        {settled && showResult && (
          <>
            <p className={`${styles.net} ${styles[netTone(settled.net)]}`}>{signed(settled.net, lang)}</p>
            <div className={styles.row}>
              <button className={styles.wood} disabled={busy} onClick={clearHand}>
                {t('play.changeBet')}
              </button>
              <PublishButton key={hand!.id} handId={hand!.id} />
              <button className={styles.gold} disabled={busy || !canRepeat} onClick={() => deal(lastBet)}>
                {t('play.again', { amount: fmt(lastBet) })}
              </button>
            </div>
          </>
        )}
      </section>
    </div>
  )
}

/** What can be done with the hand in play: insurance, or the moves (also while a new hand is on its way). */
export function HandControls({
  hand,
  pendingBet,
  busy,
  act,
}: {
  hand: HandView | null
  pendingBet: number | null
  busy: boolean
  act: (action: Action) => void
}) {
  const { t } = useTranslation()
  const lang = currentLanguage()
  const fmt = (n: number) => formatNumber(n, lang)
  return (
    <>
      {hand?.phase === 'insurance' && (
        <>
          <p className={styles.note}>
            {t('play.insuranceQuestion')}
            <br />
            <small>{t('play.insuranceCost', { amount: fmt(Math.floor(hand.hands[0].bet / 2)) })}</small>
          </p>
          <div className={styles.row}>
            <button className={styles.wood} disabled={busy || !hand.actions.includes('insurance')} onClick={() => act('insurance')}>
              {t('play.actions.insurance')}
            </button>
            <button className={styles.gold} disabled={busy} onClick={() => act('noInsurance')}>
              {t('play.actions.noInsurance')}
            </button>
          </div>
        </>
      )}

      {/* Also while a new hand is on its way, so the betting chips don't flash up in between */}
      {(hand?.phase === 'player' || pendingBet !== null) && (
        <>
          {/* The less common moves, each with what it costs or gives back */}
          <div className={styles.extras}>
            {(['double', 'split', 'surrender'] as const).map((action) => {
              const bet = hand ? (hand.hands[hand.activeHand]?.bet ?? 0) : (pendingBet ?? 0)
              return (
                <button
                  key={action}
                  type="button"
                  className={`${styles.extra} ${action === 'surrender' ? styles.extraLoss : ''}`}
                  disabled={hand !== null && !hand.actions.includes(action)}
                  onClick={() => !busy && act(action)}
                >
                  {ACTION_ICON[action]}
                  <span className={styles.extraName}>{t(`play.actions.${action}`)}</span>
                  <span className={styles.extraCost}>{action === 'surrender' ? `−${fmt(Math.ceil(bet / 2))}` : `+${fmt(bet)}`}</span>
                </button>
              )
            })}
          </div>
          <div className={styles.moves}>
            {(['stand', 'hit'] as const).map((action) => (
              <button
                key={action}
                type="button"
                className={`${styles.move} ${action === 'hit' ? styles.moveHit : ''}`}
                disabled={hand !== null && !hand.actions.includes(action)}
                onClick={() => !busy && act(action)}
              >
                {ACTION_ICON[action]}
                {t(`play.actions.${action}`)}
              </button>
            ))}
          </div>
        </>
      )}
    </>
  )
}

/** Hands are never published on their own: this offers it once the hand is over. */
function PublishButton({ handId }: { handId: string }) {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const [done, setDone] = useState(false)
  return (
    <>
      <button
        type="button"
        className={`${styles.wood} ${styles.publish}`}
        disabled={done}
        aria-label={t(done ? 'social.published' : 'social.publish')}
        title={t(done ? 'social.published' : 'social.publish')}
        onClick={() => setOpen(true)}
      >
        {done ? <CheckIcon width={20} height={20} strokeWidth={2.6} /> : <ShareIcon width={20} height={20} />}
      </button>
      {open && (
        <ShareSheet
          what={{ handId }}
          onClose={() => setOpen(false)}
          onShared={() => {
            setOpen(false)
            setDone(true)
          }}
        />
      )}
    </>
  )
}

const ACTION_ICON: Record<'hit' | 'stand' | 'double' | 'split' | 'surrender', ReactNode> = {
  hit: <PlusIcon width={22} height={22} strokeWidth={2.8} />,
  stand: <HandIcon width={22} height={22} strokeWidth={2.2} />,
  double: <span aria-hidden="true">×2</span>,
  split: <SplitIcon width={16} height={16} strokeWidth={2.4} />,
  surrender: <FlagIcon width={15} height={15} strokeWidth={2.2} />,
}

export function soundFor(hand: HandView): Sound {
  const settlement = hand.settlement!
  if (settlement.hands.some((h) => h.outcome === 'blackjack')) return 'blackjack'
  const tone = netTone(settlement.net)
  return tone === 'push' ? 'push' : tone
}

export function netTone(net: number): 'win' | 'lose' | 'push' {
  return net > 0 ? 'win' : net < 0 ? 'lose' : 'push'
}

// ── The felt ────────────────────────────────────────────────────────────────

/** The payout and rules printed on the cloth, along an arc. */
export function FeltPrint({ compact = false, payout, rules }: { compact?: boolean; payout?: string; rules?: string }) {
  const { t } = useTranslation()
  const arcId = `arc${useId().replace(/[^\w-]/g, '')}`
  return (
    <svg className={`${styles.print} ${compact ? styles.printCompact : ''}`} viewBox="0 0 390 140" aria-hidden="true">
      <path id={arcId} d="M30 24 Q195 120 360 24" fill="none" />
      <path d="M18 42 Q195 144 372 42" fill="none" stroke="var(--felt-print, rgb(242 193 78))" strokeOpacity="0.35" strokeWidth="1.5" />
      <text className={styles.printPayout}>
        <textPath href={`#${arcId}`} startOffset="50%" textAnchor="middle">
          {payout ?? t('play.payout')}
        </textPath>
      </text>
      <text className={styles.printRules} x="195" y="116" textAnchor="middle">
        {(rules ?? t('play.rules')).toUpperCase()}
      </text>
    </svg>
  )
}

/** A stack of chips for an amount, the top one showing the total. */
export function BetStack({ amount, chips, small = false }: { amount: number; chips?: ChipValue[]; small?: boolean }) {
  const lang = currentLanguage()
  // `chips` is the order they went down in, the newest on top; otherwise the biggest goes on top
  const [top, ...rest] = (chips ?? chipsFor(amount))
    .slice(0, 7)
    .map(chipColors)
  if (!top) return null
  const u = small ? 2 : 4
  // Each chip's darker side, unless the style draws its chips flat (pixel art)
  const rim = (edge: string) => `0 calc(var(--chip-rim, 1) * ${u}px) 0 ${edge}`
  const depth = 2 * u * rest.length + u
  const style: CSSProperties = {
    background: top.background,
    color: top.text,
    borderColor: top.stripe,
    boxShadow: rim(top.edge),
  }
  return (
    <span className={styles.stackWrap} style={{ transform: `translateY(${-depth / 2}px)` }} role="img" aria-label={formatNumber(amount, lang)}>
      {/* The chips underneath, whole, so a sprite's own edge shows on the side; the deepest first */}
      {rest
        .map((c, i) => (
          <span
            key={i}
            className={styles.stackLayer}
            style={{ background: c.background, boxShadow: rim(c.edge), translate: `0 ${2 * u * (i + 1)}px` }}
          />
        ))
        .reverse()}
      <span className={`${styles.stack} ${small ? styles.stackSmall : ''}`} style={style}>
        {chipLabel(amount, lang)}
      </span>
    </span>
  )
}

export function FeltHand({ hand, schedule, ready }: { hand: HandView; schedule: Schedule; ready: boolean }) {
  const { t } = useTranslation()
  const lang = currentLanguage()
  const settled = hand.settlement

  // A value shows up once the last new card of its hand has landed.
  const landed = (keys: string[]) => Math.max(0, ...keys.map((k) => (schedule.delays.get(k) ?? -FLIGHT) + FLIGHT))
  const dealerKeys = hand.dealer.map((_, i) => dealerKey(i))
  const dealerAt = Math.max(landed(dealerKeys), schedule.flipAt !== null ? schedule.flipAt + FLIP : 0)
  const dealerText = settled?.dealerBlackjack ? t('play.blackjack') : valueText(hand.dealerValue, Boolean(settled))

  return (
    <div className={styles.feltHand}>
      <div className={styles.dealer}>
        <div className={styles.cards}>
          {hand.dealer.map((card, i) => (
            <PlayingCard
              key={dealerKey(i)}
              card={card}
              delay={schedule.delays.get(dealerKey(i)) ?? 0}
              flipAt={i === 1 && schedule.flipAt !== null ? schedule.flipAt : undefined}
            />
          ))}
        </div>
        <span className={styles.label}>
          {t('play.dealer')}
          <Badge key={dealerText} at={dealerAt}>
            {dealerText}
          </Badge>
        </span>
        {settled?.dealerBlackjack && ready && <p className={styles.insured}>{t('play.dealerBlackjack')}</p>}
      </div>

      <div className={styles.middle}>
        <FeltPrint compact />
        {hand.insuranceBet > 0 && (
          <p className={styles.insured}>{t('play.insured', { amount: formatNumber(hand.insuranceBet, lang) })}</p>
        )}
      </div>

      <div
        className={`${styles.hands} ${hand.hands.length > 2 ? styles.small : ''}`}
        style={{ '--count': hand.hands.length } as CSSProperties}
      >
        {hand.hands.map((h, hi) => {
          const keys = h.cards.map((c, i) => playerKey(hi, i, c))
          const natural = hand.hands.length === 1 && !h.fromSplit && h.cards.length === 2 && h.value.total === 21
          const text = natural ? t('play.blackjack') : valueText(h.value, Boolean(settled) || h.status !== 'playing')
          const result = settled && ready ? settled.hands[hi] : null
          const active = hand.phase === 'player' && hand.hands.length > 1 && hand.activeHand === hi
          return (
            <div key={hi} className={`${styles.hand} ${active ? styles.active : ''}`}>
              {result && (
                <span className={`${styles.outcome} ${styles[OUTCOME_TONE[result.outcome]]}`}>
                  {t(`play.outcomes.${result.outcome}`)}
                </span>
              )}
              <div className={styles.cards}>
                {h.cards.map((card, i) => (
                  <PlayingCard key={keys[i]} card={card} delay={schedule.delays.get(keys[i]) ?? 0} />
                ))}
              </div>
              <span className={styles.label}>
                <Badge key={text} at={landed(keys)}>
                  {text}
                </Badge>
                <span className={styles.spotSmall}>
                  <BetStack amount={h.bet} small />
                </span>
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function Badge({ at, children }: { at: number; children: string }) {
  return (
    <span className={styles.value} style={{ '--at': `${at}s` } as CSSProperties}>
      {children}
    </span>
  )
}
