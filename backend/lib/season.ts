import { and, asc, desc, eq, gte, inArray, lt, lte, sql } from 'drizzle-orm'
import { syncAchievements } from './achievements.js'
import { db, type Tx } from './db.js'
import { notifyAll } from './events.js'
import { addDays, leagueClock, leaguePlace, madridMidnight, qualifies, type LeagueClock } from './league.js'
import { pushCeremony } from './push.js'
import {
  JOKE_PRIZES,
  groupMembers,
  groups,
  hands,
  profiles,
  seasonResults,
  seasonStandings,
  seasons,
  user,
  type JokePrize,
  type SeasonStats,
} from './schema.js'

// Closing the week. When Monday 00:00 comes in Madrid, every group's ranking is
// frozen with the members who played that week, the prizes are handed out and the
// week is archived. Balances aren't touched here: each profile goes back to the
// starting balance on its own the first time it's used (lib/league.ts).
//
// That's also why the close must run before anyone's first request of the new
// week: until then, every profile that played still holds its final balance. A
// timer does it on the dot, and every API request checks first (closePastWeeks),
// in case the server was off at midnight.

/** Coins for 1st, 2nd and 3rd; only the best place counts. */
export const PLACE_COINS = [100, 60, 30]
/** Coins for having played at all that week, once. */
export const PLAYED_COINS = 10
/** Coins for each joke prize won in a group that gives prizes; each prize counts once. */
export const JOKE_COINS = 20
/** A group gives prizes only if this many of its members played. */
export const MIN_PLAYERS = 2

/** How many joke prizes each week gives, drawn from all of them. */
export const JOKES_PER_WEEK = 5

/** What each joke prize ranks by: the most of it wins. */
const JOKE_STAT: Record<JokePrize, keyof SeasonStats> = {
  blackjacks: 'blackjacks',
  biggestBet: 'biggestBet',
  worstStreak: 'worstStreak',
  hands: 'hands',
  insurances: 'insurances',
  bestStreak: 'bestStreak',
  bestWin: 'bestWin',
  wins: 'wins',
  pushes: 'pushes',
  doubles: 'doubles',
  splits: 'splits',
  busts: 'busts',
  surrenders: 'surrenders',
  dealerBlackjacks: 'dealerBlackjacks',
}

/** The week's joke prizes: a draw seeded by its Monday, so every group gets the same ones. */
export function weekJokes(semana: string): JokePrize[] {
  // FNV-1a of the date, then mulberry32 for the shuffle.
  let seed = 2166136261
  for (const char of semana) seed = Math.imul(seed ^ char.charCodeAt(0), 16777619)
  const random = () => {
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
  const pool = [...JOKE_PRIZES]
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1))
    ;[pool[i], pool[j]] = [pool[j]!, pool[i]!]
  }
  const drawn = new Set(pool.slice(0, JOKES_PER_WEEK))
  return JOKE_PRIZES.filter((prize) => drawn.has(prize))
}

interface Played {
  userId: string
  net: number
  wagered: number
  blackjack: number
  insurance: number
  doubles: number
  split: number
  busts: number
  surrender: number
  dealerBlackjack: number
}

function statsOf(played: Played[]): SeasonStats {
  const stats: SeasonStats = {
    hands: 0,
    wins: 0,
    pushes: 0,
    losses: 0,
    blackjacks: 0,
    net: 0,
    bestWin: 0,
    biggestBet: 0,
    worstStreak: 0,
    insurances: 0,
    bestStreak: 0,
    doubles: 0,
    splits: 0,
    busts: 0,
    surrenders: 0,
    dealerBlackjacks: 0,
  }
  let run = 0
  let wins = 0
  for (const hand of played) {
    stats.hands++
    if (hand.net > 0) stats.wins++
    else if (hand.net < 0) stats.losses++
    else stats.pushes++
    if (hand.blackjack) stats.blackjacks++
    if (hand.insurance) stats.insurances++
    stats.net += hand.net
    stats.bestWin = Math.max(stats.bestWin, hand.net)
    stats.biggestBet = Math.max(stats.biggestBet, hand.wagered)
    // Losses in a row; a push doesn't break it.
    if (hand.net < 0) stats.worstStreak = Math.max(stats.worstStreak, ++run)
    else if (hand.net > 0) run = 0
    // Wins in a row, the same way round.
    if (hand.net > 0) stats.bestStreak = Math.max(stats.bestStreak, ++wins)
    else if (hand.net < 0) wins = 0
    stats.doubles += hand.doubles
    if (hand.split) stats.splits++
    stats.busts += hand.busts
    if (hand.surrender) stats.surrenders++
    if (hand.dealerBlackjack) stats.dealerBlackjacks++
  }
  return stats
}

