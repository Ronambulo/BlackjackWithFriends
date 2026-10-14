'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { CheckIcon, ChevronDownIcon, CrownIcon, PlusIcon, SlidersIcon } from '@/ui/icons'
import { avatarColor, initials } from '@/ui/avatarColor'
import { selectGroup, useCurrentGroup, useGroups } from './useGroups'
import styles from './GroupPicker.module.css'

/** The top bar's group button: shows the group in view and switches between the player's groups. */
export function GroupPicker({ className }: { className: string }) {
  const { t } = useTranslation()
  const { data: groups } = useGroups()
  const current = useCurrentGroup()
  const [open, setOpen] = useState(false)
  const pathname = usePathname()
  const router = useRouter()
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
    <>
      {/* Dims the screen; tapping it closes the menu (it is outside root) */}
      {open && <div className={styles.backdrop} aria-hidden="true" />}
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
                {groups.map((group) => {
                  const selected = group.id === current?.id
                  return (
                    <button
                      key={group.id}
                      className={styles.item}
                      type="button"
                      aria-current={selected ? 'true' : undefined}
                      onClick={() => {
                        selectGroup(group.id)
                        setOpen(false)
                        // Looking at a group: switch to the one picked.
                        const page = /^\/grupos\/(?!nuevo|unirse)[^/]+(\/invitar)?$/.exec(pathname)
                        if (page) router.push(`/grupos/${group.id}${page[1] ?? ''}`)
                      }}
                    >
                      <span className={styles.tile} style={{ background: selected ? 'var(--accent)' : avatarColor(group.id) }} aria-hidden="true">
                        {initials(group.nombre)}
                      </span>
                      <span className={styles.name}>
                        <span className={styles.label}>{group.nombre}</span>
                        <span className={styles.rank}>{t('league.position', { rank: group.rank, total: group.members })}</span>
                      </span>
                      {selected ? (
                        <CheckIcon className={styles.check} width={20} height={20} />
                      ) : (
                        group.rank === 1 && (
                          <span className={styles.first} role="img" aria-label={t('topbar.first')}>
                            <CrownIcon width={12} height={10} />
                          </span>
                        )
                      )}
                    </button>
                  )
                })}
                <hr className={styles.divider} />
              </>
            )}
            <Link className={styles.item} href="/grupos/nuevo" onClick={() => setOpen(false)}>
              <span className={`${styles.tile} ${styles.dashed}`} aria-hidden="true">
                <PlusIcon width={18} height={18} />
              </span>
              {t('topbar.newGroup')}
            </Link>
            <Link className={styles.item} href="/grupos/unirse" onClick={() => setOpen(false)}>
              <span className={`${styles.tile} ${styles.dashed}`} aria-hidden="true">
                #
              </span>
              {t('topbar.joinGroup')}
            </Link>
            {current && (
              <Link className={`${styles.item} ${styles.settings}`} href={`/grupos/${current.id}`} onClick={() => setOpen(false)}>
                <span className={styles.tile} aria-hidden="true">
                  <SlidersIcon width={20} height={20} />
                </span>
                <span className={styles.label}>{t('topbar.groupSettings', { name: current.nombre })}</span>
              </Link>
            )}
          </div>
        )}
      </div>
    </>
  )
}
