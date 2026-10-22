'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useUser } from '@/auth/session-context'
import { api } from '@/lib/api'
import type { TableState } from '@/table/useTable'

/** GET /api/league: the league balance (the same in every group) and the pay to claim. */
export interface League {
  balance: number
  /** What the pay button gives right now; 0 once today's is claimed. */
  pendingPay: number
  /** The week's rules, as set in the admin panel. */
  startBalance: number
  dailyPay: number
  /** When the week closes (ISO). */
  weekEndsAt: string
  /** This week's settled hands and chips wagered, against the minimum to enter the prizes. */
  hands: number
  wagered: number
  minHands: number
  minWagered: number
}

export function useLeague() {
  const user = useUser()
  return useQuery({
    queryKey: ['league', user.id],
    queryFn: () => api<League>('/league'),
  })
}

/** Claims every unclaimed day of pay at once. */
export function useClaimPay() {
  const user = useUser()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: () => api<League>('/league/pay', { method: 'POST' }),
    onSuccess: (league) => {
      queryClient.setQueryData(['league', user.id], league)
      queryClient.setQueryData<TableState>(['table', user.id], (table) =>
        table ? { ...table, chips: league.balance } : table,
      )
      void queryClient.invalidateQueries({ queryKey: ['groups', user.id] })
      void queryClient.invalidateQueries({ queryKey: ['group', user.id] })
    },
    // Already claimed somewhere else: show what the server has.
    onError: () => void queryClient.invalidateQueries({ queryKey: ['league', user.id] }),
  })
}
