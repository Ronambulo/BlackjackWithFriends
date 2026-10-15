'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useUser } from '@/auth/session-context'
import type { ChallengeId, Tier } from '@/challenges/useChallenges'
import { api } from '@/lib/api'

/** GET /api/me: whether the player runs the app (undefined until known). */
export function useIsAdmin(): boolean | undefined {
  const user = useUser()
  const { data } = useQuery({
    queryKey: ['me', user.id],
    queryFn: () => api<{ id: string; admin: boolean }>('/me'),
    staleTime: Infinity,
  })
  return data?.admin
}

export interface TopEntry {
  userId: string
  nombre: string
  value: number
}

export interface WeekFigures {
  players: number
  hands: number
  playMs: number
  signups: number
  /** Share of last week's players who played again (null: nobody to compare). */
  returning: number | null
  /** Share of the chips bet that the house kept. */
  houseEdge: number | null
}

/** GET /api/admin/stats (routes/admin.ts). */
export interface AdminStats {
  now: number
  weekEndsAt: number
  live: { players: number; open: number; lastHandAt: number | null }
  users: number
  hands: number
  players: number
  wagered: number
  averageBet: number
  biggestBet: number
  paid: number
  weeks: { current: WeekFigures; previous: WeekFigures }
  activity: { day: string; hands: number; players: number; signups: number; minutes: number }[]
  funnel: { signedUp: number; played: number; inAGroup: number; nextDay: number; regulars: number }
  cohorts: { week: string; size: number; weeks: (number | null)[] }[]
  /** Hands by weekday (Monday first) and hour. */
  heatmap: number[][]
  busyGroups: { id: string; nombre: string; members: number; hands: number }[]
  sharedIps: { ip: string; accounts: number }[]
  bets: { from: number; to: number | null; hands: number }[]
  tops: Record<'week' | 'allTime' | 'coins' | 'hands' | 'wagered', TopEntry[]>
}

export interface AdminUser {
  id: string
  username: string
  nombre: string | null
  avatarUrl: string | null
  createdAt: number
  lastSeen: number | null
  ip: string | null
  hands: number
  groups: number
  balance: number | null
  monedas: number | null
  admin: boolean
  banned: boolean
}

/** GET /api/admin/users/detail (routes/admin.ts). */
export interface UserDetail {
  sessions: { ip: string | null; userAgent: string | null; createdAt: number; lastSeen: number; banned: boolean }[]
  sharedWith: { id: string; username: string; nombre: string | null; avatarUrl: string | null; ip: string | null }[]
  groups: { id: string; nombre: string; rol: string }[]
  weekHands: number
  weekPlayMs: number
  totals: { hands: number; net: number; wagered: number }
  lastHands: { at: number; bet: number; net: number | null; phase: string }[]
}

export interface Ban {
  ip: string
  motivo: string | null
  /** username of the admin who put it in place */
  por: string | null
  createdAt: number
  /** null: for good */
  expiresAt: number | null
}

/** A new name or photo waiting for an admin to look at it. */
export interface Review {
  userId: string
  username: string
  tipo: 'foto' | 'nombre'
  valor: string
  createdAt: number
}

export interface ModerationFlag {
  level: 'high' | 'mid'
  kind: 'streak' | 'bot' | 'chain'
  userId: string | null
  username: string | null
  ip: string | null
  value: number
}
export interface IpCluster {
  ip: string
  since: number
  span: number
  users: { id: string; username: string }[]
}
export interface Moderation {
  flags: ModerationFlag[]
  clusters: IpCluster[]
  reviews: Review[]
}

export interface Economy {
  players: number
  chipsInPlay: number
  paid: number
  houseKept: number
  wagered: number
  coins: number
  histogram: { from: number; to: number | null; players: number }[]
  rounds: number
  dealerBlackjacks: number
  outcomes: Record<'blackjack' | 'win' | 'push' | 'lose' | 'bust' | 'surrender', number>
  rules: EconomyRules
  /** What starts next Monday, if an admin changed it. */
  nextRules: EconomyRules | null
  nextWeek: string
}

export interface EconomyRules {
  startBalance: number
  dailyPay: number
}

export function useEconomy() {
  const user = useUser()
  return useQuery({ queryKey: ['admin', user.id, 'economy'], queryFn: () => api<Economy>('/admin/economy') })
}

export interface AdminLeague {
  weekStart: string
  weekEndsAt: number
  now: number
  groups: {
    id: string
    nombre: string
    members: number
    hands: number
    leader: { userId: string; nombre: string | null; saldo: number } | null
  }[]
}

export function useAdminLeague() {
  const user = useUser()
  return useQuery({ queryKey: ['admin', user.id, 'league'], queryFn: () => api<AdminLeague>('/admin/league') })
}

