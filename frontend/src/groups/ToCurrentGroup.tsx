'use client'

import { useRouter } from 'next/navigation'
import { useEffect } from 'react'
import { useCurrentGroup, useGroups } from './useGroups'

/** Old addresses (/ranking, /grupo): to the group in view, or the list without one. */
export function ToCurrentGroup() {
  const router = useRouter()
  const { data: groups } = useGroups()
  const current = useCurrentGroup()

  useEffect(() => {
    if (groups) router.replace(current ? `/grupos/${current.id}` : '/grupos')
  }, [current, groups, router])

  return null
}
