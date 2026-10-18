'use client'

import type { Action } from '@bwf/engine'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useUser } from '@/auth/session-context'
import { ApiError, api } from '@/lib/api'
import type { HandView } from '@/table/useTable'

/** GET /api/daily and every POST /api/daily answer with this (backend/routes/daily.ts). */
export interface DailyState {
  /** #1 the first day there was one. */
  number: number
  day: string
  /** When the next deck comes out (ISO date). */
  endsAt: string
  bet: number
  start: number
  total: number
  /** Coins for 1st in a group, paid the next day. */
  prize: number
  /** The run's own chips, apart from the league balance. */
  chips: number
  /** One letter per finished hand: w won, l lost, p push. */
  results: string
  hand: HandView | null
  version: number
  done: boolean
  /** For the shared link, /r/<codigo>, once it's over. */
  codigo: string | null
  /** The line to share, once it's over. */
  share: string | null
  /** Yesterday's run; prize is set once that day closed and they won it, seen once the app told them. */
  yesterday: { number: number; net: number; prize: number | null; seen: boolean } | null
}

export interface DailyRanked {
  userId: string
  nombre: string
  avatarUrl: string | null
  marco: string | null
  net: number
  results: string
  rank: number
}

export interface DailyRanking {
  /** Hidden until the player has finished today's. */
  locked: boolean
  finished: number
  rows: DailyRanked[]
}

export type DailyRequest = { action: 'deal' | Action; version: number }

export function useDaily() {
  const user = useUser()
  return useQuery({
    queryKey: ['daily', user.id],
    queryFn: () => api<DailyState>('/daily'),
    // Like the table: never refetch behind the player's back mid-hand.
    refetchOnWindowFocus: false,
  })
}

export function useDailyPlay() {
  const user = useUser()
  const queryClient = useQueryClient()
  const key = ['daily', user.id]
  return useMutation({
    mutationFn: (request: DailyRequest) => api<DailyState>('/daily', { method: 'POST', body: request }),
    onSuccess: (state) => {
      queryClient.setQueryData(key, state)
      if (state.done) void queryClient.invalidateQueries({ queryKey: ['dailyRanking', user.id] })
    },
    onError: (err) => {
      // Another tab or a double tap moved it on: show what the server has.
      if (err instanceof ApiError && err.status === 409) void queryClient.invalidateQueries({ queryKey: key })
    },
  })
}

/** Today's results of everyone the player shares a group with ('friends'), or of one group. */
export function useDailyRanking(group: string, enabled = true) {
  const user = useUser()
  return useQuery({
    queryKey: ['dailyRanking', user.id, group],
    queryFn: () => api<DailyRanking>(`/daily/ranking?group=${encodeURIComponent(group)}`),
    enabled,
  })
}
