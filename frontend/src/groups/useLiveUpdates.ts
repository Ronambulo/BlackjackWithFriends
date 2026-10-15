'use client'

import { useQueryClient } from '@tanstack/react-query'
import { useEffect } from 'react'
import { useUser } from '@/auth/session-context'

/**
 * Listens to the API's live events (GET /api/events) and refetches only what changed:
 * when someone in your groups plays, joins, leaves or renames something, the rankings
 * and the group menu update in place. When the week closes, everything does.
 * The page itself never reloads.
 */
export function useLiveUpdates() {
  const user = useUser()
  const queryClient = useQueryClient()

  useEffect(() => {
    let source: EventSource | null = null
    let opened = false

    const refreshGroups = () => {
      void queryClient.invalidateQueries({ queryKey: ['groups', user.id] })
      void queryClient.invalidateQueries({ queryKey: ['group', user.id] })
    }

    const refreshAll = () => void queryClient.invalidateQueries()

    const connect = () => {
      if (source) return
      source = new EventSource('/api/events')
      source.addEventListener('groups', refreshGroups)
      source.addEventListener('week', refreshAll)
      // Back after a drop: whatever happened meanwhile was missed.
      source.addEventListener('open', () => {
        if (opened) refreshGroups()
        opened = true
      })
    }

    const disconnect = () => {
      source?.close()
      source = null
    }

    // A hidden app (phone locked, another tab) doesn't keep a connection open.
    const onVisibility = () => {
      // On the way back, 'open' refetches what changed meanwhile.
      if (document.visibilityState === 'hidden') disconnect()
      else connect()
    }

    connect()
    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      document.removeEventListener('visibilitychange', onVisibility)
      disconnect()
    }
  }, [queryClient, user.id])
}
