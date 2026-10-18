'use client'

import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ago } from '@/admin/format'
import { can, useBan, useResolveReport, type ModerationFlag } from '@/admin/useAdmin'
import { useDismissInbox, useInbox, useSetMarks, useUndo, type InboxItem, type InboxLevel } from '@/admin/useAdminTools'
import { ConfirmSheet } from '@/ui/ConfirmSheet'
import { CheckIcon } from '@/ui/icons'
import styles from './admin.module.css'
import { useAdminPanel } from './context'
import { flagTitle } from './ModerationTab'
import ui from './tools.module.css'

const LEVELS: (InboxLevel | 'all')[] = ['all', 'high', 'mid', 'low']

/** Everything waiting for an admin in one list: what the checks found, reports, reviews, results. */
export function InboxTab() {
  const { t } = useTranslation()
  const { data, isLoading } = useInbox()
  const [level, setLevel] = useState<InboxLevel | 'all'>('all')
  const items = (data ?? []).filter((item) => level === 'all' || item.level === level)
  const count = (l: InboxLevel | 'all') => (data ?? []).filter((item) => l === 'all' || item.level === l).length

  return (
    <section className={`card ${styles.block}`}>
      <div className={styles.sectionHead}>
        <div className={styles.chips} role="group" aria-label={t('panel.inbox.filter')}>
          {LEVELS.map((l) => (
            <button key={l} type="button" aria-pressed={level === l} onClick={() => setLevel(l)}>
              {t(`panel.inbox.level.${l}`)} · {count(l)}
            </button>
          ))}
        </div>
        <span className={styles.dim}>{t('panel.inbox.hint')}</span>
      </div>
      {isLoading ? (
        <p className={styles.dim}>{t('common.loading')}</p>
      ) : items.length === 0 ? (
        <div className={ui.allClear}>
          <CheckIcon width={28} height={28} />
          <b>{t('panel.inbox.clear')}</b>
          <span className={styles.dim}>{t('panel.inbox.clearText')}</span>
        </div>
      ) : (
        <ul className={ui.inbox}>
          {items.map((item) => (
            <InboxRow key={item.key} item={item} />
          ))}
        </ul>
      )}
    </section>
  )
}

