'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useUser } from '@/auth/session-context'
import { api } from '@/lib/api'

// Closed weeks: every Monday the API ranks each group, hands out coins and
// trophies, and keeps the joke prizes. The ceremony shows the player theirs once.

export const JOKE_PRIZES = ['blackjacks', 'biggestBet', 'worstStreak', 'hands', 'insurances', 'bestStreak', 'bestWin', 'wins', 'pushes', 'doubles', 'splits', 'busts', 'surrenders', 'dealerBlackjacks'] as const
export type JokePrize = (typeof JOKE_PRIZES)[number]
/** Coins for each joke prize won where the group gives prizes (backend/lib/season.ts). */
export const JOKE_COINS = 20

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
  /** Wins in a row, at most; a push doesn't break it. */
  bestStreak: number
  /** Hands doubled. */
  doubles: number
  /** Rounds split. */
  splits: number
  busts: number
  surrenders: number
  /** Rounds where the dealer had blackjack. */
  dealerBlackjacks: number
}

export interface WeekStanding {
  userId: string
  nombre: string
  avatarUrl: string | null
  posicion: number
  saldo: number
  /** Reached the week's minimum; without it, the place gave no prize. */
  clasificado: boolean
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
  /** Whether the player reached the week's minimum. */
  qualified: boolean
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

/** GET /api/ceremony/replay: the ceremony watched in the last hour, until `hasta`. */
export function useCeremonyReplay() {
  const user = useUser()
  return useQuery({
    queryKey: ['ceremony', 'replay', user.id],
    queryFn: () => api<(Ceremony & { hasta: string }) | null>('/ceremony/replay'),
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
      void queryClient.invalidateQueries({ queryKey: ['ceremony', 'replay', user.id] })
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
