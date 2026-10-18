'use client'

import { useQueryClient } from '@tanstack/react-query'
import Link from 'next/link'
import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { useUser } from '@/auth/session-context'
import type { DailyState } from '@/daily/useDaily'
import { useDaily } from '@/daily/useDaily'
import { currentLanguage } from '@/i18n'
import { api } from '@/lib/api'
import { formatNumber } from '@/lib/format'
import { useCeremony } from '@/season/useSeason'
import { signed } from '@/table/Table'
import { Modal } from '@/ui/Modal'
import { MegaphoneIcon } from '@/ui/icons'
import { useNotices, type Notice } from './useNotices'
import styles from './ImportantGate.module.css'

/**
 * What can't wait for the player to look: yesterday's daily deck prize, then the notices the
 * admins marked important. One dialog at a time, never at the table nor over the week's ceremony.
 */
export function ImportantGate({ paused }: { paused: boolean }) {
  const { data: ceremony, isError } = useCeremony()
  const { data: daily } = useDaily()
  const { notices, report, close } = useNotices()
  const notice = notices.find((item) => item.importante)
  // Until the ceremony query answers, it might be the one to show first.
  const waiting = paused || (ceremony !== null && !isError)

  const prize = daily?.yesterday?.prize && !daily.yesterday.seen ? daily : null
  const showNotice = !waiting && !prize && notice

  useEffect(() => {
    if (showNotice) report(showNotice)
  }, [showNotice, report])

  if (waiting) return null
  if (prize) return <DailyPrize daily={prize} />
  if (notice) return <ImportantNotice notice={notice} onClose={() => close(notice)} />
  return null
}

function DailyPrize({ daily }: { daily: DailyState }) {
  const { t } = useTranslation()
  const lang = currentLanguage()
  const user = useUser()
  const queryClient = useQueryClient()
  const yesterday = daily.yesterday!
  const amount = formatNumber(yesterday.prize ?? 0, lang)

  const close = () => {
    queryClient.setQueryData<DailyState>(['daily', user.id], (state) =>
      state?.yesterday ? { ...state, yesterday: { ...state.yesterday, seen: true } } : state,
    )
    void api('/daily/seen', { method: 'POST' }).catch(() => {})
  }

  return (
    <Modal title={t('important.prizeTitle', { number: yesterday.number })} eyebrow={t('important.eyebrow')} onClose={close}>
      <div className={styles.body}>
        <p className={styles.amount}>
          <span className={styles.coin} aria-hidden="true" />+{amount}
        </p>
        <p className="muted">{t('important.prizeText', { net: signed(yesterday.net, lang), amount })}</p>
        <div className={styles.actions}>
          <Link href="/estilos" className="btn btn-primary" onClick={close}>
            {t('important.prizeShop')}
          </Link>
          <button className="btn btn-secondary" type="button" onClick={close}>
            {t('important.ok')}
          </button>
        </div>
      </div>
    </Modal>
  )
}

function ImportantNotice({ notice, onClose }: { notice: Notice; onClose: () => void }) {
  const { t } = useTranslation()
  return (
    <Modal title={t('important.notice')} eyebrow={t('important.eyebrow')} onClose={onClose}>
      <div className={styles.body}>
        <span className={styles.icon} aria-hidden="true">
          <MegaphoneIcon width={26} height={26} />
        </span>
        <p className={styles.text}>{notice.texto}</p>
        <div className={styles.actions}>
          <button className="btn btn-primary" type="button" onClick={onClose}>
            {t('important.ok')}
          </button>
        </div>
      </div>
    </Modal>
  )
}
