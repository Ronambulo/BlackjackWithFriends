import { handValue, type Card, type HandResult, type PlayerHand } from '@bwf/engine'
import { and, asc, eq, gte, inArray, isNotNull, lte, ne, sql } from 'drizzle-orm'
import { db, type Tx } from './db.js'
import { madridMidnight } from './league.js'
import { achievements, groupMembers, hands, messages, pays, profiles, reactions, seasonResults, seasonStandings, user } from './schema.js'

// Achievements. Each one is worked out from what's already in the database
// (hands, groups, closed weeks, chats), so checking again unlocks whatever a player has
// earned, old hands included: syncAchievements runs after every settled hand,
// join, week close and chat message or reaction, and for everyone when the server starts.
//
// The two that need the balance at the time of a hand (allIn, survivor) can only
// be checked within the profile's current week: older weeks' pays are gone.

export type Reward = { coins: number } | { cosmetic: 'tapete' | 'dorso'; name: string }

export const ACHIEVEMENTS = [
  { id: 'firstHand', reward: { coins: 10 } },
  { id: 'firstBlackjack', reward: { coins: 25 } },
  { id: 'doubleWin', reward: { coins: 20 } },
  { id: 'splitWin', reward: { coins: 30 } },
  { id: 'fiveCards', reward: { coins: 40 } },
  { id: 'streak5', reward: { coins: 50 } },
  { id: 'survivor', reward: { coins: 50 } },
  { id: 'host', reward: { coins: 30 } },
  { id: 'winWeek', reward: { coins: 100 } },
  { id: 'hands1000', reward: { coins: 150 } },
  { id: 'podium10', reward: { coins: 250 } },
  { id: 'surrender25', reward: { coins: 40 } },
  { id: 'chatty', reward: { coins: 30 } },
  { id: 'dealerBust500', reward: { coins: 75 } },
  { id: 'allIn', reward: { cosmetic: 'dorso', name: 'Kamikaze' } },
  { id: 'blackjack100', reward: { cosmetic: 'tapete', name: 'Medianoche' } },
] as const satisfies readonly { id: string; reward: Reward }[]

export type AchievementId = (typeof ACHIEVEMENTS)[number]['id']

/** Below this many chips a player can't bet (routes/play.ts MIN_BET). */
const BROKE = 10
/** What survivor asks to win back at the table after going broke. */
const COMEBACK = 1000
const SURRENDERS = 25
const DEALER_BUSTS = 500
/** Chat messages written plus reactions given. */
const CHATTY = 100

const won = (r: HandResult | undefined) => r?.outcome === 'win' || r?.outcome === 'blackjack'

interface PlayedHand {
  createdAt: Date
  apuesta: number
  net: number
  hands: PlayerHand[]
  dealer: Card[]
  results: HandResult[]
}

/** What the player's hands alone unlock. */
function fromHands(tx: Tx, userId: string, missing: Set<AchievementId>, got: Set<AchievementId>) {
  const counts = tx
    .select({
      hands: sql<number>`count(*)`,
      blackjacks: sql<number>`coalesce(sum(exists (
        select 1 from json_each(${hands.ronda}, '$.settlement.hands')
        where json_extract(value, '$.outcome') = 'blackjack'
      )), 0)`,
      surrenders: sql<number>`coalesce(sum(json_extract(${hands.ronda}, '$.settlement.hands[0].outcome') = 'surrender'), 0)`,
    })
    .from(hands)
    .where(and(eq(hands.userId, userId), eq(hands.fase, 'settled')))
    .get() ?? { hands: 0, blackjacks: 0, surrenders: 0 }
  if (counts.hands >= 1) got.add('firstHand')
  if (counts.hands >= 1000) got.add('hands1000')
  if (counts.blackjacks >= 1) got.add('firstBlackjack')
  if (counts.blackjacks >= 100) got.add('blackjack100')
  if (counts.surrenders >= SURRENDERS) got.add('surrender25')

  const scan = ['doubleWin', 'splitWin', 'fiveCards', 'streak5', 'allIn', 'survivor', 'dealerBust500'] as const
  if (!scan.some((id) => missing.has(id))) return
  // Only what's needed of each round: the shoe is most of it.
  const played: PlayedHand[] = tx
    .select({
      createdAt: hands.createdAt,
      apuesta: hands.apuesta,
      net: sql<number>`${hands.neto}`,
      hands: sql<string>`json_extract(${hands.ronda}, '$.hands')`,
      dealer: sql<string>`json_extract(${hands.ronda}, '$.dealer')`,
      results: sql<string>`json_extract(${hands.ronda}, '$.settlement.hands')`,
    })
    .from(hands)
    .where(and(eq(hands.userId, userId), eq(hands.fase, 'settled')))
    .orderBy(asc(hands.createdAt))
    .all()
    .map((row) => ({ ...row, hands: JSON.parse(row.hands), dealer: JSON.parse(row.dealer), results: JSON.parse(row.results) }))

  let run = 0
  let dealerBusts = 0
  for (const hand of played) {
    hand.hands.forEach((h, i) => {
      if (h.doubled && won(hand.results[i])) got.add('doubleWin')
      if (h.cards.length >= 5 && won(hand.results[i])) got.add('fiveCards')
    })
    if (hand.hands.length >= 2 && hand.results.every(won)) got.add('splitWin')
    // Wins in a row; a push doesn't break it.
    if (hand.net > 0 && ++run >= 5) got.add('streak5')
    else if (hand.net < 0) run = 0
    if (handValue(hand.dealer).total > 21 && ++dealerBusts >= DEALER_BUSTS) got.add('dealerBust500')
  }

  if (missing.has('allIn') || missing.has('survivor')) fromBalances(tx, userId, played, got)
}

