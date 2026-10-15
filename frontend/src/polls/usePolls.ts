'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useUser } from '@/auth/session-context'
import { api } from '@/lib/api'

/** GET /api/polls: an open poll, with the counts once the player has answered. */
export interface Poll {
  id: number
  pregunta: string
  opciones: string[]
  endsAt: number | null
  /** The player's answer, by index; null if not yet. */
  mine: number | null
  votes: number[] | null
}

export function usePolls() {
  const user = useUser()
  return useQuery({ queryKey: ['polls', user.id], queryFn: () => api<Poll[]>('/polls'), staleTime: 5 * 60_000 })
}

export function useVote() {
  const user = useUser()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (vote: { id: number; opcion: number }) => api<Poll[]>('/polls/vote', { method: 'POST', body: vote }),
    onSuccess: (polls) => queryClient.setQueryData(['polls', user.id], polls),
  })
}
