'use client'

import { useQuery } from '@tanstack/react-query'
import { useUser } from '@/auth/session-context'
import { api } from '@/lib/api'

export type Tier = 'easy' | 'medium' | 'hard'

/** The catalogue (backend/lib/challenges.ts). */
export type ChallengeId =
  | 'play10'
  | 'win5'
  | 'blackjack1'
  | 'dealerBust3'
  | 'play30'
  | 'streak3'
  | 'doubleWin'
  | 'blackjack3'
  | 'profit500'
  | 'streak5'
  | 'splitWin'
  | 'bigWin'
  | 'fiveCards'
  | 'profit2000'

/** One of today's three (backend/lib/challenges.ts). */
export interface Challenge {
  id: ChallengeId
  tier: Tier
  target: number
  progress: number
  coins: number
  done: boolean
}

/** GET /api/challenges */
export interface DailyChallenges {
  day: string
  /** When the next three come (ISO). */
  endsAt: string
  challenges: Challenge[]
}

/** One just completed, as POST /api/play reports it. */
export interface CompletedChallenge {
  id: ChallengeId
  target: number
  coins: number
}

export const challengesKey = (userId: string) => ['challenges', userId]

export function useChallenges() {
  const user = useUser()
  return useQuery({
    queryKey: challengesKey(user.id),
    queryFn: () => api<DailyChallenges>('/challenges'),
  })
}
