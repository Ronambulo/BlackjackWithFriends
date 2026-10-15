'use client'

import { useTranslation } from 'react-i18next'
import { useUser } from '@/auth/session-context'
import { Ranking } from '@/groups/Ranking'
import { useGlobalRanking } from '@/groups/useRankings'
import { currentLanguage } from '@/i18n'
import { formatNumber } from '@/lib/format'
import { ChatIcon } from '@/ui/icons'
import { PullToRefresh } from '@/ui/PullToRefresh'
import styles from '../pages.module.css'

/** Everyone's week, worldwide; the chat comes later. */
export default function SocialPage() {
  const { t } = useTranslation()
  const me = useUser()
  const { data, isError, refetch } = useGlobalRanking()
  const inList = data?.members.some((member) => member.userId === me.id)

  return (
    <PullToRefresh>
      <div className={styles.page}>
        <h1 className={styles.title}>{t('social.title')}</h1>

        {isError ? (
          <section className="card">
            <p className="muted">{t('common.error')}</p>
            <button className="btn btn-secondary" onClick={() => void refetch()}>
              {t('common.retry')}
            </button>
          </section>
        ) : (
          <section className={`card ${styles.section}`} aria-busy={!data}>
            <div className={styles.headerRow}>
              <h2 className="card-title">{t('social.global')}</h2>
              <span className={styles.live}>{t('ranking.live')}</span>
            </div>
            {data && (
              <>
                <p className="muted">{t('social.players', { count: data.players, formatted: formatNumber(data.players, currentLanguage()) })}</p>
                <Ranking members={data.members} />
                {!inList && data.me && (
                  <>
                    <p className={`muted ${styles.gap}`} aria-hidden="true">
                      ⋯
                    </p>
                    <Ranking members={[data.me]} />
                  </>
                )}
              </>
            )}
          </section>
        )}

        <section className={`card ${styles.chatSoon}`}>
          <ChatIcon width={22} height={22} />
          <p className="muted">{t('social.chatSoon')}</p>
        </section>
      </div>
    </PullToRefresh>
  )
}
