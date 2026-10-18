import { createShoe, DEFAULT_RULES, seededRng, type Card, type RoundState } from '@bwf/engine'
import { and, asc, count, eq, inArray, isNotNull, isNull, lt, lte, sql } from 'drizzle-orm'
import { db, type Tx } from './db.js'
import { notifyAll } from './events.js'
import { addDays, leagueClock, madridMidnight, type LeagueClock } from './league.js'
import { dailyDecks, dailyRuns, groupMembers, profiles } from './schema.js'

// The daily deck (docs/DISENO.md, "Baraja del día"): one seed a day, so everyone
// gets the same cards in the same order. 10 hands at a fixed bet with 1,000
// virtual chips, apart from the league. When the day is over, whoever finished
// first in a group where at least 2 played gets coins for styles, once a day
// however many groups they won.

export const DAILY_START = 1000
export const DAILY_BET = 100
export const DAILY_HANDS = 10
/** Coins, not chips: it never moves the league. */
export const DAILY_PRIZE = 50

export type DailyResult = 'w' | 'l' | 'p'

/** Today's deck, made the first time anyone asks for it. */
export function deckFor(tx: Tx, dia: string) {
  tx.insert(dailyDecks).values({ dia, semilla: crypto.randomUUID() }).onConflictDoNothing().run()
  return tx.select().from(dailyDecks).where(eq(dailyDecks.dia, dia)).get()!
}

/** The deck's number: #1 the first day there was one. */
export function deckNumber(tx: Tx, dia: string): number {
  return tx.select({ n: count() }).from(dailyDecks).where(lte(dailyDecks.dia, dia)).get()?.n ?? 0
}

/** The shoe of the day's hand `index` (0–9): the same for everyone, and apart from what earlier hands drew. */
export function dailyShoe(semilla: string, index: number): Card[] {
  return createShoe(DEFAULT_RULES.decks, seededRng(`${semilla}:${index}`))
}

/** How a settled hand went, for the results line. */
export function resultOf(state: RoundState): DailyResult {
  const net = state.settlement?.net ?? 0
  return net > 0 ? 'w' : net < 0 ? 'l' : 'p'
}

/** Whether the run is over: every hand played, or not enough chips for the next. */
export function runOver(fichas: number, resultados: string): boolean {
  return resultados.length >= DAILY_HANDS || fichas < DAILY_BET
}

const SQUARES: Record<string, string> = { w: '🟩', l: '🟥', p: '⬜' }

/** The line to share: 🃏 Baraja del día #42 · +650 · 🟩🟩🟥… */
export function shareLine(number: number, fichas: number, resultados: string, english: boolean): string {
  const net = fichas - DAILY_START
  const signed = `${net > 0 ? '+' : net < 0 ? '−' : '±'}${Math.abs(net).toLocaleString(english ? 'en' : 'es')}`
  const squares = [...resultados].map((r) => SQUARES[r] ?? '').join('')
  return `🃏 ${english ? 'Daily deck' : 'Baraja del día'} #${number} · ${signed} · ${squares}`
}

// ── Closing a day ───────────────────────────────────────────────────────────

/** Gives the prizes of a day that's over. Returns whether anyone got one. */
function closeDay(tx: Tx, dia: string): boolean {
  const runs = tx
    .select({ userId: dailyRuns.userId, fichas: dailyRuns.fichas })
    .from(dailyRuns)
    .where(and(eq(dailyRuns.dia, dia), isNotNull(dailyRuns.terminada)))
    .all()
  const chips = new Map(runs.map((run) => [run.userId, run.fichas]))
  const byGroup = new Map<string, string[]>()
  if (runs.length >= 2) {
    const rows = tx
      .select({ groupId: groupMembers.groupId, userId: groupMembers.userId })
      .from(groupMembers)
      .where(inArray(groupMembers.userId, [...chips.keys()]))
      .all()
    for (const row of rows) byGroup.set(row.groupId, [...(byGroup.get(row.groupId) ?? []), row.userId])
  }

  // Ties for 1st all win.
  const winners = new Set<string>()
  for (const players of byGroup.values()) {
    if (players.length < 2) continue
    const best = Math.max(...players.map((id) => chips.get(id)!))
    for (const id of players) if (chips.get(id) === best) winners.add(id)
  }

  for (const userId of winners) {
    tx.update(profiles)
      .set({ monedas: sql`${profiles.monedas} + ${DAILY_PRIZE}` })
      .where(eq(profiles.id, userId))
      .run()
    tx.update(dailyRuns)
      .set({ premio: DAILY_PRIZE })
      .where(and(eq(dailyRuns.userId, userId), eq(dailyRuns.dia, dia)))
      .run()
  }
  tx.update(dailyDecks).set({ premiada: new Date() }).where(eq(dailyDecks.dia, dia)).run()
  return winners.size > 0
}

// The last day known to be closed, so most requests skip the query.
let closedBefore: string | null = null

/** Gives the prizes of every past day not closed yet. Returns whether anyone got one. */
export function closePastDays(c: LeagueClock = leagueClock()): boolean {
  if (closedBefore === c.today) return false
  const paid = db().transaction((tx) => {
    const pending = tx
      .select({ dia: dailyDecks.dia })
      .from(dailyDecks)
      .where(and(lt(dailyDecks.dia, c.today), isNull(dailyDecks.premiada)))
      .orderBy(asc(dailyDecks.dia))
      .all()
    let any = false
    for (const { dia } of pending) any = closeDay(tx, dia) || any
    return any
  })
  closedBefore = c.today
  return paid
}

/** After a restore: the copy may have days still to close. */
export function forgetClosedDays() {
  closedBefore = null
}

/** At midnight in Madrid: yesterday's prizes go out and today's deck is dealt. */
export function scheduleDaily() {
  const run = () => {
    try {
      if (closePastDays()) notifyAll()
      db().transaction((tx) => deckFor(tx, leagueClock().today))
    } catch (err) {
      console.error('Cierre de la baraja del día fallido', err)
    }
    // A second late, so the clock already reads the new day.
    const next = madridMidnight(addDays(leagueClock().today, 1))
    setTimeout(run, Math.max(1000, next.getTime() - Date.now() + 1000)).unref()
  }
  run()
}
