'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useEffect, useRef, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { useIsAdmin } from '@/admin/useAdmin'
import { WhatsNewBar } from '@/changelog/WhatsNewBar'
import { currentLanguage } from '@/i18n'
import { InstallBanner } from '@/install/InstallBanner'
import { useMaintenance } from '@/maintenance/useMaintenance'
import { formatNumber } from '@/lib/format'
import type { Profile } from '@/profile/useProfile'
import { CeremonyGate } from '@/season/Ceremony'
import { GroupPicker } from '@/groups/GroupPicker'
import { joinPath, pendingInvite } from '@/groups/pendingInvite'
import { useLiveUpdates } from '@/groups/useLiveUpdates'
import { useReportDevice } from '@/push/device'
import { useUnread } from '@/social/useChat'
import { CardsIcon, ChatIcon, GearIcon, GroupIcon, HomeIcon, UserIcon } from '@/ui/icons'
import { AnnouncementBar } from './AnnouncementBar'
import { rememberScreen } from './lastScreen'
import styles from './AppShell.module.css'

const TABS = [
  { href: '/', key: 'home', Icon: HomeIcon },
  { href: '/grupos', key: 'groups', Icon: GroupIcon },
  { href: '/jugar', key: 'play', Icon: CardsIcon },
  { href: '/social', key: 'social', Icon: ChatIcon },
  { href: '/perfil', key: 'profile', Icon: UserIcon },
] as const

function isActive(href: string, pathname: string) {
  if (href === '/') return pathname === '/'
  // Settings lives under the profile tab.
  if (href === '/perfil') return ['/perfil', '/ajustes', '/novedades'].some((path) => pathname.startsWith(path))
  return pathname.startsWith(href)
}

export function AppShell({ profile, children }: { profile: Profile; children: ReactNode }) {
  const { t } = useTranslation()
  const pathname = usePathname()
  const router = useRouter()
  const admin = useIsAdmin()
  const maintenance = useMaintenance()
  useLiveUpdates()
  useReportDevice()
  const { data: unread } = useUnread()
  const unreadTotal = Object.values(unread ?? {}).reduce((sum, n) => sum + n, 0)

  // Signed up from a friend's link: now that they're in, back to that invite.
  useEffect(() => {
    const codigo = pendingInvite()
    if (codigo && pathname !== '/grupos/unirse') router.replace(joinPath(codigo))
  }, [pathname, router])
  // The table is played on a full-screen felt.
  const felted = pathname.startsWith('/jugar')

  // The content is what scrolls, not the page, so Next can't reset it on navigation.
  const content = useRef<HTMLElement>(null)
  useEffect(() => {
    content.current?.scrollTo(0, 0)
    rememberScreen(pathname)
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

      <main ref={content} className={styles.content}>
        {/* Only admins get this far while it's on: a reminder that players can't. */}
        {maintenance && admin && (
          <Link href="/admin?tab=system" className={styles.maintenance}>
            {t('maintenance.adminStrip')}
          </Link>
        )}
        {!felted && <AnnouncementBar />}
        {!felted && pathname !== '/novedades' && <WhatsNewBar />}
        {children}
      </main>

      {/* Not over the table's controls. */}
      {!felted && <InstallBanner />}
      {/* Never in the middle of a hand: it waits until they leave the table. */}
      <CeremonyGate paused={felted} />

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
                  {key === 'social' && unreadTotal > 0 && (
                    <span className={styles.badge} aria-label={t('social.unread', { count: unreadTotal })}>
                      {unreadTotal > 99 ? '99+' : unreadTotal}
                    </span>
                  )}
                </span>
              )}
              <span className={styles.tabLabel}>{t(`tabs.${key}`)}</span>
            </Link>
          )
        })}
        {/* Only in the desktop sidebar: on a phone the panel stays one tap away in the profile. */}
        {admin && (
          <Link
            href="/admin"
            className={`${styles.tab} ${styles.adminTab}`}
            aria-current={pathname.startsWith('/admin') ? 'page' : undefined}
          >
            <span className={styles.tabIcon}>
              <GearIcon />
            </span>
            <span className={styles.tabLabel}>{t('admin.title')}</span>
          </Link>
        )}
      </nav>
    </div>
  )
}
