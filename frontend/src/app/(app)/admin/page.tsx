'use client'

import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { Suspense, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useUser } from '@/auth/session-context'
import { useIsAdmin, useModeration, useReports, useRole } from '@/admin/useAdmin'
import { useInbox } from '@/admin/useAdminTools'
import { EmptyState } from '@/ui/EmptyState'
import { ChevronLeftIcon, GearIcon, SearchIcon } from '@/ui/icons'
import { PullToRefresh } from '@/ui/PullToRefresh'
import pages from '../pages.module.css'
import styles from './admin.module.css'
import { AutomationsTab } from './AutomationsTab'
import { CalendarTab } from './CalendarTab'
import { AdminContext, type Focus, type Tab, TABS } from './context'
import { EconomyTab } from './EconomyTab'
import { EventsTab } from './EventsTab'
import { InboxTab } from './InboxTab'
import { LeagueTab } from './LeagueTab'
import { LogTab } from './LogTab'
import { useMasonry } from './masonry'
import { ModerationTab } from './ModerationTab'
import { NoticesTab } from './NoticesTab'
import { Palette } from './Palette'
import { PollsTab } from './PollsTab'
import { ShopTab } from './ShopTab'
import { StatsTab } from './StatsTab'
import { SystemTab } from './SystemTab'
import { TeamTab } from './TeamTab'
import ui from './tools.module.css'
import { UsersTab } from './UsersTab'

/** The menu, in the order an admin goes through it: today, the players, talking to them, the game, the machine. */
const GROUPS: ['today' | 'community' | 'comms' | 'game' | 'system', Tab[]][] = [
  ['today', ['stats', 'inbox', 'calendar']],
  ['community', ['users', 'moderation', 'league']],
  ['comms', ['notices', 'polls']],
  ['game', ['economy', 'shop', 'events']],
  ['system', ['automations', 'team', 'log', 'system']],
]

const PANELS: Record<Tab, (focus: Focus | null) => React.ReactNode> = {
  stats: () => <StatsTab />,
  inbox: () => <InboxTab />,
  calendar: () => <CalendarTab />,
  users: (focus) => <UsersTab focus={focus} />,
  moderation: () => <ModerationTab />,
  league: () => <LeagueTab />,
  notices: () => <NoticesTab />,
  polls: () => <PollsTab />,
  economy: () => <EconomyTab />,
  shop: () => <ShopTab />,
  events: () => <EventsTab />,
  automations: () => <AutomationsTab />,
  team: () => <TeamTab />,
  log: () => <LogTab />,
  system: () => <SystemTab />,
}

/** Tabs that are one long list or a wide board rather than a grid of cards. */
const SINGLE: Tab[] = ['users', 'shop', 'inbox', 'calendar', 'log']

export default function AdminPage() {
  return (
    <Suspense>
      <AskedTab />
    </Suspense>
  )
}

/** ?tab=system opens straight on that one (the maintenance strip links there), even from inside the panel. */
function AskedTab() {
  const params = useSearchParams()
  const asked = params.get('tab')
  const tab = TABS.includes(asked as Tab) ? (asked as Tab) : 'stats'
  return <AdminPanel key={tab} initialTab={tab} />
}