/**
 * allIn and survivor: the balance before each hand of the profile's week, worked
 * back from the balance now through that week's hands and pays.
 */
function fromBalances(tx: Tx, userId: string, played: PlayedHand[], got: Set<AchievementId>) {
  const profile = tx
    .select({ saldo: profiles.saldo, semana: profiles.semana })
    .from(profiles)
    .where(eq(profiles.id, userId))
    .get()
  if (!profile) return
  const begin = madridMidnight(profile.semana)
  const week = played.filter((hand) => hand.createdAt >= begin)
  if (week.length === 0) return

  // A hand still being played has its stake taken already.
  const open = tx
    .select({
      staked: sql<number>`(select coalesce(sum(json_extract(value, '$.bet')), 0) from json_each(${hands.ronda}, '$.hands'))
        + coalesce(json_extract(${hands.ronda}, '$.insuranceBet'), 0)`,
    })
    .from(hands)
    .where(and(eq(hands.userId, userId), ne(hands.fase, 'settled')))
    .get()
  const paid = tx
    .select({ createdAt: pays.createdAt, cantidad: pays.cantidad })
    .from(pays)
    .where(and(eq(pays.userId, userId), gte(pays.createdAt, begin)))
    .all()

  const events = [
    ...week.map((hand) => ({ at: hand.createdAt.getTime(), hand, amount: hand.net })),
    ...paid.map((pay) => ({ at: pay.createdAt.getTime(), hand: null, amount: pay.cantidad })),
  ].sort((a, b) => b.at - a.at)
  let balance = profile.saldo + (open?.staked ?? 0)
  const before = new Map<PlayedHand, number>()
  for (const event of events) {
    balance -= event.amount
    if (event.hand) before.set(event.hand, balance)
  }

  // Broke after a hand, then won COMEBACK chips back at the table.
  let since: number | null = null
  for (const hand of week) {
    const start = before.get(hand)!
    if (hand.net > 0 && hand.apuesta === start) got.add('allIn')
    if (since !== null && (since += hand.net) >= COMEBACK) got.add('survivor')
    if (start + hand.net < BROKE) since = 0
  }
}

/**
 * Unlocks every achievement the player has earned and doesn't have yet, and pays
 * their coins. Returns the new ones.
 */
export function syncAchievements(tx: Tx, userId: string): AchievementId[] {
  const have = new Set(
    tx
      .select({ logro: achievements.logro })
      .from(achievements)
      .where(eq(achievements.userId, userId))
      .all()
      .map((row) => row.logro),
  )
  const missing = new Set<AchievementId>(ACHIEVEMENTS.map((a) => a.id).filter((id) => !have.has(id)))
  if (missing.size === 0) return []
  const got = new Set<AchievementId>()

  fromHands(tx, userId, missing, got)

  // Admin of a group someone else has joined.
  const hosted = tx
    .select({ n: sql<number>`count(*)` })
    .from(groupMembers)
    .where(
      and(
        eq(groupMembers.userId, userId),
        eq(groupMembers.rol, 'admin'),
        sql`(select count(*) from ${groupMembers} m where m.group_id = ${groupMembers.groupId}) >= 2`,
      ),
    )
    .get()
  if (hosted?.n) got.add('host')

  if (missing.has('chatty')) {
    const written = tx
      .select({ n: sql<number>`count(*)` })
      .from(messages)
      .where(and(eq(messages.userId, userId), isNotNull(messages.texto)))
      .get()
    const reacted = tx.select({ n: sql<number>`count(*)` }).from(reactions).where(eq(reactions.userId, userId)).get()
    if ((written?.n ?? 0) + (reacted?.n ?? 0) >= CHATTY) got.add('chatty')
  }

  const trophy = tx
    .select({ n: sql<number>`count(*)` })
    .from(seasonStandings)
    .where(and(eq(seasonStandings.userId, userId), eq(seasonStandings.trofeo, true)))
    .get()
  if (trophy?.n) got.add('winWeek')
  const podiums = tx
    .select({ n: sql<number>`count(*)` })
    .from(seasonResults)
    .where(and(eq(seasonResults.userId, userId), lte(seasonResults.mejorPuesto, 3)))
    .get()
  if ((podiums?.n ?? 0) >= 10) got.add('podium10')

  const unlocked = ACHIEVEMENTS.filter((a) => missing.has(a.id) && got.has(a.id))
  if (unlocked.length === 0) return []
  tx.insert(achievements)
    .values(unlocked.map((a) => ({ userId, logro: a.id })))
    .run()
  const coins = unlocked.reduce((sum, a) => sum + ('coins' in a.reward ? a.reward.coins : 0), 0)
  if (coins > 0)
    tx.update(profiles)
      .set({ monedas: sql`${profiles.monedas} + ${coins}` })
      .where(eq(profiles.id, userId))
      .run()
  return unlocked.map((a) => a.id)
}

