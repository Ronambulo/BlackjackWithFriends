'use client'

import { useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { date, number, percent } from '@/admin/format'
import { useAdminPolls, useClosePoll, useDeletePoll, usePostPoll, type AdminPoll } from '@/admin/useAdmin'
import styles from './admin.module.css'

const OPTIONS_MAX = 6
// Ready-made questions about the rules; they fill the form and can still be changed.
const TEMPLATES = ['betLimit', 'dailyPay', 'startBalance', 'ranking'] as const

// How long answers are taken, in hours (null: until an admin closes it).
const POLL_HOURS = [
  ['day', 24],
  ['three', 72],
  ['week', 24 * 7],
  ['none', null],
] as const

function NewPoll() {
  const { t } = useTranslation()
  const publish = usePostPoll()
  const [question, setQuestion] = useState('')
  const [options, setOptions] = useState(['', ''])
  const [hours, setHours] = useState<number | null>(72)
  const [push, setPush] = useState(false)
  const filled = options.map((option) => option.trim()).filter(Boolean)
  const ready = question.trim() && filled.length >= 2 && new Set(filled).size === filled.length

  const applyTemplate = (key: (typeof TEMPLATES)[number]) => {
    setQuestion(t(`admin.pollTemplate.${key}.q`))
    setOptions(t(`admin.pollTemplate.${key}.options`, { returnObjects: true }) as string[])
  }

  const submit = (event: FormEvent) => {
    event.preventDefault()
    if (!ready) return
    publish.mutate(
      { pregunta: question.trim(), opciones: filled, hours, push, pushTitle: t('admin.pollPushTitle') },
      {
        onSuccess: () => {
          setQuestion('')
          setOptions(['', ''])
          setPush(false)
        },
      },
    )
  }

  return (
    <form className={`card ${styles.block} ${styles.span2}`} onSubmit={submit}>
      <div className={styles.sectionHead}>
        <h2 className="label">{t('admin.pollNew')}</h2>
        <span className={styles.dim}>{t('admin.pollHint')}</span>
      </div>
      <div className={styles.templates}>
        {TEMPLATES.map((key) => (
          <button key={key} className="btn btn-secondary" type="button" onClick={() => applyTemplate(key)}>
            {t(`admin.pollTemplate.${key}.label`)}
          </button>
        ))}
      </div>
      <label className={styles.formField}>
        {t('admin.pollQuestion')}
        <input
          className={styles.fieldInput}
          maxLength={140}
          value={question}
          onChange={(event) => setQuestion(event.target.value)}
          placeholder={t('admin.pollQuestionPlaceholder')}
        />
      </label>
      <div className={styles.formField}>
        {t('admin.pollOptions')}
        {options.map((option, i) => (
          <div key={i} className={styles.optionRow}>
            <input
              className={styles.fieldInput}
              maxLength={60}
              value={option}
              onChange={(event) => setOptions(options.map((value, j) => (j === i ? event.target.value : value)))}
              placeholder={t('admin.pollOption', { n: i + 1 })}
              aria-label={t('admin.pollOption', { n: i + 1 })}
            />
            <button
              className={`btn btn-secondary ${styles.softDanger}`}
              type="button"
              disabled={options.length <= 2}
              onClick={() => setOptions(options.filter((_, j) => j !== i))}
              aria-label={t('admin.pollRemoveOption')}
            >
              ×
            </button>
          </div>
        ))}
        {options.length < OPTIONS_MAX && (
          <button className="btn btn-secondary" type="button" onClick={() => setOptions([...options, ''])}>
            {t('admin.pollAddOption')}
          </button>
        )}
      </div>
      <div className={styles.formGrid}>
        <label className={styles.formField}>
          {t('admin.pollOpenFor')}
          <select
            className={styles.fieldInput}
            value={hours ?? 'none'}
            onChange={(event) => setHours(event.target.value === 'none' ? null : Number(event.target.value))}
          >
            {POLL_HOURS.map(([key, value]) => (
              <option key={key} value={value ?? 'none'}>
                {t(`admin.pollFor.${key}`)}
              </option>
            ))}
          </select>
        </label>
      </div>
      <label className={styles.checkRow}>
        <input type="checkbox" checked={push} onChange={(event) => setPush(event.target.checked)} />
        {t('admin.pollPush')}
      </label>
      {publish.isError && <p className="error-text">{publish.error.message}</p>}
      <div className={styles.formActions}>
        <button className="btn btn-primary" type="submit" disabled={!ready || publish.isPending}>
          {t('admin.pollPublish')}
        </button>
      </div>
    </form>
  )
}

function PollResults({ poll, now, players }: { poll: AdminPoll; now: number; players: number }) {
  const { t } = useTranslation()
  const close = useClosePoll()
  const remove = useDeletePoll()
  const open = poll.endsAt === null || poll.endsAt > now
  const top = Math.max(...poll.votes)

  return (
    <section className={`card ${styles.block}`}>
      <div className={styles.sectionHead}>
        <span className={styles.sev} data-level={open ? undefined : 'off'}>
          {open ? t('admin.pollOpen') : t('admin.pollClosed')}
        </span>
        <span className={styles.dim}>
          {date(poll.createdAt)} · {poll.por}
          {poll.endsAt ? ` · ${open ? t('admin.pollEnds', { date: date(poll.endsAt) }) : date(poll.endsAt)}` : ''}
        </span>
      </div>
      <h3 className={styles.wrapText}>{poll.pregunta}</h3>
      <ul className={styles.pollResults}>
        {poll.opciones.map((option, i) => (
          <li key={i} data-top={poll.total > 0 && poll.votes[i] === top}>
            <span className={styles.wrapText}>{option}</span>
            <span className={styles.meter}>
              <span style={{ width: `${poll.total ? (poll.votes[i] / poll.total) * 100 : 0}%` }} />
            </span>
            <b>
              {number(poll.votes[i])} · {percent(poll.total ? poll.votes[i] / poll.total : 0)}
            </b>
          </li>
        ))}
      </ul>
      <span className={styles.dim}>
        {t('admin.pollTurnout', {
          count: poll.total,
          n: number(poll.total),
          players: number(players),
          share: percent(players ? poll.total / players : null),
        })}
      </span>
      <div className={styles.formActions}>
        {open && (
          <button className="btn btn-secondary" type="button" disabled={close.isPending} onClick={() => close.mutate({ id: poll.id })}>
            {t('admin.pollClose')}
          </button>
        )}
        <button
          className={`btn btn-secondary ${styles.softDanger}`}
          type="button"
          disabled={remove.isPending}
          onClick={() => {
            if (window.confirm(t('admin.pollDeleteConfirm'))) remove.mutate({ id: poll.id })
          }}
        >
          {t('admin.pollDelete')}
        </button>
      </div>
    </section>
  )
}

export function PollsTab() {
  const { t } = useTranslation()
  const { data, isError, refetch } = useAdminPolls()
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
      <NewPoll />
      {data.polls.length === 0 && (
        <section className="card">
          <p className={styles.emptyBox}>{t('admin.noPolls')}</p>
        </section>
      )}
      {data.polls.map((poll) => (
        <PollResults key={poll.id} poll={poll} now={data.now} players={data.players} />
      ))}
    </>
  )
}
