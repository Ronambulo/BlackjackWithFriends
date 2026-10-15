'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { currentLanguage } from '@/i18n'
import { CloseIcon } from '@/ui/icons'
import { lastSeen, markSeen, RELEASES } from './entries'
import styles from './WhatsNewBar.module.css'

/** A nudge on top of the content when there's a version this device hasn't seen yet. */
export function WhatsNewBar() {
  const { t } = useTranslation()
  // Read after mounting: localStorage isn't there on the server.
  const [show, setShow] = useState(false)
  useEffect(() => {
    setShow(lastSeen() !== RELEASES[0].id)
  }, [])

  if (!show) return null

  const close = () => {
    markSeen()
    setShow(false)
  }

  return (
    <div className={styles.bar} role="status">
      <Link href="/novedades" className={styles.link} onClick={close}>
        <span className={styles.dot} aria-hidden="true" />
        <span>
          <b>{t('whatsNew.bar')}</b> {RELEASES[0].items[currentLanguage()][0]}
        </span>
      </Link>
      <button type="button" onClick={close} aria-label={t('install.close')}>
        <CloseIcon width={18} height={18} />
      </button>
    </div>
  )
}
