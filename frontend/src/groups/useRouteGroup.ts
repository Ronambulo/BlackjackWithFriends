'use client'

import { useParams, useRouter } from 'next/navigation'
import { useEffect } from 'react'
import { selectGroup, useGroup, useGroups } from './useGroups'

/** The group in the URL (/grupos/[id]); it becomes the last one opened, which sharing starts from. */
export function useRouteGroup() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const groups = useGroups()
  const group = useGroup(id)
  const member = groups.data?.some((summary) => summary.id === id)

  useEffect(() => {
    if (member) selectGroup(id)
    // Not (or no longer) in it: back to the list.
    else if (groups.data) router.replace('/grupos')
  }, [groups.data, id, member, router])

  return { id, groups, group }
}
