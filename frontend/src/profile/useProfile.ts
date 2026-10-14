'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useUser } from '@/auth/session-context'
import type { Language } from '@/i18n'
import { api } from '@/lib/api'

/** The player's profile, as GET /api/profile returns it. */
export interface Profile {
  id: string
  /** null until the player picks one right after signing up. */
  nombre: string | null
  avatar_url: string | null
  idioma: Language
  monedas: number
}

/** What the app itself may change; coins and styles are server-only. */
export type ProfilePatch = Partial<Pick<Profile, 'nombre' | 'avatar_url' | 'idioma'>>

export const NAME_MIN = 2
export const NAME_MAX = 20

export function isValidName(name: string): boolean {
  const length = name.trim().length
  return length >= NAME_MIN && length <= NAME_MAX
}

export function useProfile() {
  const user = useUser()
  return useQuery({
    queryKey: ['profile', user.id],
    queryFn: () => api<Profile>('/profile'),
  })
}

export function useUpdateProfile() {
  const user = useUser()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (patch: ProfilePatch) => api<Profile>('/profile', { method: 'PATCH', body: patch }),
    onSuccess: (profile) => queryClient.setQueryData(['profile', user.id], profile),
  })
}
