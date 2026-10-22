import { handValue, type Card, type HandResult, type PlayerHand } from '@bwf/engine'
import { and, asc, eq, sql } from 'drizzle-orm'
import { requireUser } from '../lib/auth.js'
import { db } from '../lib/db.js'
import { json } from '../lib/http.js'
import { leagueClock } from '../lib/league.js'
import { hands } from '../lib/schema.js'
import { seasonRecord } from '../lib/season.js'

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

/** The player's numbers this week and since they started, plus their last hands. */
export function playerStats(userId: string) {
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
    .where(and(eq(hands.userId, userId), eq(hands.fase, 'settled')))
    .orderBy(asc(hands.createdAt))
    .all()

  const { weekBegin } = leagueClock()
  return {
    week: summarise(played.filter((hand) => hand.at >= weekBegin)),
    total: summarise(played),
    recent: played.slice(-RECENT).map((hand) => hand.net),
  }
}

// ── The detailed page (/estadisticas) ───────────────────────────────────────

// Points the balance curve is drawn with, at most.
const CURVE = 120

interface Round {
  at: Date
  net: number
  bet: number
  hands: PlayerHand[]
  dealer: Card[]
  results: HandResult[]
  insuranceBet: number
  insurancePayout: number
}

const won = (r: HandResult | undefined) => r?.outcome === 'win' || r?.outcome === 'blackjack'

/** A move and how it went: how many times, and how many of those won. */
interface Tally {
  count: number
  won: number
}

/** What the totals the player stood on (≤16 and 17 to 21) did. */
const STANDS = ['16', '17', '18', '19', '20', '21'] as const

function detail(rounds: Round[]) {
  let bets = 0
  let maxBet = 0
  let worstHand = 0
  let wagered = 0
  let net = 0
  let lossRun = 0
  let worstStreak = 0
  const doubles: Tally = { count: 0, won: 0 }
  const splits: Tally = { count: 0, won: 0 }
  const insurance: Tally = { count: 0, won: 0 }
  let surrenders = 0
  let playerHands = 0
  let playerBusts = 0
  let dealerPlayed = 0
  let dealerBusts = 0
  let dealerBlackjacks = 0
  const stands = Object.fromEntries(STANDS.map((k) => [k, { count: 0, won: 0 }])) as Record<(typeof STANDS)[number], Tally>

  for (const round of rounds) {
    bets += round.bet
    maxBet = Math.max(maxBet, round.bet)
    worstHand = Math.min(worstHand, round.net)
    net += round.net
    wagered += round.hands.reduce((sum, h) => sum + h.bet, 0) + round.insuranceBet
    if (round.net < 0) worstStreak = Math.max(worstStreak, ++lossRun)
    else if (round.net > 0) lossRun = 0

    if (round.hands.length >= 2) {
      splits.count++
      if (round.net > 0) splits.won++
    }
    if (round.insuranceBet > 0) {
      insurance.count++
      if (round.insurancePayout > 0) insurance.won++
    }
    const dealer = handValue(round.dealer).total
    if (round.dealer.length === 2 && dealer === 21) dealerBlackjacks++
    // The dealer only draws when some hand is still standing.
    if (round.hands.some((h) => h.status === 'stood')) {
      dealerPlayed++
      if (dealer > 21) dealerBusts++
    }
    round.hands.forEach((hand, i) => {
      const result = round.results[i]
      playerHands++
      if (hand.status === 'bust') playerBusts++
      if (hand.status === 'surrendered') surrenders++
      if (hand.doubled) {
        doubles.count++
        if (won(result)) doubles.won++
      }
      if (hand.status === 'stood' && !hand.doubled && result?.outcome !== 'blackjack') {
        const total = handValue(hand.cards).total
        const tally = stands[total <= 16 ? '16' : (String(total) as (typeof STANDS)[number])]
        tally.count++
        if (won(result)) tally.won++
      }
    })
  }

  return {
    avgBet: rounds.length ? Math.round(bets / rounds.length) : 0,
    maxBet,
    worstHand,
    /** Net over everything staked, in %. */
    roi: wagered ? Math.round((net / wagered) * 1000) / 10 : 0,
    worstStreak,
    doubles,
    splits,
    insurance,
    surrenders,
    playerHands,
    playerBusts,
    dealerPlayed,
    dealerBusts,
    dealerBlackjacks,
    rounds: rounds.length,
    stands,
    curve: curve(rounds),
  }
}

/** The balance after each hand from 0, thinned to CURVE points (always keeping the last). */
function curve(rounds: Round[]) {
  const points: number[] = [0]
  let balance = 0
  for (const round of rounds) points.push((balance += round.net))
  if (points.length <= CURVE) return points
  const step = (points.length - 1) / (CURVE - 1)
  return Array.from({ length: CURVE }, (_, i) => points[Math.round(i * step)])
}

/** The detailed numbers this week and since they started. */
export function playerDetail(userId: string) {
  const rounds: Round[] = db()
    .select({
      at: hands.createdAt,
      net: sql<number>`${hands.neto}`,
      bet: hands.apuesta,
      hands: sql<string>`json_extract(${hands.ronda}, '$.hands')`,
      dealer: sql<string>`json_extract(${hands.ronda}, '$.dealer')`,
      results: sql<string>`json_extract(${hands.ronda}, '$.settlement.hands')`,
      insuranceBet: sql<number>`coalesce(json_extract(${hands.ronda}, '$.insuranceBet'), 0)`,
      insurancePayout: sql<number>`coalesce(json_extract(${hands.ronda}, '$.settlement.insurancePayout'), 0)`,
    })
    .from(hands)
    .where(and(eq(hands.userId, userId), eq(hands.fase, 'settled')))
    .orderBy(asc(hands.createdAt))
    .all()
    .map((row) => ({ ...row, hands: JSON.parse(row.hands), dealer: JSON.parse(row.dealer), results: JSON.parse(row.results) }))

  const { weekBegin } = leagueClock()
  return { week: detail(rounds.filter((round) => round.at >= weekBegin)), total: detail(rounds) }
}

// GET /api/profile/stats/detail: everything the statistics page shows past the profile's numbers.
export async function getStatsDetail(request: Request): Promise<Response> {
  const user = await requireUser(request)
  return json(playerDetail(user.id))
}

// GET /api/profile/stats: the player's numbers this week and since they started.
export async function getStats(request: Request): Promise<Response> {
  const user = await requireUser(request)
  return json({ ...playerStats(user.id), seasons: seasonRecord(user.id) })
}
