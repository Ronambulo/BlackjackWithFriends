'use client'

import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useUser } from '@/auth/session-context'
import { Ranking } from '@/groups/Ranking'
import { useGroups } from '@/groups/useGroups'
import { useGlobalRanking } from '@/groups/useRankings'
import { currentLanguage } from '@/i18n'
import { formatNumber } from '@/lib/format'
import { Chat } from '@/social/Chat'
import { ChatHeader, ChatList, chatsOf } from '@/social/ChatList'
import chatStyles from '@/social/Chat.module.css'
import { useUnread } from '@/social/useChat'
import { PullToRefresh } from '@/ui/PullToRefresh'
import styles from '../pages.module.css'

type View = 'chats' | 'ranking'

/**
 * The chats, the global one and each group's, listed like a messaging app; and everyone's week.
 */
export default function SocialPage() {
  const { t } = useTranslation()
  const { data: groups } = useGroups()
  const { data: unread } = useUnread()
  const [view, setView] = useState<View>('chats')
  const [open, setOpen] = useState<string | null>(null)

  // From a group's page (/social?chat=id): straight into that chat.
  useEffect(() => {
    const chat = new URLSearchParams(window.location.search).get('chat')
    if (!chat) return
    setOpen(chat)
    window.history.replaceState(null, '', window.location.pathname)
  }, [])

  const chats = groups ? chatsOf(groups, t('social.globalChat')) : []
  const opened = chats.find((chat) => chat.id === open)
  const total = chats.reduce((sum, chat) => sum + (unread?.[chat.id] ?? 0), 0)

  const tabs: { key: View; label: string; count?: number }[] = [
    // The open chat gets read as it comes in; the list shows each one's.
    { key: 'chats', label: t('social.chats'), count: view !== 'chats' ? total : opened ? total - (unread?.[opened.id] ?? 0) : 0 },
    { key: 'ranking', label: t('social.ranking') },
  ]
  const pick = (key: View) => {
    // Again on the chats' tab: back to the list.
    if (key === 'chats' && view === 'chats') setOpen(null)
    setView(key)
  }

  return (
    <div className={`${styles.page} ${chatStyles.screen}`}>
      <h1 className={styles.title}>{t('social.title')}</h1>

      <div className={chatStyles.tabsBar}>
        <div className={`segmented ${chatStyles.tabs}`} role="group" aria-label={t('social.title')}>
          {tabs.map(({ key, label, count }) => (
            <button key={key} type="button" aria-pressed={view === key} onClick={() => pick(key)}>
              <span className={chatStyles.tabName}>{label}</span>
              {Boolean(count) && <span className={chatStyles.badge}>{count! > 99 ? '99+' : count}</span>}
            </button>
          ))}
        </div>
      </div>

      {view === 'chats' &&
        groups &&
        (opened ? (
          <>
            <ChatHeader chat={opened} onBack={() => setOpen(null)} />
            <Chat key={opened.id} chatId={opened.id} name={opened.nombre} />
          </>
        ) : (
          <ChatList chats={chats} onOpen={setOpen} />
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
