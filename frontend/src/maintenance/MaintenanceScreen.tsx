'use client'

import { useTranslation } from 'react-i18next'
import { TimerIcon } from '@/ui/icons'
import type { Maintenance } from './useMaintenance'
import styles from './MaintenanceScreen.module.css'

/** What players see while the app is closed. It opens again by itself when the admins finish. */
export function MaintenanceScreen({ maintenance }: { maintenance: Maintenance }) {
  const { t } = useTranslation()
  return (
    <main className={styles.screen}>
      {/* eslint-disable-next-line @next/next/no-img-element -- tiny local SVG, no optimisation needed */}
      <img className={styles.logo} src="/icon.svg" alt="" width={72} height={72} />
      <h1>{t('maintenance.title')}</h1>
      <p className={styles.message}>{maintenance.message ?? t('maintenance.text')}</p>
      <p className={`muted ${styles.hint}`}>
        <TimerIcon width={16} height={16} />
        {t('maintenance.back')}
      </p>
    </main>
  )
}
