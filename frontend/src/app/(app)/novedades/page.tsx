'use client'

import Link from 'next/link'
import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { markSeen, RELEASES } from '@/changelog/entries'
import { currentLanguage } from '@/i18n'
import { ChevronLeftIcon } from '@/ui/icons'
import styles from '../pages.module.css'

/** What changed in each version of the app, newest first. */
export default function WhatsNewPage() {
  const { t } = useTranslation()
  const language = currentLanguage()
  useEffect(() => markSeen(), [])
  const dayFormat = new Intl.DateTimeFormat(language, { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' })

  return (
    <div className={styles.page}>
      <div className={styles.titleRow}>
        <Link href="/ajustes" className={styles.backButton} aria-label={t('common.back')}>
          <ChevronLeftIcon width={22} height={22} />
        </Link>
        <h1 className={styles.title}>{t('whatsNew.title')}</h1>
      </div>

      {RELEASES.map((release, i) => (
        <section key={release.id} className={styles.group}>
          <h2 className="label">
            {dayFormat.format(new Date(`${release.date}T12:00:00Z`))}
            {i === 0 && ` · ${t('whatsNew.latest')}`}
          </h2>
          <ul className={`${styles.list} ${styles.releaseList}`}>
            {release.items[language].map((item) => (
              <li key={item} className={styles.listRow}>
                <span className={styles.releaseDot} aria-hidden="true" />
                <span className={styles.listText}>{item}</span>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  )
}
