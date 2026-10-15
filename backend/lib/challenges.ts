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
}

interface Challenge {
  id: string
  tier: Tier
  target: number
  coins: number
  progress: (day: DayHand[]) => number
}

const won = (r: HandResult | undefined) => r?.outcome === 'win' || r?.outcome === 'blackjack'
const count = (day: DayHand[], test: (hand: DayHand) => boolean) => day.filter(test).length

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

const COINS: Record<Tier, number> = { easy: 10, medium: 20, hard: 40 }

const rows: [string, Tier, number, Challenge['progress']][] = [    ['play10', 'easy', 10, (day) => day.length],
  ['win5', 'easy', 5, (day) => count(day, (h) => h.net > 0)],
  ['blackjack1', 'easy', 1, (day) => count(day, (h) => h.results.some((r) => r.outcome === 'blackjack'))],
  ['dealerBust3', 'easy', 3, (day) => count(day, (h) => handValue(h.dealer).total > 21)],
  ['play30', 'medium', 30, (day) => day.length],
  ['streak3', 'medium', 3, bestRun],
  ['doubleWin', 'medium', 1, (day) => count(day, (h) => h.hands.some((p, i) => p.doubled && won(h.results[i])))],
  ['blackjack3', 'medium', 3, (day) => count(day, (h) => h.results.some((r) => r.outcome === 'blackjack'))],
  ['profit500', 'medium', 500, (day) => day.reduce((sum, h) => sum + h.net, 0)],
  ['streak5', 'hard', 5, bestRun],
  ['splitWin', 'hard', 1, (day) => count(day, (h) => h.hands.length >= 2 && h.results.every(won))],
  ['bigWin', 'hard', 1, (day) => count(day, (h) => h.apuesta >= 250 && h.net > 0)],
  ['fiveCards', 'hard', 1, (day) => count(day, (h) => h.hands.some((p, i) => p.cards.length >= 5 && won(h.results[i])))],
  ['profit2000', 'hard', 2000, (day) => day.reduce((sum, h) => sum + h.net, 0)],
]

export const CHALLENGES: readonly Challenge[] = rows.map(([id, tier, target, progress]) => ({
  id,
  tier,
  target,
  coins: COINS[tier],
  progress,
}))
const byId = new Map(CHALLENGES.map((c) => [c.id, c]))

/** A small stable hash of a string (FNV-1a), so a date always picks the same ones. */
function hash(text: string) {
  let h = 0x811c9dc5
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 0x01000193)
  return h >>> 0
}

const settingKey = (day: string) => `challenges.${day}`

/** The day's three, easy to hard: the admins' pick if there is one, else by the date. */
export function challengesFor(day: string): Challenge[] {
  const picked = getSetting<string[]>(settingKey(day))
  const chosen = picked?.map((id) => byId.get(id)).filter((c): c is Challenge => !!c)
  if (chosen?.length === TIERS.length) return chosen
  return TIERS.map((tier) => {
    const options = CHALLENGES.filter((c) => c.tier === tier)
    return options[hash(`${day}:${tier}`) % options.length]
  })
}

/** Whether the admins picked that day's challenges (else they come from the date). */
export function isCustomDay(day: string) {
  return !!getSetting<string[]>(settingKey(day))
}

/** The admins' pick for a day: one id per tier, easy to hard; null goes back to the date's. */
export function pickChallenges(day: string, ids: string[] | null) {
  if (ids && !TIERS.every((tier, i) => byId.get(ids[i])?.tier === tier)) throw new Error('Retos no válidos')
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
