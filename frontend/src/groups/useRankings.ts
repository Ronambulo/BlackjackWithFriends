'use client'

import { useQuery } from '@tanstack/react-query'
import { useUser } from '@/auth/session-context'
import { api } from '@/lib/api'
import type { RankedMember } from './useGroups'

/** A place in a ranking that spans groups (routes/ranking.ts). */
export type RankedPlayer = Omit<RankedMember, 'rol'>

export interface GlobalRanking {
  members: RankedPlayer[]
  /** The player's own place, even when it's below the list. */
  me: RankedPlayer | null
  /** Everyone playing this week. */
  players: number
}

// Under the groups' key, so whatever refreshes the groups (a hand, the pay, a live update) refreshes these too.

/** Everyone the player shares a group with, once each. */
export function useFriendsRanking() {
  const user = useUser()
  return useQuery({
    queryKey: ['groups', user.id, 'friends'],
    queryFn: () => api<RankedPlayer[]>('/ranking/friends'),
  })
}

/** The whole world's week. */
export function useGlobalRanking() {
  const user = useUser()
  return useQuery({
    queryKey: ['groups', user.id, 'global'],
    queryFn: () => api<GlobalRanking>('/ranking/global'),
  })
}
