'use client'

import Link from 'next/link'
import { useTranslation } from 'react-i18next'
import { useUser } from '@/auth/session-context'
import { TopList } from '@/groups/Ranking'
import { useCurrentGroup, useGroups } from '@/groups/useGroups'
import { LeagueCard } from '@/league/LeagueCard'
import { useProfile } from '@/profile/useProfile'
import { ShareIcon } from '@/ui/icons'
import { PullToRefresh } from '@/ui/PullToRefresh'
import styles from './pages.module.css'

export default function HomePage() {
  const { t } = useTranslation()
  const me = useUser()
  const { data: profile } = useProfile()
  const { data: groups, isError, refetch } = useGroups()
  const group = useCurrentGroup()
  const mine = group?.top.find((member) => member.userId === me.id)

  return (
    <PullToRefresh>
      <div className={`${styles.page} ${styles.tight}`}>
        <h1 className={styles.heading}>{t('home.greeting', { name: profile?.nombre ?? '' })}</h1>

        <LeagueCard group={group} dayChange={mine?.dayChange} />

        {isError ? (
          <section className="card">
            <p className="muted">{t('common.error')}</p>
            <button className="btn btn-secondary" onClick={() => void refetch()}>
              {t('common.retry')}
            </button>
          </section>
        ) : groups && groups.length === 0 ? (
          <section className="card">
            <h2 className="card-title">{t('home.noGroupTitle')}</h2>
            <p className="muted">{t('home.noGroupText')}</p>
            <div className={styles.actions}>
              <Link className="btn btn-primary" href="/grupos/nuevo">
                {t('home.createGroup')}
              </Link>
              <Link className="btn btn-secondary" href="/grupos/unirse">
                {t('home.joinGroup')}
              </Link>
            </div>
          </section>
        ) : group ? (
          <section className={`card ${styles.section}`}>
            <div className={styles.headerRow}>
              <h2 className="card-title">{t('home.top')}</h2>
              <span className={styles.live}>{t('ranking.live')}</span>
            </div>
            <TopList members={group.top} />
            <div className={`${styles.actions} ${styles.cardActions}`}>
              <Link className="btn btn-secondary" href={`/grupos/${group.id}`}>
                {t('home.seeRanking')}
              </Link>
              <Link className="btn btn-outline" href={`/grupos/${group.id}/invitar`}>
                <ShareIcon width={16} height={16} />
                {t('home.invite')}
              </Link>
            </div>
          </section>
        ) : null}

        <p className={`muted ${styles.rules}`}>{t('league.rules')}</p>
      </div>
    </PullToRefresh>
  )
}
