'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useUser } from '@/auth/session-context'
import type { ChallengeId, Tier } from '@/challenges/useChallenges'
import type { CosmeticKind } from '@/cosmetics/themes'
import type { EventId, Source, StyleId } from '@/cosmetics/useCosmetics'
import { api } from '@/lib/api'
import type { Audience } from '@/push/device'

export type Role = 'dueno' | 'moderador' | 'soporte'

function useMe() {
  const user = useUser()
  return useQuery({
    queryKey: ['me', user.id],
    queryFn: () => api<{ id: string; admin: boolean; role: Role | null }>('/me'),
    staleTime: Infinity,
  })
}

/** GET /api/me: whether the player runs the app (undefined until known). */
export function useIsAdmin(): boolean | undefined {
  return useMe().data?.admin
}

/** What the admin may do: owner, moderator or support (null: not on the team). */
export function useRole(): Role | null | undefined {
  return useMe().data?.role
}

const RANK: Record<Role, number> = { soporte: 0, moderador: 1, dueno: 2 }

/** Whether the role reaches at least `min`. */
export function can(role: Role | null | undefined, min: Role) {
  return role ? RANK[role] >= RANK[min] : false
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
  /** Days each period covers (1, 7, 28 or 90). */
  span: number
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
  lastHand: number | null
  etiquetas: string[]
  silenced: boolean
}

export type Segment = 'new' | 'risk' | 'broke' | 'whales'

export interface AdminUsers {
  total: number
  segments: Record<Segment, number>
  tags: { tag: string; n: number }[]
  users: AdminUser[]
}

export interface HistoryEvent {
  kind: 'signup' | 'purchase' | 'achievement' | 'group' | 'admin'
  at: number
  text?: string | null
  value?: number | null
  by?: string | null
  detail?: string | null
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
  /** Chips or coins an admin added or took away by hand, newest first. */
  adjustments: Adjustment[]
  marks: { etiquetas: string[]; hermanas: { id: string; username: string }[]; silenciadoHasta: number | null }
  notes: { id: number; admin: string; texto: string; createdAt: number }[]
  history: HistoryEvent[]
  /** Chips won or lost each day for two weeks. */
  chart: { day: string; net: number; hands: number }[]
  /** Their last chat messages. */
  messages: { texto: string; at: number; global: boolean }[]
}

export type AdjustmentKind = 'saldo' | 'monedas'

export interface Adjustment {
  id: number
  tipo: AdjustmentKind
  cantidad: number
  motivo: string
  por: string
  createdAt: number
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

/** A style in the shop's order: how it's had today, what the admins changed, and how it sells. */
export type AdminShopItem = {
  id: StyleId
  tipo: CosmeticKind
  retirado: boolean
  /** The event whose box it comes out of; never sold in the shop then. */
  evento: EventId | null
  /** The price in the code, for shop styles. */
  serie: number | null
  /** The price an admin set instead. */
  propio: number | null
  oferta: number | null
  bought: number
  coins: number
  wearing: number
} & Source

/** GET /api/admin/shop */
export interface AdminShop {
  /** A percentage off everything sold. */
  rebaja: number
  /** Every event: when its box goes, whether it's on Home now and whether it's over. */
  eventos: { id: EventId; hasta: string; abierta: boolean; acabado: boolean }[]
  items: AdminShopItem[]
}

export function useAdminShop() {
  const user = useUser()
  return useQuery({ queryKey: ['admin', user.id, 'shop'], queryFn: () => api<AdminShop>('/admin/shop') })
}

/** A player who has bought styles: each one, what it cost and whether they wear it, newest first. */
export interface ShopBuyer {
  id: string
  username: string
  nombre: string | null
  avatarUrl: string | null
  /** Coins they have now. */
  monedas: number
  spent: number
  items: { id: StyleId; tipo: CosmeticKind; monedas: number; at: number; wearing: boolean }[]
}

/** GET /api/admin/shop/buyers */
export function useShopBuyers() {
  const user = useUser()
  return useQuery({ queryKey: ['admin', user.id, 'shop', 'buyers'], queryFn: () => api<ShopBuyer[]>('/admin/shop/buyers') })
}

/** The shop changes for the admin too, who may be looking at it as a player. */
function useShopAction<T>(path: string) {
  const user = useUser()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (body: T) => api<{ ok: true }>(path, { method: 'POST', body }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['admin', user.id] })
      void queryClient.invalidateQueries({ queryKey: ['cosmetics', user.id] })
    },
  })
}

