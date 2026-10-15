'use client'

import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect } from 'react'
import { api, UNAVAILABLE } from '@/lib/api'

export interface Maintenance {
  message: string | null
  since: number
}

/**
 * GET /api/status: whether the admins have closed the app for a moment. Checked again
 * when any request gets a 503 and, while it's closed, every half minute until it's back.
 */
export function useMaintenance() {
  const queryClient = useQueryClient()
  useEffect(() => {
    const check = () => void queryClient.invalidateQueries({ queryKey: ['status'] })
    window.addEventListener(UNAVAILABLE, check)
    return () => window.removeEventListener(UNAVAILABLE, check)
  }, [queryClient])
  const query = useQuery({
    queryKey: ['status'],
    queryFn: () => api<{ maintenance: Maintenance | null }>('/status'),
    refetchInterval: (q) => (q.state.data?.maintenance ? 30_000 : false),
  })
  return query.data?.maintenance ?? null
}
