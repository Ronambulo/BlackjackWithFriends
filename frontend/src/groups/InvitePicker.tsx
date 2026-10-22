'use client'

import Link from 'next/link'
import { useEffect, useId } from 'react'
import { createPortal } from 'react-dom'
import { useTranslation } from 'react-i18next'
import { avatarColor, initials } from '@/ui/avatarColor'
import { SheetIcon } from '@/ui/ConfirmSheet'
import sheet from '@/ui/ConfirmSheet.module.css'
import { ChevronRightIcon, ShareIcon } from '@/ui/icons'
import type { GroupSummary } from './useGroups'
import styles from './InvitePicker.module.css'

/** With several groups, which one a friend is invited to: each opens that group's invite page. */
export function InvitePicker({ groups, onClose }: { groups: GroupSummary[]; onClose: () => void }) {
  const { t } = useTranslation()
  const id = useId()

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

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
          <SheetIcon tone="accent">
            <ShareIcon />
          </SheetIcon>
        </div>
        <h2 id={`${id}-title`} className={sheet.title}>
          {t('home.inviteTitle')}
        </h2>
        <p className={sheet.text}>{t('home.inviteText')}</p>

        <ul className={styles.list}>
          {groups.map((group) => (
            <li key={group.id}>
              <Link href={`/grupos/${group.id}/invitar`} className={styles.option}>
                <span className={styles.tile} style={{ background: avatarColor(group.id) }} aria-hidden="true">
                  {initials(group.nombre)}
                </span>
                <span className={styles.name}>{group.nombre}</span>
                <small className="muted">{t('groupSettings.memberCount', { count: group.members })}</small>
                <ChevronRightIcon className={styles.chevron} width={18} height={18} />
              </Link>
            </li>
          ))}
        </ul>

        <div className={`${sheet.buttons} ${sheet.stacked}`}>
          <button className={`btn ${sheet.cancel}`} type="button" onClick={onClose}>
            {t('common.cancel')}
          </button>
        </div>
      </section>
    </div>,
    document.body,
  )
}
