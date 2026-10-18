import { and, eq, lt, sql } from 'drizzle-orm'
import type { Tx } from './db.js'
import { db } from './db.js'
import { economyRules, pays, profiles } from './schema.js'
import { payMultiplier } from './schedule.js'

// The league economy. Everything is fixed by the server and the same for every
// group: the balance is the player's, groups only rank it.
//
// - Every Monday (Madrid) the balance goes back to the starting balance.
// - Every day adds the daily pay to claim, and unclaimed days pile up until Sunday.
//   Someone who starts mid-week gets the same as someone who started on Monday
//   and didn't play: the starting balance plus every day's pay up to today.
// - There's no cron for any of this: each profile catches up the first time it's
//   used in a new day or week (rollover below). Closing the week (podiums and
//   prizes) happens before any of that, in lib/season.ts.

// The rules before any admin changes them. Changes go in economy_rules and
// start on a Monday, so a week never changes its rules halfway through.
export const START_BALANCE = 1000
export const DAILY_PAY = 1000

export interface EconomyRules {
  startBalance: number
  dailyPay: number
}

let ruleRows: ({ semana: string } & EconomyRules)[] | null = null

/** The rules of the week that starts on `weekStart`. */
export function rulesFor(weekStart: string): EconomyRules {
  ruleRows ??= db()
    .select({ semana: economyRules.semana, startBalance: economyRules.saldoInicial, dailyPay: economyRules.pagaDiaria })
    .from(economyRules)
    .all()
    .sort((a, b) => b.semana.localeCompare(a.semana))
  const row = ruleRows.find((rule) => rule.semana <= weekStart)
  return row ? { startBalance: row.startBalance, dailyPay: row.dailyPay } : { startBalance: START_BALANCE, dailyPay: DAILY_PAY }
}

/** Every change to the rules, newest first. */
export function ruleChanges() {
  rulesFor('')
  return ruleRows ?? []
}

export function forgetRules() {
  ruleRows = null
}

const ZONE = 'Europe/Madrid'
const dateFormat = new Intl.DateTimeFormat('en-CA', { timeZone: ZONE, year: 'numeric', month: '2-digit', day: '2-digit' })
const wallFormat = new Intl.DateTimeFormat('en-US', {
  timeZone: ZONE,
  hourCycle: 'h23',
  year: 'numeric',
  month: 'numeric',
  day: 'numeric',
  hour: 'numeric',
  minute: 'numeric',
  second: 'numeric',
})

export function addDays(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

/** The instant Madrid's clock reads `date` 00:00. */
export function madridMidnight(date: string): Date {
  const guess = Date.parse(`${date}T00:00:00Z`)
  const parts = Object.fromEntries(wallFormat.formatToParts(guess).map((p) => [p.type, Number(p.value)]))
  const wall = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second)
  // Summer time starts and ends early on a Sunday, so the offset is the same all of Monday's first hours.
  return new Date(guess - (wall - guess))
}

const HOUR = 60 * 60 * 1000
const hourFormat = new Intl.DateTimeFormat('en-US', { timeZone: ZONE, hourCycle: 'h23', hour: 'numeric' })

/** The instant Madrid's clock reads `date` at `hour`:00, a summer time change that day included. */
export function madridAt(date: string, hour: number): Date {
  const guess = madridMidnight(date).getTime() + hour * HOUR
  return new Date(guess - (Number(hourFormat.format(guess)) - hour) * HOUR)
}

/** Today and this week in Madrid. SQLite has no time zones, so the server works them out and passes them in. */
export interface LeagueClock {
  /** 'YYYY-MM-DD' */
  today: string
  /** This week's Monday, 'YYYY-MM-DD' */
  weekStart: string
  /** When the week opened: that Monday 00:00 in Madrid. */
  weekBegin: Date
  /** When the week closes: next Monday 00:00 in Madrid. */
  weekEnd: Date
}

export function leagueClock(now = new Date()): LeagueClock {
  const today = dateFormat.format(now)
  // 0 Monday ... 6 Sunday
  const weekday = (new Date(`${today}T00:00:00Z`).getUTCDay() + 6) % 7
  const weekStart = addDays(today, -weekday)
  return { today, weekStart, weekBegin: madridMidnight(weekStart), weekEnd: madridMidnight(addDays(weekStart, 7)) }
}

