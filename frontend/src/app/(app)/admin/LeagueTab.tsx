'use client'

import { useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { useAdminLeague, useAdminSettings, useSetAnnouncement } from '@/admin/useAdmin'
import { date, number } from '@/admin/format'
import { MegaphoneIcon } from '@/ui/icons'
import styles from './admin.module.css'

/** ISO week number of the Monday `day` (YYYY-MM-DD). */
function isoWeek(day: string) {
  const monday = new Date(`${day}T12:00:00Z`)
  const thursday = new Date(monday.getTime() + 3 * 86_400_000)
  const firstThursday = new Date(Date.UTC(thursday.getUTCFullYear(), 0, 4))
  return 1 + Math.round((thursday.getTime() - firstThursday.getTime()) / (7 * 86_400_000))
}

// How long a notice stays up, in hours (null: until an admin takes it down).
const NOTICE_HOURS = [
  ['day', 24],
  ['week', 24 * 7],
  ['none', null],
] as const

function Announcement() {
  const { t } = useTranslation()
  const { data } = useAdminSettings()
  const publish = useSetAnnouncement()
  const [text, setText] = useState('')
  const [hours, setHours] = useState<number | null>(24)
  const current = data?.announcement ?? null

  const submit = (event: FormEvent) => {
    event.preventDefault()
    if (text.trim()) publish.mutate({ text: text.trim(), hours }, { onSuccess: () => setText('') })
  }

  return (
    <form className={`card ${styles.block}`} onSubmit={submit}>
      <h2 className="label">{t('admin.notice')}</h2>
      {current && (
        <div className={styles.noticeLive}>
          <span className={styles.dim}>
            {t('admin.noticeLive', {
              by: current.by,
              until: current.expiresAt ? date(current.expiresAt) : t('admin.noticeUntilRemoved'),
            })}
          </span>
          <div className={styles.noticePreview}>
            <MegaphoneIcon width={18} height={18} />
            <span>{current.text}</span>
          </div>
          <button
            className={`btn ${styles.softDanger}`}
            type="button"
            disabled={publish.isPending}
            onClick={() => publish.mutate({ text: '' })}
          >
            {t('admin.noticeRemove')}
          </button>
        </div>
      )}
      <label className={styles.formField}>
        {t('admin.noticeMessage')}
        <textarea
          className={`${styles.fieldInput} ${styles.textarea}`}
          rows={3}
          maxLength={280}
          value={text}
          onChange={(event) => setText(event.target.value)}
          placeholder={t('admin.noticePlaceholder')}
        />
      </label>
      <label className={styles.formField}>
        {t('admin.noticeUntil')}
        <select
          className={styles.fieldInput}
          value={hours ?? 'none'}
          onChange={(event) => setHours(event.target.value === 'none' ? null : Number(event.target.value))}
        >
          {NOTICE_HOURS.map(([key, value]) => (
            <option key={key} value={value ?? 'none'}>
              {t(`admin.noticeFor.${key}`)}
            </option>
          ))}
        </select>
      </label>
      {text.trim() && (
        <div className={styles.formField}>
          {t('admin.noticeLooks')}
          <div className={styles.noticePreview}>
            <MegaphoneIcon width={18} height={18} />
            <span>{text.trim()}</span>
          </div>
        </div>
      )}
      {publish.isError && <p className="error-text">{publish.error.message}</p>}
      <div className={styles.formActions}>
        <button className="btn btn-primary" type="submit" disabled={!text.trim() || publish.isPending}>
          {current ? t('admin.noticeReplace') : t('admin.noticePublish')}
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
          <span className={styles.seasonWeek}>{t('admin.weekN', { n: isoWeek(data.weekStart) })}</span>
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

      <Announcement />

      <section className={`card ${styles.block} ${styles.full}`}>
        <div className={styles.sectionHead}>
          <h2 className="label">{t('admin.comingSoon')}</h2>
          <span className={styles.dim}>{t('admin.comingSoonHint')}</span>
        </div>
        <div className={styles.soonGrid}>
          {(['challenges', 'shop'] as const).map((key) => (
            <article key={key} className={styles.soon}>
              <b>{t(`admin.soon.${key}.title`)}</b>
              <span className={styles.dim}>{t(`admin.soon.${key}.text`)}</span>
            </article>
          ))}
        </div>
      </section>
    </>
  )
}
