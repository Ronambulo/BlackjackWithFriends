'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState, type CSSProperties } from 'react'
import { Trans, useTranslation } from 'react-i18next'
import { useUser } from '@/auth/session-context'
import { Podium, Ranking, type Picker } from '@/groups/Ranking'
import { useLeaveGroup, type RankedMember } from '@/groups/useGroups'
import { WeekChart } from '@/groups/WeekChart'
import { useRouteGroup } from '@/groups/useRouteGroup'
import { currentLanguage } from '@/i18n'
import { LeagueRules, minimumLeft } from '@/league/MinimumProgress'
import { useCountdown } from '@/league/useCountdown'
import { useLeague, type League } from '@/league/useLeague'
import { formatNumber } from '@/lib/format'
import { GroupHistory } from '@/season/GroupHistory'
import { useGroupSeasons } from '@/season/useSeason'
import { Avatar } from '@/ui/Avatar'
import { avatarColor, initials } from '@/ui/avatarColor'
import { ConfirmSheet, SheetIcon } from '@/ui/ConfirmSheet'
import { ChatIcon, ChevronLeftIcon, LeaveIcon, PlusIcon } from '@/ui/icons'
import { PullToRefresh } from '@/ui/PullToRefresh'
import pages from '../../pages.module.css'
import styles from './Group.module.css'
import { AdminCard, MembersCard } from './sections'

type Tab = 'ranking' | 'history' | 'group'
const TABS: Tab[] = ['ranking', 'history', 'group']
const TAB_LABEL = { ranking: 'groupPage.tabRanking', history: 'groupPage.tabHistory', group: 'groupPage.tabGroup' } as const

export default function GroupPage() {
  const { t } = useTranslation()
  const router = useRouter()
  const me = useUser()
  const { id, groups, group } = useRouteGroup()
  const { data: league } = useLeague()
  const countdown = useCountdown(league?.weekEndsAt)
  const leave = useLeaveGroup()
  const [confirmLeave, setConfirmLeave] = useState(false)
  const [tab, setTab] = useState<Tab>('ranking')
  // Who the chart shows; until the player picks, themselves and the leader.
  const [picked, setPicked] = useState<string[] | null>(null)

  const data = group.data
  const ranking = data?.ranking ?? []
  const summary = groups.data?.find((group) => group.id === id)
  const name = data?.nombre ?? summary?.nombre
  const unread = summary?.unread ?? 0

  const shown = (picked ?? [me.id, ranking[0]?.userId]).filter(
    (userId, i, all): userId is string => Boolean(userId) && all.indexOf(userId) === i && ranking.some((m) => m.userId === userId),
  )
  const picker: Picker = {
    picked: shown,
    onPick: (userId) => setPicked(shown.includes(userId) ? shown.filter((other) => other !== userId) : [...shown, userId]),
  }

  return (
    <PullToRefresh>
      <div className={pages.page}>
        <header className={styles.hero} style={{ '--group': avatarColor(id ?? '') } as CSSProperties}>
          <div className={styles.bar}>
            <Link href="/grupos" className={pages.backButton} aria-label={t('common.back')}>
              <ChevronLeftIcon width={22} height={22} />
            </Link>
            <span className={styles.spacer} />
            {data && (
              <Link className={`btn btn-primary ${styles.invite}`} href={`/grupos/${id}/invitar`}>
                <PlusIcon width={18} height={18} />
                {t('groupPage.invite')}
              </Link>
            )}
            <Link href={`/social?chat=${id}`} className={`${pages.iconButton} ${styles.chat}`} aria-label={t('social.openChat')}>
              <ChatIcon width={22} height={22} />
              {unread > 0 && <span className={pages.dotBadge}>{unread > 99 ? '99+' : unread}</span>}
            </Link>
          </div>
          <span className={styles.tile} aria-hidden="true">
            {initials(name ?? '')}
          </span>
          <h1 className={styles.name}>{name ?? '…'}</h1>
          {data && (
            <p className={styles.meta}>
              <span className={styles.stack} aria-hidden="true">
                {ranking.slice(0, 4).map((m) => (
                  <Avatar key={m.userId} seed={m.userId} name={m.nombre} src={m.avatarUrl} size={22} />
                ))}
              </span>
              <span>
                {t('groupSettings.memberCount', { count: ranking.length })}
                {countdown && ` · ${t('groupPage.closes', { time: countdown })}`}
              </span>
            </p>
          )}
        </header>

        {group.isError ? (
          <section className="card">
            <p className="muted">{t('common.error')}</p>
            <button className="btn btn-secondary" onClick={() => void group.refetch()}>
              {t('common.retry')}
            </button>
          </section>
        ) : data ? (
          <>
            <div className={styles.tabs} role="tablist" aria-label={t('groupPage.sections')}>
              {TABS.map((key) => (
                <button
                  key={key}
                  type="button"
                  role="tab"
                  id={`tab-${key}`}
                  aria-controls={`panel-${key}`}
                  aria-selected={tab === key}
                  className={styles.tab}
                  onClick={() => setTab(key)}
                >
                  {t(TAB_LABEL[key])}
                </button>
              ))}
            </div>

            <div role="tabpanel" id={`panel-${tab}`} aria-labelledby={`tab-${tab}`} className={pages.section}>
              {tab === 'ranking' && (
                <>
                  <Banner league={league} ranking={ranking} meId={me.id} />
                  <Podium members={ranking.slice(0, 3)} picker={picker} dayChange />
                  {ranking.length > 3 && (
                    <Ranking members={ranking.slice(3)} leader={ranking[0]?.balance} minHands={league?.minHands} picker={picker} />
                  )}
                  <Stats ranking={ranking} meId={me.id} />
                  <WeekChart
                    groupId={data.id}
                    ranking={ranking}
                    picked={shown}
                    onPick={picker.onPick}
                    onShowAll={() => setPicked([])}
                  />
                  <LeagueRules className={`muted ${pages.rules}`} />
                </>
              )}

              {tab === 'history' && <History groupId={data.id} />}

              {tab === 'group' && (
                <>
                  <MembersCard group={data} />
                  {/* Keyed so a rename elsewhere starts the form afresh. */}
                  {data.rol === 'admin' && <AdminCard key={data.nombre} group={data} />}
                  <button className="btn btn-danger btn-block" disabled={leave.isPending} onClick={() => setConfirmLeave(true)}>
                    {t('groupSettings.leave')}
                  </button>
                  {leave.isError && (
                    <p className="error-text" role="alert">
                      {t('common.error')}
                    </p>
                  )}
                </>
              )}
            </div>

            <ConfirmSheet
              open={confirmLeave}
              stacked
              icon={
                <SheetIcon tone="danger">
                  <LeaveIcon />
                </SheetIcon>
              }
              title={t('groupSettings.leaveTitle', { name: data.nombre })}
              text={t('groupSettings.leaveText')}
              confirm={t('groupSettings.leave')}
              busy={leave.isPending}
              onCancel={() => setConfirmLeave(false)}
              onConfirm={() =>
                leave.mutate(data.id, {
                  onSuccess: () => router.push('/grupos'),
                  onSettled: () => setConfirmLeave(false),
                })
              }
            />
          </>
        ) : (
          <p className="muted" aria-busy="true">
            …
          </p>
        )}
      </div>
    </PullToRefresh>
  )
}

