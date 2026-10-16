'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useUser } from '@/auth/session-context'
import type { AchievementId } from '@/achievements/useAchievements'
import type { es } from '@/i18n/es'
import { api } from '@/lib/api'
import type { Profile } from '@/profile/useProfile'
import type { CosmeticKind, Equipped } from './themes'

/** How a style is had: everyone's, an achievement's, for winning weeks, or bought (antes: the price before a sale). */
export type Source =
  | { from: 'gratis' }
  | { from: 'logro'; logro: AchievementId }
  | { from: 'trofeo'; trofeos: number }
  | { from: 'tienda'; precio: number; antes?: number }

type Names = typeof es.styles.items

/** A style's id, as 'tapete.verde': its kind and its name. */
export type StyleId = { [K in keyof Names]: `${K}.${keyof Names[K] & string}` }[keyof Names]

export type CosmeticItem = { id: StyleId; tipo: CosmeticKind; owned: boolean } & Source

/** GET /api/cosmetics: the catalogue in the shop's order, what the player has and wears. */
export interface Cosmetics {
  monedas: number
  equipped: Equipped
  items: CosmeticItem[]
}

export function useCosmetics() {
  const user = useUser()
  return useQuery({
    queryKey: ['cosmetics', user.id],
    queryFn: () => api<Cosmetics>('/cosmetics'),
  })
}

/** Equipping or buying: the shop and the profile (coins, the look) change at once. */
function useCosmeticChange<T extends { id: string }>(path: string) {
  const user = useUser()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (body: T) => api<Cosmetics>(path, { method: 'POST', body }),
    onSuccess: (cosmetics) => {
      queryClient.setQueryData(['cosmetics', user.id], cosmetics)
      queryClient.setQueryData<Profile>(['profile', user.id], (profile) =>
        profile && { ...profile, monedas: cosmetics.monedas, estilos: cosmetics.equipped },
      )
      // The frame shows next to the player's name in the rankings and the chat.
      void queryClient.invalidateQueries({ queryKey: ['groups', user.id] })
      void queryClient.invalidateQueries({ queryKey: ['group', user.id] })
      void queryClient.invalidateQueries({ queryKey: ['chat', user.id] })
    },
    // A price changed or a style left the shop meanwhile: show the shop as it is now.
    onError: () => void queryClient.invalidateQueries({ queryKey: ['cosmetics', user.id] }),
  })
}

export const useEquip = () => useCosmeticChange<{ id: string }>('/cosmetics/equip')
/** precio is the price the player saw: if it changed, nothing is charged. */
export const useBuy = () => useCosmeticChange<{ id: string; precio: number }>('/cosmetics/buy')
