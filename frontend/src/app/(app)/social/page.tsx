'use client'

import Link from 'next/link'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useUser } from '@/auth/session-context'
import { Ranking } from '@/groups/Ranking'
import { useCurrentGroup } from '@/groups/useGroups'
import { useGlobalRanking } from '@/groups/useRankings'
import { currentLanguage } from '@/i18n'
import { formatNumber } from '@/lib/format'
import { Chat } from '@/social/Chat'
import chatStyles from '@/social/Chat.module.css'
import { GLOBAL, useUnread } from '@/social/useChat'
import { GroupIcon } from '@/ui/icons'
import { PullToRefresh } from '@/ui/PullToRefresh'
import styles from '../pages.module.css'

type View = 'global' | 'group' | 'ranking'

/** The global chat, the chat of the group in view (the top bar's picker) and everyone's week. */
export default function SocialPage() {
  const { t } = useTranslation()
  const group = useCurrentGroup()
  const { data: unread } = useUnread()
  const [view, setView] = useState<View>('global')

  const tabs: { key: View; label: string; count?: number }[] = [
    { key: 'global', label: t('social.globalChat'), count: unread?.[GLOBAL] },
    { key: 'group', label: group?.nombre ?? t('social.groupChat'), count: group && unread?.[group.id] },
    { key: 'ranking', label: t('social.ranking') },
  ]

  return (
    <div className={`${styles.page} ${chatStyles.screen}`}>
      <h1 className={styles.title}>{t('social.title')}</h1>

      <div className={chatStyles.tabsBar}>
        <div className={`segmented ${chatStyles.tabs}`} role="group" aria-label={t('social.title')}>
          {tabs.map(({ key, label, count }) => (
            <button key={key} type="button" aria-pressed={view === key} onClick={() => setView(key)}>
              <span className={chatStyles.tabName}>{label}</span>
              {/* The one on screen gets read as it comes in. */}
              {view !== key && Boolean(count) && (
                <span className={chatStyles.badge}>{count! > 99 ? '99+' : count}</span>
              )}
            </button>
          ))}
        </div>
      </div>

      {view === 'global' && <Chat key={GLOBAL} chatId={GLOBAL} name={t('social.globalChat')} />}
      {view === 'group' &&
        (group ? (
          <Chat key={group.id} chatId={group.id} name={group.nombre} />
        ) : (
          <section className={`card ${chatStyles.empty}`}>
            <GroupIcon width={28} height={28} />
            <p className="muted">{t('social.noGroup')}</p>
            <Link className="btn btn-primary" href="/grupos">
              {t('social.toGroups')}
            </Link>
          </section>
        ))}
      {view === 'ranking' && <GlobalRanking />}
    </div>
  )
}

function GlobalRanking() {
  const { t } = useTranslation()
  const me = useUser()
  const { data, isError, refetch } = useGlobalRanking()
  const inList = data?.members.some((member) => member.userId === me.id)

  if (isError) {
    return (
      <section className="card">
        <p className="muted">{t('common.error')}</p>
        <button className="btn btn-secondary" onClick={() => void refetch()}>
          {t('common.retry')}
        </button>
      </section>
    )
  }
  return (
    <PullToRefresh>
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
    </PullToRefresh>
  )
}