/** One thing to look at, with what can be done about it right there. */
export function InboxRow({ item, compact = false }: { item: InboxItem; compact?: boolean }) {
  const { t } = useTranslation()
  const { go, openUser, role } = useAdminPanel()
  const dismiss = useDismissInbox()
  const marks = useSetMarks()
  const resolve = useResolveReport()
  const undo = useUndo()
  const ban = useBan()
  const [banning, setBanning] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const busy = dismiss.isPending || marks.isPending || resolve.isPending || undo.isPending || ban.isPending
  const run = (promise: Promise<unknown>) => {
    setError(null)
    promise.catch((err: Error) => setError(err.message || t('common.error')))
  }
  const who = item.username ? `@${item.username}` : (item.ip ?? '')
  const open = () => item.userId && item.username && openUser({ id: item.userId, username: item.username })
  const moderate = can(role, 'moderador')

  let title: string
  let text: string
  const actions: React.ReactNode[] = []
  const button = (key: string, label: string, onClick: () => void, primary = false) => (
    <button key={key} type="button" className={`btn ${primary ? 'btn-primary' : 'btn-ghost'} btn-sm`} disabled={busy} onClick={onClick}>
      {label}
    </button>
  )

  switch (item.kind) {
    case 'flag': {
      const flag: ModerationFlag = {
        level: item.level === 'high' ? 'high' : 'mid',
        kind: item.text as ModerationFlag['kind'],
        userId: item.userId ?? null,
        ip: item.ip ?? null,
        value: item.value ?? 0,
        username: item.username ?? null,
      }
      title = flagTitle(t, flag)
      text = who
      if (item.userId) actions.push(button('open', t('panel.inbox.openUser'), open, true))
      if (moderate && (item.userId || item.ip)) actions.push(button('ban', t('panel.inbox.ban'), () => setBanning(true)))
      break
    }
    case 'shared': {
      const users = item.users ?? []
      title = t('panel.inbox.shared', { count: users.length })
      text = users.map((u) => `@${u.username}`).join(' · ')
      if (moderate) {
        actions.push(
          button('siblings', t('panel.inbox.siblings'), () =>
            run(marks.mutateAsync({ userId: users[0].id, siblings: { ids: users.map((u) => u.id), linked: true } })),
          true,
          ),
        )
        actions.push(
          button('watch', t('panel.inbox.watch'), () =>
            run(Promise.all(users.map((u) => marks.mutateAsync({ userId: u.id, addTags: ['VIGILAR'] })))),
          ),
        )
      }
      break
    }
    case 'report':
      title = t('panel.inbox.report', { name: who || t('panel.inbox.someone') })
      text = item.text ?? ''
      if (item.id !== undefined) actions.push(button('resolve', t('panel.inbox.resolve'), () => run(resolve.mutateAsync({ id: item.id!, ok: true })), true))
      actions.push(button('see', t('panel.inbox.seeAll'), () => go('system')))
      break
    case 'review':
      title = t('panel.inbox.review', { count: item.value ?? 0 })
      text = t('panel.inbox.reviewText')
      actions.push(button('go', t('panel.inbox.review_go'), () => go('moderation'), true))
      break
    case 'poll':
      title = t('panel.inbox.poll')
      text = `${item.text ?? ''} · ${t('panel.inbox.votes', { count: item.value ?? 0 })}`
      actions.push(button('go', t('panel.inbox.seePolls'), () => go('polls')))
      break
    case 'campaign':
      title = t('panel.inbox.campaign', { count: item.value ?? 0 })
      text = item.text ?? ''
      actions.push(button('go', t('panel.inbox.seeNotices'), () => go('notices')))
      break
    case 'auto':
    default:
      title = t('panel.inbox.auto', { action: t(`admin.log.${item.text}`, { defaultValue: item.text ?? '' }) })
      text = item.username ?? ''
      if (item.id !== undefined && moderate) actions.push(button('undo', t('panel.inbox.undo'), () => run(undo.mutateAsync(item.id!))))
  }
  actions.push(
    <button
      key="dismiss"
      type="button"
      className={`btn btn-ghost btn-sm ${ui.quiet}`}
      disabled={busy}
      onClick={() => run(dismiss.mutateAsync({ key: item.key }))}
    >
      {t('panel.inbox.dismiss')}
    </button>,
  )

  return (
    <li className={ui.inboxRow} data-level={item.level} data-compact={compact || undefined}>
      <span className={ui.levelBar} data-level={item.level} aria-label={t(`panel.inbox.level.${item.level}`)} />
      <div className={ui.inboxBody}>
        <b>{title}</b>
        {text && <span className={styles.dim}>{text}</span>}
        {error && <span className="error-text">{error}</span>}
      </div>
      <small className={ui.inboxAgo}>{ago(item.at)}</small>
      {!compact && <div className={ui.inboxActions}>{actions}</div>}
      {compact && <div className={ui.inboxActions}>{actions.slice(0, 1)}{actions.at(-1)}</div>}
      <ConfirmSheet
        open={banning}
        icon="🚫"
        title={t('panel.inbox.banTitle', { name: who })}
        text={t('panel.inbox.banText')}
        confirm={t('panel.inbox.ban')}
        tone="danger"
        busy={ban.isPending}
        onConfirm={() =>
          ban
            .mutateAsync({ ...(item.userId ? { userId: item.userId } : { ip: item.ip! }), hours: 24 * 7, motivo: title })
            .then(() => setBanning(false))
            .catch((err: Error) => setError(err.message))
        }
        onCancel={() => setBanning(false)}
      />
    </li>
  )
}
