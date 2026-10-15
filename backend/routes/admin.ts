import { readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { and, count, desc, eq, inArray, or, sql } from 'drizzle-orm'
import { activeBan, dropReview, forgetBans, isAdmin, logAction, requireAdmin } from '../lib/admin.js'
import { createBackup, listBackups } from '../lib/backup.js'
import { snapshot } from '../lib/metrics.js'
import { announcement, FLAGS, flags, setSetting, type Announcement, type Flag } from '../lib/settings.js'
import { databasePath, db } from '../lib/db.js'
import { notifyGroups } from '../lib/events.js'
import { HttpError, json } from '../lib/http.js'
import { addDays, currentBalance, forgetRules, leagueClock, ruleChanges, rulesFor } from '../lib/league.js'
import { adminLog, economyRules, groupMembers, groups, hands, ipBans, pays, profiles, reviews, session, user } from '../lib/schema.js'
import { deleteObject, keyOf, mediaPath } from '../lib/storage.js'
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

// GET /api/admin/stats
export async function getAdminStats(request: Request): Promise<Response> {
  await requireAdmin(request)
  const clock = leagueClock()
  const now = Date.now()
  const d = db()

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
    .where(sql`${hands.createdAt} >= ${now - WINDOW * DAY}`)
    .orderBy(hands.createdAt)
    .all()
  const between = (from: number, to: number) => recent.filter((row) => row.at >= now - from * DAY && row.at < now - to * DAY)
  const joined = (from: number, to: number) => users.filter((u) => u.at >= now - from * DAY && u.at < now - to * DAY).length
  const ids = (rows: Played[]) => new Set(rows.map((row) => row.userId))
  const [w0, w1, w2] = [between(7, 0), between(14, 7), between(21, 14)]
  const weeks = { current: period(w0, joined(7, 0), ids(w1)), previous: period(w1, joined(14, 7), ids(w2)) }

  // Hands, players, sign-ups and minutes per day.
  const days = Array.from({ length: DAYS }, (_, i) => dayFormat.format(new Date(now - (DAYS - 1 - i) * DAY)))
  const perDay = new Map(days.map((day) => [day, { rows: [] as Played[], signups: 0 }]))
  for (const row of recent) perDay.get(dayFormat.format(row.at))?.rows.push(row)
  for (const u of users) perDay.get(dayFormat.format(u.at))!.signups++
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

// GET /api/admin/users?q=: the newest players, or those whose username, name or IP matches.
export async function listUsers(request: Request): Promise<Response> {
  await requireAdmin(request)
  const q = new URL(request.url).searchParams.get('q')?.trim().toLowerCase() ?? ''
  const clock = leagueClock()
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
      ip: lastIp,
      hands: sql<number>`(select count(*) from hands h where h.user_id = ${user.id})`,
      groups: sql<number>`(select count(*) from group_members m where m.user_id = ${user.id})`,
      balance: sql<number | null>`case when ${profiles.id} is null then null else ${currentBalance(clock)} end`,
      monedas: profiles.monedas,
    })
    .from(user)
    .leftJoin(profiles, eq(profiles.id, user.id))
    .where(
      q
        ? or(
            sql`lower(${user.username}) like ${pattern} escape '\\'`,
            sql`lower(${profiles.nombre}) like ${pattern} escape '\\'`,
            sql`exists (select 1 from sessions s where s.user_id = ${user.id} and s.ip_address like ${pattern} escape '\\')`,
          )
        : undefined,
    )
    .orderBy(desc(user.createdAt))
    .limit(USERS_LIMIT)
    .all()
  const total = d.select({ n: count() }).from(user).get()?.n ?? 0
  const banned = new Set(d.select({ ip: ipBans.ip }).from(ipBans).all().map((row) => row.ip))
  return json({
    total,
    users: rows.map((row) => ({ ...row, admin: isAdmin(row.id), banned: Boolean(row.ip && banned.has(row.ip)) })),
  })
}

