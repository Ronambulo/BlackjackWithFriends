'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useUser } from '@/auth/session-context'
import type { Language } from '@/i18n'
import { api } from '@/lib/api'
import type { Crop } from './PhotoCropper'

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

/** Cuts the chosen square out of the photo and shrinks it, so photos stay small. */
async function squarePhoto(file: File, crop: Crop, size = 256): Promise<Blob> {
  const bitmap = await createImageBitmap(file)
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  canvas.getContext('2d')!.drawImage(bitmap, crop.x, crop.y, crop.side, crop.side, 0, 0, size, size)
  bitmap.close()
  const encode = (type: string) => new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, type, 0.85))
  // Safari can't write webp and hands back a png instead; jpeg is smaller then.
  const webp = await encode('image/webp')
  const blob = webp?.type === 'image/webp' ? webp : await encode('image/jpeg')
  if (!blob) throw new Error('No se pudo leer la imagen')
  return blob
}

/** Uploads a new profile photo (POST /api/profile/avatar) or, with null, removes it. */
export function useAvatar() {
  const user = useUser()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (photo: { file: File; crop: Crop } | null) =>
      photo
        ? api<Profile>('/profile/avatar', { method: 'POST', body: await squarePhoto(photo.file, photo.crop) })
        : api<Profile>('/profile', { method: 'PATCH', body: { avatar_url: null } }),
    onSuccess: (profile) => {
      queryClient.setQueryData(['profile', user.id], profile)
      // The rankings carry everyone's photo.
      void queryClient.invalidateQueries({ queryKey: ['groups'] })
      void queryClient.invalidateQueries({ queryKey: ['group'] })
      void queryClient.invalidateQueries({ queryKey: ['league'] })
    },
  })
}
