'use client'

import type { PublicRoundView } from '@bwf/engine'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useUser } from '@/auth/session-context'
import type { Challenge } from '@/challenges/useChallenges'
import type { CosmeticKind } from '@/cosmetics/themes'
import { api } from '@/lib/api'
import { useAdminAction, type Role, type Segment } from './useAdmin'

// The panel's tools beyond the numbers (routes/admin-tools.ts): the inbox, the live
// tables, the player's marks and notes, scheduled events, price tests, the team,
// the automations, the calendar and undoing from the log.

export type InboxLevel = 'high' | 'mid' | 'low'

export interface InboxItem {
  key: string
  level: InboxLevel
  kind: 'flag' | 'report' | 'review' | 'shared' | 'poll' | 'campaign' | 'auto'
  at: number
  userId?: string | null
  username?: string | null
  ip?: string | null
  users?: { id: string; username: string }[]
  /** flag: its kind; report: the text; poll: question → winner; auto: the action */
  text?: string | null
  value?: number | null
  id?: number
}

export function useInbox() {
  const user = useUser()
  return useQuery({ queryKey: ['admin', user.id, 'inbox'], queryFn: () => api<InboxItem[]>('/admin/inbox'), refetchInterval: 60_000 })
}

export interface LiveTable {
  id: string
  userId: string
  username: string
  nombre: string | null
  avatarUrl: string | null
  bet: number
  startedAt: number
  updatedAt: number
  view: PublicRoundView
}

export interface Live {
  now: number
  peak: number
  peakAt: number | null
  tables: LiveTable[]
}

/** The hands being played now; every few seconds while someone watches. */
export function useLive(fast = false) {
  const user = useUser()
  return useQuery({
    queryKey: ['admin', user.id, 'live'],
    queryFn: () => api<Live>('/admin/live'),
    refetchInterval: fast ? 2_000 : 15_000,
  })
}

export interface FeedItem {
  kind: 'signup' | 'blackjack' | 'bigWin' | 'purchase' | 'achievement' | 'daily' | 'admin'
  at: number
  userId: string | null
  username: string | null
  text?: string | null
  value?: number | null
}

export function useFeed() {
  const user = useUser()
  return useQuery({ queryKey: ['admin', user.id, 'feed'], queryFn: () => api<FeedItem[]>('/admin/feed'), refetchInterval: 30_000 })
}

export type EventKind = 'doble_paga' | 'rebajas' | 'precios' | 'tematico'

export interface AdminEvent {
  id: number
  tipo: EventKind
  titulo: string
  inicio: number
  fin: number | null
  valor: number | null
  detalle: string | null
  por: string
}

export function useEvents() {
  const user = useUser()
  return useQuery({ queryKey: ['admin', user.id, 'events'], queryFn: () => api<AdminEvent[]>('/admin/events') })
}

export interface TestHalf {
  players: number
  buyers: number
  coins: number
}

export interface PriceTest {
  id: number
  estilo: string
  precioA: number | null
  precioB: number
  inicio: number
  fin: number | null
  por: string
  a: TestHalf
  b: TestHalf
}

export function useTests() {
  const user = useUser()
  return useQuery({ queryKey: ['admin', user.id, 'tests'], queryFn: () => api<PriceTest[]>('/admin/tests') })
}

export interface Team {
  me: Role
  owners: string[]
  staff: { username: string; role: Role }[]
}

export function useTeam() {
  const user = useUser()
  return useQuery({ queryKey: ['admin', user.id, 'team'], queryFn: () => api<Team>('/admin/team') })
}

export type AutomationId = 'spamSilence' | 'brokeGift' | 'inactivePush' | 'sharedIpWatch'

export interface Automations {
  rules: { id: AutomationId; on: boolean; runs: number; last: number | null }[]
  weeklyReport: { on: boolean }
}

export function useAutomations() {
  const user = useUser()
  return useQuery({ queryKey: ['admin', user.id, 'automations'], queryFn: () => api<Automations>('/admin/automations') })
}

export interface CalendarItem {
  kind: string
  at: number
  end?: number | null
  title: string
  id?: number
}