export interface SystemInfo {
  uptime: number
  node: string
  database: number
  photos: number
  mediaBytes: number
  rows: { users: number; hands: number; sessions: number; groups: number; bans: number }
  admins: number
  metrics: {
    count: number
    errors: number
    routes: { route: string; count: number; errors: number; p50: number; p95: number }[]
    recent: { at: number; route: string; status: number; message: string }[]
  }
}

export type Flag = 'signups' | 'play' | 'invites'

export interface Announcement {
  text: string
  expiresAt: number | null
  createdAt: number
  by: string
}

/** GET /api/admin/settings */
export interface AdminSettings {
  flags: Record<Flag, boolean>
  announcement: Announcement | null
}

export interface Backup {
  name: string
  bytes: number
  createdAt: number
}

export interface LogEntry {
  id: number
  admin: string
  accion: string
  objetivo: string | null
  detalle: string | null
  createdAt: number
}

export function useAdminSettings() {
  const user = useUser()
  return useQuery({ queryKey: ['admin', user.id, 'settings'], queryFn: () => api<AdminSettings>('/admin/settings') })
}

export function useBackups() {
  const user = useUser()
  return useQuery({ queryKey: ['admin', user.id, 'backups'], queryFn: () => api<Backup[]>('/admin/backups') })
}

export function useAdminLog() {
  const user = useUser()
  return useQuery({ queryKey: ['admin', user.id, 'log'], queryFn: () => api<LogEntry[]>('/admin/log') })
}

export function useSystem() {
  const user = useUser()
  return useQuery({ queryKey: ['admin', user.id, 'system'], queryFn: () => api<SystemInfo>('/admin/system') })
}

export function useModeration() {
  const user = useUser()
  return useQuery({ queryKey: ['admin', user.id, 'moderation'], queryFn: () => api<Moderation>('/admin/moderation') })
}

export function useAdminStats() {
  const user = useUser()
  return useQuery({ queryKey: ['admin', user.id, 'stats'], queryFn: () => api<AdminStats>('/admin/stats') })
}

export function useAdminUsers(q: string) {
  const user = useUser()
  return useQuery({
    queryKey: ['admin', user.id, 'users', q],
    queryFn: () => api<{ total: number; users: AdminUser[] }>(`/admin/users?q=${encodeURIComponent(q)}`),
    placeholderData: (previous) => previous,
  })
}

export function useUserDetail(id: string | null) {
  const user = useUser()
  return useQuery({
    queryKey: ['admin', user.id, 'detail', id],
    queryFn: () => api<UserDetail>(`/admin/users/detail?id=${encodeURIComponent(id!)}`),
    enabled: id !== null,
  })
}

export function useBans() {
  const user = useUser()
  return useQuery({ queryKey: ['admin', user.id, 'bans'], queryFn: () => api<Ban[]>('/admin/bans') })
}

/** A change from the admin screen: refreshes everything on it afterwards. */
function useAdminAction<T>(path: string) {
  const user = useUser()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (body: T) => api<{ ok: true }>(path, { method: 'POST', body }),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['admin', user.id] }),
  })
}

export const useDeleteUser = () => useAdminAction<{ id: string }>('/admin/users/delete')
export const useBan = () =>
  useAdminAction<({ ip: string } | { userId: string }) & { motivo?: string; hours?: number | null }>('/admin/bans')
export const useUnban = () => useAdminAction<{ ip: string }>('/admin/bans/delete')
export const useDecideReview = () => useAdminAction<{ userId: string; tipo: Review['tipo']; ok: boolean }>('/admin/reviews')
export const useSetFlag = () => useAdminAction<{ flag: Flag; on: boolean }>('/admin/flags')
export const useSetRules = () => useAdminAction<EconomyRules>('/admin/rules')
export const useBackupNow = () => useAdminAction<Record<string, never>>('/admin/backups')

/** Publishing or taking down the notice also refreshes the one on top of the app. */
export function useSetAnnouncement() {
  const user = useUser()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (body: { text: string; hours?: number | null }) => api('/admin/announcement', { method: 'POST', body }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['admin', user.id] })
      void queryClient.invalidateQueries({ queryKey: ['announcement'] })
    },
  })
}

export interface AdminChallenges {
  today: {
    day: string
    custom: boolean
    challenges: { id: ChallengeId; tier: Tier; target: number; coins: number; completed: number }[]
  }
  tomorrow: { day: string; custom: boolean; ids: ChallengeId[] }
  catalogue: { id: ChallengeId; tier: Tier; target: number; coins: number }[]
}

export function useAdminChallenges() {
  const user = useUser()
  return useQuery({ queryKey: ['admin', user.id, 'challenges'], queryFn: () => api<AdminChallenges>('/admin/challenges') })
}

/** Picks tomorrow's challenges, easy to hard; null goes back to the ones the date gives. */
export function usePickChallenges() {
  const user = useUser()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (ids: ChallengeId[] | null) => api('/admin/challenges', { method: 'POST', body: { ids } }),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['admin', user.id] }),
  })
}
