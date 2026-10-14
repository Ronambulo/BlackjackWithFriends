'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { currentLanguage } from '@/i18n'
import { InstallBanner } from '@/install/InstallBanner'
import { formatNumber } from '@/lib/format'
import type { Profile } from '@/profile/useProfile'
import { CardsIcon, ChatIcon, ChevronDownIcon, HomeIcon, TrophyIcon, UserIcon } from '@/ui/icons'
import styles from './AppShell.module.css'

const TABS = [
  { href: '/', key: 'home', Icon: HomeIcon },
  { href: '/ranking', key: 'ranking', Icon: TrophyIcon },
  { href: '/jugar', key: 'play', Icon: CardsIcon },
  { href: '/social', key: 'social', Icon: ChatIcon },
  { href: '/perfil', key: 'profile', Icon: UserIcon },
] as const

function isActive(href: string, pathname: string) {
  if (href === '/') return pathname === '/'
  // Settings lives under the profile tab.
  if (href === '/perfil') return pathname.startsWith('/perfil') || pathname.startsWith('/ajustes')
  return pathname.startsWith(href)
}

export function AppShell({ profile, children }: { profile: Profile; children: ReactNode }) {
  const { t } = useTranslation()
  const pathname = usePathname()
  // The table is played on a full-screen felt.
  const felted = pathname.startsWith('/jugar')

  return (
    <div className={`${styles.shell} ${felted ? styles.felted : ''}`}>
      <header className={styles.topbar}>
        {/* Group selector: enabled in phase 2, when groups exist. */}
        <button className={styles.group} type="button" disabled>
          <span>{t('topbar.noGroup')}</span>
          <ChevronDownIcon width={16} height={16} />
        </button>
        <div className={styles.coins} aria-label={t('common.coins', { count: profile.monedas })}>
          <span className={styles.coin} aria-hidden="true" />
          {formatNumber(profile.monedas, currentLanguage())}
        </div>
      </header>

      <main className={styles.content}>{children}</main>

      {/* Not over the table's controls. */}
      {!felted && <InstallBanner />}

      <nav className={styles.tabbar} aria-label="Menú">
        {TABS.map(({ href, key, Icon }) => {
          const active = isActive(href, pathname)
          return (
            <Link key={href} href={href} className={styles.tab} aria-current={active ? 'page' : undefined}>
              <span className={styles.tabIcon}>
                <Icon />
              </span>
              <span className={styles.tabLabel}>{t(`tabs.${key}`)}</span>
            </Link>
          )
        })}
      </nav>
    </div>
  )
}
