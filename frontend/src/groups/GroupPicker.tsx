'use client'

import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ChevronDownIcon, PlusIcon } from '@/ui/icons'
import { selectGroup, useCurrentGroup, useGroups } from './useGroups'
import styles from './GroupPicker.module.css'

/** The top bar's group button: shows the group in view and switches between the player's groups. */
export function GroupPicker({ className }: { className: string }) {
  const { t } = useTranslation()
  const { data: groups } = useGroups()
  const current = useCurrentGroup()
  const [open, setOpen] = useState(false)
  const root = useRef<HTMLDivElement>(null)

  // Closes when picking, tapping outside or pressing Escape.
  useEffect(() => {
    if (!open) return
    const onPointer = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false)
    }
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false)
    }
    document.addEventListener('pointerdown', onPointer)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('pointerdown', onPointer)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  return (
    <div ref={root} className={styles.root}>
      <button
        className={className}
        type="button"
        aria-haspopup="true"
        aria-expanded={open}
        disabled={!groups}
        onClick={() => setOpen((value) => !value)}
      >
        <span className={styles.label}>{current?.nombre ?? t('topbar.noGroup')}</span>
        <ChevronDownIcon width={16} height={16} />
      </button>
      {open && (
        <div className={styles.menu}>
          {groups && groups.length > 0 && (
            <>
              <p className={styles.heading}>{t('topbar.groups')}</p>
              {groups.map((group) => (
                <button
                  key={group.id}
                  className={styles.item}
                  type="button"
                  aria-current={group.id === current?.id ? 'true' : undefined}
                  onClick={() => {
                    selectGroup(group.id)
                    setOpen(false)
                  }}
                >
                  <span className={styles.label}>{group.nombre}</span>
                  <span className={styles.rank}>
                    {group.rank}º/{group.members}
                  </span>
                </button>
              ))}
              <hr className={styles.divider} />
            </>
          )}
          <Link className={styles.item} href="/grupos/nuevo" onClick={() => setOpen(false)}>
            <PlusIcon width={16} height={16} />
            {t('topbar.newGroup')}
          </Link>
          <Link className={styles.item} href="/grupos/unirse" onClick={() => setOpen(false)}>
            <span className={styles.hash} aria-hidden="true">
              #
            </span>
            {t('topbar.joinGroup')}
          </Link>
        </div>
      )}
    </div>
  )
}
