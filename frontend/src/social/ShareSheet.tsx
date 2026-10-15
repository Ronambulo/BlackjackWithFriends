'use client'

import { useEffect, useId, useState } from 'react'
import { createPortal } from 'react-dom'
import { useTranslation } from 'react-i18next'
import { useCurrentGroup, useGroups } from '@/groups/useGroups'
import { ChatIcon, CheckIcon, ShareIcon } from '@/ui/icons'
import { SheetIcon } from '@/ui/ConfirmSheet'
import sheet from '@/ui/ConfirmSheet.module.css'
import { GLOBAL, useShare, type Shared } from './useChat'
import styles from './ShareSheet.module.css'

/** Picks the chats a finished hand or the stats go to: the global one and/or the player's groups. */
export function ShareSheet({
  what,
  onClose,
  onShared,
}: {
  what: Shared
  onClose: () => void
  onShared: () => void
}) {
  const { t } = useTranslation()
  const id = useId()
  const { data: groups } = useGroups()
  const current = useCurrentGroup()
  const share = useShare()
  const kind = 'handId' in what ? 'hand' : 'stats'
  // The group in view to start with; the global chat if there's none.
  const [picked, setPicked] = useState<Set<string>>(() => new Set([current?.id ?? GLOBAL]))

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  const toggle = (chat: string) =>
    setPicked((set) => {
      const next = new Set(set)
      if (!next.delete(chat)) next.add(chat)
      return next
    })

  const options = [{ id: GLOBAL, name: t('social.globalChat') }, ...(groups ?? []).map((g) => ({ id: g.id, name: g.nombre }))]

  const publish = () =>
    share.mutate({ what, chats: [...picked] }, { onSuccess: () => onShared() })

  return createPortal(
    <div className={sheet.overlay} onClick={onClose}>
      <section
        className={sheet.sheet}
        role="dialog"
        aria-modal="true"
        aria-labelledby={`${id}-title`}
        onClick={(event) => event.stopPropagation()}
      >
        <span className={sheet.grab} aria-hidden="true" />
        <div className={sheet.icon} aria-hidden="true">
          <SheetIcon tone="accent">{kind === 'hand' ? <ShareIcon /> : <ChatIcon />}</SheetIcon>
        </div>
        <h2 id={`${id}-title`} className={sheet.title}>
          {t(kind === 'hand' ? 'social.publishTitle' : 'social.publishStatsTitle')}
        </h2>
        <p className={sheet.text}>{t(kind === 'hand' ? 'social.publishText' : 'social.publishStatsText')}</p>

        <ul className={styles.list}>
          {options.map((option) => {
            const on = picked.has(option.id)
            return (
              <li key={option.id}>
                <button
                  type="button"
                  role="checkbox"
                  aria-checked={on}
                  className={styles.option}
                  onClick={() => toggle(option.id)}
                >
                  <span className={styles.name}>{option.name}</span>
                  <span className={`${styles.box} ${on ? styles.boxOn : ''}`} aria-hidden="true">
                    {on && <CheckIcon width={16} height={16} strokeWidth={3} />}
                  </span>
                </button>
              </li>
            )
          })}
        </ul>

        {share.isError && (
          <p className="error-text" role="alert">
            {share.error.message.startsWith('Demasiados') ? t('social.slowDown') : t('common.error')}
          </p>
        )}
        <div className={`${sheet.buttons} ${sheet.stacked}`}>
          <button
            className="btn btn-primary"
            type="button"
            disabled={picked.size === 0 || share.isPending}
            onClick={publish}
          >
            {t('social.publishTo', { count: picked.size })}
          </button>
          <button className={`btn ${sheet.cancel}`} type="button" onClick={onClose}>
            {t('common.cancel')}
          </button>
        </div>
      </section>
    </div>,
    document.body,
  )
}
