'use client'

import Link from 'next/link'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useUser } from '@/auth/session-context'
import { ChallengesCard } from '@/challenges/ChallengesCard'
import { TopList } from '@/groups/Ranking'
import { useCurrentGroup, useGroups } from '@/groups/useGroups'
import { useFriendsRanking } from '@/groups/useRankings'
import { LeagueCard } from '@/league/LeagueCard'
import { PollCard } from '@/polls/PollCard'
import { useProfile } from '@/profile/useProfile'
import { ShareIcon } from '@/ui/icons'
import { PullToRefresh } from '@/ui/PullToRefresh'
import styles from './pages.module.css'

// Places shown before "see all"; the player's own row is added if they're further down.
const PREVIEW = 5

export default function HomePage() {
  const { t } = useTranslation()
  const me = useUser()
  const { data: profile } = useProfile()
  const { data: groups, isError, refetch } = useGroups()
  const group = useCurrentGroup()
  const mine = group?.top.find((member) => member.userId === me.id)
  // Everyone from all the player's groups: the first few, or the whole list.
  const { data: friends } = useFriendsRanking()
  const [expanded, setExpanded] = useState(false)
  const preview = (friends ?? []).filter((member, i) => i < PREVIEW || (!expanded && member.userId === me.id))
  const shown = expanded ? (friends ?? []) : preview

  return (
    <PullToRefresh>
      <div className={`${styles.page} ${styles.tight}`}>
        <h1 className={styles.heading}>{t('home.greeting', { name: profile?.nombre ?? '' })}</h1>

        <LeagueCard group={group} dayChange={mine?.dayChange} />

        <PollCard />

        <ChallengesCard />

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
            <TopList members={shown} />
            {friends && friends.length > PREVIEW && (
              <button className={styles.more} type="button" aria-expanded={expanded} onClick={() => setExpanded((value) => !value)}>
                {expanded ? t('home.seeLess') : t('home.seeAll', { count: friends.length })}
              </button>
            )}
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
