'use client'

import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { Suspense, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useUser } from '@/auth/session-context'
import { useIsAdmin, useModeration, useReports } from '@/admin/useAdmin'
import { EmptyState } from '@/ui/EmptyState'
import { ChevronLeftIcon, GearIcon } from '@/ui/icons'
import { PullToRefresh } from '@/ui/PullToRefresh'
import pages from '../pages.module.css'
import styles from './admin.module.css'
import { EconomyTab } from './EconomyTab'
import { LeagueTab } from './LeagueTab'
import { ModerationTab } from './ModerationTab'
import { NoticesTab } from './NoticesTab'
import { PollsTab } from './PollsTab'
import { StatsTab } from './StatsTab'
import { SystemTab } from './SystemTab'
import { UsersTab } from './UsersTab'

const TABS = ['stats', 'users', 'moderation', 'economy', 'league', 'notices', 'polls', 'system'] as const
type Tab = (typeof TABS)[number]

const PANELS: Record<Tab, (go: (tab: Tab) => void) => React.ReactNode> = {
  stats: (go) => <StatsTab onSeeAll={() => go('moderation')} />,
  users: () => <UsersTab />,
  moderation: () => <ModerationTab />,
  economy: () => <EconomyTab />,
  league: () => <LeagueTab />,
  notices: () => <NoticesTab />,
  polls: () => <PollsTab />,
  system: () => <SystemTab />,
}

export default function AdminPage() {
  return (
    <Suspense>
      <AskedTab />
    </Suspense>
  )
}

/** ?tab=system opens straight on that one (the maintenance strip links there), even from inside the panel. */
function AskedTab() {
  const asked = useSearchParams().get('tab')
  const tab = TABS.includes(asked as Tab) ? (asked as Tab) : 'stats'
  return <AdminPanel key={tab} initialTab={tab} />
}

function AdminPanel({ initialTab }: { initialTab: Tab }) {
  const { t } = useTranslation()
  const admin = useIsAdmin()
  const user = useUser()
  const [tab, setTab] = useState(initialTab)
  const { data: moderation } = useModeration()
  const { data: reports } = useReports()

  if (admin === undefined) return null
  if (!admin) return <EmptyState icon={<GearIcon />} title={t('admin.title')} text={t('admin.forbidden')} />

  const badges: Partial<Record<Tab, number>> = {
    moderation: (moderation?.flags.length ?? 0) + (moderation?.reviews.length ?? 0),
    system: reports?.filter((report) => !report.resuelto).length ?? 0,
  }

  return (
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
          {TABS.map((key) => (
            <button
              key={key}
              type="button"
              className={styles.navItem}
              aria-current={tab === key ? 'page' : undefined}
              onClick={() => setTab(key)}
            >
              <span>{t(`admin.tab.${key}`)}</span>
              {(badges[key] ?? 0) > 0 && <span className={styles.badge}>{badges[key]}</span>}
            </button>
          ))}
          <div className={styles.navFoot}>
            <span>
              {t('admin.connectedAs')} <b>@{user.username ?? user.name}</b>
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
          </div>
          <div className={`segmented ${styles.tabBar} ${styles.mobileOnly}`} role="group" aria-label={t('admin.title')}>
            {TABS.map((key) => (
              <button key={key} type="button" aria-pressed={tab === key} onClick={() => setTab(key)}>
                {t(`admin.tab.${key}`)}
              </button>
            ))}
          </div>
          <div className={tab === 'users' ? styles.single : styles.grid}>{PANELS[tab](setTab)}</div>
        </main>
      </div>
    </PullToRefresh>
  )
}
