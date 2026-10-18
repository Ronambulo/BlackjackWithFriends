import { readdirSync, statSync } from 'node:fs'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { and, count, desc, eq, inArray, or, sql } from 'drizzle-orm'
import { activeBan, dropReview, forgetBans, isAdmin, logAction, MOD_LIMIT, requireAdmin, setUsername } from '../lib/admin.js'
import { forgetAuth } from '../lib/auth.js'
import { backupDir, createBackup, listBackups, restoreBackup } from '../lib/backup.js'
import { cosmeticStats, setShopItem, setShopOrder, setShopSale } from '../lib/cosmetics.js'
import { snapshot } from '../lib/metrics.js'
import { FLAGS, flags, forgetSettings, getSetting, maintenance, setSetting, type Flag, type Maintenance } from '../lib/settings.js'
import { databasePath, db } from '../lib/db.js'
import { notifyAll, notifyGroups } from '../lib/events.js'
import { HttpError, json } from '../lib/http.js'
import { pushReviewRejected } from '../lib/push.js'
import { addDays, currentBalance, forgetRules, leagueClock, madridMidnight, rollover, ruleChanges, rulesFor } from '../lib/league.js'
import { forgetClosedWeeks } from '../lib/season.js'
import { forgetClosedDays } from '../lib/daily.js'
import {
  ADJUSTMENT_KINDS,
  adjustments,
  adminLog,
  economyRules,
  groupMembers,
  groups,
  hands,
  ipBans,
  pays,
  playerMarks,
  profiles,
  reports,
  reviews,
  session,
  user,
  type AdjustmentKind,
} from '../lib/schema.js'
import { deleteObject, keyOf, mediaPath } from '../lib/storage.js'
import { lastMessages, playerExtras } from './admin-tools.js'
import { removeMember } from './groups.js'

// The admin screen: how the app is doing, and the players, to delete or shut out.

const DAY = 24 * 60 * 60 * 1000
const HOUR = 60 * 60 * 1000
// Days in the activity chart: this week and the one before.
const DAYS = 14
// Days of hands read one by one: three weeks, to compare this one with the two before.
const WINDOW = 21
// Days in the busy hours map.
const HEATMAP_DAYS = 28
// Sign-up weeks in the retention table, this one included.
const COHORTS = 5
// Days out of the last seven that make a regular.
const REGULAR_DAYS = 5
// A hand touched this recently means someone is at the table.
const LIVE = 5 * 60 * 1000
// An address shared by this many accounts or more is worth a look.
const SHARED_IP = 3
// Hands further apart than this count as separate sittings when estimating play time.
const SITTING_GAP = 10 * 60 * 1000
// What a sitting is taken to last on top of the time between its first and last hand.
const HAND_TIME = 60 * 1000
const TOP = 10
// Settled hands read for the outcomes table (the newest).
const ECONOMY_HANDS = 20000
// Moderation: hands won in a row, hands in a sitting at a pace no one plays at (ms between hands), and the
// minutes in which several accounts from one address count as a chain.
const STREAK = 10
const BOT_HANDS = 30
const BOT_GAP = 4000
const CHAIN_WINDOW = 60 * 60 * 1000
const USERS_LIMIT = 200
const SESSIONS_LIMIT = 10
const HANDS_LIMIT = 15

const BET_BUCKETS = [1, 10, 25, 100, 500, 1000] as const

async function readBody(request: Request): Promise<Record<string, unknown>> {
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null
  if (!body || typeof body !== 'object') throw new HttpError(400, 'Cuerpo no válido')
  return body
}

const displayName = sql<string>`coalesce(${profiles.nombre}, ${user.displayUsername}, ${user.name})`

const ZONE = 'Europe/Madrid'
/** 'YYYY-MM-DD' in Madrid, like the league's days. */
const dayFormat = new Intl.DateTimeFormat('en-CA', { timeZone: ZONE })
const hourFormat = new Intl.DateTimeFormat('en-US', { timeZone: ZONE, weekday: 'short', hour: 'numeric', hourCycle: 'h23' })
const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

/** Midnight in Madrid of the day `ms` falls on. */
function madridDayStart(ms: number): number {
  return madridMidnight(dayFormat.format(ms)).getTime()
}

