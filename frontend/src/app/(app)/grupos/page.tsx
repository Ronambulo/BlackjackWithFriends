'use client'

import Link from 'next/link'
import { useTranslation } from 'react-i18next'
import { useUser } from '@/auth/session-context'
import { RankChange } from '@/groups/RankChange'
import { useGroups, type GroupSummary } from '@/groups/useGroups'
import { currentLanguage } from '@/i18n'
import { useCountdown } from '@/league/useCountdown'
import { useLeague } from '@/league/useLeague'
import { formatNumber } from '@/lib/format'
import { Avatar } from '@/ui/Avatar'
import { avatarColor, initials } from '@/ui/avatarColor'
import { EmptyState } from '@/ui/EmptyState'
import { ChevronRightIcon, CrownIcon, GroupIcon, PlusIcon, TimerIcon } from '@/ui/icons'
import { PullToRefresh } from '@/ui/PullToRefresh'
import pages from '../pages.module.css'
import styles from './Groups.module.css'

function GroupCard({ group }: { group: GroupSummary }) {
  const { t } = useTranslation()
  const me = useUser()
  const leader = group.top[0]
  return (
    <Link href={`/grupos/${group.id}`} className={styles.card}>
      <div className={styles.head}>
        <span className={styles.tile} style={{ background: avatarColor(group.id) }} aria-hidden="true">
          {initials(group.nombre)}
        </span>
        <span className={styles.name}>
          <span className={styles.title}>{group.nombre}</span>
          <span className="muted">
            {t('groupSettings.memberCount', { count: group.members })}
            {group.rol === 'admin' && ` · ${t('groupSettings.admin')}`}
          </span>
        </span>
        <span className={styles.place}>
          <span className={styles.rank}>
            {group.rank === 1 && <CrownIcon width={14} height={12} />}
            {group.rank}º
          </span>
          <span className={styles.of}>
            {t('groups.of', { total: group.members })}
            <RankChange change={group.rankChange} />
          </span>
        </span>
      </div>
      {leader && (
        <div className={styles.foot}>
          <span className={styles.stack} aria-hidden="true">
            {group.top.slice(0, 3).map((member) => (
              <Avatar key={member.userId} seed={member.userId} name={member.nombre} size={26} className={styles.stacked} />
            ))}
          </span>
          <span className={styles.leader}>
            {leader.userId === me.id ? t('groups.youLead') : t('groups.leads', { name: leader.nombre })}
            <b>{formatNumber(leader.balance, currentLanguage())}</b>
          </span>
          <ChevronRightIcon className={styles.chevron} width={18} height={18} />
        </div>
      )}
    </Link>
  )
}

export default function GroupsPage() {
  const { t } = useTranslation()
  const { data: groups, isError, refetch } = useGroups()
  const { data: league } = useLeague()
  const countdown = useCountdown(league?.weekEndsAt)

  const actions = (
    <div className={pages.actions}>
      <Link className="btn btn-primary" href="/grupos/nuevo">
        <PlusIcon width={18} height={18} />
        {t('home.createGroup')}
      </Link>
      <Link className="btn btn-secondary" href="/grupos/unirse">
        {t('groups.joinShort')}
      </Link>
    </div>
  )

  if (groups?.length === 0) {
    return (
      <PullToRefresh>
        <div className={pages.page}>
          <EmptyState icon={<GroupIcon />} title={t('groups.title')} text={t('groups.empty')} />
          {actions}
        </div>
      </PullToRefresh>
    )
  }

  return (
    <PullToRefresh fill>
      <div className={pages.page}>
        <div className={pages.headerRow}>
          <h1 className={pages.heading}>{t('groups.title')}</h1>
          <span className={pages.live}>{t('ranking.live')}</span>
        </div>

        {isError ? (
          <section className="card">
            <p className="muted">{t('common.error')}</p>
            <button className="btn btn-secondary" onClick={() => void refetch()}>
              {t('common.retry')}
            </button>
          </section>
        ) : groups ? (
          <div className={styles.list}>
            {groups.map((group) => (
              <GroupCard key={group.id} group={group} />
            ))}
          </div>
        ) : (
          <p className="muted" aria-busy="true">
            …
          </p>
        )}

        {/* At the bottom of the screen; a long list scrolls under it. */}
        {groups && (
          <div className={styles.footer}>
            {actions}
            {countdown && (
              <div className={pages.notice}>
                <TimerIcon width={20} height={20} />
                <p>{t('league.closesIn', { time: countdown })}.</p>
              </div>
            )}
          </div>
        )}
      </div>
    </PullToRefresh>
  )
}
