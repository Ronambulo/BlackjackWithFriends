'use client'

import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useUser } from '@/auth/session-context'
import { api } from '@/lib/api'
import { inAudience, pushOn, type Audience } from '@/push/device'

/** GET /api/notices: up now and not closed by the player. */
export interface Notice {
  id: number
  texto: string
  audiencia: Audience
  startsAt: number
  /** Shown as a dialog when the app opens (ImportantGate), not as the strip. */
  importante: boolean
}

/** The notices up now that are meant for this device, newest first, and how to close one. */
export function useNotices() {
  const user = useUser()
  const queryClient = useQueryClient()
  const key = ['notices', user.id]
  const { data } = useQuery({
    queryKey: key,
    queryFn: () => api<Notice[]>('/notices'),
    staleTime: 5 * 60_000,
  })
  // Notices for people with (or without) notifications need to know; until then they wait.
  const [push, setPush] = useState<boolean | null>(null)
  useEffect(() => {
    void pushOn().then(setPush)
  }, [])
  const notices = (data ?? []).filter((item) => {
    if (item.audiencia === 'push' || item.audiencia === 'noPush') return push !== null && inAudience(item.audiencia, push)
    return inAudience(item.audiencia, false)
  })

  // Seen once per visit, so the admins know how many it reached.
  const reported = useRef(new Set<number>())
  const report = useCallback((notice: Notice) => {
    if (reported.current.has(notice.id)) return
    reported.current.add(notice.id)
    void api('/notices/seen', { method: 'POST', body: { id: notice.id } }).catch(() => {})
  }, [])

  const close = (notice: Notice) => {
    queryClient.setQueryData<Notice[]>(key, (list) => list?.filter((item) => item.id !== notice.id))
    void api('/notices/seen', { method: 'POST', body: { id: notice.id, closed: true } }).catch(() => {})
  }

  return { notices, report, close }
}
