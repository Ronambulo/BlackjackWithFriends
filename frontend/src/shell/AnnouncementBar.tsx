'use client'

import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { CloseIcon, MegaphoneIcon } from '@/ui/icons'
import { useNotices } from './useNotices'
import styles from './AnnouncementBar.module.css'

/** The newest notice from the admins meant for this device, on top of the content until it's closed. */
export function AnnouncementBar() {
  const { t } = useTranslation()
  const { notices, report, close: closeNotice } = useNotices()
  const notice = notices.find((item) => !item.importante)

  useEffect(() => {
    if (notice) report(notice)
  }, [notice, report])

  if (!notice) return null

  const close = () => closeNotice(notice)

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
