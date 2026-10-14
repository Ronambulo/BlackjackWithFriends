'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { Trans, useTranslation } from 'react-i18next'
import { useUser } from '@/auth/session-context'
import { Podium, Ranking } from '@/groups/Ranking'
import { useLeaveGroup } from '@/groups/useGroups'
import { WeekChart } from '@/groups/WeekChart'
import { useRouteGroup } from '@/groups/useRouteGroup'
import { currentLanguage } from '@/i18n'
import { useCountdown } from '@/league/useCountdown'
import { useLeague } from '@/league/useLeague'
import { formatNumber } from '@/lib/format'
import { ConfirmSheet, SheetIcon } from '@/ui/ConfirmSheet'
import { ChevronLeftIcon, LeaveIcon, ShareIcon, TimerIcon } from '@/ui/icons'
import styles from '../../pages.module.css'
import { AdminCard, MembersCard } from './sections'

export default function GroupPage() {
  const { t } = useTranslation()
  const router = useRouter()
  const me = useUser()
  const { id, groups, group } = useRouteGroup()
  const { data: league } = useLeague()
  const countdown = useCountdown(league?.weekEndsAt)
  const leave = useLeaveGroup()
  const [confirmLeave, setConfirmLeave] = useState(false)

  const data = group.data
  const ranking = data?.ranking ?? []
  const mineIndex = ranking.findIndex((member) => member.userId === me.id)
  // Whoever is just above the player, to say how far they are.
  const ahead = mineIndex > 0 ? ranking[mineIndex - 1] : undefined
  const gap = ahead ? ahead.balance - ranking[mineIndex].balance : 0
  const name = data?.nombre ?? groups.data?.find((summary) => summary.id === id)?.nombre

  return (
    <div className={styles.page}>
      <div className={styles.titleRow}>
        <Link href="/grupos" className={styles.backButton} aria-label={t('common.back')}>
          <ChevronLeftIcon width={22} height={22} />
        </Link>
        <div className={styles.who}>
          <h1 className={styles.title}>{name ?? '…'}</h1>
          {data && (
            <p className="muted">
              {t('groupSettings.memberCount', { count: ranking.length })}
              {data.rol === 'admin' && ` · ${t('groupSettings.youAdmin')}`}
            </p>
          )}
        </div>
      </div>

      {group.isError ? (
        <section className="card">
          <p className="muted">{t('common.error')}</p>
          <button className="btn btn-secondary" onClick={() => void group.refetch()}>
            {t('common.retry')}
          </button>
        </section>
      ) : data ? (
        <>
          <Link className={`btn btn-primary ${styles.inviteButton}`} href={`/grupos/${id}/invitar`}>
            <ShareIcon width={18} height={18} />
            {t('groupSettings.invite')}
          </Link>

          <section className={styles.section}>
            <div className={styles.headerRow}>
              <h2 className="label">{t('ranking.title')}</h2>
              <span className={styles.live}>{t('ranking.live')}</span>
            </div>
            <Podium members={ranking.slice(0, 3)} />
            {ranking.length > 3 && <Ranking members={ranking.slice(3)} />}
            <WeekChart groupId={data.id} ranking={ranking} />
          </section>

          {countdown && (
            <div className={styles.notice}>
              <TimerIcon width={20} height={20} />
              <p>
                {t('league.closesIn', { time: countdown })}.{' '}
                {ahead && gap > 0 && (
                  <Trans
                    i18nKey="ranking.toCatch"
                    values={{ amount: formatNumber(gap, currentLanguage()), name: ahead.nombre }}
                    components={{ b: <b /> }}
                  />
                )}
              </p>
            </div>
          )}

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
          <p className={`muted ${styles.rules}`}>{t('league.rules')}</p>
        </>
      ) : (
        <p className="muted" aria-busy="true">
          …
        </p>
      )}
    </div>
  )
}