/** null puts a price back as it is in the code. */
export const useSetShopItem = () =>
  useShopAction<{ id: string; precio: number | null; oferta: number | null; retirado: boolean }>('/admin/shop/item')
export const useSetShopOrder = () => useShopAction<{ tipo: CosmeticKind; ids: string[] }>('/admin/shop/order')
export const useSetShopSale = () => useShopAction<{ rebaja: number }>('/admin/shop/sale')

/** GET /api/admin/event-boxes: every event's box as set, and what has come out of each. */
export interface AdminEventBox {
  id: EventId
  activa: boolean
  /** What the first box costs. */
  precio: number
  /** How much dearer it gets every two styles a player takes out. */
  subida: number
  cada: number
  hasta: string
  fuera: StyleId[]
  /** On the home screen right now: on and before its date. */
  abierta: boolean
  cajas: number
  monedas: number
  jugadores: number
  /** Players who have everything left in the box. */
  completos: number
  items: { id: StyleId; tipo: CosmeticKind; fuera: boolean; salidos: number }[]
}

export function useAdminEventBoxes() {
  const user = useUser()
  return useQuery({ queryKey: ['admin', user.id, 'event-boxes'], queryFn: () => api<AdminEventBox[]>('/admin/event-boxes') })
}

export const useSetEventBox = () =>
  useShopAction<{ evento: EventId } & Partial<Pick<AdminEventBox, 'activa' | 'precio' | 'subida' | 'cada' | 'hasta' | 'fuera'>>>('/admin/event-boxes')

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
  /** Counting from the week the first hand was played in, as 1. */
  weekNumber: number
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

/** GET /api/admin/settings */
export interface AdminSettings {
  flags: Record<Flag, boolean>
  maintenance: Maintenance | null
}

export interface Maintenance {
  message: string | null
  since: number
  /** username of the admin who turned it on */
  by: string
}

/** Something a player says went wrong (POST /api/reports). */
export interface BugReport {
  id: number
  userId: string
  username: string
  texto: string
  /** The screen they were on. */
  ruta: string | null
  /** Their browser, as it introduces itself. */
  dispositivo: string | null
  resuelto: boolean
  createdAt: number
}

export function useReports() {
  const user = useUser()
  return useQuery({ queryKey: ['admin', user.id, 'reports'], queryFn: () => api<BugReport[]>('/admin/reports') })
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
  undoable: boolean
  deshecho: boolean
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

export function useAdminStats(days = 7) {
  const user = useUser()
  return useQuery({
    queryKey: ['admin', user.id, 'stats', days],
    queryFn: () => api<AdminStats>(`/admin/stats?days=${days}`),
    placeholderData: (previous) => previous,
  })
}

export function useAdminUsers(q: string, segment: Segment | null = null, tag: string | null = null) {
  const user = useUser()
  return useQuery({
    queryKey: ['admin', user.id, 'users', q, segment, tag],
    queryFn: () => {
      const params = new URLSearchParams({ q })
      if (segment) params.set('segment', segment)
      if (tag) params.set('tag', tag)
      return api<AdminUsers>(`/admin/users?${params}`)
    },
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
export function useAdminAction<T>(path: string) {
  const user = useUser()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (body: T) => api<{ ok: true }>(path, { method: 'POST', body }),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['admin', user.id] }),
  })
}

export const useDeleteUser = () => useAdminAction<{ id: string }>('/admin/users/delete')
export const useRenameUser = () => useAdminAction<{ id: string; nombre?: string; username?: string }>('/admin/users/rename')
export const useBan = () =>
  useAdminAction<({ ip: string } | { userId: string }) & { motivo?: string; hours?: number | null }>('/admin/bans')
export const useUnban = () => useAdminAction<{ ip: string }>('/admin/bans/delete')
export const useDecideReview = () => useAdminAction<{ userId: string; tipo: Review['tipo']; ok: boolean }>('/admin/reviews')
export const useSetFlag = () => useAdminAction<{ flag: Flag; on: boolean }>('/admin/flags')
export const useSetRules = () => useAdminAction<EconomyRules>('/admin/rules')
export const useBackupNow = () => useAdminAction<Record<string, never>>('/admin/backups')
export const useAdjustUser = () =>
  useAdminAction<{ id: string; tipo: AdjustmentKind; cantidad: number; motivo: string }>('/admin/users/adjust')