/** Closes one week: standings, prizes and each player's numbers. */
function closeWeek(tx: Tx, semana: string) {
  const begin = madridMidnight(semana)
  const end = madridMidnight(addDays(semana, 7))
  tx.insert(seasons).values({ semana }).run()

  // Profiles still on that week hold their final balance (see above).
  const played: Played[] = tx
    .select({
      userId: hands.userId,
      net: sql<number>`${hands.neto}`,
      wagered: sql<number>`coalesce(json_extract(${hands.ronda}, '$.settlement.totalWagered'), ${hands.apuesta})`,
      blackjack: sql<number>`exists (
        select 1 from json_each(${hands.ronda}, '$.settlement.hands')
        where json_extract(value, '$.outcome') = 'blackjack'
      )`,
      insurance: sql<number>`coalesce(json_extract(${hands.ronda}, '$.insuranceBet'), 0) > 0`,
      doubles: sql<number>`(select count(*) from json_each(${hands.ronda}, '$.hands') where json_extract(value, '$.doubled'))`,
      split: sql<number>`json_array_length(${hands.ronda}, '$.hands') > 1`,
      busts: sql<number>`(select count(*) from json_each(${hands.ronda}, '$.settlement.hands')
        where json_extract(value, '$.outcome') = 'bust')`,
      surrender: sql<number>`exists (
        select 1 from json_each(${hands.ronda}, '$.settlement.hands')
        where json_extract(value, '$.outcome') = 'surrender'
      )`,
      dealerBlackjack: sql<number>`coalesce(json_extract(${hands.ronda}, '$.settlement.dealerBlackjack'), 0)`,
    })
    .from(hands)
    .innerJoin(profiles, eq(profiles.id, hands.userId))
    .where(
      and(eq(profiles.semana, semana), eq(hands.fase, 'settled'), gte(hands.createdAt, begin), lt(hands.createdAt, end)),
    )
    .orderBy(asc(hands.createdAt))
    .all()
  const userIds = [...new Set(played.map((hand) => hand.userId))]
  if (userIds.length === 0) return []

  const profileRows = tx
    .select({ id: profiles.id, saldo: profiles.saldo, hands: profiles.manosSemana, wagered: profiles.apostadoSemana })
    .from(profiles)
    .where(inArray(profiles.id, userIds))
    .all()
  const balances = new Map(profileRows.map((row) => [row.id, row.saldo]))
  // The same counts the player watched all week (lib/league.ts).
  const qualified = new Set(profileRows.filter((row) => qualifies(row.hands, row.wagered)).map((row) => row.id))
  const stats = new Map(userIds.map((id) => [id, statsOf(played.filter((hand) => hand.userId === id))]))

  // Each group ranks the members who played: those who reached the minimum first,
  // and only they take places, the trophy and joke prizes.
  const memberships = tx
    .select({ groupId: groupMembers.groupId, userId: groupMembers.userId })
    .from(groupMembers)
    .where(inArray(groupMembers.userId, userIds))
    .all()
  const best = new Map<string, number>()
  const drawn = weekJokes(semana)
  const titles = new Map<string, Set<JokePrize>>(userIds.map((id) => [id, new Set()]))
  for (const groupId of new Set(memberships.map((m) => m.groupId))) {
    const players = memberships.filter((m) => m.groupId === groupId).map((m) => m.userId)
    const conPremios = players.length >= MIN_PLAYERS
    const rank = new Map(
      players.map((id) => [
        id,
        leaguePlace(
          { balance: balances.get(id) ?? 0, qualified: qualified.has(id) },
          players.map((other) => ({ balance: balances.get(other) ?? 0, qualified: qualified.has(other) })),
        ),
      ]),
    )
    const jokes = new Map<string, JokePrize[]>(players.map((id) => [id, []]))
    for (const prize of drawn) {
      const of = (id: string) => stats.get(id)![JOKE_STAT[prize]]
      const top = Math.max(...players.map(of))
      const winners = players.filter((id) => of(id) === top)
      // Everyone tied (all at the top bet, say) is no prize; alone in the group still is.
      // Whoever won it without the minimum doesn't take it, and nobody else does either.
      if (top > 0 && (winners.length < players.length || players.length === 1))
        for (const id of winners) if (qualified.has(id)) jokes.get(id)!.push(prize)
    }
    for (const userId of players) {
      const posicion = rank.get(userId)!
      const clasificado = qualified.has(userId)
      if (conPremios && clasificado) {
        best.set(userId, Math.min(best.get(userId) ?? Infinity, posicion))
        for (const prize of jokes.get(userId)!) titles.get(userId)!.add(prize)
      }
      tx.insert(seasonStandings)
        .values({
          semana,
          groupId,
          userId,
          posicion,
          saldoFinal: balances.get(userId) ?? 0,
          conPremios,
          clasificado,
          trofeo: conPremios && clasificado && posicion === 1,
          premios: jokes.get(userId)!,
        })
        .run()
    }
  }

  for (const userId of userIds) {
    const place = best.get(userId)
    const monedas = (place ? (PLACE_COINS[place - 1] ?? 0) : 0) + PLAYED_COINS + titles.get(userId)!.size * JOKE_COINS
    tx.insert(seasonResults)
      .values({
        semana,
        userId,
        saldoFinal: balances.get(userId) ?? 0,
        estadisticas: stats.get(userId)!,
        monedas,
        mejorPuesto: place ?? null,
      })
      .run()
    tx.update(profiles)
      .set({ monedas: sql`${profiles.monedas} + ${monedas}` })
      .where(eq(profiles.id, userId))
      .run()
    syncAchievements(tx, userId)
  }
  return userIds
}