/** What matters most to the player right now: the week's minimum while they lack it, else who to catch. */
function Banner({ league, ranking, meId }: { league: League | undefined; ranking: RankedMember[]; meId: string }) {
  const { t } = useTranslation()
  const lang = currentLanguage()
  const fmt = (n: number) => formatNumber(n, lang)

  const left = league ? minimumLeft(t, league) : null
  if (league && left) {
    const share = Math.min(1, league.hands / league.minHands)
    const r = 17
    const around = 2 * Math.PI * r
    return (
      <div className={pages.notice}>
        <svg className={styles.ring} width="42" height="42" viewBox="0 0 42 42" aria-hidden="true">
          <circle cx="21" cy="21" r={r} className={styles.ringTrack} />
          <circle
            cx="21"
            cy="21"
            r={r}
            className={styles.ringFill}
            strokeDasharray={`${share * around} ${around}`}
            transform="rotate(-90 21 21)"
          />
        </svg>
        <p>
          <b>{left}</b>
          <br />
          <small className="muted">
            {t('groupPage.progress', {
              hands: fmt(Math.min(league.hands, league.minHands)),
              minHands: fmt(league.minHands),
              wagered: fmt(Math.min(league.wagered, league.minWagered)),
              minWagered: fmt(league.minWagered),
            })}
          </small>
        </p>
      </div>
    )
  }

  const mineIndex = ranking.findIndex((member) => member.userId === meId)
  // Whoever is just above the player, to say how far they are.
  const ahead = mineIndex > 0 ? ranking[mineIndex - 1] : undefined
  const gap = ahead ? ahead.balance - ranking[mineIndex].balance : 0
  if (!ahead || gap <= 0) return null
  return (
    <div className={pages.notice}>
      <p>
        <Trans i18nKey="ranking.toCatch" values={{ amount: fmt(gap), name: ahead.nombre }} components={{ b: <b /> }} />
      </p>
    </div>
  )
}

/** Two small highlights of the week: who's won most today and who's played most. */
function Stats({ ranking, meId }: { ranking: RankedMember[]; meId: string }) {
  const { t } = useTranslation()
  const lang = currentLanguage()
  const best = ranking.reduce<RankedMember | undefined>((top, m) => (m.dayChange > (top?.dayChange ?? 0) ? m : top), undefined)
  const busiest = ranking.reduce<RankedMember | undefined>((top, m) => (m.hands > (top?.hands ?? 0) ? m : top), undefined)
  if (!best && !busiest) return null
  const nameOf = (m: RankedMember) => (m.userId === meId ? t('ranking.you') : m.nombre)

  return (
    <div className={styles.stats}>
      {best && (
        <div className={styles.stat}>
          <small className="muted">{t('groupPage.bestDay')}</small>
          <b>{nameOf(best)}</b>
          <span className={styles.up}>{t('groupPage.bestDayValue', { amount: formatNumber(best.dayChange, lang) })}</span>
        </div>
      )}
      {busiest && (
        <div className={styles.stat}>
          <small className="muted">{t('groupPage.mostHands')}</small>
          <b>{nameOf(busiest)}</b>
          <span className="muted">{t('groupPage.mostHandsValue', { count: busiest.hands })}</span>
        </div>
      )}
    </div>
  )
}

function History({ groupId }: { groupId: string }) {
  const { t } = useTranslation()
  const { data: weeks } = useGroupSeasons(groupId)
  if (weeks && !weeks.length) return <p className={`muted ${styles.empty}`}>{t('groupPage.noHistory')}</p>
  return <GroupHistory groupId={groupId} />
}
