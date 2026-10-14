'use client'

import { createContext, useContext } from 'react'
import type { AuthSession } from '@/lib/auth-client'

export interface SessionState {
  session: AuthSession | null
  /** True until the saved session has been restored (or ruled out). */
  loading: boolean
}

export const SessionContext = createContext<SessionState>({ session: null, loading: true })

export function useSession(): SessionState {
  return useContext(SessionContext)
}

/** The signed-in user. Only for screens behind the login. */
export function useUser(): AuthSession['user'] {
  const { session } = useSession()
  if (!session) throw new Error('useUser() necesita una sesión iniciada')
  return session.user
}
