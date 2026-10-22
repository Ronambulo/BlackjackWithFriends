'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useUser } from '@/auth/session-context'
import { api } from '@/lib/api'

export type AchievementId =
  | 'firstHand'
  | 'firstBlackjack'
  | 'doubleWin'
  | 'splitWin'
  | 'fiveCards'
  | 'streak5'
  | 'survivor'
  | 'host'
  | 'winWeek'
  | 'hands1000'
  | 'podium10'
  | 'surrender25'
  | 'chatty'
  | 'dealerBust500'
  | 'allIn'
  | 'blackjack100'

export type Reward = { coins: number } | { cosmetic: 'tapete' | 'dorso'; name: string }

/** One just unlocked, as POST /api/play reports it. */
export interface UnlockedAchievement {
  id: AchievementId
  reward: Reward
}

/** GET /api/achievements, in catalogue order (backend/lib/achievements.ts). */
export interface Achievement {
  id: AchievementId
  reward: Reward
  /** ISO date, null while locked. */
  unlockedAt: string | null
  /** Unlocked and not seen yet. */
  isNew: boolean
  /** Only the counted ones still locked (play 1.000 hands…): how far along. */
  progress?: { done: number; goal: number }
}

export function useAchievements() {
  const user = useUser()
  return useQuery({
    queryKey: ['achievements', user.id],
    queryFn: () => api<Achievement[]>('/achievements'),
  })
}

/** Seen in the profile: they stop being new next time (this view keeps the mark). */
export function useAchievementsSeen() {
  return useMutation({
    mutationFn: (ids: AchievementId[]) => api('/achievements/seen', { method: 'POST', body: { ids } }),
  })
}

/** After something that may have unlocked achievements: their coins and the list. */
export function useRefreshAchievements() {
  const user = useUser()
  const queryClient = useQueryClient()
  return () => {
    void queryClient.invalidateQueries({ queryKey: ['achievements', user.id] })
    void queryClient.invalidateQueries({ queryKey: ['profile', user.id] })
  }
}
