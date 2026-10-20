'use client'

import Link from 'next/link'
import { useParams } from 'next/navigation'
import { useTranslation } from 'react-i18next'
import { useCosmetics } from '@/cosmetics/useCosmetics'
import { EventBoxPage } from '@/events/EventBox'
import { isEventId } from '@/events/themes'
import { ChevronLeftIcon } from '@/ui/icons'
import styles from '../../estilos/styles.module.css'

/** An event's box on its own page, reached from its banner on the home screen. */
export default function EventPage() {
  const { t } = useTranslation()
  const { id } = useParams<{ id: string }>()
  const { isPending, isError, refetch } = useCosmetics()

  return (
    <div className={styles.page}>
      <div className={styles.titleRow}>
        <Link href="/" className={styles.backButton} aria-label={t('common.back')}>
          <ChevronLeftIcon width={22} height={22} />
        </Link>
        <h1 className={styles.title}>{isEventId(id) ? t(`eventNames.${id}`) : t('eventBox.missing')}</h1>
      </div>

      {!isEventId(id) ? null : isPending ? (
        <section className="card" aria-busy="true" />
      ) : isError ? (
        <section className="card">
          <p>{t('common.error')}</p>
          <button className="btn btn-secondary" type="button" onClick={() => void refetch()}>
            {t('common.retry')}
          </button>
        </section>
      ) : (
        <EventBoxPage id={id} />
      )}
    </div>
  )
}
