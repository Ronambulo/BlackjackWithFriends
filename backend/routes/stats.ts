import { and, asc, eq, sql } from 'drizzle-orm'
import { requireUser } from '../lib/auth.js'
import { db } from '../lib/db.js'
import { json } from '../lib/http.js'
import { leagueClock } from '../lib/league.js'
import { hands } from '../lib/schema.js'

// How many of the last hands the profile draws as bars.
const RECENT = 30

interface Played {
  at: Date
  net: number
  wagered: number
  blackjack: number
}

/** Totals over some settled hands, oldest first. A split round counts as one hand. */
function summarise(played: Played[]) {
  let wins = 0
  let pushes = 0
  let losses = 0
  let blackjacks = 0
  let bestWin = 0
  let net = 0
  let wagered = 0
  let run = 0
  let bestStreak = 0
  for (const hand of played) {
    if (hand.net > 0) wins++
    else if (hand.net < 0) losses++
    else pushes++
    if (hand.blackjack) blackjacks++
    bestWin = Math.max(bestWin, hand.net)
    net += hand.net
    wagered += hand.wagered
    // Wins in a row; a push doesn't break it.
    if (hand.net > 0) bestStreak = Math.max(bestStreak, ++run)
    else if (hand.net < 0) run = 0
  }
  return { hands: played.length, wins, pushes, losses, blackjacks, bestWin, net, wagered, streak: run, bestStreak }
}

// GET /api/profile/stats: the player's numbers this week and since they started.
export async function getStats(request: Request): Promise<Response> {
  const user = await requireUser(request)
  const played: Played[] = db()
    .select({
      at: hands.createdAt,
      net: sql<number>`${hands.neto}`,
      wagered: sql<number>`coalesce(json_extract(${hands.ronda}, '$.settlement.totalWagered'), ${hands.apuesta})`,
      blackjack: sql<number>`exists (
        select 1 from json_each(${hands.ronda}, '$.settlement.hands')
        where json_extract(value, '$.outcome') = 'blackjack'
      )`,
    })
    .from(hands)
    .where(and(eq(hands.userId, user.id), eq(hands.fase, 'settled')))
    .orderBy(asc(hands.createdAt))
    .all()

  const { weekBegin } = leagueClock()
  return json({
    week: summarise(played.filter((hand) => hand.at >= weekBegin)),
    total: summarise(played),
    recent: played.slice(-RECENT).map((hand) => hand.net),
  })
}
