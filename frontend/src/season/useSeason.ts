'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useUser } from '@/auth/session-context'
import { api } from '@/lib/api'

// Closed weeks: every Monday the API ranks each group, hands out coins and
// trophies, and keeps the joke prizes. The ceremony shows the player theirs once.

export const JOKE_PRIZES = ['blackjacks', 'biggestBet', 'worstStreak', 'hands', 'insurances'] as const
export type JokePrize = (typeof JOKE_PRIZES)[number]

export interface SeasonStats {
  hands: number
  wins: number
  pushes: number
  losses: number
  blackjacks: number
  net: number
  bestWin: number
  biggestBet: number
  worstStreak: number
  insurances: number
}

export interface WeekStanding {
  userId: string
  nombre: string
  avatarUrl: string | null
  posicion: number
  saldo: number
  trofeo: boolean
  premios: JokePrize[]
}

export interface Joke {
  prize: JokePrize
  value: number
  userIds: string[]
}

/** One closed week of a group. */
export interface GroupWeek {
  /** The week's Monday, 'YYYY-MM-DD'. */
  semana: string
  /** Podium, trophy and coins only count with at least two players. */
  conPremios: boolean
  standings: WeekStanding[]
  jokes: Joke[]
}

/** GET /api/ceremony */
export interface Ceremony {
  semana: string
  coins: number
  bestPlace: number | null
  stats: SeasonStats
  group: (GroupWeek & { id: string; nombre: string }) | null
  otherGroups: number
}

/** The player's closed weeks, in GET /api/profile/stats. */
export interface SeasonRecord {
  played: number
  won: number
  podiums: number
  coins: number
  trophies: { semana: string; groupId: string; nombre: string }[]
}

export function useCeremony() {
  const user = useUser()
  return useQuery({
    queryKey: ['ceremony', user.id],
    queryFn: () => api<Ceremony | null>('/ceremony'),
    staleTime: Infinity,
  })
}

/** Watched or skipped: it won't show again, and the coins it gave show up. */
export function useCeremonySeen() {
  const user = useUser()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (semana: string) => api('/ceremony/seen', { method: 'POST', body: { semana } }),
    onMutate: () => queryClient.setQueryData(['ceremony', user.id], null),
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: ['profile', user.id] })
      void queryClient.invalidateQueries({ queryKey: ['stats', user.id] })
    },
  })
}

export function useGroupSeasons(groupId: string) {
  const user = useUser()
  return useQuery({
    queryKey: ['seasons', user.id, groupId],
    queryFn: () => api<GroupWeek[]>(`/group/seasons?id=${encodeURIComponent(groupId)}`),
  })
}

const weekFormats = new Map<string, Intl.DateTimeFormat>()

/** '12 de octubre' / 'October 12', for a week's Monday. */
export function formatWeek(semana: string, language: string): string {
  let format = weekFormats.get(language)
  if (!format) {
    format = new Intl.DateTimeFormat(language, { day: 'numeric', month: 'long', timeZone: 'UTC' })
    weekFormats.set(language, format)
  }
  return format.format(new Date(`${semana}T00:00:00Z`))
}
