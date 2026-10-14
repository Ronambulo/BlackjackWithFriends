'use client'

import type { Action, Card, HandValue, Outcome } from '@bwf/engine'
import { useEffect, useState, type CSSProperties } from 'react'
import { useTranslation } from 'react-i18next'
import { currentLanguage } from '@/i18n'
import { ApiError } from '@/lib/api'
import { formatNumber } from '@/lib/format'
import { PlayingCard } from './PlayingCard'
import { useClearFinishedHand, usePlay, useTable, type HandView } from './useTable'
import styles from './Table.module.css'

const CHIP_VALUES = [10, 50, 100, 500, 1000] as const
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

function useDealTiming(hand: HandView | null) {
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

function signed(n: number, lang: ReturnType<typeof currentLanguage>): string {
  if (n === 0) return '±0'
  return `${n > 0 ? '+' : '−'}${formatNumber(Math.abs(n), lang)}`
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
  const hand = table?.hand ?? null
  const { schedule, ready } = useDealTiming(hand)

  // The chip count catches up once the cards have shown how the hand went.
  const [shownChips, setShownChips] = useState<number | null>(null)
  if (ready && table && shownChips !== table.chips) setShownChips(table.chips)
  const chips = table ? (ready ? table.chips : (shownChips ?? table.chips)) : 0

  const [bet, setBet] = useState(0)
  const [lastBet, setLastBet] = useState(readLastBet)

  if (isPending) return <div className={styles.loading} aria-busy="true" />
  if (isError || !table) {
    return (
      <div className={`card ${styles.message}`}>
        <p className="muted">{t('common.error')}</p>
        <button className="btn btn-secondary" onClick={() => void refetch()}>
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
    setBet(0)
    play.mutate({ action: 'bet', bet: amount })
  }
  const act = (action: Action) => {
    if (hand) play.mutate({ action, handId: hand.id, version: hand.version })
  }
  const addToBet = (value: number) => setBet((b) => Math.min(b + value, table.chips))

  const settled = hand?.phase === 'settled' ? hand.settlement : null
  const errorText = play.error ? t(play.error instanceof ApiError && play.error.status === 409 ? 'play.changed' : 'common.error') : null

  return (
    <div className={styles.table}>
      <div className={styles.bar}>
        <span className="muted">{t('play.practice')}</span>
        <span className={styles.chips} aria-label={t('play.chips', { count: chips })}>
          <span className={styles.chipIcon} aria-hidden="true" />
          {fmt(chips)}
        </span>
      </div>

      <section className={styles.felt}>
        <div className={styles.shoe} aria-hidden="true" />
        {hand ? (
          <FeltHand key={hand.id} hand={hand} schedule={schedule} ready={ready} />
        ) : (
          <div className={styles.idle}>
            <p className={styles.feltTitle}>Blackjack</p>
            <p className={styles.feltRules}>{t('play.rules')}</p>
          </div>
        )}
      </section>

      <section className={styles.controls} aria-live="polite">
        {errorText && <p className="error-text">{errorText}</p>}

        {!hand && table.chips < table.minBet && (
          <div className={styles.message}>
            <p className="muted">{t('play.broke')}</p>
            <button className="btn btn-primary btn-block" disabled={busy} onClick={() => play.mutate({ action: 'refill' })}>
              {t('play.refill', { amount: fmt(1000) })}
            </button>
          </div>
        )}

        {!hand && table.chips >= table.minBet && (
          <>
            <div className={styles.betLine}>
              <span className={styles.betAmount}>{bet > 0 ? fmt(bet) : t('play.placeBet')}</span>
              <span className="muted">{t('play.minBet', { amount: fmt(table.minBet) })}</span>
            </div>
            <div className={styles.chipRow}>
              {CHIP_VALUES.map((value) => (
                <button
                  key={value}
                  type="button"
                  className={`${styles.chip} ${styles[`chip${value}`]}`}
                  disabled={busy || bet + value > table.chips}
                  onClick={() => addToBet(value)}
                >
                  {value >= 1000 ? `${value / 1000}K` : value}
                </button>
              ))}
            </div>
            <div className={styles.betTools}>
              <button className="btn btn-ghost" disabled={bet === 0} onClick={() => setBet(0)}>
                {t('play.clear')}
              </button>
              <button
                className="btn btn-ghost"
                disabled={lastBet < table.minBet || lastBet > table.chips}
                onClick={() => setBet(lastBet)}
              >
                {t('play.repeat')}
              </button>
              <button className="btn btn-ghost" disabled={bet === 0 || bet * 2 > table.chips} onClick={() => setBet(bet * 2)}>
                {t('play.double')}
              </button>
              <button className="btn btn-ghost" onClick={() => setBet(table.chips)}>
                {t('play.allIn')}
              </button>
            </div>
            <button
              className="btn btn-primary btn-block"
              disabled={busy || bet < table.minBet || bet > table.chips}
              onClick={() => deal(bet)}
            >
              {t('play.deal')}
            </button>
          </>
        )}

        {hand?.phase === 'insurance' && (
          <div className={styles.message}>
            <p>{t('play.insuranceQuestion')}</p>
            <p className="muted">{t('play.insuranceCost', { amount: fmt(Math.floor(hand.hands[0].bet / 2)) })}</p>
            <div className={styles.actionGrid}>
              <button className="btn btn-secondary" disabled={busy || !hand.actions.includes('insurance')} onClick={() => act('insurance')}>
                {t('play.actions.insurance')}
              </button>
              <button className="btn btn-primary" disabled={busy} onClick={() => act('noInsurance')}>
                {t('play.actions.noInsurance')}
              </button>
            </div>
          </div>
        )}

        {hand?.phase === 'player' && (
          <>
            <div className={styles.actionGrid}>
              {(['hit', 'stand', 'double', 'split'] as const).map((action) => (
                <button
                  key={action}
                  className={`btn ${action === 'hit' ? 'btn-primary' : 'btn-secondary'}`}
                  disabled={busy || !hand.actions.includes(action)}
                  onClick={() => act(action)}
                >
                  {t(`play.actions.${action}`)}
                </button>
              ))}
            </div>
            {hand.actions.includes('surrender') && (
              <button className="btn btn-ghost" disabled={busy} onClick={() => act('surrender')}>
                {t('play.actions.surrender')}
              </button>
            )}
          </>
        )}

        {settled && ready && (
          <div className={styles.result}>
            <p className={`${styles.net} ${styles[netTone(settled.net)]}`}>{signed(settled.net, lang)}</p>
            <div className={styles.actionGrid}>
              <button className="btn btn-secondary" disabled={busy} onClick={clearHand}>
                {t('play.changeBet')}
              </button>
              <button
                className="btn btn-primary"
                disabled={busy || lastBet < table.minBet || lastBet > table.chips}
                onClick={() => deal(lastBet)}
              >
                {t('play.again', { amount: fmt(lastBet) })}
              </button>
            </div>
          </div>
        )}
      </section>
    </div>
  )
}

function netTone(net: number): 'win' | 'lose' | 'push' {
  return net > 0 ? 'win' : net < 0 ? 'lose' : 'push'
}

// ── The cards on the felt ───────────────────────────────────────────────────

function FeltHand({ hand, schedule, ready }: { hand: HandView; schedule: Schedule; ready: boolean }) {
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
      </div>

      {hand.insuranceBet > 0 && (
        <p className={styles.insured}>{t('play.insured', { amount: formatNumber(hand.insuranceBet, lang) })}</p>
      )}

      <div className={`${styles.hands} ${hand.hands.length > 2 ? styles.small : ''}`}>
        {hand.hands.map((h, hi) => {
          const keys = h.cards.map((c, i) => playerKey(hi, i, c))
          const natural = hand.hands.length === 1 && !h.fromSplit && h.cards.length === 2 && h.value.total === 21
          const text = natural ? t('play.blackjack') : valueText(h.value, Boolean(settled) || h.status !== 'playing')
          const result = settled && ready ? settled.hands[hi] : null
          const active = hand.phase === 'player' && hand.hands.length > 1 && hand.activeHand === hi
          return (
            <div key={hi} className={`${styles.hand} ${active ? styles.active : ''}`}>
              <div className={styles.cards}>
                {h.cards.map((card, i) => (
                  <PlayingCard key={keys[i]} card={card} delay={schedule.delays.get(keys[i]) ?? 0} />
                ))}
              </div>
              <span className={styles.label}>
                <Badge key={text} at={landed(keys)}>
                  {text}
                </Badge>
                <span className={styles.bet}>
                  <span className={styles.chipIcon} aria-hidden="true" />
                  {formatNumber(h.bet, lang)}
                </span>
              </span>
              {result && (
                <span className={`${styles.outcome} ${styles[OUTCOME_TONE[result.outcome]]}`}>
                  {t(`play.outcomes.${result.outcome}`)}
                </span>
              )}
            </div>
          )
        })}
      </div>

      {settled?.dealerBlackjack && ready && <p className={styles.insured}>{t('play.dealerBlackjack')}</p>}
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
