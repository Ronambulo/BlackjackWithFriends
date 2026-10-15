import { handValue, type Card, type HandResult, type PlayerHand } from '@bwf/engine'
import { and, asc, eq, gte, sql } from 'drizzle-orm'
import { db, type Tx } from './db.js'
import { addDays, leagueClock, madridMidnight } from './league.js'
import { getSetting, setSetting } from './settings.js'
import { challengeCompletions, hands, profiles } from './schema.js'

// Daily challenges: three a day (an easy, a medium and a hard one), the same for
// everyone, picked from the catalogue by the date unless an admin chose them.
// Progress is worked out from the day's settled hands (Madrid), so it needs no
// counters; completing one pays coins, never chips, once.

export const TIERS = ['easy', 'medium', 'hard'] as const
export type Tier = (typeof TIERS)[number]

/** What a challenge looks at: one settled round of the day. */
interface DayHand {
  net: number
  apuesta: number
  hands: PlayerHand[]
  results: HandResult[]
  dealer: Card[]
  insurancePayout: number
}

/** What a challenge is about: a day never has two of the same kind. */
export type Family =
  | 'volume'
  | 'wins'
  | 'streak'
  | 'blackjack'
  | 'dealer'
  | 'double'
  | 'split'
  | 'push'
  | 'bet'
  | 'profit'
  | 'cards'
  | 'comeback'
  | 'insurance'

interface Challenge {
  id: string
  tier: Tier
  family: Family
  target: number
  coins: number
  progress: (day: DayHand[]) => number
}

const won = (r: HandResult | undefined) => r?.outcome === 'win' || r?.outcome === 'blackjack'
const count = (day: DayHand[], test: (hand: DayHand) => boolean) => day.filter(test).length
/** Hands (a split counts each) that pass the test. */
const handCount = (day: DayHand[], test: (p: PlayerHand, r: HandResult | undefined) => boolean) =>
  day.reduce((sum, h) => sum + h.hands.filter((p, i) => test(p, h.results[i])).length, 0)
const profit = (day: DayHand[]) => day.reduce((sum, h) => sum + h.net, 0)
const blackjacks = (day: DayHand[]) => count(day, (h) => h.results.some((r) => r.outcome === 'blackjack'))

/** Wins in a row today, at most; a push doesn't break it. */
function bestRun(day: DayHand[]) {
  let run = 0
  let best = 0
  for (const hand of day) {
    if (hand.net > 0) best = Math.max(best, ++run)
    else if (hand.net < 0) run = 0
  }
  return best
}

/** Wins right after losing three in a row (pushes don't count either way). */
function comebacks(day: DayHand[]) {
  let losses = 0
  let found = 0
  for (const hand of day) {
    if (hand.net < 0) losses++
    else if (hand.net > 0) {
      if (losses >= 3) found++
      losses = 0
    }
  }
  return found
}

const COINS: Record<Tier, number> = { easy: 10, medium: 20, hard: 40 }

