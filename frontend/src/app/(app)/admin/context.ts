'use client'

import { createContext, useContext } from 'react'
import type { Role } from '@/admin/useAdmin'

export const TABS = [
  'stats',
  'inbox',
  'calendar',
  'users',
  'moderation',
  'league',
  'notices',
  'polls',
  'economy',
  'shop',
  'events',
  'automations',
  'team',
  'log',
  'system',
] as const
export type Tab = (typeof TABS)[number]

/** A player to open in the players' tab. */
export interface Focus {
  id: string
  username: string
}

/** What any tab may do with the panel around it. */
export const AdminContext = createContext<{
  go: (tab: Tab) => void
  openUser: (who: Focus) => void
  openPalette: () => void
  role: Role | null
}>({ go: () => {}, openUser: () => {}, openPalette: () => {}, role: null })

export const useAdminPanel = () => useContext(AdminContext)
