'use client'

import type { Session, User } from '@supabase/supabase-js'
import { createContext, useContext } from 'react'

export interface SessionState {
  session: Session | null
  /** True until Supabase has restored (or ruled out) a saved session. */
  loading: boolean
}

export const SessionContext = createContext<SessionState>({ session: null, loading: true })

export function useSession(): SessionState {
  return useContext(SessionContext)
}

/** The signed-in user. Only for screens behind the login. */
export function useUser(): User {
  const { session } = useSession()
  if (!session) throw new Error('useUser() necesita una sesión iniciada')
  return session.user
}
