'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { joinPath, rememberInvite } from '@/groups/pendingInvite'
import { Splash } from '@/ui/Splash'
import styles from './InviteLanding.module.css'

/** Sends a person on to the join screen, remembering the invite in case they have to sign up first. */
export function InviteLanding({ codigo, valid }: { codigo: string; valid: boolean }) {
  const { t } = useTranslation()
  const router = useRouter()

  useEffect(() => {
    if (!valid) return
    rememberInvite(codigo)
    router.replace(joinPath(codigo))
  }, [codigo, valid, router])

  if (valid) return <Splash />
  return (
    <main className={styles.expired}>
      {/* eslint-disable-next-line @next/next/no-img-element -- tiny local SVG, no optimisation needed */}
      <img src="/icon.svg" alt="" width={72} height={72} />
      <p>{t('groups.expired')}</p>
      <Link className="btn btn-primary" href="/">
        {t('groups.openApp')}
      </Link>
    </main>
  )
}
