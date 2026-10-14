'use client'

import { type ReactNode } from 'react'
import { authClient } from '@/lib/auth-client'
import { SessionContext } from './session-context'

export function SessionProvider({ children }: { children: ReactNode }) {
  // Re-renders on sign in and sign out, and refetches when the app comes back to the foreground.
  const { data, isPending } = authClient.useSession()
  return <SessionContext value={{ session: data ?? null, loading: isPending }}>{children}</SessionContext>
}
