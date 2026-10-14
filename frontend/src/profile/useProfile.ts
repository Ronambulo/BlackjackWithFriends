'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useUser } from '@/auth/session-context'
import type { Language } from '@/i18n'
import { supabase } from '@/lib/supabase'

/** A row of public.profiles (supabase/migrations). */
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

const COLUMNS = 'id, nombre, avatar_url, idioma, monedas'

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
    queryFn: async () => {
      const { data, error } = await supabase().from('profiles').select(COLUMNS).eq('id', user.id).single()
      if (error) throw error
      return data as Profile
    },
  })
}

export function useUpdateProfile() {
  const user = useUser()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (patch: ProfilePatch) => {
      const { data, error } = await supabase()
        .from('profiles')
        .update(patch)
        .eq('id', user.id)
        .select(COLUMNS)
        .single()
      if (error) throw error
      return data as Profile
    },
    onSuccess: (profile) => queryClient.setQueryData(['profile', user.id], profile),
  })
}
