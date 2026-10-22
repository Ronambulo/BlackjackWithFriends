'use client'

import { useQuery } from '@tanstack/react-query'
import { useUser } from '@/auth/session-context'
import { api } from '@/lib/api'
import type { SeasonRecord } from '@/season/useSeason'

/** Totals over some settled hands; a split round counts as one hand. */
export interface Stats {
  hands: number
  wins: number
  pushes: number
  losses: number
  /** Rounds with at least one blackjack. */
  blackjacks: number
  /** The most won in one hand, 0 if none. */
  bestWin: number
  net: number
  wagered: number
  /** Wins in a row up to the last hand; pushes don't break it. */
  streak: number
  bestStreak: number
}

/** GET /api/profile/stats */
export interface PlayerStats {
  week: Stats
  total: Stats
  /** What each of the last hands won or lost, oldest first. */
  recent: number[]
  /** Closed weeks: podiums, trophies and coins. */
  seasons: SeasonRecord
}

/** A move and how it went. */
export interface Tally {
  count: number
  won: number
}

/** Totals the player stood on: '16' is 16 or less. */
export const STANDS = ['16', '17', '18', '19', '20', '21'] as const

export interface Detail {
  avgBet: number
  maxBet: number
  /** The most lost in one hand, 0 or below. */
  worstHand: number
  /** Net over everything staked, in %. */
  roi: number
  worstStreak: number
  doubles: Tally
  splits: Tally
  insurance: Tally
  surrenders: number
  playerHands: number
  playerBusts: number
  /** Rounds the dealer had to play out. */
  dealerPlayed: number
  dealerBusts: number
  dealerBlackjacks: number
  rounds: number
  stands: Record<(typeof STANDS)[number], Tally>
  /** The balance after each hand from 0, thinned out. */
  curve: number[]
}

/** GET /api/profile/stats/detail */
export interface PlayerDetail {
  week: Detail
  total: Detail
}

export function useStatsDetail() {
  const user = useUser()
  return useQuery({
    queryKey: ['stats', user.id, 'detail'],
    queryFn: () => api<PlayerDetail>('/profile/stats/detail'),
  })
}

export function useStats() {
  const user = useUser()
  return useQuery({
    queryKey: ['stats', user.id],
    queryFn: () => api<PlayerStats>('/profile/stats'),
  })
}