// The last week known to be closed, so most requests skip the query.
let closedBefore: string | null = null

/**
 * Closes every past week that still has profiles on it. Cheap when there's nothing
 * to do; run it before anything that may roll a profile over. Returns whether it
 * closed any.
 */
export function closePastWeeks(c: LeagueClock = leagueClock()): boolean {
  if (closedBefore === c.weekStart) return false
  const players: string[] = []
  const closed = db().transaction((tx) => {
    const pending = tx
      .selectDistinct({ semana: profiles.semana })
      .from(profiles)
      .where(and(lt(profiles.semana, c.weekStart), sql`${profiles.semana} not in (select ${seasons.semana} from ${seasons})`))
      .orderBy(asc(profiles.semana))
      .all()
    for (const { semana } of pending) players.push(...closeWeek(tx, semana))
    return pending.length > 0
  })
  closedBefore = c.weekStart
  pushCeremony(players)
  return closed
}

/** After a restore: the copy may have weeks still to close. */
export function forgetClosedWeeks() {
  closedBefore = null
}

/** Closes the week as soon as it ends, then waits for the next one. */
export function scheduleSeasons() {
  const run = () => {
    try {
      // Open apps refetch, so the ceremony shows up straight away.
      if (closePastWeeks()) notifyAll()
    } catch (err) {
      console.error('Cierre de semana fallido', err)
    }
    // A second late, so the clock already reads the new week.
    setTimeout(run, Math.max(1000, leagueClock().weekEnd.getTime() - Date.now() + 1000)).unref()
  }
  run()
}

