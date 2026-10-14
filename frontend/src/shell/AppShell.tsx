'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useRef, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { currentLanguage } from '@/i18n'
import { InstallBanner } from '@/install/InstallBanner'
import { formatNumber } from '@/lib/format'
import type { Profile } from '@/profile/useProfile'
import { GroupPicker } from '@/groups/GroupPicker'
import { CardsIcon, ChatIcon, HomeIcon, PodiumIcon, UserIcon } from '@/ui/icons'
import styles from './AppShell.module.css'

const TABS = [
  { href: '/', key: 'home', Icon: HomeIcon },
  { href: '/ranking', key: 'ranking', Icon: PodiumIcon },
  { href: '/jugar', key: 'play', Icon: CardsIcon },
  { href: '/social', key: 'social', Icon: ChatIcon },
  { href: '/perfil', key: 'profile', Icon: UserIcon },
] as const

function isActive(href: string, pathname: string) {
  // Creating or joining a group starts from home; a group's settings hang off its ranking.
  if (href === '/') return pathname === '/' || pathname.startsWith('/grupos')
  if (href === '/ranking') return pathname.startsWith('/ranking') || pathname === '/grupo'
  // Settings lives under the profile tab.
  if (href === '/perfil') return pathname.startsWith('/perfil') || pathname.startsWith('/ajustes')
  return pathname.startsWith(href)
}

export function AppShell({ profile, children }: { profile: Profile; children: ReactNode }) {
  const { t } = useTranslation()
  const pathname = usePathname()
  // The table is played on a full-screen felt.
  const felted = pathname.startsWith('/jugar')

  // The content is what scrolls, not the page, so Next can't reset it on navigation.
  const content = useRef<HTMLElement>(null)
  useEffect(() => {
    content.current?.scrollTo(0, 0)
  }, [pathname])

  return (
    <div className={`${styles.shell} ${felted ? styles.felted : ''}`}>
      {/* iOS 27 paints the status bar from a fixed element at the top; without it the edge is blurred */}
      <div className={styles.statusTint} aria-hidden="true" />
      <header className={styles.topbar}>
        <GroupPicker className={styles.group} />
        <div className={styles.coins} aria-label={t('common.coins', { count: profile.monedas })}>
          <span className={styles.coin} aria-hidden="true" />
          {formatNumber(profile.monedas, currentLanguage())}
        </div>
      </header>

      <main ref={content} className={styles.content}>{children}</main>

      {/* Not over the table's controls. */}
      {!felted && <InstallBanner />}

      <nav className={styles.tabbar} aria-label="Menú">
        {TABS.map(({ href, key, Icon }) => {
          const active = isActive(href, pathname)
          // Play is the raised casino chip in the middle.
          const chip = href === '/jugar'
          return (
            <Link
              key={href}
              href={href}
              className={`${styles.tab} ${chip ? styles.chipTab : ''}`}
              aria-current={active ? 'page' : undefined}
            >
              {chip ? (
                <span className={styles.chip}>
                  <span className={styles.chipFace}>
                    <Icon />
                  </span>
                </span>
              ) : (
                <span className={styles.tabIcon}>
                  <Icon />
                </span>
              )}
              <span className={styles.tabLabel}>{t(`tabs.${key}`)}</span>
            </Link>
          )
        })}
      </nav>
    </div>
  )
}