/** Coins for every player at once, or taken from all of them (nobody goes below zero). */
export function useAdjustAll() {
  const user = useUser()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (body: { cantidad: number; motivo: string }) =>
      api<{ ok: true; players: number; total: number }>('/admin/users/adjust-all', { method: 'POST', body }),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['admin', user.id] }),
  })
}
export const useResolveReport = () => useAdminAction<{ id: number; ok: boolean }>('/admin/reports/resolve')
export const useDeleteReport = () => useAdminAction<{ id: number }>('/admin/reports/delete')

/** Maintenance also changes what this app shows. */
export function useSetMaintenance() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (body: { on: boolean; message?: string }) => api('/admin/maintenance', { method: 'POST', body }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['admin'] })
      void queryClient.invalidateQueries({ queryKey: ['status'] })
    },
  })
}

/** Puts a backup back as the database: everything the app knows may be different afterwards. */
export function useRestoreBackup() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (name: string) => api<{ ok: true; before: string }>('/admin/backups/restore', { method: 'POST', body: { name } }),
    onSuccess: () => void queryClient.invalidateQueries(),
  })
}

/** Notices also change the bar on top of the app. */
function useNoticeAction<T>(path: string) {
  const user = useUser()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (body: T) => api<{ ok: true }>(path, { method: 'POST', body }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['admin', user.id] })
      void queryClient.invalidateQueries({ queryKey: ['notices'] })
      void queryClient.invalidateQueries({ queryKey: ['polls'] })
    },
  })
}

export interface AdminNotice {
  id: number
  texto: string
  audiencia: Audience
  startsAt: number
  expiresAt: number | null
  /** A dialog when the app opens instead of the strip. */
  importante: boolean
  por: string
  /** Players who had it on screen, and who of them closed it. */
  seen: number
  closed: number
}

export interface Campaign {
  id: number
  titulo: string
  cuerpo: string
  url: string
  audiencia: Audience
  sendAt: number
  sentAt: number | null
  devices: number | null
  failed: number | null
  por: string
}

/** GET /api/admin/notices (routes/notices.ts). */
export interface AdminNotices {
  now: number
  notices: AdminNotice[]
  campaigns: Campaign[]
  audiences: {
    users: number
    /** Players who opened the app in the last 30 days. */
    seen: number
    byPlatform: Record<'ios' | 'android' | 'desktop', number>
    pwa: number
    browserOnly: number
    pushUsers: number
    pushDevices: number
    /** Devices a campaign to each audience would reach now. */
    reach: Record<Audience, number>
  }
}

export function useAdminNotices() {
  const user = useUser()
  return useQuery({ queryKey: ['admin', user.id, 'notices'], queryFn: () => api<AdminNotices>('/admin/notices') })
}

export const usePostNotice = () =>
  useNoticeAction<{ texto: string; audiencia: Audience; startsAt?: number; hours?: number | null; importante: boolean }>('/admin/notices')
export const useEndNotice = () => useNoticeAction<{ id: number }>('/admin/notices/end')
export const usePostCampaign = () =>
  useAdminAction<{ titulo: string; cuerpo: string; url?: string; audiencia: Audience; sendAt?: number }>('/admin/campaigns')
export const useDeleteCampaign = () => useAdminAction<{ id: number }>('/admin/campaigns/delete')

export interface AdminPoll {
  id: number
  pregunta: string
  opciones: string[]
  endsAt: number | null
  createdAt: number
  por: string
  votes: number[]
  total: number
}

/** GET /api/admin/polls (routes/notices.ts). */
export interface AdminPolls {
  now: number
  /** Players seen in the last 30 days: who could have answered. */
  players: number
  polls: AdminPoll[]
}

export function useAdminPolls() {
  const user = useUser()
  return useQuery({ queryKey: ['admin', user.id, 'polls'], queryFn: () => api<AdminPolls>('/admin/polls') })
}

export const usePostPoll = () =>
  useNoticeAction<{ pregunta: string; opciones: string[]; hours?: number | null; push?: boolean; pushTitle?: string }>(
    '/admin/polls',
  )
export const useClosePoll = () => useNoticeAction<{ id: number }>('/admin/polls/close')
export const useDeletePoll = () => useNoticeAction<{ id: number }>('/admin/polls/delete')

export interface AdminChallenges {
  today: {
    day: string
    custom: boolean
    challenges: { id: ChallengeId; tier: Tier; target: number; coins: number; completed: number }[]
  }
  tomorrow: { day: string; custom: boolean; ids: ChallengeId[] }
  catalogue: { id: ChallengeId; tier: Tier; family: string; target: number; coins: number }[]
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