// ── Reading closed weeks ────────────────────────────────────────────────────

export interface WeekStanding {
  userId: string
  nombre: string
  avatarUrl: string | null
  posicion: number
  saldo: number
  /** Reached the week's minimum; without it, the place gave no prize. */
  clasificado: boolean
  trofeo: boolean
  premios: JokePrize[]
}

export interface Joke {
  prize: JokePrize
  /** How much of it the winners had (blackjacks, chips, losses in a row...). */
  value: number
  userIds: string[]
}

export interface GroupWeek {
  semana: string
  conPremios: boolean
  standings: WeekStanding[]
  jokes: Joke[]
}

/** Closed weeks of a group, newest first. */
export function groupWeeks(tx: Tx, groupId: string, semanas?: string[]): GroupWeek[] {
  const rows = tx
    .select({
      semana: seasonStandings.semana,
      userId: seasonStandings.userId,
      nombre: sql<string>`coalesce(${profiles.nombre}, ${user.displayUsername}, ${user.name})`,
      avatarUrl: profiles.avatarUrl,
      posicion: seasonStandings.posicion,
      saldo: seasonStandings.saldoFinal,
      conPremios: seasonStandings.conPremios,
      clasificado: seasonStandings.clasificado,
      trofeo: seasonStandings.trofeo,
      premios: seasonStandings.premios,
      stats: seasonResults.estadisticas,
    })
    .from(seasonStandings)
    .innerJoin(profiles, eq(profiles.id, seasonStandings.userId))
    .innerJoin(user, eq(user.id, seasonStandings.userId))
    .innerJoin(
      seasonResults,
      and(eq(seasonResults.semana, seasonStandings.semana), eq(seasonResults.userId, seasonStandings.userId)),
    )
    .where(and(eq(seasonStandings.groupId, groupId), semanas ? inArray(seasonStandings.semana, semanas) : undefined))
    .orderBy(desc(seasonStandings.semana), asc(seasonStandings.posicion))
    .all()

  const weeks = new Map<string, GroupWeek>()
  for (const row of rows) {
    let week = weeks.get(row.semana)
    if (!week) weeks.set(row.semana, (week = { semana: row.semana, conPremios: row.conPremios, standings: [], jokes: [] }))
    week.standings.push({
      userId: row.userId,
      nombre: row.nombre,
      avatarUrl: row.avatarUrl,
      posicion: row.posicion,
      saldo: row.saldo,
      clasificado: row.clasificado,
      trofeo: row.trofeo,
      premios: row.premios,
    })
    for (const prize of row.premios) {
      let joke = week.jokes.find((j) => j.prize === prize)
      if (!joke) week.jokes.push((joke = { prize, value: row.stats[JOKE_STAT[prize]], userIds: [] }))
      joke.userIds.push(row.userId)
    }
  }
  for (const week of weeks.values()) {
    week.standings.sort((a, b) => a.posicion - b.posicion || a.nombre.localeCompare(b.nombre))
    week.jokes.sort((a, b) => JOKE_PRIZES.indexOf(a.prize) - JOKE_PRIZES.indexOf(b.prize))
  }
  return [...weeks.values()]
}

export interface Ceremony {
  semana: string
  coins: number
  bestPlace: number | null
  /** Whether the player reached the week's minimum; without it, places gave no prize. */
  qualified: boolean
  stats: SeasonStats
  group: (GroupWeek & { id: string; nombre: string }) | null
  /** Other groups the player was ranked in that week. */
  otherGroups: number
}

/** How long after watching the ceremony it can be watched again. */
export const REPLAY_MS = 60 * 60_000

/** The newest closed week whose ceremony the player hasn't watched, if any. */
export function pendingCeremony(userId: string): Ceremony | null {
  return db().transaction((tx) => {
    const result = tx
      .select()
      .from(seasonResults)
      .where(and(eq(seasonResults.userId, userId), eq(seasonResults.vista, false)))
      .orderBy(desc(seasonResults.semana))
      .get()
    return result ? buildCeremony(tx, userId, result) : null
  })
}