function shiftDay(day: string, days: number): string {
  const d = new Date(`${day}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

/** The Monday of a 'YYYY-MM-DD' day's week. */
function mondayOf(day: string): string {
  return shiftDay(day, -((new Date(`${day}T00:00:00Z`).getUTCDay() + 6) % 7))
}

/** Total time at the table, from when each player's hands happened (sorted by time). */
function playTime(rows: { userId: string; at: number }[]): number {
  let total = 0
  const open = new Map<string, { start: number; end: number }>()
  for (const row of rows) {
    const sitting = open.get(row.userId)
    if (sitting && row.at - sitting.end <= SITTING_GAP) {
      sitting.end = row.at
    } else {
      if (sitting) total += sitting.end - sitting.start + HAND_TIME
      open.set(row.userId, { start: row.at, end: row.at })
    }
  }
  for (const sitting of open.values()) total += sitting.end - sitting.start + HAND_TIME
  return total
}

interface Played {
  userId: string
  at: number
  bet: number
  net: number | null
}

/** Seven days of play, to set beside the seven before. */
function period(rows: Played[], signups: number, before: Set<string>) {
  const players = new Set(rows.map((row) => row.userId))
  const settled = rows.filter((row) => row.net !== null)
  const wagered = settled.reduce((sum, row) => sum + row.bet, 0)
  return {
    players: players.size,
    hands: rows.length,
    playMs: playTime(rows),
    signups,
    // Out of who played the seven days before, how many came back.
    returning: before.size ? [...before].filter((id) => players.has(id)).length / before.size : null,
    // What the house keeps of every chip bet.
    houseEdge: wagered ? -settled.reduce((sum, row) => sum + row.net!, 0) / wagered : null,
  }
}

const PERIODS = [1, 7, 28, 90]

// GET /api/admin/stats?days=1|7|28|90: the figures for that many days against the same before.
export async function getAdminStats(request: Request): Promise<Response> {
  await requireAdmin(request)
  const clock = leagueClock()
  const now = Date.now()
  const d = db()
  const asked = Number(new URL(request.url).searchParams.get('days'))
  const span = PERIODS.includes(asked) ? asked : 7
  const windowDays = Math.max(WINDOW, span * 3)
  const chartDays = Math.max(DAYS, span)

  const users = d.select({ id: user.id, at: sql<number>`${user.createdAt}` }).from(user).all()
  const inAGroup = d.select({ n: sql<number>`count(distinct ${groupMembers.userId})` }).from(groupMembers).get()?.n ?? 0
  const totals = d
    .select({
      hands: count(),
      players: sql<number>`count(distinct ${hands.userId})`,
      wagered: sql<number>`coalesce(sum(${hands.apuesta}), 0)`,
      averageBet: sql<number>`coalesce(avg(${hands.apuesta}), 0)`,
      biggestBet: sql<number>`coalesce(max(${hands.apuesta}), 0)`,
    })
    .from(hands)
    .get()!
  const paid = d.select({ n: sql<number>`coalesce(sum(${pays.cantidad}), 0)` }).from(pays).get()?.n ?? 0

  // Who is at the table now.
  const live = d
    .select({
      players: sql<number>`count(distinct ${hands.userId})`,
      open: sql<number>`coalesce(sum(${hands.fase} <> 'settled'), 0)`,
    })
    .from(hands)
    .where(sql`${hands.updatedAt} >= ${now - LIVE}`)
    .get()!
  const lastHandAt = d.select({ at: sql<number | null>`max(${hands.updatedAt})` }).from(hands).get()?.at ?? null

  // Every hand of the last three weeks, one by one.
  const recent: Played[] = d
    .select({ userId: hands.userId, at: sql<number>`${hands.createdAt}`, bet: hands.apuesta, net: hands.neto })
    .from(hands)
    .where(sql`${hands.createdAt} >= ${now - windowDays * DAY}`)
    .orderBy(hands.createdAt)
    .all()
  const between = (from: number, to: number) => recent.filter((row) => row.at >= now - from * DAY && row.at < now - to * DAY)
  const joined = (from: number, to: number) => users.filter((u) => u.at >= now - from * DAY && u.at < now - to * DAY).length
  const ids = (rows: Played[]) => new Set(rows.map((row) => row.userId))
  const [w0, w1, w2] = [between(span, 0), between(span * 2, span), between(span * 3, span * 2)]
  const weeks = { current: period(w0, joined(span, 0), ids(w1)), previous: period(w1, joined(span * 2, span), ids(w2)) }

  // Hands, players, sign-ups and minutes per day.
  const days = Array.from({ length: chartDays }, (_, i) => dayFormat.format(new Date(now - (chartDays - 1 - i) * DAY)))
  const perDay = new Map(days.map((day) => [day, { rows: [] as Played[], signups: 0 }]))
  for (const row of recent) perDay.get(dayFormat.format(row.at))?.rows.push(row)
  for (const u of users) {
    const day = perDay.get(dayFormat.format(u.at))
    if (day) day.signups++
  }
  const activity = days.map((day) => {
    const { rows, signups } = perDay.get(day)!
    return { day, hands: rows.length, players: ids(rows).size, signups, minutes: Math.round(playTime(rows) / 60_000) }
  })

  // The days each player has played and the busy hours, from their hands an hour at a time.
  const hours = d
    .select({ userId: hands.userId, hour: sql<number>`${hands.createdAt} / ${HOUR}`, n: count() })
    .from(hands)
    .groupBy(hands.userId, sql`${hands.createdAt} / ${HOUR}`)
    .all()
  const played = new Map<string, Set<string>>()
  const heatmap = Array.from({ length: 7 }, () => Array<number>(24).fill(0))
  const heatFrom = now - HEATMAP_DAYS * DAY
  for (const row of hours) {
    const at = row.hour * HOUR
    const daysPlayed = played.get(row.userId) ?? new Set<string>()
    daysPlayed.add(dayFormat.format(at))
    played.set(row.userId, daysPlayed)
    if (at < heatFrom) continue
    const parts = Object.fromEntries(hourFormat.formatToParts(at).map((p) => [p.type, p.value]))
    heatmap[WEEKDAYS.indexOf(parts.weekday)][Number(parts.hour)] += row.n
  }

  // From signing up to playing most days.
  const lastWeek = new Set(days.slice(-7))
  const signupDay = new Map(users.map((u) => [u.id, dayFormat.format(u.at)]))
  const funnel = {
    signedUp: users.length,
    played: users.filter((u) => played.has(u.id)).length,
    inAGroup,
    nextDay: users.filter((u) => played.get(u.id)?.has(shiftDay(signupDay.get(u.id)!, 1))).length,
    regulars: [...played.values()].filter((set) => [...set].filter((day) => lastWeek.has(day)).length >= REGULAR_DAYS).length,
  }

  // Of who signed up each week, how many played that week and the ones after.
  const cohorts = Array.from({ length: COHORTS }, (_, i) => {
    const week = shiftDay(clock.weekStart, -7 * (COHORTS - 1 - i))
    const members = users.filter((u) => mondayOf(signupDay.get(u.id)!) === week)
    return {
      week,
      size: members.length,
      weeks: Array.from({ length: COHORTS - i }, (_, k) => {
        if (!members.length) return null
        const target = shiftDay(week, 7 * k)
        return members.filter((u) => [...(played.get(u.id) ?? [])].some((day) => mondayOf(day) === target)).length / members.length
      }),
    }
  })

  const bets = BET_BUCKETS.map((from, i) => ({ from, to: i + 1 < BET_BUCKETS.length ? BET_BUCKETS[i + 1] - 1 : null, hands: 0 }))
  for (const row of d.select({ bet: hands.apuesta, n: count() }).from(hands).groupBy(hands.apuesta).all()) {
    const bucket = bets.findLast((b) => row.bet >= b.from)
    if (bucket) bucket.hands += row.n
  }

  // The groups whose members have played the most this week.
  const weekHands = sql<number>`count(${hands.id})`
  const busyGroups = d
    .select({ id: groups.id, nombre: groups.nombre, members: sql<number>`count(distinct ${groupMembers.userId})`, hands: weekHands })
    .from(groups)
    .innerJoin(groupMembers, eq(groupMembers.groupId, groups.id))
    .leftJoin(hands, and(eq(hands.userId, groupMembers.userId), sql`${hands.createdAt} >= ${clock.weekBegin.getTime()}`))
    .groupBy(groups.id)
    .orderBy(desc(weekHands))
    .limit(TOP)
    .all()

  // Addresses several accounts sign in from.
  const accounts = sql<number>`count(distinct ${session.userId})`
  const sharedIps = d
    .select({ ip: sql<string>`${session.ipAddress}`, accounts })
    .from(session)
    .where(sql`coalesce(${session.ipAddress}, '') <> ''`)
    .groupBy(session.ipAddress)
    .having(sql`${accounts} >= ${SHARED_IP}`)
    .orderBy(desc(accounts))
    .limit(TOP)
    .all()

  const balance = currentBalance(clock)
  const player = { userId: profiles.id, nombre: displayName }
  const byHands = (value: ReturnType<typeof sql<number>>) =>
    d
      .select({ ...player, value })
      .from(hands)
      .innerJoin(profiles, eq(profiles.id, hands.userId))
      .innerJoin(user, eq(user.id, hands.userId))
      .groupBy(hands.userId)
      .orderBy(desc(value))
      .limit(TOP)
      .all()
  const tops = {
    week: d
      .select({ ...player, value: balance })
      .from(profiles)
      .innerJoin(user, eq(user.id, profiles.id))
      .where(eq(profiles.semana, clock.weekStart))
      .orderBy(desc(balance))
      .limit(TOP)
      .all(),
    allTime: byHands(sql<number>`coalesce(sum(${hands.neto}), 0)`),
    coins: d
      .select({ ...player, value: profiles.monedas })
      .from(profiles)
      .innerJoin(user, eq(user.id, profiles.id))
      .orderBy(desc(profiles.monedas))
      .limit(TOP)
      .all(),
    hands: byHands(sql<number>`count(*)`),
    wagered: byHands(sql<number>`sum(${hands.apuesta})`),
  }

  return json({
    now,
    span,
    weekEndsAt: clock.weekEnd.getTime(),
    live: { ...live, lastHandAt },
    users: users.length,
    hands: totals.hands,
    players: totals.players,
    wagered: totals.wagered,
    averageBet: totals.averageBet,
    biggestBet: totals.biggestBet,
    paid,
    weeks,
    activity,
    funnel,
    cohorts,
    heatmap,
    busyGroups,
    sharedIps,
    bets,
    tops,
  })
}

// GET /api/admin/moderation: odd behaviour worth a look, and the accounts that share an address.
export async function getModeration(request: Request): Promise<Response> {
  await requireAdmin(request)
  const now = Date.now()
  const d = db()
  const names = new Map(
    d
      .select({ id: user.id, username: sql<string>`coalesce(${user.displayUsername}, ${user.username}, ${user.name})`, createdAt: sql<number>`${user.createdAt}` })
      .from(user)
      .all()
      .map((row) => [row.id, row]),
  )
  const flags: { level: 'high' | 'mid'; kind: 'streak' | 'bot' | 'chain'; userId: string | null; ip: string | null; value: number }[] = []

  // Hands of the last week, in order, one player at a time.
  const byPlayer = new Map<string, { at: number; net: number | null }[]>()
  for (const row of d
    .select({ userId: hands.userId, at: sql<number>`${hands.createdAt}`, net: hands.neto })
    .from(hands)
    .where(sql`${hands.createdAt} >= ${now - 7 * DAY}`)
    .orderBy(hands.createdAt)
    .all()) {
    const list = byPlayer.get(row.userId) ?? []
    list.push(row)
    byPlayer.set(row.userId, list)
  }
  for (const [userId, list] of byPlayer) {
    // The longest run of won hands.
    let run = 0
    let best = 0
    for (const hand of list) {
      run = hand.net !== null && hand.net > 0 ? run + 1 : hand.net === null ? run : 0
      best = Math.max(best, run)
    }
    if (best >= STREAK) flags.push({ level: 'high', kind: 'streak', userId, ip: null, value: best })
    // A sitting with a hand every few seconds.
    let start = 0
    for (let i = 1; i <= list.length; i++) {
      if (i < list.length && list[i].at - list[i - 1].at <= SITTING_GAP) continue
      const count = i - start
      if (count >= BOT_HANDS && (list[i - 1].at - list[start].at) / (count - 1) < BOT_GAP) {
        flags.push({ level: 'mid', kind: 'bot', userId, ip: null, value: Math.round((list[i - 1].at - list[start].at) / (count - 1)) })
        break
      }
      start = i
    }
  }

  // Accounts by address.
  const rows = d
    .selectDistinct({ ip: sql<string>`${session.ipAddress}`, userId: session.userId })
    .from(session)
    .where(sql`coalesce(${session.ipAddress}, '') <> ''`)
    .all()
  const byIp = new Map<string, string[]>()
  for (const row of rows) byIp.set(row.ip, [...(byIp.get(row.ip) ?? []), row.userId])
  const clusters = [...byIp.entries()]
    .filter(([, ids]) => ids.length >= 2)
    .map(([ip, ids]) => {
      const joined = ids.map((id) => names.get(id)?.createdAt ?? 0)
      return {
        ip,
        since: Math.min(...joined),
        span: Math.max(...joined) - Math.min(...joined),
        users: ids.map((id) => ({ id, username: names.get(id)?.username ?? '?' })),
      }
    })
    .sort((a, b) => b.users.length - a.users.length)
    .slice(0, TOP)
  for (const cluster of clusters) {
    if (cluster.users.length >= SHARED_IP && cluster.span <= CHAIN_WINDOW) {
      flags.push({ level: 'high', kind: 'chain', userId: null, ip: cluster.ip, value: cluster.users.length })
    }
  }

  return json({
    flags: flags
      .sort((a, b) => Number(b.level === 'high') - Number(a.level === 'high'))
      .map((flag) => ({ ...flag, username: flag.userId ? (names.get(flag.userId)?.username ?? '?') : null })),
    clusters,
    reviews: d
      .select({ userId: reviews.userId, tipo: reviews.tipo, valor: reviews.valor, createdAt: sql<number>`${reviews.createdAt}` })
      .from(reviews)
      .orderBy(reviews.createdAt)
      .all()
      .map((row) => ({ ...row, username: names.get(row.userId)?.username ?? '?' })),
  })
}

const SEGMENTS = ['new', 'risk', 'broke', 'whales'] as const
type Segment = (typeof SEGMENTS)[number]
// Who counts as at risk: played a fair bit, then went quiet for a few days.
const RISK_HANDS = 20
const RISK_FROM = 4 * DAY
const RISK_TO = 14 * DAY
// Coins held plus coins spent in the shop.
const WHALE_COINS = 2000

/** The condition for each built-in segment, on users left-joined with profiles. */
function segmentWhere(segment: Segment, clock: ReturnType<typeof leagueClock>, now: number) {
  const lastHand = sql`(select max(h.created_at) from hands h where h.user_id = ${user.id})`
  switch (segment) {
    case 'new':
      return sql`${user.createdAt} >= ${now - 7 * DAY}`
    case 'risk':
      return sql`(select count(*) from hands h where h.user_id = ${user.id}) >= ${RISK_HANDS} and ${lastHand} between ${now - RISK_TO} and ${now - RISK_FROM}`
    case 'broke':
      return sql`${profiles.semana} = ${clock.weekStart} and ${profiles.saldo} = 0`
    case 'whales':
      return sql`coalesce(${profiles.monedas}, 0) + (select coalesce(sum(c.monedas), 0) from user_cosmetics c where c.user_id = ${user.id}) >= ${WHALE_COINS}`
  }
}

// GET /api/admin/users?q=&segment=&tag=: the newest players, or those whose username, name or
// IP matches, in a segment or with a tag.
export async function listUsers(request: Request): Promise<Response> {
  await requireAdmin(request)
  const params = new URL(request.url).searchParams
  const q = params.get('q')?.trim().toLowerCase() ?? ''
  const segment = SEGMENTS.find((s) => s === params.get('segment')) ?? null
  const tag = params.get('tag')?.trim().toUpperCase() || null
  const clock = leagueClock()
  const now = Date.now()
  const d = db()
  const lastSeen = sql<number | null>`(select max(s.updated_at) from sessions s where s.user_id = ${user.id})`
  const lastIp = sql<string | null>`(select s.ip_address from sessions s where s.user_id = ${user.id} order by s.updated_at desc limit 1)`
  const pattern = `%${q.replace(/[%_\\]/g, (char) => `\\${char}`)}%`
  const rows = d
    .select({
      id: user.id,
      username: sql<string>`coalesce(${user.displayUsername}, ${user.username}, ${user.name})`,
      nombre: profiles.nombre,
      avatarUrl: profiles.avatarUrl,
      createdAt: sql<number>`${user.createdAt}`,
      lastSeen,
      lastHand: sql<number | null>`(select max(h.created_at) from hands h where h.user_id = ${user.id})`,
      ip: lastIp,
      hands: sql<number>`(select count(*) from hands h where h.user_id = ${user.id})`,
      groups: sql<number>`(select count(*) from group_members m where m.user_id = ${user.id})`,
      balance: sql<number | null>`case when ${profiles.id} is null then null else ${currentBalance(clock)} end`,
      monedas: profiles.monedas,
      etiquetas: sql<string | null>`${playerMarks.etiquetas}`,
      silenciadoHasta: sql<number | null>`${playerMarks.silenciadoHasta}`,
    })
    .from(user)
    .leftJoin(profiles, eq(profiles.id, user.id))
    .leftJoin(playerMarks, eq(playerMarks.userId, user.id))
    .where(
      and(
        q
          ? or(
              sql`lower(${user.username}) like ${pattern} escape '\\'`,
              sql`lower(${profiles.nombre}) like ${pattern} escape '\\'`,
              sql`exists (select 1 from sessions s where s.user_id = ${user.id} and s.ip_address like ${pattern} escape '\\')`,
            )
          : undefined,
        segment ? segmentWhere(segment, clock, now) : undefined,
        tag ? sql`exists (select 1 from json_each(${playerMarks.etiquetas}) t where t.value = ${tag})` : undefined,
      ),
    )
    .orderBy(desc(user.createdAt))
    .limit(USERS_LIMIT)
    .all()
  const total = d.select({ n: count() }).from(user).get()?.n ?? 0
  const segments = Object.fromEntries(
    SEGMENTS.map((s) => [
      s,
      d.select({ n: count() }).from(user).leftJoin(profiles, eq(profiles.id, user.id)).where(segmentWhere(s, clock, now)).get()?.n ?? 0,
    ]),
  )
  // Every tag in use, with how many players have it.
  const tags = d
    .select({ tag: sql<string>`t.value`, n: count() })
    .from(sql`${playerMarks}, json_each(${playerMarks.etiquetas}) t`)
    .groupBy(sql`t.value`)
    .orderBy(desc(count()))
    .all()
  const banned = new Set(d.select({ ip: ipBans.ip }).from(ipBans).all().map((row) => row.ip))
  return json({
    total,
    segments,
    tags,
    users: rows.map(({ etiquetas, silenciadoHasta, ...row }) => ({
      ...row,
      etiquetas: etiquetas ? (JSON.parse(etiquetas) as string[]) : [],
      silenced: Boolean(silenciadoHasta && silenciadoHasta > now),
      admin: isAdmin(row.id),
      banned: Boolean(row.ip && banned.has(row.ip)),
    })),
  })
}

const BALANCE_BUCKETS: [number, number | null][] = [
  [0, 1],
  [1, 500],
  [500, 1000],
  [1000, 1001],
  [1001, 2000],
  [2000, 3000],
  [3000, 5000],
  [5000, null],
]

// GET /api/admin/economy: where the chips are, what the house keeps and how the cards fall.
export async function getEconomy(request: Request): Promise<Response> {
  await requireAdmin(request)
  const d = db()
  const clock = leagueClock()
  const balance = currentBalance(clock)
  const balances = d.select({ n: balance }).from(profiles).all().map((row) => row.n)
  const settled = d
    .select({ net: sql<number>`coalesce(sum(${hands.neto}), 0)`, wagered: sql<number>`coalesce(sum(${hands.apuesta}), 0)` })
    .from(hands)
    .where(eq(hands.fase, 'settled'))
    .get()
  const outcomes: Record<string, number> = { blackjack: 0, win: 0, push: 0, lose: 0, bust: 0, surrender: 0 }
  let rounds = 0
  let dealerBlackjacks = 0
  for (const row of d
    .select({ settlement: sql<string | null>`json_extract(${hands.ronda}, '$.settlement')` })
    .from(hands)
    .where(eq(hands.fase, 'settled'))
    .orderBy(desc(hands.createdAt))
    .limit(ECONOMY_HANDS)
    .all()) {
    if (!row.settlement) continue
    const settlement = JSON.parse(row.settlement) as { hands: { outcome: string }[]; dealerBlackjack: boolean }
    rounds++
    if (settlement.dealerBlackjack) dealerBlackjacks++
    for (const hand of settlement.hands) outcomes[hand.outcome] = (outcomes[hand.outcome] ?? 0) + 1
  }
  return json({
    players: balances.length,
    chipsInPlay: balances.reduce((sum, n) => sum + n, 0),
    paid: d.select({ n: sql<number>`coalesce(sum(${pays.cantidad}), 0)` }).from(pays).get()?.n ?? 0,
    houseKept: -(settled?.net ?? 0),
    wagered: settled?.wagered ?? 0,
    coins: d.select({ n: sql<number>`coalesce(sum(${profiles.monedas}), 0)` }).from(profiles).get()?.n ?? 0,
    histogram: BALANCE_BUCKETS.map(([from, to]) => ({
      from,
      to,
      players: balances.filter((n) => n >= from && (to === null || n < to)).length,
    })),
    rounds,
    dealerBlackjacks,
    outcomes,
    rules: rulesFor(clock.weekStart),
    // A change waiting for next Monday, if any.
    nextRules: ruleChanges().some((rule) => rule.semana > clock.weekStart) ? rulesFor(addDays(clock.weekStart, 7)) : null,
    nextWeek: addDays(clock.weekStart, 7),
  })
}

// GET /api/admin/shop: every style with its price, sale and sales, and the sale on everything.
export async function getAdminShop(request: Request): Promise<Response> {
  await requireAdmin(request)
  return json(cosmeticStats())
}

// POST /api/admin/shop/item { id, precio, oferta, retirado }: null puts a price back as it was.
export async function postShopItem(request: Request): Promise<Response> {
  const me = await requireAdmin(request, 'dueno')
  const body = await readBody(request)
  const before = getSetting('shop') ?? null
  logAction(me, 'shop_item', String(body.id), setShopItem(body.id, body), { kind: 'setting', key: 'shop', value: before })
  return json({ ok: true })
}

// POST /api/admin/shop/order { tipo, ids }
export async function postShopOrder(request: Request): Promise<Response> {
  const me = await requireAdmin(request, 'dueno')
  const body = await readBody(request)
  logAction(me, 'shop_order', setShopOrder(body.tipo, body.ids))
  return json({ ok: true })
}

// POST /api/admin/shop/sale { rebaja }: a percentage off everything, 0 to end it.
export async function postShopSale(request: Request): Promise<Response> {
  const me = await requireAdmin(request, 'dueno')
  const body = await readBody(request)
  const before = getSetting('shop') ?? null
  logAction(me, 'shop_sale', null, `${setShopSale(body.rebaja)} %`, { kind: 'setting', key: 'shop', value: before })
  return json({ ok: true })
}

// GET /api/admin/league: the week in progress and how every group stands in it.
export async function getAdminLeague(request: Request): Promise<Response> {
  await requireAdmin(request)
  const d = db()
  const clock = leagueClock()
  const balance = currentBalance(clock)
  const weekBegin = clock.weekBegin.getTime()
  const members = d
    .select({
      groupId: groupMembers.groupId,
      userId: profiles.id,
      nombre: profiles.nombre,
      saldo: balance,
      hands: sql<number>`(select count(*) from ${hands} where ${hands.userId} = ${profiles.id} and ${hands.createdAt} >= ${weekBegin})`,
    })
    .from(groupMembers)
    .innerJoin(profiles, eq(profiles.id, groupMembers.userId))
    .all()
  const byGroup = new Map<string, typeof members>()
  for (const row of members) byGroup.set(row.groupId, [...(byGroup.get(row.groupId) ?? []), row])
  const rows = d
    .select({ id: groups.id, nombre: groups.nombre })
    .from(groups)
    .all()
    .map((group) => {
      const list = byGroup.get(group.id) ?? []
      const leader = [...list].sort((a, b) => b.saldo - a.saldo)[0]
      return {
        id: group.id,
        nombre: group.nombre,
        members: list.length,
        hands: list.reduce((sum, m) => sum + m.hands, 0),
        leader: leader ? { userId: leader.userId, nombre: leader.nombre, saldo: leader.saldo } : null,
      }
    })
    .sort((a, b) => b.hands - a.hands)
  // Week 1 is the one the first hand was played in.
  const first = d.select({ at: sql<number | null>`min(${hands.createdAt})` }).from(hands).get()?.at
  const firstWeek = first ? leagueClock(new Date(first)).weekStart : clock.weekStart
  const weekNumber = 1 + Math.round((Date.parse(clock.weekStart) - Date.parse(firstWeek)) / (7 * DAY))
  return json({
    weekStart: clock.weekStart,
    weekNumber,
    weekEndsAt: clock.weekEnd.getTime(),
    now: Date.now(),
    groups: rows,
  })
}

// GET /api/admin/system: whether the server is healthy and how big its files are.
export async function getSystem(request: Request): Promise<Response> {
  await requireAdmin(request)
  const d = db()
  const file = databasePath()
  const size = (path: string) => {
    try {
      return statSync(path).size
    } catch {
      return 0
    }
  }
  const photos = d.select({ n: count() }).from(profiles).where(sql`coalesce(${profiles.avatarUrl}, '') <> ''`).get()?.n ?? 0
  return json({
    uptime: Math.round(process.uptime() * 1000),
    node: process.version,
    database: size(file) + size(`${file}-wal`),
    photos,
    mediaBytes: dirSize(mediaPath()),
    rows: {
      users: d.select({ n: count() }).from(user).get()?.n ?? 0,
      hands: d.select({ n: count() }).from(hands).get()?.n ?? 0,
      sessions: d.select({ n: count() }).from(session).get()?.n ?? 0,
      groups: d.select({ n: count() }).from(groups).get()?.n ?? 0,
      bans: d.select({ n: count() }).from(ipBans).where(activeBan()).get()?.n ?? 0,
    },
    admins: (process.env.ADMIN_USERNAMES ?? '').split(',').map((name) => name.trim()).filter(Boolean).length,
    metrics: snapshot(),
  })
}

function dirSize(dir: string): number {
  try {
    return readdirSync(dir, { withFileTypes: true }).reduce(
      (sum, entry) => sum + (entry.isDirectory() ? dirSize(join(dir, entry.name)) : statSync(join(dir, entry.name)).size),
      0,
    )
  } catch {
    return 0
  }
}

// GET /api/admin/users/detail?id=: one player's file: sessions, accounts on the same addresses, groups and last hands.
export async function getUserDetail(request: Request): Promise<Response> {
  await requireAdmin(request)
  const id = userId(new URL(request.url).searchParams.get('id'))
  const clock = leagueClock()
  const now = Date.now()
  const d = db()
  const sessions = d
    .select({
      ip: session.ipAddress,
      userAgent: session.userAgent,
      createdAt: sql<number>`${session.createdAt}`,
      lastSeen: sql<number>`${session.updatedAt}`,
    })
    .from(session)
    .where(eq(session.userId, id))
    .orderBy(desc(session.updatedAt))
    .limit(SESSIONS_LIMIT)
    .all()
  const ips = [...new Set(sessions.map((s) => s.ip).filter((ip): ip is string => Boolean(ip)))]
  const sharedWith = ips.length
    ? d
        .selectDistinct({ id: user.id, username: sql<string>`coalesce(${user.displayUsername}, ${user.username}, ${user.name})`, nombre: profiles.nombre, avatarUrl: profiles.avatarUrl, ip: session.ipAddress })
        .from(session)
        .innerJoin(user, eq(user.id, session.userId))
        .leftJoin(profiles, eq(profiles.id, user.id))
        .where(and(inArray(session.ipAddress, ips), sql`${user.id} <> ${id}`))
        .limit(TOP)
        .all()
    : []
  const theirGroups = d
    .select({ id: groups.id, nombre: groups.nombre, rol: groupMembers.rol })
    .from(groupMembers)
    .innerJoin(groups, eq(groups.id, groupMembers.groupId))
    .where(eq(groupMembers.userId, id))
    .all()
  const recent = d
    .select({ at: sql<number>`${hands.createdAt}`, bet: hands.apuesta, net: hands.neto, userId: hands.userId })
    .from(hands)
    .where(and(eq(hands.userId, id), sql`${hands.createdAt} >= ${now - 7 * DAY}`))
    .orderBy(hands.createdAt)
    .all()
  const totals = d
    .select({ hands: count(), net: sql<number>`coalesce(sum(${hands.neto}), 0)`, wagered: sql<number>`coalesce(sum(${hands.apuesta}), 0)` })
    .from(hands)
    .where(eq(hands.userId, id))
    .get()!
  const lastHands = d
    .select({ at: sql<number>`${hands.createdAt}`, bet: hands.apuesta, net: hands.neto, phase: hands.fase })
    .from(hands)
    .where(eq(hands.userId, id))
    .orderBy(desc(hands.createdAt))
    .limit(HANDS_LIMIT)
    .all()
  const banned = new Set(d.select({ ip: ipBans.ip }).from(ipBans).all().map((row) => row.ip))
  const fixes = d
    .select({
      id: adjustments.id,
      tipo: adjustments.tipo,
      cantidad: adjustments.cantidad,
      motivo: adjustments.motivo,
      por: adjustments.por,
      createdAt: sql<number>`${adjustments.createdAt}`,
    })
    .from(adjustments)
    .where(eq(adjustments.userId, id))
    .orderBy(desc(adjustments.id))
    .limit(SESSIONS_LIMIT)
    .all()
  // Chips won or lost each day for two weeks, for the chart (the adjustments mark the drops).
  const chartFrom = now - (DAYS - 1) * DAY
  const chart = Array.from({ length: DAYS }, (_, i) => ({ day: dayFormat.format(new Date(chartFrom + i * DAY)), net: 0, hands: 0 }))
  const chartDay = new Map(chart.map((c) => [c.day, c]))
  for (const row of d
    .select({ at: sql<number>`${hands.createdAt}`, net: hands.neto })
    .from(hands)
    .where(and(eq(hands.userId, id), sql`${hands.createdAt} >= ${madridDayStart(chartFrom)}`))
    .all()) {
    const day = chartDay.get(dayFormat.format(row.at))
    if (!day) continue
    day.hands++
    day.net += row.net ?? 0
  }
  return json({
    ...playerExtras(id),
    chart,
    messages: lastMessages(id),
    adjustments: fixes,
    sessions: sessions.map((s) => ({ ...s, banned: Boolean(s.ip && banned.has(s.ip)) })),
    sharedWith,
    groups: theirGroups,
    weekHands: recent.length,
    weekPlayMs: playTime(recent),
    totals,
    lastHands,
    weekStart: clock.weekStart,
  })
}

function userId(value: unknown): string {
  if (typeof value !== 'string' || !value) throw new HttpError(400, 'Usuario no válido')
  return value
}

// POST /api/admin/users/delete { id }: deletes the account and everything that hangs from it.
export async function deleteUser(request: Request): Promise<Response> {
  const me = await requireAdmin(request, 'dueno')
  const id = userId((await readBody(request)).id)
  if (id === me.id || isAdmin(id)) throw new HttpError(400, 'No se puede borrar a un administrador')
  const d = db()
  const target = d
    .select({ avatarUrl: profiles.avatarUrl, username: sql<string>`coalesce(${user.displayUsername}, ${user.username}, ${user.name})` })
    .from(user)
    .leftJoin(profiles, eq(profiles.id, user.id))
    .where(eq(user.id, id))
    .get()
  if (!target) throw new HttpError(404, 'No existe el usuario')
  const theirGroups = d.select({ id: groupMembers.groupId }).from(groupMembers).where(eq(groupMembers.userId, id)).all()
  const mates = theirGroups.length
    ? d
        .selectDistinct({ userId: groupMembers.userId })
        .from(groupMembers)
        .where(inArray(groupMembers.groupId, theirGroups.map((group) => group.id)))
        .all()
    : []
  d.transaction((tx) => {
    // Their groups get a new admin (or go, if they were alone) before the cascade takes them out.
    for (const group of theirGroups) removeMember(tx, group.id, id)
    // Sessions, accounts, profile, hands and pays go with the user.
    tx.delete(user).where(eq(user.id, id)).run()
  })
  const key = keyOf(target.avatarUrl)
  if (key) deleteObject(key)
  notifyGroups(mates.map((mate) => mate.userId).filter((mate) => mate !== id))
  logAction(me, 'delete_user', `@${target.username}`)
  return json({ ok: true })
}

// GET /api/admin/bans
export async function listBans(request: Request): Promise<Response> {
  await requireAdmin(request)
  return json(
    db()
      .select({
        ip: ipBans.ip,
        motivo: ipBans.motivo,
        por: ipBans.por,
        createdAt: sql<number>`${ipBans.createdAt}`,
        expiresAt: sql<number | null>`${ipBans.expiresAt}`,
      })
      .from(ipBans)
      .where(activeBan())
      .orderBy(desc(ipBans.createdAt))
      .all(),
  )
}

// POST /api/admin/bans { ip | userId | username, motivo?, hours? }: shuts out an address, or every
// address a player has signed in from (and signs them out everywhere). No hours: for good.
export async function banIp(request: Request): Promise<Response> {
  const me = await requireAdmin(request, 'moderador')
  const body = await readBody(request)
  const motivo = typeof body.motivo === 'string' && body.motivo.trim() ? body.motivo.trim().slice(0, 200) : null
  const d = db()
  const hours = typeof body.hours === 'number' && body.hours > 0 ? Math.min(body.hours, 24 * 365) : null
  const expiresAt = hours ? new Date(Date.now() + hours * HOUR) : null
  let ips: string[]
  let target: string
  // "@name" (or anything that isn't an address) in the address box means a player.
  const typed = typeof body.ip === 'string' ? body.ip.trim() : ''
  if (body.username === undefined && typed && !(/^[\d.:a-f]+$/i.test(typed) && /[.:]/.test(typed))) body.username = typed
  if (body.username !== undefined) {
    const name = String(body.username).replace(/^@/, '').trim().toLowerCase()
    const found = d.select({ id: user.id }).from(user).where(eq(user.username, name)).get()
    if (!found) throw new HttpError(404, 'No existe ese usuario')
    body.userId = found.id
  }
  if (body.userId !== undefined) {
    const id = userId(body.userId)
    target = `@${d.select({ n: sql<string>`coalesce(${user.displayUsername}, ${user.username}, ${user.name})` }).from(user).where(eq(user.id, id)).get()?.n ?? '?'}`
    if (id === me.id || isAdmin(id)) throw new HttpError(400, 'No se puede bloquear a un administrador')
    ips = d
      .selectDistinct({ ip: session.ipAddress })
      .from(session)
      .where(and(eq(session.userId, id), sql`coalesce(${session.ipAddress}, '') <> ''`))
      .all()
      .map((row) => row.ip!)
    d.delete(session).where(eq(session.userId, id)).run()
  } else {
    const ip = typeof body.ip === 'string' ? body.ip.trim() : ''
    if (!ip || ip.length > 64) throw new HttpError(400, 'IP no válida')
    ips = [ip]
    target = ip
  }
  // Never the admin's own addresses (a shared home connection, say).
  const mine = new Set(
    d
      .selectDistinct({ ip: session.ipAddress })
      .from(session)
      .where(eq(session.userId, me.id))
      .all()
      .map((row) => row.ip),
  )
  ips = ips.filter((ip) => !mine.has(ip))
  for (const ip of ips) {
    d.insert(ipBans)
      .values({ ip, motivo, expiresAt, por: me.name })
      .onConflictDoUpdate({ target: ipBans.ip, set: { motivo, expiresAt, por: me.name, createdAt: new Date() } })
      .run()
  }
  forgetBans()
  logAction(me, 'ban', target, [hours ? `${hours} h` : 'para siempre', motivo].filter(Boolean).join(' · '), ips.length ? { kind: 'unban', ips } : null)
  return json({ ok: true, ips })
}

// POST /api/admin/bans/delete { ip }
export async function unbanIp(request: Request): Promise<Response> {
  const me = await requireAdmin(request, 'moderador')
  const ip = (await readBody(request)).ip
  if (typeof ip !== 'string') throw new HttpError(400, 'IP no válida')
  db().delete(ipBans).where(eq(ipBans.ip, ip)).run()
  forgetBans()
  logAction(me, 'unban', ip)
  return json({ ok: true })
}

// POST /api/admin/reviews { userId, tipo, ok }: a new name or photo looked at. ok keeps it; otherwise
// the photo goes (back to initials) or the name goes back to the username.
export async function decideReview(request: Request): Promise<Response> {
  const me = await requireAdmin(request, 'moderador')
  const body = await readBody(request)
  const id = userId(body.userId)
  const tipo = body.tipo === 'foto' || body.tipo === 'nombre' ? body.tipo : null
  if (!tipo) throw new HttpError(400, 'Tipo no válido')
  const d = db()
  const row = d.select().from(reviews).where(and(eq(reviews.userId, id), eq(reviews.tipo, tipo))).get()
  if (!row) throw new HttpError(404, 'Ya no está en la cola')
  const username =
    d.select({ n: sql<string>`coalesce(${user.displayUsername}, ${user.username}, ${user.name})` }).from(user).where(eq(user.id, id)).get()?.n ?? '?'
  if (body.ok !== true) {
    const profile = d.select({ avatarUrl: profiles.avatarUrl, nombre: profiles.nombre }).from(profiles).where(eq(profiles.id, id)).get()
    // Only if it's still what was queued: the player may have changed it again since.
    if (tipo === 'foto' && profile?.avatarUrl === row.valor) {
      d.update(profiles).set({ avatarUrl: null }).where(eq(profiles.id, id)).run()
      const key = keyOf(row.valor)
      if (key) deleteObject(key)
    }
    if (tipo === 'nombre' && profile?.nombre === row.valor) d.update(profiles).set({ nombre: username }).where(eq(profiles.id, id)).run()
    notifyGroups(withMates(id))
    // Only if it was still up: a change of their own since isn't news.
    if (tipo === 'foto' ? profile?.avatarUrl === row.valor : profile?.nombre === row.valor) pushReviewRejected(id, tipo)
  }
  dropReview(id, tipo)
  logAction(me, body.ok === true ? 'review_ok' : 'review_reject', `@${username}`, tipo === 'nombre' ? row.valor : 'foto')
  return json({ ok: true })
}

/** The player and everyone in a group with them: who sees their name. */
function withMates(id: string) {
  const d = db()
  const theirGroups = d.select({ id: groupMembers.groupId }).from(groupMembers).where(eq(groupMembers.userId, id)).all()
  const mates = theirGroups.length
    ? d
        .selectDistinct({ userId: groupMembers.userId })
        .from(groupMembers)
        .where(inArray(groupMembers.groupId, theirGroups.map((group) => group.id)))
        .all()
        .map((mate) => mate.userId)
    : []
  return [id, ...mates]
}

// POST /api/admin/users/rename { id, nombre?, username? }: puts right a player's name or username.
export async function renameUser(request: Request): Promise<Response> {
  const me = await requireAdmin(request, 'moderador')
  const body = await readBody(request)
  const id = userId(body.id)
  const d = db()
  const before =
    d.select({ n: sql<string>`coalesce(${user.displayUsername}, ${user.username}, ${user.name})` }).from(user).where(eq(user.id, id)).get()?.n
  if (before === undefined) throw new HttpError(404, 'No existe')
  if (body.nombre !== undefined) {
    const nombre = typeof body.nombre === 'string' ? body.nombre.trim() : ''
    if (nombre.length < 2 || nombre.length > 20) throw new HttpError(400, 'Nombre no válido')
    const current = d.select({ nombre: profiles.nombre }).from(profiles).where(eq(profiles.id, id)).get()
    if (current && current.nombre !== nombre) {
      d.update(profiles).set({ nombre }).where(eq(profiles.id, id)).run()
      // An admin's choice needs no second look.
      dropReview(id, 'nombre')
      logAction(me, 'rename', `@${before}`, nombre)
    }
  }
  if (body.username !== undefined) {
    const { old, username } = setUsername(id, typeof body.username === 'string' ? body.username : '')
    if (old !== username.toLowerCase()) logAction(me, 'rename_username', `@${before}`, `@${username}`)
  }
  notifyGroups(withMates(id))
  return json({ ok: true })
}

// GET /api/admin/settings: the switches and every change to the economy rules.
export async function getAdminSettings(request: Request): Promise<Response> {
  await requireAdmin(request)
  return json({ flags: flags(), defaults: FLAGS, rules: ruleChanges(), maintenance: maintenance() })
}

// POST /api/admin/flags { flag, on }
export async function postFlag(request: Request): Promise<Response> {
  const me = await requireAdmin(request, 'dueno')
  const body = await readBody(request)
  if (typeof body.flag !== 'string' || !(body.flag in FLAGS) || typeof body.on !== 'boolean') {
    throw new HttpError(400, 'Interruptor no válido')
  }
  const flag = body.flag as Flag
  const before = getSetting(`flag.${flag}`) ?? null
  // Back to the default is stored as nothing.
  setSetting(`flag.${flag}`, body.on === FLAGS[flag] ? null : body.on)
  logAction(me, body.on ? 'flag_on' : 'flag_off', flag, null, { kind: 'setting', key: `flag.${flag}`, value: before })
  return json(flags())
}

function chips(value: unknown, min: number): number {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < min || value > 1_000_000) {
    throw new HttpError(400, 'Cantidad no válida')
  }
  return value
}

// POST /api/admin/rules { startBalance, dailyPay }: from next Monday, so the week in play keeps its rules.
export async function postRules(request: Request): Promise<Response> {
  const me = await requireAdmin(request, 'dueno')
  const body = await readBody(request)
  const rules = { saldoInicial: chips(body.startBalance, 1), pagaDiaria: chips(body.dailyPay, 0) }
  const semana = addDays(leagueClock().weekStart, 7)
  db().insert(economyRules).values({ semana, ...rules }).onConflictDoUpdate({ target: economyRules.semana, set: rules }).run()
  forgetRules()
  logAction(me, 'rules', semana, `${rules.saldoInicial} / ${rules.pagaDiaria}`)
  return json({ ok: true, semana })
}

// GET /api/admin/backups: the copies of the database. POST: one more, now.
export async function getBackups(request: Request): Promise<Response> {
  await requireAdmin(request, 'dueno')
  return json(listBackups())
}

export async function postBackup(request: Request): Promise<Response> {
  const me = await requireAdmin(request, 'dueno')
  const name = await createBackup()
  logAction(me, 'backup', name)
  return json(listBackups())
}

// GET /api/admin/backups/download?name=…: one of the copies; without a name, a new one taken now.
export async function downloadBackup(request: Request): Promise<Response> {
  const me = await requireAdmin(request, 'dueno')
  const asked = new URL(request.url).searchParams.get('name')
  const name = asked ?? (await createBackup())
  if (!listBackups().some((backup) => backup.name === name)) throw new HttpError(404, 'No existe')
  logAction(me, 'download', name)
  return new Response(await readFile(join(backupDir(), name)), {
    headers: {
      'content-type': 'application/vnd.sqlite3',
      'content-disposition': `attachment; filename="${name}"`,
      'cache-control': 'no-store',
    },
  })
}

// GET /api/admin/log: what the admins did, newest first.
export async function getAdminLog(request: Request): Promise<Response> {
  await requireAdmin(request)
  return json(
    db()
      .select({
        id: adminLog.id,
        admin: adminLog.admin,
        accion: adminLog.accion,
        objetivo: adminLog.objetivo,
        detalle: adminLog.detalle,
        undoable: sql<boolean>`${adminLog.deshacer} is not null`,
        deshecho: adminLog.deshecho,
        createdAt: sql<number>`${adminLog.createdAt}`,
      })
      .from(adminLog)
      .orderBy(desc(adminLog.id))
      .limit(200)
      .all()
      // SQLite answers the "is not null" with 0 or 1.
      .map((row) => ({ ...row, undoable: Boolean(row.undoable) })),
  )
}

// POST /api/admin/backups/restore { name }: puts that copy back as the database. One of how
// things are now is taken first. Whoever signed in after the copy was made has to sign in again.
export async function postRestore(request: Request): Promise<Response> {
  const me = await requireAdmin(request, 'dueno')
  const name = (await readBody(request)).name
  if (typeof name !== 'string') throw new HttpError(400, 'Copia no válida')
  // The push keys may be newer than the copy: devices signed up with them must keep working.
  const vapid = getSetting('push.vapid')
  const before = await restoreBackup(name)
  if (!before) throw new HttpError(404, 'No existe')
  // What's kept in memory belongs to the database that's gone.
  forgetAuth()
  forgetSettings()
  forgetBans()
  forgetRules()
  forgetClosedWeeks()
  forgetClosedDays()
  if (vapid && !getSetting('push.vapid')) setSetting('push.vapid', vapid)
  logAction(me, 'restore', name, before)
  // Every open app reads everything again.
  notifyAll()
  return json({ ok: true, before })
}

const ADJUST_MAX = 1_000_000

// POST /api/admin/users/adjust { id, tipo, cantidad, motivo }: adds (or takes away) chips this week, or coins.
// The day's change in the ranking moves with it, so it doesn't look like a win.
export async function adjustUser(request: Request): Promise<Response> {
  const me = await requireAdmin(request, 'moderador')
  const body = await readBody(request)
  const id = userId(body.id)
  if (!ADJUSTMENT_KINDS.includes(body.tipo as AdjustmentKind)) throw new HttpError(400, 'Tipo no válido')
  const tipo = body.tipo as AdjustmentKind
  const cantidad = body.cantidad
  if (typeof cantidad !== 'number' || !Number.isInteger(cantidad) || cantidad === 0 || Math.abs(cantidad) > ADJUST_MAX) {
    throw new HttpError(400, 'Cantidad no válida')
  }
  if (me.role !== 'dueno' && Math.abs(cantidad) > MOD_LIMIT) throw new HttpError(403, `Tu rol da como mucho ${MOD_LIMIT} de una vez`)
  const motivo = typeof body.motivo === 'string' ? body.motivo.trim() : ''
  if (motivo.length < 3 || motivo.length > 200) throw new HttpError(400, 'Falta el motivo')
  const d = db()
  const target = d
    .select({ n: sql<string>`coalesce(${user.displayUsername}, ${user.username}, ${user.name})` })
    .from(user)
    .where(eq(user.id, id))
    .get()
  if (!target) throw new HttpError(404, 'No existe')
  d.transaction((tx) => {
    rollover(tx, id)
    const row = tx.select({ saldo: profiles.saldo, monedas: profiles.monedas }).from(profiles).where(eq(profiles.id, id)).get()!
    if (row[tipo] + cantidad < 0) throw new HttpError(400, 'Se quedaría en negativo')
    if (tipo === 'saldo') {
      tx.update(profiles)
        .set({ saldo: sql`${profiles.saldo} + ${cantidad}`, saldoInicioDia: sql`max(0, ${profiles.saldoInicioDia} + ${cantidad})` })
        .where(eq(profiles.id, id))
        .run()
    } else {
      tx.update(profiles)
        .set({ monedas: sql`${profiles.monedas} + ${cantidad}` })
        .where(eq(profiles.id, id))
        .run()
    }
    tx.insert(adjustments).values({ userId: id, tipo, cantidad, motivo, por: me.name }).run()
  })
  logAction(me, `adjust_${tipo}`, `@${target.n}`, `${cantidad > 0 ? '+' : ''}${cantidad} · ${motivo}`, { kind: 'adjust', userId: id, tipo, cantidad })
  notifyGroups(withMates(id))
  return json({ ok: true })
}

// POST /api/admin/users/adjust-all { cantidad, motivo }: gives every player coins, or takes them
// away; whoever has fewer than that is left at zero. Each one gets its own line in their history.
export async function adjustAll(request: Request): Promise<Response> {
  const me = await requireAdmin(request, 'dueno')
  const body = await readBody(request)
  const cantidad = body.cantidad
  if (typeof cantidad !== 'number' || !Number.isInteger(cantidad) || cantidad === 0 || Math.abs(cantidad) > ADJUST_MAX) {
    throw new HttpError(400, 'Cantidad no válida')
  }
  const motivo = typeof body.motivo === 'string' ? body.motivo.trim() : ''
  if (motivo.length < 3 || motivo.length > 200) throw new HttpError(400, 'Falta el motivo')
  let players = 0
  let total = 0
  db().transaction((tx) => {
    for (const row of tx.select({ id: profiles.id, monedas: profiles.monedas }).from(profiles).all()) {
      const change = Math.max(cantidad, -row.monedas)
      if (change === 0) continue
      tx.update(profiles)
        .set({ monedas: sql`${profiles.monedas} + ${change}` })
        .where(eq(profiles.id, row.id))
        .run()
      tx.insert(adjustments).values({ userId: row.id, tipo: 'monedas', cantidad: change, motivo, por: me.name }).run()
      players++
      total += change
    }
  })
  logAction(me, 'adjust_all_monedas', `${players} jugadores`, `${cantidad > 0 ? '+' : ''}${cantidad} · ${motivo}`)
  notifyAll()
  return json({ ok: true, players, total })
}

// POST /api/admin/maintenance { on, message? }: closes the app to players (admins still get in).
export async function postMaintenance(request: Request): Promise<Response> {
  const me = await requireAdmin(request, 'dueno')
  const body = await readBody(request)
  if (typeof body.on !== 'boolean') throw new HttpError(400, 'Cuerpo no válido')
  const message = typeof body.message === 'string' ? body.message.trim().slice(0, 200) || null : null
  const value: Maintenance | null = body.on ? { message, since: maintenance()?.since ?? Date.now(), by: me.name } : null
  setSetting('maintenance', value)
  logAction(me, body.on ? 'maintenance_on' : 'maintenance_off', null, message)
  // Open apps check again and show (or leave) the maintenance screen.
  notifyAll()
  return json({ maintenance: value })
}

const REPORTS_LIMIT = 100

// GET /api/admin/reports: what the players say went wrong, newest first.
export async function getReports(request: Request): Promise<Response> {
  await requireAdmin(request)
  const rows = db()
    .select({
      id: reports.id,
      userId: reports.userId,
      username: sql<string>`coalesce(${user.displayUsername}, ${user.username}, ${user.name})`,
      texto: reports.texto,
      ruta: reports.ruta,
      dispositivo: reports.dispositivo,
      resuelto: reports.resuelto,
      createdAt: sql<number>`${reports.createdAt}`,
    })
    .from(reports)
    .innerJoin(user, eq(user.id, reports.userId))
    .orderBy(desc(reports.id))
    .limit(REPORTS_LIMIT)
    .all()
  return json(rows)
}

function reportId(value: unknown): number {
  if (typeof value !== 'number' || !Number.isInteger(value)) throw new HttpError(400, 'Aviso no válido')
  return value
}

// POST /api/admin/reports/resolve { id, ok }
export async function resolveReport(request: Request): Promise<Response> {
  const me = await requireAdmin(request)
  const body = await readBody(request)
  const id = reportId(body.id)
  const done = body.ok !== false
  db().update(reports).set({ resuelto: done }).where(eq(reports.id, id)).run()
  logAction(me, done ? 'report_done' : 'report_open', `#${id}`)
  return json({ ok: true })
}

// POST /api/admin/reports/delete { id }
export async function deleteReport(request: Request): Promise<Response> {
  const me = await requireAdmin(request, 'moderador')
  const id = reportId((await readBody(request)).id)
  db().delete(reports).where(eq(reports.id, id)).run()
  logAction(me, 'report_delete', `#${id}`)
  return json({ ok: true })
}

// CSV for a spreadsheet: semicolons and a BOM, which is what Excel in Spanish opens straight away.
function csv(name: string, header: string[], rows: (string | number | null)[][]): Response {
  const cell = (value: string | number | null) => {
    if (value === null) return ''
    const text = String(value)
    return /[";\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
  }
  const body = '﻿' + [header, ...rows].map((row) => row.map(cell).join(';')).join('\r\n') + '\r\n'
  return new Response(body, {
    headers: {
      'content-type': 'text/csv; charset=utf-8',
      'content-disposition': `attachment; filename="${name}-${dayFormat.format(new Date())}.csv"`,
      'cache-control': 'no-store',
    },
  })
}

/** 'YYYY-MM-DD HH:MM' in Madrid. */
const stampFormat = new Intl.DateTimeFormat('sv-SE', { timeZone: ZONE, dateStyle: 'short', timeStyle: 'short' })
const stamp = (ms: number | null) => (ms === null ? null : stampFormat.format(ms))

const SUITS: Record<string, string> = { S: '♠', H: '♥', D: '♦', C: '♣' }
const OUTCOME_TEXT: Record<string, string> = { blackjack: 'blackjack', win: 'gana', push: 'empate', lose: 'pierde', bust: 'se pasa', surrender: 'se rinde' }
const cardsText = (cards: { rank: string; suit: string }[]) => cards.map((card) => `${card.rank}${SUITS[card.suit] ?? card.suit}`).join(' ')

// GET /api/admin/export?what=players|days|hands: the players, every day the app has been played,
// or every hand anyone has played, as CSV.
export async function getExport(request: Request): Promise<Response> {
  const me = await requireAdmin(request, 'moderador')
  const what = new URL(request.url).searchParams.get('what')
  const d = db()
  if (what === 'players') {
    const clock = leagueClock()
    const rows = d
      .select({
        id: user.id,
        username: sql<string>`coalesce(${user.displayUsername}, ${user.username}, ${user.name})`,
        nombre: profiles.nombre,
        createdAt: sql<number>`${user.createdAt}`,
        lastSeen: sql<number | null>`(select max(s.updated_at) from sessions s where s.user_id = ${user.id})`,
        balance: sql<number | null>`case when ${profiles.id} is null then null else ${currentBalance(clock)} end`,
        monedas: profiles.monedas,
        hands: sql<number>`(select count(*) from hands h where h.user_id = ${user.id})`,
        wagered: sql<number>`(select coalesce(sum(h.apuesta), 0) from hands h where h.user_id = ${user.id})`,
        net: sql<number>`(select coalesce(sum(h.neto), 0) from hands h where h.user_id = ${user.id})`,
        groups: sql<number>`(select count(*) from group_members m where m.user_id = ${user.id})`,
      })
      .from(user)
      .leftJoin(profiles, eq(profiles.id, user.id))
      .orderBy(user.createdAt)
      .all()
    logAction(me, 'export', 'players')
    return csv(
      'jugadores',
      ['usuario', 'nombre', 'alta', 'ultima_conexion', 'saldo', 'monedas', 'manos', 'apostado', 'neto', 'grupos', 'admin'],
      rows.map((row) => [
        row.username,
        row.nombre,
        stamp(row.createdAt),
        stamp(row.lastSeen),
        row.balance,
        row.monedas,
        row.hands,
        row.wagered,
        row.net,
        row.groups,
        isAdmin(row.id) ? 'si' : 'no',
      ]),
    )
  }
  if (what === 'days') {
    interface Day {
      players: Set<string>
      hands: number
      wagered: number
      net: number
      signups: number
      paid: number
    }
    const days = new Map<string, Day>()
    const day = (ms: number) => {
      const key = dayFormat.format(ms)
      let entry = days.get(key)
      if (!entry) days.set(key, (entry = { players: new Set(), hands: 0, wagered: 0, net: 0, signups: 0, paid: 0 }))
      return entry
    }
    const handRows = d
      .select({ at: sql<number>`${hands.createdAt}`, userId: hands.userId, bet: hands.apuesta, net: hands.neto })
      .from(hands)
      .all()
    for (const hand of handRows) {
      const entry = day(hand.at)
      entry.players.add(hand.userId)
      entry.hands++
      entry.wagered += hand.bet
      entry.net += hand.net ?? 0
    }
    for (const row of d.select({ at: sql<number>`${user.createdAt}` }).from(user).all()) day(row.at).signups++
    for (const row of d.select({ at: sql<number>`${pays.createdAt}`, cantidad: pays.cantidad }).from(pays).all()) {
      day(row.at).paid += row.cantidad
    }
    logAction(me, 'export', 'days')
    return csv(
      'dias',
      ['dia', 'jugadores', 'manos', 'apostado', 'neto_jugadores', 'casa', 'altas', 'pagas'],
      [...days.entries()]
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([key, entry]) => [key, entry.players.size, entry.hands, entry.wagered, entry.net, -entry.net, entry.signups, entry.paid]),
    )
  }
  if (what === 'hands') {
    // Only what's needed of the round: the shoe left in it would make this huge.
    const rows = d
      .select({
        at: sql<number>`${hands.createdAt}`,
        username: sql<string>`coalesce(${user.displayUsername}, ${user.username}, ${user.name})`,
        nombre: profiles.nombre,
        modo: hands.modo,
        fase: hands.fase,
        bet: hands.apuesta,
        net: hands.neto,
        dealer: sql<string>`json_extract(${hands.ronda}, '$.dealer')`,
        played: sql<string>`json_extract(${hands.ronda}, '$.hands')`,
        settlement: sql<string | null>`json_extract(${hands.ronda}, '$.settlement')`,
        insurance: sql<number>`coalesce(json_extract(${hands.ronda}, '$.insuranceBet'), 0)`,
      })
      .from(hands)
      .innerJoin(user, eq(user.id, hands.userId))
      .leftJoin(profiles, eq(profiles.id, hands.userId))
      .orderBy(hands.createdAt)
      .all()
    logAction(me, 'export', 'hands')
    return csv(
      'manos',
      ['fecha', 'usuario', 'nombre', 'modo', 'estado', 'apuesta', 'apostado_total', 'neto', 'cartas_jugador', 'cartas_crupier', 'resultado', 'doblada', 'separada', 'seguro'],
      rows.map((row) => {
        const played = JSON.parse(row.played) as { cards: { rank: string; suit: string }[]; doubled: boolean }[]
        const settlement = row.settlement ? (JSON.parse(row.settlement) as { hands: { outcome: string }[]; totalWagered: number }) : null
        return [
          stamp(row.at),
          row.username,
          row.nombre,
          row.modo,
          row.fase === 'settled' ? 'terminada' : 'en curso',
          row.bet,
          settlement?.totalWagered ?? null,
          row.net,
          played.map((hand) => cardsText(hand.cards)).join(' | '),
          row.fase === 'settled' ? cardsText(JSON.parse(row.dealer)) : null,
          settlement?.hands.map((hand) => OUTCOME_TEXT[hand.outcome] ?? hand.outcome).join(' | ') ?? null,
          played.some((hand) => hand.doubled) ? 'si' : 'no',
          played.length > 1 ? 'si' : 'no',
          row.insurance,
        ]
      }),
    )
  }
  throw new HttpError(400, 'Exportación no válida')
}