function AdminPanel({ initialTab }: { initialTab: Tab }) {
  const { t } = useTranslation()
  const admin = useIsAdmin()
  const role = useRole()
  const user = useUser()
  const [tab, setShown] = useState(initialTab)
  const [focus, setFocus] = useState<Focus | null>(null)
  const grid = useRef<HTMLDivElement>(null)
  // The grid only exists once we know the visitor is an admin, and changes with the tab.
  useMasonry(grid, `${tab}:${admin}`)
  const [palette, setPalette] = useState(false)
  // The tab goes in the address too, so a reload stays on it.
  const go = (next: Tab) => {
    setShown(next)
    if (next !== 'users') setFocus(null)
    const url = new URL(window.location.href)
    url.searchParams.set('tab', next)
    window.history.replaceState(window.history.state, '', url)
    document.querySelector(`.${styles.main}`)?.scrollTo({ top: 0 })
  }
  const openUser = (who: Focus) => {
    setFocus(who)
    go('users')
  }
  const { data: moderation } = useModeration()
  const { data: reports } = useReports()
  const { data: inbox } = useInbox()

  // Ctrl K (or ⌘K) anywhere in the panel: search or do.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault()
        setPalette((open) => !open)
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [])

  if (admin === undefined) return null
  if (!admin) return <EmptyState icon={<GearIcon />} title={t('admin.title')} text={t('admin.forbidden')} />

  const urgent = inbox?.filter((item) => item.level !== 'low').length ?? 0
  const badges: Partial<Record<Tab, { n: number; quiet?: boolean }>> = {
    inbox: { n: inbox?.length ?? 0, quiet: urgent === 0 },
    moderation: { n: (moderation?.flags.length ?? 0) + (moderation?.reviews.length ?? 0) },
    system: { n: reports?.filter((report) => !report.resuelto).length ?? 0 },
  }
  const badge = (key: Tab) => {
    const b = badges[key]
    return b && b.n > 0 ? (
      <span className={b.quiet ? ui.quietBadge : styles.badge}>{b.n > 99 ? '99+' : b.n}</span>
    ) : null
  }

  return (
    <AdminContext.Provider value={{ go, openUser, role: role ?? null, openPalette: () => setPalette(true) }}>
      <PullToRefresh>
        <div className={styles.admin}>
          <nav className={styles.nav} aria-label={t('admin.title')}>
            <div className={styles.brand}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img className={styles.mark} src="/icon.svg" alt="" width={36} height={36} />
              <span className={styles.brandName}>
                <b>Blackjack</b>
                <small>{t('admin.title')}</small>
              </span>
            </div>
            <button type="button" className={ui.paletteButton} onClick={() => setPalette(true)}>
              <SearchIcon width={16} height={16} />
              <span>{t('panel.palette.open')}</span>
              <kbd>Ctrl K</kbd>
            </button>
            {GROUPS.map(([group, tabs]) => (
              <div key={group} className={ui.navGroup}>
                <span className={ui.navLabel}>{t(`panel.group.${group}`)}</span>
                {tabs.map((key) => (
                  <button
                    key={key}
                    type="button"
                    className={styles.navItem}
                    aria-current={tab === key ? 'page' : undefined}
                    onClick={() => go(key)}
                  >
                    <span>{t(`admin.tab.${key}`)}</span>
                    {badge(key)}
                  </button>
                ))}
              </div>
            ))}
            <div className={styles.navFoot}>
              <span>
                {t('admin.connectedAs')} <b>@{user.username ?? user.name}</b>
                {role && <span className={ui.roleTag}>{t(`panel.role.${role}`)}</span>}
              </span>
              <Link href="/perfil">← {t('admin.backToApp')}</Link>
            </div>
          </nav>

          <main className={styles.main}>
            <div className={pages.titleRow}>
              <Link href="/perfil" className={`${pages.backButton} ${styles.mobileOnly}`} aria-label={t('common.back')}>
                <ChevronLeftIcon width={22} height={22} />
              </Link>
              <div className={styles.heading}>
                <h1 className={styles.title}>{t(`admin.tab.${tab}`)}</h1>
                <p className={styles.subtitle}>{t(`admin.sub.${tab}`)}</p>
              </div>
              <button
                type="button"
                className={`${ui.iconBtn} ${styles.mobileOnly}`}
                aria-label={t('panel.palette.open')}
                onClick={() => setPalette(true)}
              >
                <SearchIcon width={20} height={20} />
              </button>
            </div>
            <div className={`segmented ${styles.tabBar} ${styles.mobileOnly}`} role="group" aria-label={t('admin.title')}>
              {GROUPS.flatMap(([, tabs]) => tabs).map((key) => (
                <button key={key} type="button" aria-pressed={tab === key} onClick={() => go(key)}>
                  {t(`admin.tab.${key}`)}
                  {(badges[key]?.n ?? 0) > 0 && <span className={ui.dotBadge} />}
                </button>
              ))}
            </div>
            <div ref={SINGLE.includes(tab) ? undefined : grid} className={SINGLE.includes(tab) ? styles.single : styles.grid}>{PANELS[tab](focus)}</div>
          </main>
        </div>
      </PullToRefresh>
      {palette && <Palette onClose={() => setPalette(false)} />}
    </AdminContext.Provider>
  )
}
