'use client'

import type { Action, PublicRoundView } from '@bwf/engine'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useUser } from '@/auth/session-context'
import { ApiError, api } from '@/lib/api'

/** A hand as the server shows it: no shoe, and the dealer's hole card is null until it's revealed. */
export type HandView = PublicRoundView & { id: string; version: number; actions: Action[] }

/** GET /api/play and every POST /api/play answer with this. */
export interface TableState {
  chips: number
  minBet: number
  /** The hand being played, or the one that just finished (POST only). */
  hand: HandView | null
}

export type PlayRequest = { action: 'bet'; bet: number } | { action: 'refill' } | { action: Action; handId: string; version: number }

export function useTable() {
  const user = useUser()
  return useQuery({
    queryKey: ['table', user.id],
    queryFn: () => api<TableState>('/play'),
    // The deck lives on the server: never refetch behind the player's back mid-hand.
    refetchOnWindowFocus: false,
  })
}

export function usePlay() {
  const user = useUser()
  const queryClient = useQueryClient()
  const key = ['table', user.id]
  return useMutation({
    mutationFn: (request: PlayRequest) => api<TableState>('/play', { method: 'POST', body: request }),
    onSuccess: (table) => queryClient.setQueryData(key, table),
    onError: (err) => {
      // The hand moved on (another tab, a double tap): show what the server has.
      if (err instanceof ApiError && err.status === 409) void queryClient.invalidateQueries({ queryKey: key })
    },
  })
}

/** Back to the betting screen after a finished hand. */
export function useClearFinishedHand() {
  const user = useUser()
  const queryClient = useQueryClient()
  return () =>
    queryClient.setQueryData<TableState>(['table', user.id], (table) => (table ? { ...table, hand: null } : table))
}