const rows: [string, Tier, Family, number, Challenge['progress']][] = [
  ['play10', 'easy', 'volume', 10, (day) => day.length],
  ['win5', 'easy', 'wins', 5, (day) => count(day, (h) => h.net > 0)],
  ['blackjack1', 'easy', 'blackjack', 1, blackjacks],
  ['dealerBust3', 'easy', 'dealer', 3, (day) => count(day, (h) => handValue(h.dealer).total > 21)],
  ['doubles2', 'easy', 'double', 2, (day) => handCount(day, (p) => p.doubled)],
  ['split1', 'easy', 'split', 1, (day) => count(day, (h) => h.hands.length >= 2)],
  ['push2', 'easy', 'push', 2, (day) => handCount(day, (_p, r) => r?.outcome === 'push')],
  ['bet100x5', 'easy', 'bet', 5, (day) => count(day, (h) => h.apuesta >= 100)],
  ['play30', 'medium', 'volume', 30, (day) => day.length],
  ['win10', 'medium', 'wins', 10, (day) => count(day, (h) => h.net > 0)],
  ['streak3', 'medium', 'streak', 3, bestRun],
  ['doubleWin', 'medium', 'double', 1, (day) => handCount(day, (p, r) => p.doubled && won(r))],
  ['blackjack3', 'medium', 'blackjack', 3, blackjacks],
  ['profit500', 'medium', 'profit', 500, profit],
  ['win21', 'medium', 'cards', 1, (day) => handCount(day, (p, r) => p.cards.length >= 3 && handValue(p.cards).total === 21 && won(r))],
  ['beat20', 'medium', 'dealer', 1, (day) => count(day, (h) => handValue(h.dealer).total === 20 && h.results.some((r) => r.outcome === 'win'))],
  ['comeback', 'medium', 'comeback', 1, comebacks],
  ['play60', 'hard', 'volume', 60, (day) => day.length],
  ['streak5', 'hard', 'streak', 5, bestRun],
  ['splitWin', 'hard', 'split', 1, (day) => count(day, (h) => h.hands.length >= 2 && h.results.every(won))],
  ['bigWin', 'hard', 'bet', 1, (day) => count(day, (h) => h.apuesta >= 250 && h.net > 0)],
  ['fiveCards', 'hard', 'cards', 1, (day) => handCount(day, (p, r) => p.cards.length >= 5 && won(r))],
  ['profit2000', 'hard', 'profit', 2000, profit],
  ['doubleWin3', 'hard', 'double', 3, (day) => handCount(day, (p, r) => p.doubled && won(r))],
  ['insuranceWin', 'hard', 'insurance', 1, (day) => count(day, (h) => h.insurancePayout > 0)],
]

export const CHALLENGES: readonly Challenge[] = rows.map(([id, tier, family, target, progress]) => ({
  id,
  tier,
  family,
  target,
  coins: COINS[tier],
  progress,
}))
const byId = new Map(CHALLENGES.map((c) => [c.id, c]))

/** A small stable hash of a string (FNV-1a, well mixed), so a date always picks the same ones. */
function hash(text: string) {
  let h = 0x811c9dc5
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 0x01000193)
  // Mixed once more (murmur3's finaliser): dates a day apart otherwise pick alike.
  h = Math.imul(h ^ (h >>> 16), 0x85ebca6b)
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35)
  return (h ^ (h >>> 16)) >>> 0
}

const settingKey = (day: string) => `challenges.${day}`

/** What the admins picked for a day, if they did. */
function adminPick(day: string) {
  const chosen = getSetting<string[]>(settingKey(day))?.map((id) => byId.get(id)).filter((c): c is Challenge => !!c)
  return chosen?.length === TIERS.length ? chosen : null
}

/**
 * One per tier from the date. Each tier's challenges come shuffled into a round
 * that goes one a day, so none is back until all the others had their turn; one
 * of a kind the day already has gives its place to the next.
 */
function byDate(day: string) {
  const n = Math.round(Date.parse(`${day}T00:00:00Z`) / 86_400_000)
  const picked: Challenge[] = []
  for (const tier of TIERS) {
    const all = CHALLENGES.filter((c) => c.tier === tier)
    const round = Math.floor(n / all.length)
    const order = [...all].sort((a, b) => hash(`${round}:${a.id}`) - hash(`${round}:${b.id}`))
    for (let k = 0; k < order.length; k++) {
      const c = order[(n + k) % order.length]
      if (!picked.some((p) => p.family === c.family)) {
        picked.push(c)
        break
      }
    }
  }
  return picked
}

/** The day's three, easy to hard: the admins' pick if there is one, else by the date. */
export function challengesFor(day: string): Challenge[] {
  return adminPick(day) ?? byDate(day)
}

/** Whether the admins picked that day's challenges (else they come from the date). */
export function isCustomDay(day: string) {
  return !!getSetting<string[]>(settingKey(day))
}

/** The admins' pick for a day: one id per tier, easy to hard; null goes back to the date's. */
export function pickChallenges(day: string, ids: string[] | null) {
  const chosen = ids?.map((id) => byId.get(id))
  const valid =
    !chosen ||
    (TIERS.every((tier, i) => chosen[i]?.tier === tier) && new Set(chosen.map((c) => c?.family)).size === TIERS.length)
  if (!valid) throw new Error('Retos no válidos')
  setSetting(settingKey(day), ids)
}