/** Checks everyone, for achievements earned before they existed. */
export function syncAllAchievements() {
  const ids = db()
    .select({ id: profiles.id })
    .from(profiles)
    .innerJoin(user, eq(user.id, profiles.id))
    .all()
    .map((row) => row.id)
  let total = 0
  for (const id of ids) total += db().transaction((tx) => syncAchievements(tx, id)).length
  if (total > 0) console.log(`Logros desbloqueados al arrancar: ${total}`)
}

/** Unlocks for the admins of a group, after someone joins it. */
export function syncGroupAdmins(tx: Tx, groupId: string) {
  const admins = tx
    .select({ userId: groupMembers.userId })
    .from(groupMembers)
    .where(and(eq(groupMembers.groupId, groupId), eq(groupMembers.rol, 'admin')))
    .all()
  for (const { userId } of admins) syncAchievements(tx, userId)
}

export interface PlayerAchievement {
  id: AchievementId
  reward: Reward
  /** When it was unlocked (ISO), null if still locked. */
  unlockedAt: string | null
  /** Unlocked and not shown to the player yet. */
  isNew: boolean
  /** How far along a counted one is, while locked. */
  progress?: { done: number; goal: number }
}

/** Where the player stands on the achievements that count up to a number. */
function achievementProgress(userId: string): Partial<Record<AchievementId, number>> {
  const settled = and(eq(hands.userId, userId), eq(hands.fase, 'settled'))
  const counts = db()
    .select({
      hands: sql<number>`count(*)`,
      blackjacks: sql<number>`coalesce(sum(exists (
        select 1 from json_each(${hands.ronda}, '$.settlement.hands')
        where json_extract(value, '$.outcome') = 'blackjack'
      )), 0)`,
      surrenders: sql<number>`coalesce(sum(json_extract(${hands.ronda}, '$.settlement.hands[0].outcome') = 'surrender'), 0)`,
    })
    .from(hands)
    .where(settled)
    .get()
  const dealerBusts = db()
    .select({ dealer: sql<string>`json_extract(${hands.ronda}, '$.dealer')` })
    .from(hands)
    .where(settled)
    .all()
    .filter((row) => handValue(JSON.parse(row.dealer) as Card[]).total > 21).length
  const written = db()
    .select({ n: sql<number>`count(*)` })
    .from(messages)
    .where(and(eq(messages.userId, userId), isNotNull(messages.texto)))
    .get()
  const reacted = db().select({ n: sql<number>`count(*)` }).from(reactions).where(eq(reactions.userId, userId)).get()
  const podiums = db()
    .select({ n: sql<number>`count(*)` })
    .from(seasonResults)
    .where(and(eq(seasonResults.userId, userId), lte(seasonResults.mejorPuesto, 3)))
    .get()
  return {
    hands1000: counts?.hands ?? 0,
    blackjack100: counts?.blackjacks ?? 0,
    surrender25: counts?.surrenders ?? 0,
    dealerBust500: dealerBusts,
    chatty: (written?.n ?? 0) + (reacted?.n ?? 0),
    podium10: podiums?.n ?? 0,
  }
}

/** What each counted achievement asks for. */
const GOALS: Partial<Record<AchievementId, number>> = {
  hands1000: 1000,
  blackjack100: 100,
  surrender25: SURRENDERS,
  dealerBust500: DEALER_BUSTS,
  chatty: CHATTY,
  podium10: 10,
}

/** The whole list for the profile, in catalogue order. */
export function playerAchievements(userId: string): PlayerAchievement[] {
  const rows = db().select().from(achievements).where(eq(achievements.userId, userId)).all()
  const byId = new Map(rows.map((row) => [row.logro, row]))
  const counted = ACHIEVEMENTS.some((a) => GOALS[a.id] && !byId.has(a.id)) ? achievementProgress(userId) : {}
  return ACHIEVEMENTS.map(({ id, reward }) => {
    const row = byId.get(id)
    const goal = GOALS[id]
    const done = counted[id]
    return {
      id,
      reward,
      unlockedAt: row ? row.createdAt.toISOString() : null,
      isNew: row ? !row.visto : false,
      ...(!row && goal && done !== undefined && { progress: { done: Math.min(done, goal), goal } }),
    }
  })
}

export function achievementsSeen(userId: string, ids: string[]) {
  if (ids.length === 0) return
  db()
    .update(achievements)
    .set({ visto: true })
    .where(and(eq(achievements.userId, userId), inArray(achievements.logro, ids)))
    .run()
}
