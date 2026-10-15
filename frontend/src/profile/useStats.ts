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

export function useStats() {
  const user = useUser()
  return useQuery({
    queryKey: ['stats', user.id],
    queryFn: () => api<PlayerStats>('/profile/stats'),
  })
}
