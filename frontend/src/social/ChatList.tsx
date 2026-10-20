'use client'

import Link from 'next/link'
import { useTranslation } from 'react-i18next'
import { useUser } from '@/auth/session-context'
import type { GroupSummary } from '@/groups/useGroups'
import { currentLanguage } from '@/i18n'
import { avatarColor, initials } from '@/ui/avatarColor'
import { ChevronLeftIcon, GlobeIcon, GroupIcon } from '@/ui/icons'
import { GLOBAL, useLatest, useUnread, type ChatLatest } from './useChat'
import styles from './Chat.module.css'

/** A chat in the list: the global one or a group's. */
export interface ChatEntry {
  id: string
  nombre: string
  /** A group's; none for the global chat. */
  members?: number
}

/** The group's tile, the same as in the list of groups; the world for the global chat. */
export function ChatTile({ chat, size = 46 }: { chat: ChatEntry; size?: number }) {
  const global = chat.id === GLOBAL
  return (
    <span
      className={styles.groupTile}
      data-global={global}
      style={{ background: global ? undefined : avatarColor(chat.id), width: size, height: size }}
      aria-hidden="true"
    >
      {global ? <GlobeIcon width={size * 0.5} height={size * 0.5} /> : initials(chat.nombre)}
    </span>
  )
}

/** Today: the time; this week: the weekday. */
function when(at: string) {
  const date = new Date(at)
  const today = new Date().toDateString() === date.toDateString()
  return date.toLocaleString(currentLanguage(), today ? { hour: '2-digit', minute: '2-digit' } : { weekday: 'short' })
}

/** Every chat like a messaging app's list: the global one pinned on top, then the groups, the one written in last first. */
export function ChatList({ chats, onOpen }: { chats: ChatEntry[]; onOpen: (id: string) => void }) {
  const { t } = useTranslation()
  const me = useUser()
  const { data: latest } = useLatest()
  const { data: unread } = useUnread()

  const preview = (message: ChatLatest) => {
    const who = message.userId === me.id ? t('social.you') : message.nombre
    const what = message.texto ?? t(message.mano ? 'social.handQuote' : 'social.statsQuote')
    return `${who}: ${what}`
  }
  const lastAt = (id: string) => (latest?.[id] ? new Date(latest[id].createdAt).getTime() : 0)
  const sorted = [...chats].sort((a, b) => Number(b.id === GLOBAL) - Number(a.id === GLOBAL) || lastAt(b.id) - lastAt(a.id))
  const noGroups = !chats.some((chat) => chat.id !== GLOBAL)

  return (
    <>
      <ul className={`card ${styles.chatList}`} aria-busy={!latest}>
        {sorted.map((chat) => {
          const message = latest?.[chat.id]
          const count = unread?.[chat.id] ?? 0
          return (
            <li key={chat.id}>
              <button type="button" className={styles.chatRow} data-unread={count > 0} onClick={() => onOpen(chat.id)}>
                <ChatTile chat={chat} />
                <span className={styles.chatRowText}>
                  <span className={styles.chatRowName}>{chat.nombre}</span>
                  <span className={styles.chatRowPreview}>
                    {message ? preview(message) : latest ? t('social.noMessages') : ' '}
                  </span>
                </span>
                <span className={styles.chatRowSide}>
                  {message && <time dateTime={message.createdAt}>{when(message.createdAt)}</time>}
                  {count > 0 && (
                    <span className={styles.badge} aria-label={t('social.unread', { count })}>
                      {count > 99 ? '99+' : count}
                    </span>
                  )}
                </span>
              </button>
            </li>
          )
        })}
      </ul>
      {noGroups && (
        <section className={`card ${styles.empty}`}>
          <GroupIcon width={28} height={28} />
          <p className="muted">{t('social.noGroup')}</p>
          <Link className="btn btn-primary" href="/grupos">
            {t('social.toGroups')}
          </Link>
        </section>
      )}
    </>
  )
}

/** Above an open chat: back to the list, and whose chat it is. */
export function ChatHeader({ chat, onBack }: { chat: ChatEntry; onBack: () => void }) {
  const { t } = useTranslation()
  return (
    <div className={styles.chatHeader}>
      <button type="button" className={styles.chatBack} aria-label={t('common.back')} onClick={onBack}>
        <ChevronLeftIcon width={20} height={20} />
      </button>
      <ChatTile chat={chat} size={36} />
      <span className={styles.chatRowText}>
        <span className={styles.chatRowName}>{chat.nombre}</span>
        <span className={styles.chatRowPreview}>
          {chat.members === undefined ? t('social.everyone') : t('groupSettings.memberCount', { count: chat.members })}
        </span>
      </span>
    </div>
  )
}

/** For the list: the global chat and every group's. */
export function chatsOf(groups: GroupSummary[], globalName: string): ChatEntry[] {
  return [{ id: GLOBAL, nombre: globalName }, ...groups.map(({ id, nombre, members }) => ({ id, nombre, members }))]
}
