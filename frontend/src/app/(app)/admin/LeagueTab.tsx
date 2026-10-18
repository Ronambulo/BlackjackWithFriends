'use client'

import { useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import {
  useAdminChallenges,
  useAdminLeague,
  usePickChallenges,
} from '@/admin/useAdmin'
import type { ChallengeId } from '@/challenges/useChallenges'
import { currentLanguage } from '@/i18n'
import { date, number } from '@/admin/format'
import styles from './admin.module.css'

const TIERS = ['easy', 'medium', 'hard'] as const

/** Today's challenges with how many players did them, and a pick for tomorrow's. */
function Challenges() {
  const { t } = useTranslation()
  const { data } = useAdminChallenges()
  const pick = usePickChallenges()
  // The admin's edit, until it's saved; else what tomorrow has now.
  const [draft, setDraft] = useState<ChallengeId[] | null>(null)

  if (!data) return <section className={`card ${styles.placeholder}`} aria-busy="true" />

  const text = (c: { id: ChallengeId; target: number }) =>
    t(`challenges.items.${c.id}`, { count: c.target, amount: number(c.target) })
  const ids = draft ?? data.tomorrow.ids
  const changed = ids.some((id, i) => id !== data.tomorrow.ids[i])
  // A day never has two of a kind: what the other tiers took is off.
  const familyOf = (id: ChallengeId) => data.catalogue.find((c) => c.id === id)?.family
  const taken = (i: number) => new Set(ids.filter((_, j) => j !== i).map(familyOf))

  const submit = (event: FormEvent) => {
    event.preventDefault()
    pick.mutate(ids, { onSuccess: () => setDraft(null) })
  }

  return (
    <form className={`card ${styles.block} ${styles.span2}`} onSubmit={submit}>
      <div className={styles.sectionHead}>
        <h2 className="label">{t('admin.challengesTitle')}</h2>
        <span className={styles.dim}>{data.today.custom ? t('admin.challengesCustom') : t('admin.challengesAuto')}</span>
      </div>
      <ol className={styles.top}>
        {data.today.challenges.map((c) => (
          <li key={c.id}>
            <span className={styles.userName}>
              <b className={styles.wrapText}>{text(c)}</b>
              <small className={styles.ellipsis}>
                {t(`challenges.tiers.${c.tier}`)} · {t('challenges.reward', { count: c.coins })}
              </small>
            </span>
            <b>{t('admin.challengesCompleted', { count: c.completed, n: number(c.completed) })}</b>
          </li>
        ))}
      </ol>

      <h3 className="label">
        {t('admin.challengesTomorrow', {
          date: new Intl.DateTimeFormat(currentLanguage(), { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' }).format(
            new Date(`${data.tomorrow.day}T12:00:00Z`),
          ),
        })}
        {data.tomorrow.custom ? ` · ${t('admin.challengesCustom')}` : ''}
      </h3>
      {TIERS.map((tier, i) => (
        <label key={tier} className={styles.formField}>
          {t(`challenges.tiers.${tier}`)}
          <select
            className={styles.fieldInput}
            value={ids[i] ?? ''}
            onChange={(event) => setDraft(ids.map((id, j) => (j === i ? (event.target.value as ChallengeId) : id)))}
          >
            {data.catalogue
              .filter((c) => c.tier === tier)
              .map((c) => (
                <option key={c.id} value={c.id} disabled={taken(i).has(c.family)}>
                  {text(c)}
                </option>
              ))}
          </select>
        </label>
      ))}
      {pick.isError && <p className="error-text">{pick.error.message}</p>}
      <div className={styles.formActions}>
        {data.tomorrow.custom && (
          <button className="btn btn-ghost" type="button" disabled={pick.isPending} onClick={() => pick.mutate(null, { onSuccess: () => setDraft(null) })}>
            {t('admin.challengesReset')}
          </button>
        )}
        <button className="btn btn-primary" type="submit" disabled={!changed || pick.isPending}>
          {t('admin.challengesSave')}
        </button>
      </div>
    </form>
  )
}

export function LeagueTab() {
  const { t } = useTranslation()
  const { data, isError, refetch } = useAdminLeague()

  if (isError) {
    return (
      <section className="card">
        <p className="muted">{t('common.error')}</p>
        <button className="btn btn-secondary" onClick={() => void refetch()}>
          {t('common.retry')}
        </button>
      </section>
    )
  }
  if (!data) return <section className={`card ${styles.placeholder}`} aria-busy="true" />

  const left = Math.max(0, data.weekEndsAt - data.now)
  const countdown = [
    [Math.floor(left / 86_400_000), t('admin.unit.days')],
    [Math.floor(left / 3_600_000) % 24, t('admin.unit.hours')],
    [Math.floor(left / 60_000) % 60, t('admin.unit.min')],
  ] as const

  return (
    <>
      <section className={`${styles.season} ${styles.full}`}>
        <div className={styles.seasonText}>
          <span className={styles.seasonKicker}>{t('admin.season')}</span>
          <span className={styles.seasonWeek}>{t('admin.weekN', { n: data.weekNumber })}</span>
          <span>
            {t('admin.seasonGroups', { count: data.groups.length })} · {t('admin.seasonCloses', { date: date(data.weekEndsAt) })}
          </span>
        </div>
        <div className={styles.countdown}>
          {countdown.map(([value, unit], i) => (
            <div key={unit}>
              <b>{i === 0 ? value : String(value).padStart(2, '0')}</b>
              <span>{unit}</span>
            </div>
          ))}
        </div>
      </section>

      <section className={`card ${styles.block}`}>
        <h2 className="label">{t('admin.leagueGroups')}</h2>
        {data.groups.length === 0 && <p className="muted">{t('admin.nobody')}</p>}
        <ol className={styles.top}>
          {data.groups.map((group, i) => (
            <li key={group.id}>
              <span className={styles.place}>{i + 1}</span>
              <span className={styles.userName}>
                <b className={styles.ellipsis}>{group.nombre}</b>
                <small className={styles.ellipsis}>
                  {t('admin.members', { count: group.members })}
                  {group.leader?.nombre ? ` · ${t('admin.leads', { name: group.leader.nombre })}` : ''}
                </small>
              </span>
              <b>{t('admin.handsCount', { count: group.hands, n: number(group.hands) })}</b>
            </li>
          ))}
        </ol>
      </section>

      <Challenges />
    </>
  )
}