/** The player's settled hands of the day, oldest first. */
function dayHands(tx: Tx, userId: string, day: string): DayHand[] {
  return tx
    .select({
      net: sql<number>`${hands.neto}`,
      apuesta: hands.apuesta,
      hands: sql<string>`json_extract(${hands.ronda}, '$.hands')`,
      results: sql<string>`json_extract(${hands.ronda}, '$.settlement.hands')`,
      insurancePayout: sql<number>`coalesce(json_extract(${hands.ronda}, '$.settlement.insurancePayout'), 0)`,
      dealer: sql<string>`json_extract(${hands.ronda}, '$.dealer')`,
    })
    .from(hands)
    // When it was settled: a hand dealt before midnight counts for the day it ends.
    .where(and(eq(hands.userId, userId), eq(hands.fase, 'settled'), gte(hands.updatedAt, madridMidnight(day))))
    .orderBy(asc(hands.updatedAt))
    .all()
    .map((row) => ({
      net: row.net,
      apuesta: row.apuesta,
      hands: JSON.parse(row.hands),
      results: JSON.parse(row.results),
      dealer: JSON.parse(row.dealer),
      insurancePayout: row.insurancePayout,
    }))
}

function completedIds(tx: Tx, userId: string, day: string) {
  return new Set(
    tx
      .select({ reto: challengeCompletions.reto })
      .from(challengeCompletions)
      .where(and(eq(challengeCompletions.userId, userId), eq(challengeCompletions.dia, day)))
      .all()
      .map((row) => row.reto),
  )
}

export interface CompletedChallenge {
  id: string
  target: number
  coins: number
}

/** Marks today's challenges the player has just done and pays their coins. Returns them. */
export function syncChallenges(tx: Tx, userId: string): CompletedChallenge[] {
  const { today } = leagueClock()
  const done = completedIds(tx, userId, today)
  const pending = challengesFor(today).filter((c) => !done.has(c.id))
  if (pending.length === 0) return []
  const day = dayHands(tx, userId, today)
  const completed = pending.filter((c) => c.progress(day) >= c.target)
  if (completed.length === 0) return []
  tx.insert(challengeCompletions)
    .values(completed.map((c) => ({ userId, dia: today, reto: c.id, monedas: c.coins })))
    .run()
  tx.update(profiles)
    .set({ monedas: sql`${profiles.monedas} + ${completed.reduce((sum, c) => sum + c.coins, 0)}` })
    .where(eq(profiles.id, userId))
    .run()
  return completed.map(({ id, target, coins }) => ({ id, target, coins }))
}

export interface PlayerChallenge {
  id: string
  tier: Tier
  target: number
  /** Capped at the target; 0 while below zero (the profit ones). */
  progress: number
  coins: number
  done: boolean
}

/** Today's three as the player sees them, and when they change. */
export function playerChallenges(userId: string) {
  const { today } = leagueClock()
  return db().transaction((tx) => {
    const done = completedIds(tx, userId, today)
    const day = dayHands(tx, userId, today)
    return {
      day: today,
      endsAt: madridMidnight(addDays(today, 1)).toISOString(),
      challenges: challengesFor(today).map(
        (c): PlayerChallenge => ({
          id: c.id,
          tier: c.tier,
          target: c.target,
          progress: done.has(c.id) ? c.target : Math.max(0, Math.min(c.target, c.progress(day))),
          coins: c.coins,
          done: done.has(c.id),
        }),
      ),
    }
  })
}

/** How many players completed each of a day's challenges. */
export function completionCounts(day: string): Record<string, number> {
  return Object.fromEntries(
    db()
      .select({ reto: challengeCompletions.reto, n: sql<number>`count(*)` })
      .from(challengeCompletions)
      .where(eq(challengeCompletions.dia, day))
      .groupBy(challengeCompletions.reto)
      .all()
      .map((row) => [row.reto, row.n]),
  )
}
