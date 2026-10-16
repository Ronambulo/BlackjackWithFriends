import { and, desc, eq, gt, inArray, isNotNull, or, sql } from 'drizzle-orm'
import { requireUser } from '../lib/auth.js'
import { db, type Tx } from '../lib/db.js'
import { json } from '../lib/http.js'
import { currentBalance, dayStartBalance, leagueClock, rollover, type LeagueClock } from '../lib/league.js'
import { frameColumn } from '../lib/cosmetics.js'
import { groupMembers, profiles, user } from '../lib/schema.js'

// Rankings beyond a single group: everyone the player shares a group with, and the
// whole world. Both by this week's league balance, the same one the groups use.

// The world list shows this many; the player's own place comes apart if they're further down.
const GLOBAL_LIMIT = 100

interface PlayerRow {
  userId: string
  nombre: string
  avatarUrl: string | null
  marco: string | null
  balance: number
  dayStart: number
}

export interface RankedPlayer {
  userId: string
  nombre: string
  avatarUrl: string | null
  marco: string | null
  balance: number
  dayChange: number
  rank: number
  rankChange: number
}

function columns(c: LeagueClock) {
  return {
    userId: profiles.id,
    nombre: sql<string>`coalesce(${profiles.nombre}, ${user.displayUsername}, ${user.name})`,
    avatarUrl: profiles.avatarUrl,
    marco: frameColumn(),
    balance: currentBalance(c),
    dayStart: dayStartBalance(c),
  }
}

/** Standard competition ranking (1, 2, 2, 4), like the groups'. */
function rank(rows: PlayerRow[]): RankedPlayer[] {
  const place = (value: number, all: number[]) => 1 + all.filter((other) => other > value).length
  const now = rows.map((row) => row.balance)
  const before = rows.map((row) => row.dayStart)
  return rows
    .map((row) => {
      const current = place(row.balance, now)
      return {
        userId: row.userId,
        nombre: row.nombre,
        avatarUrl: row.avatarUrl,
        marco: row.marco,
        balance: row.balance,
        dayChange: row.balance - row.dayStart,
        rank: current,
        rankChange: place(row.dayStart, before) - current,
      }
    })
    .sort((a, b) => a.rank - b.rank || a.nombre.localeCompare(b.nombre))
}

function friends(tx: Tx, userId: string, c: LeagueClock): PlayerRow[] {
  const mine = sql`(select ${groupMembers.groupId} from ${groupMembers} where ${groupMembers.userId} = ${userId})`
  const shared = tx
    .selectDistinct({ id: groupMembers.userId })
    .from(groupMembers)
    .where(inArray(groupMembers.groupId, mine))
  return tx
    .select(columns(c))
    .from(profiles)
    .innerJoin(user, eq(user.id, profiles.id))
    .where(or(eq(profiles.id, userId), inArray(profiles.id, shared)))
    .all()
}

// GET /api/ranking/friends: everyone in any of the player's groups, once each.
export async function getFriendsRanking(request: Request): Promise<Response> {
  const me = await requireUser(request)
  const clock = leagueClock()
  const rows = db().transaction((tx) => {
    rollover(tx, me.id, clock)
    return friends(tx, me.id, clock)
  })
  return json(rank(rows))
}

// GET /api/ranking/global: the top of everyone who has played this week, and the player's place.
export async function getGlobalRanking(request: Request): Promise<Response> {
  const me = await requireUser(request)
  const clock = leagueClock()
  const result = db().transaction((tx) => {
    rollover(tx, me.id, clock)
    // A balance from an older week has already gone back to the start: those players aren't in this one.
    const thisWeek = and(eq(profiles.semana, clock.weekStart), isNotNull(profiles.nombre))
    const balance = currentBalance(clock)
    const top = tx
      .select(columns(clock))
      .from(profiles)
      .innerJoin(user, eq(user.id, profiles.id))
      .where(thisWeek)
      .orderBy(desc(balance), profiles.nombre)
      .limit(GLOBAL_LIMIT)
      .all()
    const players = tx.select({ n: sql<number>`count(*)` }).from(profiles).where(thisWeek).get()?.n ?? 0
    const self = tx.select(columns(clock)).from(profiles).innerJoin(user, eq(user.id, profiles.id)).where(eq(profiles.id, me.id)).get()
    const above = self
      ? (tx.select({ n: sql<number>`count(*)` }).from(profiles).where(and(thisWeek, gt(balance, self.balance))).get()?.n ?? 0)
      : 0
    return { top, players, self, above }
  })
  // Places from the balances alone; today's moves only matter within the list itself.
  const members = rank(result.top).map((member) => ({ ...member, rankChange: 0 }))
  const self = result.self
    ? { ...rank([result.self])[0], rank: result.above + 1, rankChange: 0 }
    : null
  return json({ members, me: self, players: result.players })
}