/** A profile's balance as of now, for players who haven't opened the app this week. */
export function currentBalance(c: LeagueClock) {
  return sql<number>`(case when ${profiles.semana} < ${c.weekStart} then ${rulesFor(c.weekStart).startBalance} else ${profiles.saldo} end)`
}

/** A profile's balance when today started. */
export function dayStartBalance(c: LeagueClock) {
  return sql<number>`(case
    when ${profiles.semana} < ${c.weekStart} then ${rulesFor(c.weekStart).startBalance}
    when ${profiles.dia} < ${c.today} then ${profiles.saldo}
    else ${profiles.saldoInicioDia}
  end)`
}

/**
 * Makes sure the player's profile exists and is up to date: a new week resets
 * the balance, a new day remembers where it started. Run it first, in the same
 * transaction as whatever reads or moves the balance.
 */
export function rollover(tx: Tx, userId: string, c = leagueClock()) {
  const { startBalance } = rulesFor(c.weekStart)
  tx.insert(profiles)
    .values({ id: userId, semana: c.weekStart, dia: c.today, saldo: startBalance, saldoInicioDia: startBalance })
    .onConflictDoNothing()
    .run()
  tx.run(sql`
    update ${profiles}
    set saldo = case when semana < ${c.weekStart} then ${startBalance} else saldo end,
        ultima_paga = case when semana < ${c.weekStart} then null else ultima_paga end,
        saldo_inicio_dia = case when semana < ${c.weekStart} then ${startBalance} else saldo end,
        semana = ${c.weekStart},
        dia = ${c.today}
    where id = ${userId} and (semana < ${c.weekStart} or dia < ${c.today})
  `)
}

/** Days of pay waiting to be claimed (the profile must be rolled over first). */
function pendingDays(c: LeagueClock) {
  return sql<number>`cast(julianday(${c.today}) - julianday(coalesce(${profiles.ultimaPaga}, date(${profiles.semana}, '-1 day'))) as integer)`
}

export interface LeagueState {
  balance: number
  /** Chips the pay button gives right now; 0 if today's is already claimed. */
  pendingPay: number
  dailyPay: number
  /** When the week closes (ISO date). */
  weekEndsAt: string
}

/** The league state of a rolled over profile. */
export function selectLeague(tx: Tx, userId: string, c = leagueClock()): LeagueState {
  const row = tx
    .select({ balance: profiles.saldo, pendingDays: pendingDays(c) })
    .from(profiles)
    .where(eq(profiles.id, userId))
    .get()
  const rules = rulesFor(c.weekStart)
  return {
    balance: row?.balance ?? rules.startBalance,
    pendingPay: Math.max(0, row?.pendingDays ?? 0) * rules.dailyPay,
    dailyPay: rules.dailyPay,
    weekEndsAt: c.weekEnd.toISOString(),
  }
}

/** Claims every unclaimed day of pay this week at once. Returns false if there was nothing. */
export function claimPay(tx: Tx, userId: string, c = leagueClock()): boolean {
  // What the claim pays, worked out before the update moves ultimaPaga.
  // A "hora feliz" the admins scheduled multiplies it.
  const dailyPay = rulesFor(c.weekStart).dailyPay * payMultiplier()
  const paid = dailyPay * (tx.select({ days: pendingDays(c) }).from(profiles).where(eq(profiles.id, userId)).get()?.days ?? 0)
  const claimed = tx
    .update(profiles)
    .set({ saldo: sql`${profiles.saldo} + ${dailyPay} * ${pendingDays(c)}`, ultimaPaga: c.today })
    .where(and(eq(profiles.id, userId), sql`${pendingDays(c)} > 0`))
    .returning({ id: profiles.id })
    .get()
  if (!claimed) return false
  tx.insert(pays).values({ userId, cantidad: paid }).run()
  // Only this week's chart reads them: older ones go.
  tx.delete(pays).where(and(eq(pays.userId, userId), lt(pays.createdAt, c.weekBegin))).run()
  return true
}
