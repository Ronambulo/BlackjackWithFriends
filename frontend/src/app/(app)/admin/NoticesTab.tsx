'use client'

import { useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { date, number } from '@/admin/format'
import {
  useAdminNotices,
  useDeleteCampaign,
  useEndNotice,
  usePostCampaign,
  usePostNotice,
  type AdminNotices,
} from '@/admin/useAdmin'
import type { Audience } from '@/push/device'
import { MegaphoneIcon } from '@/ui/icons'
import styles from './admin.module.css'

const AUDIENCES: Audience[] = ['all', 'ios', 'android', 'desktop', 'pwa', 'browser', 'push', 'noPush']

// How long a notice stays up, in hours (null: until an admin takes it down).
const NOTICE_HOURS = [
  ['day', 24],
  ['week', 24 * 7],
  ['none', null],
] as const

/** `ms` as a datetime-local value, in this computer's time. */
function localInput(ms: number) {
  const at = new Date(ms - new Date(ms).getTimezoneOffset() * 60_000)
  return at.toISOString().slice(0, 16)
}

/** Now, or a moment picked on a datetime-local; undefined when it's for now. */
function When({ value, onChange }: { value: string | null; onChange: (value: string | null) => void }) {
  const { t } = useTranslation()
  return (
    <label className={styles.formField}>
      {t('admin.when')}
      <select
        className={styles.fieldInput}
        value={value === null ? 'now' : 'later'}
        onChange={(event) => onChange(event.target.value === 'now' ? null : localInput(Date.now() + 60 * 60_000))}
      >
        <option value="now">{t('admin.whenNow')}</option>
        <option value="later">{t('admin.whenLater')}</option>
      </select>
      {value !== null && (
        <input
          className={styles.fieldInput}
          type="datetime-local"
          value={value}
          min={localInput(Date.now())}
          onChange={(event) => onChange(event.target.value)}
          required
        />
      )}
    </label>
  )
}

const at = (value: string | null) => (value === null ? undefined : new Date(value).getTime())

function Reach({ data }: { data: AdminNotices['audiences'] }) {
  const { t } = useTranslation()
  const tiles = [
    [t('admin.reach.active'), `${number(data.seen)} / ${number(data.users)}`],
    [t('admin.audience.ios'), number(data.byPlatform.ios)],
    [t('admin.audience.android'), number(data.byPlatform.android)],
    [t('admin.audience.desktop'), number(data.byPlatform.desktop)],
    [t('admin.audience.pwa'), number(data.pwa)],
    [t('admin.reach.browserOnly'), number(data.browserOnly)],
    [t('admin.reach.push'), number(data.pushUsers)],
    [t('admin.reach.pushDevices'), number(data.pushDevices)],
  ]
  return (
    <section className={`card ${styles.block}`}>
      <div className={styles.sectionHead}>
        <h2 className="label">{t('admin.reach.title')}</h2>
        <span className={styles.dim}>{t('admin.reach.hint')}</span>
      </div>
      <div className={`${styles.tiles} ${styles.tilesFlat}`}>
        {tiles.map(([label, value]) => (
          <div key={label} className={styles.tile}>
            <span className={styles.tileLabel}>{label}</span>
            <span className={styles.tileValue}>{value}</span>
          </div>
        ))}
      </div>
    </section>
  )
}

function NewNotice() {
  const { t } = useTranslation()
  const publish = usePostNotice()
  const [text, setText] = useState('')
  const [audience, setAudience] = useState<Audience>('all')
  const [start, setStart] = useState<string | null>(null)
  const [hours, setHours] = useState<number | null>(24)

  const submit = (event: FormEvent) => {
    event.preventDefault()
    if (!text.trim()) return
    publish.mutate(
      { texto: text.trim(), audiencia: audience, startsAt: at(start), hours },
      {
        onSuccess: () => {
          setText('')
          setStart(null)
        },
      },
    )
  }

  return (
    <form className={`card ${styles.block}`} onSubmit={submit}>
      <h2 className="label">{t('admin.notice')}</h2>
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
      <div className={styles.formGrid}>
        <label className={styles.formField}>
          {t('admin.audienceLabel')}
          <select className={styles.fieldInput} value={audience} onChange={(event) => setAudience(event.target.value as Audience)}>
            {AUDIENCES.map((key) => (
              <option key={key} value={key}>
                {t(`admin.audience.${key}`)}
              </option>
            ))}
          </select>
        </label>
        <When value={start} onChange={setStart} />
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
      </div>
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
          {start === null ? t('admin.noticePublish') : t('admin.schedule')}
        </button>
      </div>
    </form>
  )
}

function Notices({ data }: { data: AdminNotices }) {
  const { t } = useTranslation()
  const end = useEndNotice()
  return (
    <section className={`card ${styles.block}`}>
      <h2 className="label">{t('admin.noticesTitle')}</h2>
      {data.notices.length === 0 && <p className={styles.emptyBox}>{t('admin.noNotices')}</p>}
      <ul className={styles.banList}>
        {data.notices.map((notice) => {
          const state =
            notice.startsAt > data.now ? 'scheduled' : notice.expiresAt && notice.expiresAt <= data.now ? 'ended' : 'live'
          return (
            <li key={notice.id} className={styles.noticeRow}>
              <span className={styles.sev} data-level={state === 'live' ? undefined : 'off'}>
                {t(`admin.noticeState.${state}`)}
              </span>
              <span className={styles.userName}>
                <b className={styles.wrapText}>{notice.texto}</b>
                <small>
                  {t(`admin.audience.${notice.audiencia}`)} · {date(notice.startsAt)} →{' '}
                  {notice.expiresAt ? date(notice.expiresAt) : t('admin.noticeUntilRemoved')} · {notice.por}
                </small>
                {state !== 'scheduled' && (
                  <small>{t('admin.noticeSeen', { seen: number(notice.seen), closed: number(notice.closed) })}</small>
                )}
              </span>
              {state !== 'ended' && (
                <button
                  className={`btn btn-secondary ${styles.softDanger}`}
                  type="button"
                  disabled={end.isPending}
                  onClick={() => end.mutate({ id: notice.id })}
                >
                  {state === 'scheduled' ? t('common.cancel') : t('admin.noticeRemove')}
                </button>
              )}
            </li>
          )
        })}
      </ul>
    </section>
  )
}

function NewCampaign({ reach }: { reach: Record<Audience, number> }) {
  const { t } = useTranslation()
  const send = usePostCampaign()
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [url, setUrl] = useState('')
  const [audience, setAudience] = useState<Audience>('all')
  const [when, setWhen] = useState<string | null>(null)
  const ready = title.trim() && body.trim()

  const submit = (event: FormEvent) => {
    event.preventDefault()
    if (!ready) return
    if (when === null && !window.confirm(t('admin.campaignConfirm', { count: reach[audience] }))) return
    send.mutate(
      { titulo: title.trim(), cuerpo: body.trim(), url: url.trim() || undefined, audiencia: audience, sendAt: at(when) },
      {
        onSuccess: () => {
          setTitle('')
          setBody('')
          setUrl('')
          setWhen(null)
        },
      },
    )
  }

  return (
    <form className={`card ${styles.block}`} onSubmit={submit}>
      <div className={styles.sectionHead}>
        <h2 className="label">{t('admin.campaign')}</h2>
        <span className={styles.dim}>{t('admin.campaignHint')}</span>
      </div>
      <div className={styles.formGrid}>
        <label className={styles.formField}>
          {t('admin.campaignTitle')}
          <input
            className={styles.fieldInput}
            maxLength={60}
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="Blackjack with Friends"
          />
        </label>
        <label className={styles.formField}>
          {t('admin.campaignUrl')}
          <input
            className={styles.fieldInput}
            maxLength={200}
            value={url}
            onChange={(event) => setUrl(event.target.value)}
            placeholder="/"
            pattern="\/[\w\-\/?=&%.]*"
          />
        </label>
      </div>
      <label className={styles.formField}>
        {t('admin.campaignBody')}
        <textarea
          className={`${styles.fieldInput} ${styles.textarea}`}
          rows={2}
          maxLength={180}
          value={body}
          onChange={(event) => setBody(event.target.value)}
          placeholder={t('admin.campaignPlaceholder')}
        />
      </label>
      <div className={styles.formGrid}>
        <label className={styles.formField}>
          {t('admin.audienceLabel')}
          <select className={styles.fieldInput} value={audience} onChange={(event) => setAudience(event.target.value as Audience)}>
            {AUDIENCES.filter((key) => key !== 'noPush').map((key) => (
              <option key={key} value={key}>
                {t(`admin.audience.${key}`)} · {t('admin.devices', { count: reach[key] })}
              </option>
            ))}
          </select>
        </label>
        <When value={when} onChange={setWhen} />
      </div>
      {ready && (
        <div className={styles.formField}>
          {t('admin.noticeLooks')}
          <div className={styles.pushPreview}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/icon.svg" alt="" width={36} height={36} />
            <span>
              <b>{title.trim()}</b>
              {body.trim()}
            </span>
          </div>
        </div>
      )}
      {send.isError && <p className="error-text">{send.error.message}</p>}
      <div className={styles.formActions}>
        <button className="btn btn-primary" type="submit" disabled={!ready || send.isPending || (when === null && !reach[audience])}>
          {when === null ? t('admin.campaignSend', { count: reach[audience] }) : t('admin.schedule')}
        </button>
      </div>
    </form>
  )
}

function Campaigns({ data }: { data: AdminNotices }) {
  const { t } = useTranslation()
  const remove = useDeleteCampaign()
  return (
    <section className={`card ${styles.block}`}>
      <h2 className="label">{t('admin.campaignsTitle')}</h2>
      {data.campaigns.length === 0 && <p className={styles.emptyBox}>{t('admin.noCampaigns')}</p>}
      <ul className={styles.banList}>
        {data.campaigns.map((campaign) => (
          <li key={campaign.id} className={styles.noticeRow}>
            <span className={styles.sev} data-level={campaign.sentAt ? 'off' : undefined}>
              {campaign.sentAt ? t('admin.campaignSent') : t('admin.campaignScheduled')}
            </span>
            <span className={styles.userName}>
              <b className={styles.wrapText}>{campaign.titulo}</b>
              <span className={styles.wrapText}>{campaign.cuerpo}</span>
              <small>
                {t(`admin.audience.${campaign.audiencia}`)} · {date(campaign.sentAt ?? campaign.sendAt)} · {campaign.url} ·{' '}
                {campaign.por}
              </small>
              {campaign.sentAt && (
                <small>
                  {t('admin.campaignResult', { count: campaign.devices ?? 0 })}
                  {campaign.failed ? ` · ${t('admin.campaignFailed', { count: campaign.failed })}` : ''}
                </small>
              )}
            </span>
            {!campaign.sentAt && (
              <button
                className={`btn btn-secondary ${styles.softDanger}`}
                type="button"
                disabled={remove.isPending}
                onClick={() => remove.mutate({ id: campaign.id })}
              >
                {t('common.cancel')}
              </button>
            )}
          </li>
        ))}
      </ul>
    </section>
  )
}

export function NoticesTab() {
  const { t } = useTranslation()
  const { data, isError, refetch } = useAdminNotices()
  if (isError) {
    return (
      <section className="card">
        <p className="muted">{t('common.error')}</p>
        <button className="btn btn-secondary" type="button" onClick={() => void refetch()}>
          {t('common.retry')}
        </button>
      </section>
    )
  }
  if (!data) return <section className={`card ${styles.placeholder}`} aria-busy="true" />

  return (
    <>
      <Reach data={data.audiences} />
      <NewNotice />
      <Notices data={data} />
      <NewCampaign reach={data.audiences.reach} />
      <Campaigns data={data} />
    </>
  )
}