// Balance ranges in the economy histogram: from (included) to (excluded), null for no limit.
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
  return json({
    weekStart: clock.weekStart,
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
  return json({
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
  const me = await requireAdmin(request)
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
  const me = await requireAdmin(request)
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
  logAction(me, 'ban', target, [hours ? `${hours} h` : 'para siempre', motivo].filter(Boolean).join(' · '))
  return json({ ok: true, ips })
}

// POST /api/admin/bans/delete { ip }
export async function unbanIp(request: Request): Promise<Response> {
  const me = await requireAdmin(request)
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
  const me = await requireAdmin(request)
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
    const theirGroups = d.select({ id: groupMembers.groupId }).from(groupMembers).where(eq(groupMembers.userId, id)).all()
    const mates = theirGroups.length
      ? d
          .selectDistinct({ userId: groupMembers.userId })
          .from(groupMembers)
          .where(inArray(groupMembers.groupId, theirGroups.map((group) => group.id)))
          .all()
          .map((mate) => mate.userId)
      : []
    notifyGroups([id, ...mates])
  }
  dropReview(id, tipo)
  logAction(me, body.ok === true ? 'review_ok' : 'review_reject', `@${username}`, tipo === 'nombre' ? row.valor : 'foto')
  return json({ ok: true })
}

// GET /api/admin/settings: the switches, the notice on top of the app and every change to the economy rules.
export async function getAdminSettings(request: Request): Promise<Response> {
  await requireAdmin(request)
  return json({ flags: flags(), defaults: FLAGS, announcement: announcement(), rules: ruleChanges() })
}

// POST /api/admin/flags { flag, on }
export async function postFlag(request: Request): Promise<Response> {
  const me = await requireAdmin(request)
  const body = await readBody(request)
  if (typeof body.flag !== 'string' || !(body.flag in FLAGS) || typeof body.on !== 'boolean') {
    throw new HttpError(400, 'Interruptor no válido')
  }
  const flag = body.flag as Flag
  // Back to the default is stored as nothing.
  setSetting(`flag.${flag}`, body.on === FLAGS[flag] ? null : body.on)
  logAction(me, body.on ? 'flag_on' : 'flag_off', flag)
  return json(flags())
}

// POST /api/admin/announcement { text, hours? }, or { text: '' } to take it down.
export async function postAnnouncement(request: Request): Promise<Response> {
  const me = await requireAdmin(request)
  const body = await readBody(request)
  const text = typeof body.text === 'string' ? body.text.trim().slice(0, 280) : ''
  if (!text) {
    setSetting('announcement', null)
    logAction(me, 'announcement_off')
    return json(null)
  }
  const hours = typeof body.hours === 'number' && body.hours > 0 ? Math.min(body.hours, 24 * 30) : null
  const value: Announcement = { text, expiresAt: hours ? Date.now() + hours * HOUR : null, createdAt: Date.now(), by: me.name }
  setSetting('announcement', value)
  logAction(me, 'announcement', null, text)
  return json(value)
}

function chips(value: unknown, min: number): number {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < min || value > 1_000_000) {
    throw new HttpError(400, 'Cantidad no válida')
  }
  return value
}

// POST /api/admin/rules { startBalance, dailyPay }: from next Monday, so the week in play keeps its rules.
export async function postRules(request: Request): Promise<Response> {
  const me = await requireAdmin(request)
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
  await requireAdmin(request)
  return json(listBackups())
}

export async function postBackup(request: Request): Promise<Response> {
  const me = await requireAdmin(request)
  const name = await createBackup()
  logAction(me, 'backup', name)
  return json(listBackups())
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
        createdAt: sql<number>`${adminLog.createdAt}`,
      })
      .from(adminLog)
      .orderBy(desc(adminLog.id))
      .limit(100)
      .all(),
  )
}