/** The ceremony the player watched in the last hour, to watch again until `hasta`. */
export function recentCeremony(userId: string, now = new Date()): (Ceremony & { hasta: string }) | null {
  return db().transaction((tx) => {
    const result = tx
      .select()
      .from(seasonResults)
      .where(and(eq(seasonResults.userId, userId), gte(seasonResults.vistaEn, new Date(now.getTime() - REPLAY_MS))))
      .orderBy(desc(seasonResults.semana))
      .get()
    if (!result?.vistaEn) return null
    return { ...buildCeremony(tx, userId, result), hasta: new Date(result.vistaEn.getTime() + REPLAY_MS).toISOString() }
  })
}

function buildCeremony(tx: Tx, userId: string, result: typeof seasonResults.$inferSelect): Ceremony {
  // The group where the player did best, the biggest one on a tie.
  const mine = tx
    .select({
      groupId: seasonStandings.groupId,
      nombre: groups.nombre,
      posicion: seasonStandings.posicion,
      conPremios: seasonStandings.conPremios,
      clasificado: seasonStandings.clasificado,
      players: sql<number>`(select count(*) from ${seasonStandings} s
        where s.semana = ${seasonStandings.semana} and s.group_id = ${seasonStandings.groupId})`,
    })
    .from(seasonStandings)
    .innerJoin(groups, eq(groups.id, seasonStandings.groupId))
    .where(and(eq(seasonStandings.semana, result.semana), eq(seasonStandings.userId, userId)))
    .all()
    .sort((a, b) => Number(b.conPremios) - Number(a.conPremios) || a.posicion - b.posicion || b.players - a.players)
  const top = mine[0]
  const week = top ? groupWeeks(tx, top.groupId, [result.semana])[0] : undefined
  return {
    semana: result.semana,
    coins: result.monedas,
    bestPlace: result.mejorPuesto,
    qualified: mine.length === 0 || mine.some((m) => m.clasificado),
    stats: result.estadisticas,
    group: top && week ? { ...week, id: top.groupId, nombre: top.nombre } : null,
    otherGroups: Math.max(0, mine.length - 1),
  }
}

/** Marks the ceremony of that week, and any older one left unwatched, as watched. */
export function ceremonySeen(userId: string, semana: string, now = new Date()) {
  db().transaction((tx) => {
    // The clock to watch it again starts the first time only.
    tx.update(seasonResults)
      .set({ vistaEn: now })
      .where(and(eq(seasonResults.userId, userId), eq(seasonResults.semana, semana), eq(seasonResults.vista, false)))
      .run()
    tx.update(seasonResults)
      .set({ vista: true })
      .where(and(eq(seasonResults.userId, userId), lte(seasonResults.semana, semana)))
      .run()
  })
}

/** The player's record over every closed week. */
export function seasonRecord(userId: string) {
  const results = db()
    .select({ semana: seasonResults.semana, mejorPuesto: seasonResults.mejorPuesto, monedas: seasonResults.monedas })
    .from(seasonResults)
    .where(eq(seasonResults.userId, userId))
    .all()
  const trophies = db()
    .select({ semana: seasonStandings.semana, groupId: seasonStandings.groupId, nombre: groups.nombre })
    .from(seasonStandings)
    .innerJoin(groups, eq(groups.id, seasonStandings.groupId))
    .where(and(eq(seasonStandings.userId, userId), eq(seasonStandings.trofeo, true)))
    .orderBy(desc(seasonStandings.semana))
    .all()
  return {
    played: results.length,
    won: results.filter((r) => r.mejorPuesto === 1).length,
    podiums: results.filter((r) => r.mejorPuesto !== null && r.mejorPuesto <= 3).length,
    coins: results.reduce((sum, r) => sum + r.monedas, 0),
    trophies,
  }
}
