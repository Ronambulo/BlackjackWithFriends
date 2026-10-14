'use client'

import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'

/** "2 d 14 h" until the given moment, kept up to date while on screen. */
export function useCountdown(until: string | undefined): string | null {
  const { t } = useTranslation()
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 30_000)
    return () => window.clearInterval(timer)
  }, [])
  if (!until) return null
  const minutes = Math.max(0, Math.ceil((new Date(until).getTime() - now) / 60_000))
  const d = Math.floor(minutes / 1440)
  const h = Math.floor((minutes % 1440) / 60)
  const m = minutes % 60
  if (d > 0) return t('league.daysHours', { d, h })
  if (h > 0) return t('league.hoursMinutes', { h, m })
  return t('league.minutes', { m })
}
