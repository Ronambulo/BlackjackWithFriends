'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useSyncExternalStore } from 'react'
import { useUser } from '@/auth/session-context'
import { api } from '@/lib/api'

export type GroupRole = 'admin' | 'miembro'

export interface RankedMember {
  userId: string
  nombre: string
  avatarUrl: string | null
  rol: GroupRole
  balance: number
  /** Chips won or lost today, pay included. */
  dayChange: number
  /** 1 is the leader; ties share the place. */
  rank: number
  /** Places gained today (negative if lost). */
  rankChange: number
}

/** One of the player's groups, as GET /api/groups lists them. */
export interface GroupSummary {
  id: string
  nombre: string
  rol: GroupRole
  members: number
  rank: number
  rankChange: number
  top: RankedMember[]
}

/** GET /api/group?id=: the whole live ranking. */
export interface Group {
  id: string
  nombre: string
  rol: GroupRole
  codigo: string
  ajustes: { ocultarRanking: boolean }
  ranking: RankedMember[]
}

/** GET /api/invite?codigo=: a group seen from its invite code. */
export interface Invite {
  id: string
  nombre: string
  members: number
  member: boolean
  top: { nombre: string; balance: number }[]
}

export const GROUP_NAME_MIN = 2
export const GROUP_NAME_MAX = 30
export const CODE_LENGTH = 10

/** Others' balances change as they play: the ranking refreshes every few seconds while it's on screen. */
const LIVE_MS = 10_000

export function useGroups() {
  const user = useUser()
  return useQuery({
    queryKey: ['groups', user.id],
    queryFn: () => api<GroupSummary[]>('/groups'),
    refetchInterval: LIVE_MS * 3,
  })
}

export function useGroup(id: string | undefined) {
  const user = useUser()
  return useQuery({
    queryKey: ['group', user.id, id],
    queryFn: () => api<Group>(`/group?id=${encodeURIComponent(id!)}`),
    enabled: Boolean(id),
    refetchInterval: LIVE_MS,
  })
}

export function useInvite(codigo: string) {
  const user = useUser()
  return useQuery({
    queryKey: ['invite', user.id, codigo],
    queryFn: () => api<Invite>(`/invite?codigo=${encodeURIComponent(codigo)}`),
    enabled: codigo.length === CODE_LENGTH,
    retry: false,
  })
}

// ── The group picked in the top bar ─────────────────────────────────────────
// Remembered on this device only: it's just which ranking to show.

const STORAGE_KEY = 'bwf.group'
const listeners = new Set<() => void>()

function readStored(): string | null {
  try {
    return localStorage.getItem(STORAGE_KEY)
  } catch {
    return null
  }
}

export function selectGroup(id: string) {
  try {
    localStorage.setItem(STORAGE_KEY, id)
  } catch {
    // Private mode: it just won't be remembered.
  }
  listeners.forEach((listener) => listener())
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

/** The group in view: the one picked last, or the first one. undefined while loading or without groups. */
export function useCurrentGroup(): GroupSummary | undefined {
  const { data: groups } = useGroups()
  const stored = useSyncExternalStore(subscribe, readStored, () => null)
  return groups?.find((group) => group.id === stored) ?? groups?.[0]
}

// ── Changes ─────────────────────────────────────────────────────────────────

function useRefreshGroups() {
  const user = useUser()
  const queryClient = useQueryClient()
  return (group?: Group) => {
    if (group) queryClient.setQueryData(['group', user.id, group.id], group)
    void queryClient.invalidateQueries({ queryKey: ['groups', user.id] })
    void queryClient.invalidateQueries({ queryKey: ['group', user.id] })
  }
}

export function useCreateGroup() {
  const refresh = useRefreshGroups()
  return useMutation({
    mutationFn: (nombre: string) => api<{ id: string }>('/groups', { method: 'POST', body: { nombre } }),
    onSuccess: ({ id }) => {
      selectGroup(id)
      refresh()
    },
  })
}

export function useJoinGroup() {
  const refresh = useRefreshGroups()
  return useMutation({
    mutationFn: (codigo: string) => api<{ id: string }>('/groups/join', { method: 'POST', body: { codigo } }),
    onSuccess: ({ id }) => {
      selectGroup(id)
      refresh()
    },
  })
}

export function useLeaveGroup() {
  const refresh = useRefreshGroups()
  return useMutation({
    mutationFn: (id: string) => api<{ ok: true }>('/group/leave', { method: 'POST', body: { id } }),
    onSuccess: () => refresh(),
  })
}

export type GroupPatch = { id: string; nombre?: string; ocultarRanking?: boolean }

export function useUpdateGroup() {
  const refresh = useRefreshGroups()
  return useMutation({
    mutationFn: (patch: GroupPatch) => api<Group>('/group', { method: 'PATCH', body: patch }),
    onSuccess: (group) => refresh(group),
  })
}

export function useRenewCode() {
  const refresh = useRefreshGroups()
  return useMutation({
    mutationFn: (id: string) => api<{ codigo: string }>('/group/renew', { method: 'POST', body: { id } }),
    onSuccess: () => refresh(),
  })
}

export function useKickMember() {
  const refresh = useRefreshGroups()
  return useMutation({
    mutationFn: ({ id, userId }: { id: string; userId: string }) =>
      api<{ ok: true }>('/group/kick', { method: 'POST', body: { id, userId } }),
    onSuccess: () => refresh(),
  })
}
