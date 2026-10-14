'use client'

import Link from 'next/link'
import { useTranslation } from 'react-i18next'
import { useRouteGroup } from '@/groups/useRouteGroup'
import { ChevronLeftIcon } from '@/ui/icons'
import styles from '../../../pages.module.css'
import { InviteCard } from '../sections'

export default function InvitePage() {
  const { t } = useTranslation()
  const { id, group } = useRouteGroup()
  return (
    <div className={styles.page}>
      <div className={styles.titleRow}>
        <Link href={`/grupos/${id}`} className={styles.backButton} aria-label={t('common.back')}>
          <ChevronLeftIcon width={22} height={22} />
        </Link>
        <div className={styles.who}>
          <h1 className={styles.title}>{t('groupSettings.invite')}</h1>
          {group.data && <p className="muted">{group.data.nombre}</p>}
        </div>
      </div>
      {group.isError ? (
        <section className="card">
          <p className="muted">{t('common.error')}</p>
          <button className="btn btn-secondary" onClick={() => void group.refetch()}>
            {t('common.retry')}
          </button>
        </section>
      ) : group.data ? (
        <InviteCard group={group.data} />
      ) : (
        <p className="muted" aria-busy="true">
          …
        </p>
      )}
    </div>
  )
}
