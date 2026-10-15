'use client'

import { useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import type { TFunction } from 'i18next'
import {
  useBan,
  useBans,
  useDecideReview,
  useModeration,
  useUnban,
  type ModerationFlag,
  type Review,
} from '@/admin/useAdmin'
import { ago, date } from '@/admin/format'
import { CloseIcon } from '@/ui/icons'
import styles from './admin.module.css'

export function flagTitle(t: TFunction, flag: ModerationFlag) {
  return t(`admin.flag.${flag.kind}`, { count: flag.kind === 'bot' ? Math.round(flag.value / 1000) : flag.value })
}

export function flagText(t: TFunction, flag: ModerationFlag) {
  return `${t(`admin.flagLevel.${flag.level}`)} · ${flag.username ? `@${flag.username}` : flag.ip}`
}

const flagKey = (flag: ModerationFlag) => `${flag.kind}:${flag.userId ?? flag.ip}:${flag.value}`

// Flags an admin waved through, remembered on this device only.
const IGNORED = 'admin.ignoredFlags'

function readIgnored(): string[] {
  try {
    return JSON.parse(localStorage.getItem(IGNORED) ?? '[]') as string[]
  } catch {
    return []
  }
}

/** The options of the "for how long" select, in hours (null: for good). */
const DURATIONS = [
  ['day', 24],
  ['week', 24 * 7],
  ['month', 24 * 30],
  ['forever', null],
] as const

function timeLeft(t: TFunction, expiresAt: number | null, now = Date.now()) {
  if (expiresAt === null) return t('admin.forGood')
  const hours = Math.max(1, Math.round((expiresAt - now) / 3_600_000))
  return hours < 48 ? t('admin.hoursLeft', { count: hours }) : t('admin.daysLeft', { count: Math.round(hours / 24) })
}

function ErrorCard({ onRetry }: { onRetry: () => void }) {
  const { t } = useTranslation()
  return (
    <section className="card">
      <p className="muted">{t('common.error')}</p>
      <button className="btn btn-secondary" onClick={onRetry}>
        {t('common.retry')}
      </button>
    </section>
  )
}

function ReviewCard({ review }: { review: Review }) {
  const { t } = useTranslation()
  const decide = useDecideReview()
  const answer = (ok: boolean) => decide.mutate({ userId: review.userId, tipo: review.tipo, ok })
  return (
    <article className={styles.reviewItem}>
      <div className={styles.reviewPreview} data-kind={review.tipo}>
        {review.tipo === 'foto' ? <img src={review.valor} alt="" /> : <span>«{review.valor}»</span>}
      </div>
      <div className={styles.userName}>
        <b>{t(`admin.reviewKind.${review.tipo}`)}</b>
        <small>
          @{review.username} · {t('admin.agoShort', { time: ago(review.createdAt) })}
        </small>
      </div>
      <div className={styles.pair}>
        <button className={`btn ${styles.softDanger}`} type="button" disabled={decide.isPending} onClick={() => answer(false)}>
          {t('admin.reject')}
        </button>
        <button className="btn btn-primary" type="button" disabled={decide.isPending} onClick={() => answer(true)}>
          {t('admin.approve')}
        </button>
      </div>
    </article>
  )
}

function BanForm({ target, onTarget }: { target: string; onTarget: (value: string) => void }) {
  const { t } = useTranslation()
  const ban = useBan()
  const [hours, setHours] = useState<number | null>(24 * 7)
  const [motivo, setMotivo] = useState('')

  const submit = (event: FormEvent) => {
    event.preventDefault()
    if (!target.trim()) return
    ban.mutate(
      { ip: target.trim(), hours, motivo: motivo.trim() || undefined },
      {
        onSuccess: () => {
          onTarget('')
          setMotivo('')
        },
      },
    )
  }

  return (
    <form id="ban-form" className={styles.banForm} onSubmit={submit}>
      <label className={styles.formField}>
        {t('admin.banTarget')}
        <input
          className={styles.fieldInput}
          value={target}
          onChange={(event) => onTarget(event.target.value)}
          placeholder={t('admin.banTargetHint')}
          maxLength={64}
        />
      </label>
      <label className={`${styles.formField} ${styles.narrowField}`}>
        {t('admin.banFor')}
        <select
          className={styles.fieldInput}
          value={hours ?? 'forever'}
          onChange={(event) => setHours(event.target.value === 'forever' ? null : Number(event.target.value))}
        >
          {DURATIONS.map(([key, value]) => (
            <option key={key} value={value ?? 'forever'}>
              {t(`admin.duration.${key}`)}
            </option>
          ))}
        </select>
      </label>
      <label className={`${styles.formField} ${styles.fullField}`}>
        {t('admin.banReason')}
        <input
          className={styles.fieldInput}
          value={motivo}
          onChange={(event) => setMotivo(event.target.value)}
          placeholder={t('admin.banReasonHint')}
          maxLength={200}
        />
      </label>
      {ban.isError && <p className="error-text">{ban.error.message}</p>}
      <button className="btn btn-danger" type="submit" disabled={ban.isPending || !target.trim()}>
        {t('admin.banIp')}
      </button>
    </form>
  )
}

export function ModerationTab() {
  const { t } = useTranslation()
  const { data, isError, refetch } = useModeration()
  const bans = useBans()
  const unban = useUnban()
  const [ignored, setIgnored] = useState(readIgnored)
  const [target, setTarget] = useState('')

  if (isError) return <ErrorCard onRetry={() => void refetch()} />
  if (!data) return <section className={`card ${styles.placeholder}`} aria-busy="true" />

  const ignore = (flag: ModerationFlag) => {
    const next = [...ignored, flagKey(flag)].slice(-200)
    setIgnored(next)
    try {
      localStorage.setItem(IGNORED, JSON.stringify(next))
    } catch {
      // Private mode: it just comes back on the next visit.
    }
  }
  const pick = (value: string) => {
    setTarget(value)
    document.getElementById('ban-form')?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }
  const flags = data.flags.filter((flag) => !ignored.includes(flagKey(flag)))

  return (
    <>
      <section className={`card ${styles.block} ${styles.full}`}>
        <div className={styles.sectionHead}>
          <h2 className="label">{t('admin.reviewQueue', { count: data.reviews.length })}</h2>
          <span className={styles.dim}>{t('admin.reviewHint')}</span>
        </div>
        {data.reviews.length === 0 ? (
          <p className={styles.emptyBox}>{t('admin.reviewEmpty')}</p>
        ) : (
          <div className={styles.reviewGrid}>
            {data.reviews.map((review) => (
              <ReviewCard key={`${review.userId}:${review.tipo}`} review={review} />
            ))}
          </div>
        )}
      </section>

      <section className={`card ${styles.block} ${styles.full}`}>
        <h2 className="label">{t('admin.flags')}</h2>
        {flags.length === 0 && <p className={styles.emptyBox}>{t('admin.noFlags')}</p>}
        {flags.map((flag) => (
          <div key={flagKey(flag)} className={styles.flagRow}>
            <span className={styles.sev} data-level={flag.level}>
              {t(`admin.flagLevel.${flag.level}`)}
            </span>
            <div className={styles.flagBody}>
              <b>
                {flagTitle(t, flag)} · {flag.username ? `@${flag.username}` : flag.ip}
              </b>
              <span className={styles.dim}>{t(`admin.flagHelp.${flag.kind}`)}</span>
            </div>
            <div className={styles.flagActions}>
              <button
                className="btn btn-secondary"
                type="button"
                onClick={() => pick(flag.username ? `@${flag.username}` : (flag.ip ?? ''))}
              >
                {t('admin.banEllipsis')}
              </button>
              <button className="btn btn-ghost" type="button" onClick={() => ignore(flag)}>
                {t('admin.ignore')}
              </button>
            </div>
          </div>
        ))}
      </section>

      <section className={`card ${styles.block}`}>
        <h2 className="label">{t('admin.clusters')}</h2>
        {data.clusters.length === 0 && <p className="muted">{t('admin.noClusters')}</p>}
        {data.clusters.map((cluster) => (
          <div key={cluster.ip} className={styles.cluster}>
            <div className={styles.clusterHead}>
              <button className={styles.link} type="button" onClick={() => pick(cluster.ip)}>
                {cluster.ip}
              </button>
              <span className={styles.dim}>
                {t('admin.clusterNote', { count: cluster.users.length, date: date(cluster.since) })}
              </span>
            </div>
            <div className={styles.pills}>
              {cluster.users.map((u) => (
                <span key={u.id}>@{u.username}</span>
              ))}
            </div>
          </div>
        ))}
        <p className={styles.dim}>{t('admin.clusterHint')}</p>
      </section>

      <section className={`card ${styles.block}`}>
        <h2 className="label">{t('admin.bansTitle')}</h2>
        <BanForm target={target} onTarget={setTarget} />
        {bans.data?.length === 0 && <p className="muted">{t('admin.noBans')}</p>}
        <ul className={styles.banList}>
          {bans.data?.map((item) => (
            <li key={item.ip}>
              <span className={styles.userName}>
                <b className={styles.ellipsis}>{item.ip}</b>
                <small className={styles.ellipsis}>
                  {[item.motivo ?? t('admin.noReason'), item.por ? t('admin.byAdmin', { name: item.por }) : null]
                    .filter(Boolean)
                    .join(' · ')}
                </small>
              </span>
              <span className={styles.left} data-warn={item.expiresAt !== null}>
                {timeLeft(t, item.expiresAt)}
              </span>
              <button
                className={`btn ${styles.iconButton}`}
                type="button"
                aria-label={t('admin.unbanTarget', { target: item.ip })}
                disabled={unban.isPending}
                onClick={() => unban.mutate({ ip: item.ip })}
              >
                <CloseIcon width={18} height={18} />
              </button>
            </li>
          ))}
        </ul>
      </section>
    </>
  )
}
