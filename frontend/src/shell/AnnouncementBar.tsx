'use client'

import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { Announcement } from '@/admin/useAdmin'
import { api } from '@/lib/api'
import { CloseIcon, MegaphoneIcon } from '@/ui/icons'
import styles from './AnnouncementBar.module.css'

// The notice a player closed, by when it was posted: a new one shows again.
const SEEN = 'announcement.closed'

function readClosed() {
  try {
    return Number(localStorage.getItem(SEEN)) || 0
  } catch {
    return 0
  }
}

/** The notice the admins post for everyone, on top of the content until it's closed. */
export function AnnouncementBar() {
  const { t } = useTranslation()
  const { data } = useQuery({
    queryKey: ['announcement'],
    queryFn: () => api<Announcement | null>('/announcement'),
    staleTime: 5 * 60_000,
  })
  const [closed, setClosed] = useState(readClosed)

  if (!data || data.createdAt === closed) return null

  const close = () => {
    setClosed(data.createdAt)
    try {
      localStorage.setItem(SEEN, String(data.createdAt))
    } catch {
      // Private mode: it shows again next time.
    }
  }

  return (
    <div className={styles.bar} role="status">
      <MegaphoneIcon width={20} height={20} />
      <p>{data.text}</p>
      <button type="button" onClick={close} aria-label={t('install.close')}>
        <CloseIcon width={18} height={18} />
      </button>
    </div>
  )
}
