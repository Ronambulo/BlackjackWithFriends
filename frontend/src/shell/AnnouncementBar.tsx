'use client'

import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useUser } from '@/auth/session-context'
import { api } from '@/lib/api'
import { inAudience, pushOn, type Audience } from '@/push/device'
import { CloseIcon, MegaphoneIcon } from '@/ui/icons'
import styles from './AnnouncementBar.module.css'

/** GET /api/notices: up now and not closed by the player. */
interface Notice {
  id: number
  texto: string
  audiencia: Audience
  startsAt: number
}

/** The newest notice from the admins meant for this device, on top of the content until it's closed. */
export function AnnouncementBar() {
  const { t } = useTranslation()
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
  const notice = data?.find((item) => {
    if (item.audiencia === 'push' || item.audiencia === 'noPush') return push !== null && inAudience(item.audiencia, push)
    return inAudience(item.audiencia, false)
  })

  // Seen once per visit, so the admins know how many it reached.
  const reported = useRef(new Set<number>())
  useEffect(() => {
    if (!notice || reported.current.has(notice.id)) return
    reported.current.add(notice.id)
    void api('/notices/seen', { method: 'POST', body: { id: notice.id } }).catch(() => {})
  }, [notice])

  if (!notice) return null

  const close = () => {
    queryClient.setQueryData<Notice[]>(key, (list) => list?.filter((item) => item.id !== notice.id))
    void api('/notices/seen', { method: 'POST', body: { id: notice.id, closed: true } }).catch(() => {})
  }

  return (
    <div className={styles.bar} role="status">
      <MegaphoneIcon width={20} height={20} />
      <p>{notice.texto}</p>
      <button type="button" onClick={close} aria-label={t('install.close')}>
        <CloseIcon width={18} height={18} />
      </button>
    </div>
  )
}