export function useCalendar(from: number, to: number) {
  const user = useUser()
  return useQuery({
    queryKey: ['admin', user.id, 'calendar', from, to],
    queryFn: () => api<CalendarItem[]>(`/admin/calendar?from=${from}&to=${to}`),
    placeholderData: (previous) => previous,
  })
}

export interface CoinFlow {
  flow: {
    week: string
    in: { challenges: number; daily: number; achievements: number; season: number; admin: number }
    out: { shop: number }
  }[]
  active: number
  coinsPerActiveDay: number
  averagePrice: number
  broke: number
  nextWeek: string
  nextWeekAt: number
}

export function useCoinFlow() {
  const user = useUser()
  return useQuery({ queryKey: ['admin', user.id, 'flow'], queryFn: () => api<CoinFlow>('/admin/economy/flow') })
}

export interface SavedSegment {
  id: string
  name: string
  segment?: Segment | null
  tag?: string | null
  q?: string | null
}

export function useSegments() {
  const user = useUser()
  return useQuery({ queryKey: ['admin', user.id, 'segments'], queryFn: () => api<SavedSegment[]>('/admin/segments') })
}

export interface PlayerView {
  username: string
  nombre: string | null
  avatarUrl: string | null
  monedas: number
  saldo: number
  estilos: Partial<Record<CosmeticKind, string>>
  payPending: boolean
  groups: { id: string; nombre: string; members: number }[]
  challenges: Challenge[]
  shop: { owned: number; total: number }
  achievements: { unlocked: number; total: number }
  daily: { fichas: number; done: boolean } | null
}

export function usePlayerView(id: string | null) {
  const user = useUser()
  return useQuery({
    queryKey: ['admin', user.id, 'view', id],
    queryFn: () => api<PlayerView>(`/admin/users/view?id=${encodeURIComponent(id!)}`),
    enabled: id !== null,
  })
}

export const useDismissInbox = () => useAdminAction<{ key: string }>('/admin/inbox/dismiss')
export const useSetMarks = () =>
  useAdminAction<{ userId: string; etiquetas?: string[]; addTags?: string[]; silenceHours?: number; siblings?: { ids: string[]; linked: boolean } }>('/admin/marks')
export const usePostNote = () => useAdminAction<{ userId: string; texto: string }>('/admin/notes')
export const useDeleteNote = () => useAdminAction<{ id: number }>('/admin/notes/delete')
export const useCloseSessions = () => useAdminAction<{ userId: string }>('/admin/users/sessions')
export const useRemoveAvatar = () => useAdminAction<{ userId: string }>('/admin/users/avatar')
export const usePostEvent = () =>
  useAdminAction<{ tipo: EventKind; titulo: string; inicio: number; fin?: number | null; valor?: number | null; detalle?: string | null }>(
    '/admin/events',
  )
export const useDeleteEvent = () => useAdminAction<{ id: number }>('/admin/events/delete')
export const usePostTest = () => useAdminAction<{ estilo: string; precioB: number }>('/admin/tests')
export const useEndTest = () => useAdminAction<{ id: number }>('/admin/tests/end')
export const useSetTeam = () => useAdminAction<{ username: string; role: Role | null }>('/admin/team')
export const useSetAutomation = () => useAdminAction<{ id: AutomationId | 'weeklyReport'; on: boolean }>('/admin/automations')
export const usePostSegment = () =>
  useAdminAction<{ name: string; segment?: Segment | null; tag?: string | null; q?: string | null } | { id: string; delete: true }>(
    '/admin/segments',
  )

/** Undoing can touch anything, the shop and the player's own screens included. */
export function useUndo() {
  const user = useUser()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: number) => api<{ ok: true }>('/admin/log/undo', { method: 'POST', body: { id } }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['admin', user.id] })
      void queryClient.invalidateQueries({ queryKey: ['cosmetics', user.id] })
    },
  })
}

export const usePushUser = () => useAdminAction<{ userId: string; titulo: string; cuerpo: string }>('/admin/users/push')
