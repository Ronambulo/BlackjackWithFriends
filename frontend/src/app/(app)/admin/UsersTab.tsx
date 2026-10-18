'use client'

import { useDeferredValue, useEffect, useRef, useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { date, ago, duration, number } from '@/admin/format'
import {
  can,
  useAdjustUser,
  useAdminUsers,
  useBan,
  useDeleteUser,
  useRenameUser,
  useUserDetail,
  type AdjustmentKind,
  type AdminUser,
  type Segment,
  type UserDetail,
} from '@/admin/useAdmin'
import {
  useCloseSessions,
  useDeleteNote,
  usePlayerView,
  usePostNote,
  usePostSegment,
  usePushUser,
  useRemoveAvatar,
  useSegments,
  useSetMarks,
} from '@/admin/useAdminTools'
import { currentLanguage } from '@/i18n'
import { ApiError } from '@/lib/api'
import { formatNumber } from '@/lib/format'
import { Avatar } from '@/ui/Avatar'
import { ConfirmSheet } from '@/ui/ConfirmSheet'
import { ChevronLeftIcon, CloseIcon, PhoneIcon, SearchIcon } from '@/ui/icons'
import { Modal } from '@/ui/Modal'
import styles from './admin.module.css'
import { useAdminPanel, type Focus } from './context'
import { useMasonry } from './masonry'
import { SignedAmount, signedAmount, type Sign } from './SignedAmount'
import ui from './tools.module.css'

const DAY = 24 * 60 * 60 * 1000
const SEGMENTS: Segment[] = ['new', 'risk', 'broke', 'whales']
type Sort = 'seen' | 'balance' | 'hands' | 'joined'
const SORTS: Sort[] = ['seen', 'balance', 'hands', 'joined']
/** Tags any admin puts with one tap; others can be typed. */
const QUICK_TAGS = ['VIGILAR', 'VIP', 'AMIGO']
const SILENCE_HOURS = [1, 24, 168]

const SORT_VALUE: Record<Sort, (user: AdminUser) => number> = {
  seen: (user) => user.lastSeen ?? 0,
  balance: (user) => user.balance ?? -1,
  hands: (user) => user.hands,
  joined: (user) => user.createdAt,
}

/** The tags the panel shows on a player: their own, and the ones that follow from their account. */
function tagsOf(user: AdminUser, now: number) {
  const tags: string[] = []
  if (user.admin) tags.push('ADMIN')
  if (user.banned) tags.push('BLOQUEADO')
  if (user.silenced) tags.push('SILENCIADO')
  if (now - user.createdAt <= 7 * DAY) tags.push('NUEVA')
  return [...tags, ...user.etiquetas.filter((tag) => !tags.includes(tag))]
}

function Tags({ user, now }: { user: AdminUser; now: number }) {
  const tags = tagsOf(user, now)
  if (!tags.length) return null
  return (
    <span className={ui.tagRow}>
      {tags.map((tag) => (
        <span key={tag} className={ui.tagChip} data-tag={tag}>
          {tag}
        </span>
      ))}
    </span>
  )
}

/** Desktop has room for the table and the card side by side; a phone goes list → card. */
function useWide() {
  const [wide, setWide] = useState(false)
  useEffect(() => {
    const query = window.matchMedia('(min-width: 900px)')
    const update = () => setWide(query.matches)
    update()
    query.addEventListener('change', update)
    return () => query.removeEventListener('change', update)
  }, [])
  return wide
}

/** "Chrome · Windows" out of a user agent, as far as it's worth guessing. */
function device(agent: string | null) {
  if (!agent) return '—'
  const browser = /Edg\//.test(agent) ? 'Edge' : /Firefox\//.test(agent) ? 'Firefox' : /Chrome\//.test(agent) ? 'Chrome' : /Safari\//.test(agent) ? 'Safari' : '?'
  const system = /Android/.test(agent) ? 'Android' : /iPhone|iPad/.test(agent) ? 'iOS' : /Windows/.test(agent) ? 'Windows' : /Mac OS/.test(agent) ? 'macOS' : /Linux/.test(agent) ? 'Linux' : '?'
  return `${browser} · ${system}`
}

/** The player's name and username, as an admin may put them right. */
function EditNames({ user }: { user: AdminUser }) {
  const { t } = useTranslation()
  const rename = useRenameUser()
  const [nombre, setNombre] = useState(user.nombre ?? '')
  const [username, setUsername] = useState(user.username)
  const nombreChanged = nombre.trim() !== (user.nombre ?? '')
  const usernameChanged = username.trim().replace(/^@/, '') !== user.username
  const valid = nombre.trim().length >= 2 && /^@?[a-zA-Z0-9_.]{3,20}$/.test(username.trim())

  function onSubmit(event: FormEvent) {
    event.preventDefault()
    if (!valid || (!nombreChanged && !usernameChanged)) return
    rename.mutate({
      id: user.id,
      ...(nombreChanged && { nombre: nombre.trim() }),
      ...(usernameChanged && { username: username.trim().replace(/^@/, '') }),
    })
  }

  const error =
    rename.error instanceof ApiError && rename.error.status === 409
      ? t('settings.usernameTaken')
      : rename.error instanceof ApiError && rename.error.status === 403
        ? t('settings.usernameLocked')
        : t('common.error')

  return (
    <form className={styles.block} onSubmit={onSubmit}>
      <h2 className="label">{t('admin.editNames')}</h2>
      <div className={styles.editNames}>
        <label className="field">
          <span className="field-label">{t('settings.name')}</span>
          <input className="input" maxLength={20} value={nombre} onChange={(e) => { setNombre(e.target.value); rename.reset() }} />
        </label>
        <label className="field">
          <span className="field-label">{t('settings.username')}</span>
          <input
            className="input"
            autoCapitalize="none"
            spellCheck={false}
            maxLength={21}
            value={username}
            onChange={(e) => { setUsername(e.target.value); rename.reset() }}
          />
        </label>
        <button className="btn btn-secondary" type="submit" disabled={!valid || (!nombreChanged && !usernameChanged) || rename.isPending}>
          {rename.isPending ? t('common.saving') : rename.isSuccess ? t('common.saved') : t('common.save')}
        </button>
      </div>
      {rename.isError && <p className="error-text">{error}</p>}
    </form>
  )
}

/** Adds or takes away chips (this week) or coins by hand, with the reason written down. */
function Adjust({ user, history }: { user: AdminUser; history: UserDetail['adjustments'] | undefined }) {
  const { t } = useTranslation()
  const adjust = useAdjustUser()
  const [tipo, setTipo] = useState<AdjustmentKind>('monedas')
  const [sign, setSign] = useState<Sign>(1)
  const [amount, setAmount] = useState('')
  const [motivo, setMotivo] = useState('')
  const cantidad = signedAmount(sign, amount)
  const current = tipo === 'saldo' ? user.balance : user.monedas
  // The server refuses to leave anyone below zero; say so before trying.
  const negative = current !== null && current + cantidad < 0
  const valid = cantidad !== 0 && Math.abs(cantidad) <= 1_000_000 && !negative && motivo.trim().length >= 3

  function onSubmit(event: FormEvent) {
    event.preventDefault()
    if (!valid) return
    adjust.mutate(
      { id: user.id, tipo, cantidad, motivo: motivo.trim() },
      {
        onSuccess: () => {
          setAmount('')
          setMotivo('')
        },
      },
    )
  }

  const reset = () => adjust.reset()
  const error =
    adjust.error instanceof ApiError && adjust.error.status === 400 && adjust.error.message === 'Se quedaría en negativo'
      ? t('admin.adjust.negative')
      : adjust.error instanceof Error && adjust.error.message
        ? adjust.error.message
        : t('common.error')

  return (
    <form className={styles.block} onSubmit={onSubmit}>
      <div className={styles.chips}>
        {(['monedas', 'saldo'] as const).map((kind) => (
          <button
            key={kind}
            type="button"
            aria-pressed={tipo === kind}
            onClick={() => {
              setTipo(kind)
              reset()
            }}
          >
            {t(`admin.adjust.${kind}`)}
          </button>
        ))}
      </div>
      <div className={styles.adjust}>
        <SignedAmount
          sign={sign}
          digits={amount}
          onSign={(value) => {
            setSign(value)
            reset()
          }}
          onDigits={(value) => {
            setAmount(value)
            reset()
          }}
        />
        <label className="field">
          <span className="field-label">{t('admin.adjust.reason')}</span>
          <input
            className="input"
            maxLength={200}
            placeholder={t('admin.adjust.reasonHint')}
            value={motivo}
            onChange={(e) => {
              setMotivo(e.target.value)
              reset()
            }}
          />
        </label>
        <button className="btn btn-primary" type="submit" disabled={!valid || adjust.isPending}>
          {adjust.isPending ? t('common.saving') : adjust.isSuccess ? t('common.saved') : t('admin.adjust.apply')}
        </button>
      </div>
      {negative ? (
        <p className="error-text">{t('admin.adjust.negative')}</p>
      ) : (
        <p className={styles.dim}>
          {current !== null && cantidad !== 0
            ? t('admin.adjust.preview', { from: number(current), to: number(current + cantidad) })
            : tipo === 'saldo'
              ? t('admin.adjust.saldoHint')
              : t('admin.adjust.monedasHint')}
        </p>
      )}
      {adjust.isError && !negative && <p className="error-text">{error}</p>}
      {!!history?.length && (
        <ul className={styles.bans}>
          {history.map((item) => (
            <li key={item.id} className={styles.adjustRow}>
              <b className={item.cantidad > 0 ? styles.up : styles.down}>
                {item.cantidad > 0 ? '+' : ''}
                {number(item.cantidad)} {t(`admin.adjust.unit.${item.tipo}`)}
              </b>
              <span className={styles.userName}>
                <span>{item.motivo}</span>
                <small className="muted">
                  {date(item.createdAt)} · {item.por}
                </small>
              </span>
            </li>
          ))}
        </ul>
      )}
    </form>
  )
}

/** A notification to one player's phone. */
function Push({ user, onClose }: { user: AdminUser; onClose: () => void }) {
  const { t } = useTranslation()
  const push = usePushUser()
  const [titulo, setTitulo] = useState('')
  const [cuerpo, setCuerpo] = useState('')
  const valid = titulo.trim().length >= 2 && cuerpo.trim().length >= 2
  return (
    <Modal title={t('panel.user.pushTitle', { name: user.username })} onClose={onClose}>
      <form
        className={styles.block}
        onSubmit={(event) => {
          event.preventDefault()
          if (valid) push.mutate({ userId: user.id, titulo: titulo.trim(), cuerpo: cuerpo.trim() })
        }}
      >
        <label className="field">
          <span className="field-label">{t('panel.user.pushHeading')}</span>
          <input className="input" maxLength={60} value={titulo} onChange={(e) => { setTitulo(e.target.value); push.reset() }} />
        </label>
        <label className="field">
          <span className="field-label">{t('panel.user.pushBody')}</span>
          <textarea className="input" rows={3} maxLength={180} value={cuerpo} onChange={(e) => { setCuerpo(e.target.value); push.reset() }} />
        </label>
        <div className={ui.pushMock}>
          <b>{titulo || t('panel.user.pushHeading')}</b>
          <span>{cuerpo || '…'}</span>
        </div>
        {push.isError && <p className="error-text">{push.error instanceof Error && push.error.message ? push.error.message : t('common.error')}</p>}
        {push.isSuccess && <p className={styles.up}>{t('panel.user.pushSent')}</p>}
        <button className="btn btn-primary" type="submit" disabled={!valid || push.isPending || push.isSuccess}>
          {push.isPending ? t('common.sending') : t('panel.user.pushSend')}
        </button>
      </form>
    </Modal>
  )
}

/** The app as the player sees it, without being able to touch anything. */
function ViewAs({ user, onClose }: { user: AdminUser; onClose: () => void }) {
  const { t } = useTranslation()
  const { data, isError } = usePlayerView(user.id)
  return (
    <div className={ui.viewAs} role="dialog" aria-modal="true" aria-label={t('panel.user.viewing', { name: user.username })}>
      <div className={ui.viewBanner}>
        <span>{t('panel.user.viewing', { name: user.username })}</span>
        <button type="button" className="btn btn-sm btn-secondary" onClick={onClose}>
          {t('panel.user.exit')}
        </button>
      </div>
      <div className={ui.viewBody}>
        {isError && <p className="error-text">{t('common.error')}</p>}
        {!data ? (
          !isError && <p className={styles.dim}>{t('common.loading')}</p>
        ) : (
          <>
            <header className={ui.viewHead}>
              <Avatar seed={user.id} name={data.nombre ?? data.username} src={data.avatarUrl} size={56} />
              <span className={ui.grow}>
                <b>{data.nombre ?? data.username}</b>
                <small className={styles.dim}>@{data.username}</small>
              </span>
            </header>
            <div className={`card ${styles.tiles}`}>
              <div className={styles.tile}>
                <span className={styles.tileLabel}>{t('admin.fact.balance')}</span>
                <span className={styles.tileValue}>{number(data.saldo)}</span>
              </div>
              <div className={styles.tile}>
                <span className={styles.tileLabel}>{t('admin.fact.coins')}</span>
                <span className={styles.tileValue}>{number(data.monedas)}</span>
              </div>
              <div className={styles.tile}>
                <span className={styles.tileLabel}>{t('panel.user.view.shop')}</span>
                <span className={styles.tileValue}>
                  {data.shop.owned}/{data.shop.total}
                </span>
              </div>
              <div className={styles.tile}>
                <span className={styles.tileLabel}>{t('panel.user.view.achievements')}</span>
                <span className={styles.tileValue}>
                  {data.achievements.unlocked}/{data.achievements.total}
                </span>
              </div>
            </div>
            <section className={`card ${styles.block}`}>
              <h2 className="label">{t('challenges.title')}</h2>
              {data.challenges.length === 0 ? (
                <p className={styles.dim}>—</p>
              ) : (
                <ul className={styles.stack}>
                  {data.challenges.map((c) => (
                    <li key={c.id}>
                      <span className={styles.stackHead}>
                        <span>
                          {c.done ? '✓ ' : ''}
                          {t(`challenges.items.${c.id}`, { count: c.target, amount: number(c.target) })}
                        </span>
                        <span className={styles.dim}>
                          {number(Math.min(c.progress, c.target))}/{number(c.target)} · {t('challenges.reward', { count: c.coins })}
                        </span>
                      </span>
                      <span className={styles.meter}>
                        <span style={{ width: `${Math.min(1, c.progress / Math.max(1, c.target)) * 100}%` }} />
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </section>
            <section className={`card ${styles.block}`}>
              <h2 className="label">{t('admin.fact.groups')}</h2>
              {data.groups.length === 0 ? (
                <p className={styles.dim}>—</p>
              ) : (
                <div className={styles.pills}>
                  {data.groups.map((g) => (
                    <span key={g.id}>
                      {g.nombre} · {g.members}
                    </span>
                  ))}
                </div>
              )}
              <p className={styles.dim}>
                {data.daily
                  ? data.daily.done
                    ? t('panel.user.view.dailyDone', { n: number(data.daily.fichas) })
                    : t('panel.user.view.dailyPending')
                  : t('panel.user.view.noDaily')}
                {data.payPending ? ` · ${t('panel.user.view.payPending')}` : ''}
              </p>
            </section>
          </>
        )}
      </div>
    </div>
  )
}

/** Two weeks of chips won or lost, added up day by day, with the worst day marked. */
function NetChart({ chart }: { chart: UserDetail['chart'] }) {
  const { t } = useTranslation()
  const language = currentLanguage()
  const day = new Intl.DateTimeFormat(language, { day: 'numeric', month: 'short' })
  let sum = 0
  const totals = [0, ...chart.map((d) => (sum += d.net))]
  const top = Math.max(0, ...totals)
  const span = Math.max(1, top - Math.min(0, ...totals))
  const x = (i: number) => (i / Math.max(1, totals.length - 1)) * 100
  const flat = totals.every((v) => v === 0)
  const y = (v: number) => (flat ? 50 : 6 + ((top - v) / span) * 88)
  const worst = chart.reduce<number | null>((w, d, i) => (d.net < 0 && (w === null || d.net < chart[w].net) ? i : w), null)
  return (
    <>
      <div className={ui.netChart} role="img" aria-label={t('panel.user.chart')}>
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
          <line x1="0" x2="100" y1={y(0)} y2={y(0)} />
          <polyline points={totals.map((v, i) => `${x(i)},${y(v)}`).join(' ')} />
        </svg>
        {worst !== null && <i style={{ left: `${x(worst + 1)}%`, top: `${y(totals[worst + 1])}%` }} />}
      </div>
      {worst !== null && (
        <p className={ui.netWorst}>
          {day.format(new Date(`${chart[worst].day}T12:00:00`))}: {number(chart[worst].net)} ·{' '}
          {t('admin.handsCount', { count: chart[worst].hands, n: number(chart[worst].hands) })}
        </p>
      )}
    </>
  )
}

function Player({ user, onBack, onBan, onDelete }: { user: AdminUser; onBack?: () => void; onBan: () => void; onDelete: () => void }) {
  const { t } = useTranslation()
  const { role, openUser } = useAdminPanel()
  const { data, isError } = useUserDetail(user.id)
  const marks = useSetMarks()
  const postNote = usePostNote()
  const deleteNote = useDeleteNote()
  const closeSessions = useCloseSessions()
  const removeAvatar = useRemoveAvatar()
  const [modal, setModal] = useState<'adjust' | 'push' | 'view' | null>(null)
  const [more, setMore] = useState(false)
  const [silencing, setSilencing] = useState(false)
  const [allHistory, setAllHistory] = useState(false)
  const [note, setNote] = useState('')
  const [newTag, setNewTag] = useState('')
  const [done, setDone] = useState<string | null>(null)
  const wall = useRef<HTMLDivElement>(null)
  useMasonry(wall, !!data)
  const language = currentLanguage()
  const now = Date.now()
  const mod = can(role, 'moderador')
  const owner = can(role, 'dueno')
  const facts: [string, string, string][] = [
    [
      t('admin.fact.balance'),
      user.balance === null ? '—' : formatNumber(user.balance, language),
      data ? t('admin.factSub.net', { n: `${data.totals.net > 0 ? '+' : ''}${formatNumber(data.totals.net, language)}` }) : '…',
    ],
    [t('admin.fact.hands'), formatNumber(user.hands, language), data ? t('admin.factSub.week', { n: number(data.weekHands) }) : '…'],
    [t('admin.fact.time7'), data ? duration(data.weekPlayMs) : '…', t('admin.factSub.groups', { count: user.groups })],
    [t('admin.fact.coins'), formatNumber(user.monedas ?? 0, language), t('admin.factSub.coins')],
  ]
  const tags = data?.marks.etiquetas ?? user.etiquetas
  const siblings = new Set(data?.marks.hermanas.map((s) => s.id))
  const unlinked = (data?.sharedWith ?? []).filter((other, i, all) => !siblings.has(other.id) && all.findIndex((o) => o.id === other.id) === i)
  const silencedUntil = data?.marks.silenciadoHasta ?? null
  // The device of the last session, when the browser gave enough away to name it.
  const known = data?.sessions[0] && !device(data.sessions[0].userAgent).includes('?') ? device(data.sessions[0].userAgent) : null

  const run = (promise: Promise<unknown>, message: string) => {
    setDone(null)
    promise.then(() => setDone(message)).catch(() => setDone(null))
  }
  const setTags = (next: string[]) => marks.mutate({ userId: user.id, etiquetas: next })

  return (
    <>
      {onBack && (
        <button className={styles.back} type="button" onClick={onBack}>
          <ChevronLeftIcon width={18} height={18} /> {t('admin.backToList')}
        </button>
      )}
      <div className={ui.file} role="region" aria-label={t('admin.playerCard')}>
        <section className={`card ${ui.fileHead}`}>
          <Avatar seed={user.id} name={user.nombre ?? user.username} src={user.avatarUrl} size={64} />
          <span className={ui.fileName}>
            <span className={ui.fileTitle}>
              <h2 className={styles.ellipsis}>{user.nombre ?? user.username}</h2>
              <Tags user={{ ...user, etiquetas: tags, silenced: silencedUntil ? silencedUntil > now : user.silenced }} now={now} />
            </span>
            <small>
              @{user.username} · {t('admin.since', { date: date(user.createdAt) })} · {t('admin.agoShort', { time: ago(user.lastSeen, now) })}
              {known && ` · ${known}`}
            </small>
          </span>

        <div className={ui.fileActions}>
          <button type="button" className="btn btn-secondary" onClick={() => setModal('adjust')} disabled={!mod}>
            {t('panel.user.adjust')}
          </button>
          <button type="button" className="btn btn-secondary" onClick={() => setModal('push')} disabled={!mod}>
            {t('panel.user.push')}
          </button>
          <span className={ui.menuWrap}>
            <button type="button" className="btn btn-secondary" aria-expanded={more} onClick={() => setMore(!more)}>
              {t('panel.user.more')} ▾
            </button>
            {more && (
              <span className={ui.menu} role="menu" onClick={() => setMore(false)}>
                <button type="button" role="menuitem" onClick={() => setModal('view')}>
                  {t('panel.user.viewAs')}
                </button>
              </span>
            )}
          </span>
        </div>
          {done && <p className={`${styles.up} ${ui.fileDone}`}>{done}</p>}
        </section>

        <dl className={ui.fileKpis}>
          {facts.map(([label, value, sub]) => (
            <div key={label} className="card">
              <dt>{label}</dt>
              <dd>{value}</dd>
              <dd className={ui.fileKpiSub}>{sub}</dd>
            </div>
          ))}
        </dl>

        {isError && <p className="error-text">{t('common.error')}</p>}

        {data && (
          <div ref={wall} className={ui.fileGrid}>
            <section className={`card ${styles.block}`}>
              <div className={styles.sectionHead}>
                <h2 className="label">{t('panel.user.chart')}</h2>
                <span className={styles.dim}>{t('admin.handsCount', { count: data.weekHands, n: number(data.weekHands) })}</span>
              </div>
              <NetChart chart={data.chart} />
            </section>

            {(unlinked.length > 0 || data.marks.hermanas.length > 0) && (
              <section className={`card ${styles.block}`}>
                <h2 className="label">{t('panel.user.related')}</h2>
                <ul className={ui.list}>
                  {data.marks.hermanas.map((s) => (
                    <li key={s.id}>
                      <span className={ui.grow}>
                        <button type="button" className={ui.inlineUser} onClick={() => openUser(s)}>
                          @{s.username}
                        </button>
                        <small className={styles.dim}>{t('panel.user.sibling')}</small>
                      </span>
                      {mod && (
                        <button type="button" className={`btn btn-ghost btn-sm ${ui.quiet}`} onClick={() => marks.mutate({ userId: user.id, siblings: { ids: [s.id], linked: false } })}>
                          {t('panel.user.unlink')}
                        </button>
                      )}
                    </li>
                  ))}
                  {unlinked.map((other) => (
                    <li key={other.id}>
                      <Avatar seed={other.id} name={other.nombre ?? other.username} src={other.avatarUrl} size={28} />
                      <span className={ui.grow}>
                        <button type="button" className={ui.inlineUser} onClick={() => openUser(other)}>
                          @{other.username}
                        </button>
                        <small className={`${styles.dim} ${styles.code}`}>{t('panel.user.sameIp', { ip: other.ip ?? '—' })}</small>
                      </span>
                    </li>
                  ))}
                </ul>
                {mod && unlinked.length > 0 && (
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    disabled={marks.isPending}
                    onClick={() => marks.mutate({ userId: user.id, siblings: { ids: unlinked.map((o) => o.id), linked: true } })}
                  >
                    {t('panel.user.markSiblings')}
                  </button>
                )}
              </section>
            )}

            <section className={`card ${styles.block}`}>
              <h2 className="label">{t('panel.user.history')}</h2>
              {data.history.length === 0 ? (
                <p className="muted">{t('admin.nobody')}</p>
              ) : (
                <ul className={ui.timeline}>
                  {data.history.slice(0, allHistory ? 30 : 5).map((event, i) => (
                    <li key={i}>
                      <span className={ui.timelineDot} data-kind={event.kind} />
                      <span className={ui.grow}>
                        <b>
                          {event.kind === 'admin'
                            ? t(`admin.log.${event.text}`, { defaultValue: event.text ?? '' })
                            : t(`panel.user.event.${event.kind}`, {
                                what:
                                  event.kind === 'purchase'
                                    ? t(`styles.items.${event.text}`, { defaultValue: event.text ?? '' })
                                    : event.kind === 'achievement'
                                      ? t(`achievements.${event.text}.name`, { defaultValue: event.text ?? '' })
                                      : event.text ?? '',
                                n: number(event.value ?? 0),
                              })}
                        </b>
                        {(event.by || event.detail) && (
                          <small className={styles.dim}>
                            {[event.by && `@${event.by}`, event.detail].filter(Boolean).join(' · ')}
                          </small>
                        )}
                      </span>
                      <small className={styles.dim}>{ago(event.at, now)}</small>
                    </li>
                  ))}
                </ul>
              )}
              {data.history.length > 5 && (
                <button type="button" className={ui.inlineUser} aria-expanded={allHistory} onClick={() => setAllHistory(!allHistory)}>
                  {allHistory ? t('panel.user.historyLess') : t('panel.user.historyAll', { count: Math.min(30, data.history.length) })}
                </button>
              )}
            </section>

            <section className={`card ${styles.block}`}>
              <h2 className="label">{t('panel.user.notes')}</h2>
              {data.notes.length > 0 && (
                <ul className={ui.notes}>
                  {data.notes.map((n) => (
                    <li key={n.id}>
                      <p>{n.texto}</p>
                      <small className={styles.dim}>
                        @{n.admin} · {date(n.createdAt)}
                        <button type="button" className={ui.inlineUser} onClick={() => deleteNote.mutate({ id: n.id })}>
                          {t('panel.user.deleteNote')}
                        </button>
                      </small>
                    </li>
                  ))}
                </ul>
              )}
              <form
                className={ui.inlineForm}
                onSubmit={(event) => {
                  event.preventDefault()
                  if (note.trim()) postNote.mutate({ userId: user.id, texto: note.trim() }, { onSuccess: () => setNote('') })
                }}
              >
                <input
                  className={styles.fieldInput}
                  value={note}
                  maxLength={500}
                  placeholder={t('panel.user.notePlaceholder')}
                  aria-label={t('panel.user.notes')}
                  onChange={(e) => setNote(e.target.value)}
                />
                <button type="submit" className="btn btn-secondary btn-sm" disabled={!note.trim() || postNote.isPending}>
                  {t('panel.user.addNote')}
                </button>
              </form>
            </section>

            <section className={`card ${styles.block}`}>
              <h2 className="label">{t('panel.user.tags')}</h2>
              <div className={ui.tagRow}>
                {tags.map((tag) => (
                  <span key={tag} className={ui.tagChip} data-tag={tag}>
                    {tag}
                    <button type="button" className={ui.tagX} aria-label={t('panel.user.removeTag', { tag })} onClick={() => setTags(tags.filter((x) => x !== tag))}>
                      <CloseIcon width={10} height={10} />
                    </button>
                  </span>
                ))}
                {QUICK_TAGS.filter((tag) => !tags.includes(tag)).map((tag) => (
                  <button key={tag} type="button" className={ui.tagAdd} onClick={() => setTags([...tags, tag])}>
                    + {tag}
                  </button>
                ))}
                <form
                  className={ui.tagForm}
                  onSubmit={(event) => {
                    event.preventDefault()
                    const tag = newTag.trim().toUpperCase()
                    if (tag && !tags.includes(tag)) setTags([...tags, tag])
                    setNewTag('')
                  }}
                >
                  <input
                    className={styles.fieldInput}
                    value={newTag}
                    maxLength={20}
                    placeholder={t('panel.user.newTag')}
                    aria-label={t('panel.user.newTag')}
                    onChange={(e) => setNewTag(e.target.value)}
                  />
                </form>
              </div>
            </section>

            <details className={`card ${ui.details}`}>
              <summary>{t('panel.user.moreData')}</summary>
              <div className={styles.block}>
                <h2 className="label">{t('admin.sessions')}</h2>
                {data.sessions.length === 0 ? (
                  <p className="muted">{t('admin.nobody')}</p>
                ) : (
                  <ul className={styles.sessions}>
                    {data.sessions.map((s, i) => (
                      <li key={i}>
                        <PhoneIcon width={18} height={18} className={styles.dim} />
                        <span className={styles.userName}>
                          <span className={styles.ellipsis}>{device(s.userAgent)}</span>
                          {s.ip && <small className={`${styles.ellipsis} ${styles.code}`}>{s.ip}</small>}
                        </span>
                        <span className="muted">{s.banned ? t('admin.status.banned') : ago(s.lastSeen, now)}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              {data.groups.length > 0 && (
                <div className={styles.block}>
                  <h2 className="label">{t('admin.fact.groups')}</h2>
                  <div className={styles.pills}>
                    {data.groups.map((group) => (
                      <span key={group.id}>
                        {group.nombre}
                        {group.rol === 'admin' ? ' ★' : ''}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              <div className={styles.block}>
                <h2 className="label">{t('admin.lastHands')}</h2>
                {data.lastHands.length === 0 ? (
                  <p className="muted">{t('admin.nobody')}</p>
                ) : (
                  <ul className={styles.bans}>
                    {data.lastHands.map((hand, i) => (
                      <li key={i} className={styles.handRow}>
                        <small className="muted">{date(hand.at)}</small>
                        <span>{number(hand.bet)}</span>
                        <b className={hand.net === null ? '' : hand.net > 0 ? styles.up : hand.net < 0 ? styles.down : ''}>
                          {hand.net === null ? '…' : `${hand.net > 0 ? '+' : ''}${number(hand.net)}`}
                        </b>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              {mod && <EditNames key={user.id} user={user} />}
            </details>
          </div>
        )}

        {mod && (
          <section className={`card ${ui.danger}`}>
            <h2 className="label">{t('panel.user.serious')}</h2>
            <div className={ui.dangerRow}>
              <button
                type="button"
                className="btn btn-secondary"
                disabled={!user.avatarUrl}
                onClick={() => run(removeAvatar.mutateAsync({ userId: user.id }), t('panel.user.avatarRemoved'))}
              >
                {t('panel.user.removeAvatar')}
              </button>
              <button type="button" className="btn btn-secondary" onClick={() => run(closeSessions.mutateAsync({ userId: user.id }), t('panel.user.sessionsClosed'))}>
                {t('panel.user.closeSessions')}
              </button>
              {!user.admin &&
                (silencedUntil && silencedUntil > now ? (
                  <button type="button" className={`btn ${styles.softDanger}`} title={t('panel.user.silencedUntil', { date: date(silencedUntil) })} onClick={() => marks.mutate({ userId: user.id, silenceHours: 0 })}>
                    {t('panel.user.unsilence')}
                  </button>
                ) : (
                  <button type="button" className={`btn ${styles.softDanger}`} aria-expanded={silencing} title={t('panel.user.silenceHint')} onClick={() => setSilencing(!silencing)}>
                    {t('panel.user.silenceEllipsis')}
                  </button>
                ))}
              {!user.admin && (
                <button className={`btn ${styles.softDanger}`} type="button" title={t('panel.user.banHint')} onClick={onBan}>
                  {t('admin.banEllipsis')}
                </button>
              )}
              {!user.admin && owner && (
                <button className="btn btn-danger" type="button" title={t('panel.user.deleteHint')} onClick={onDelete}>
                  {t('admin.delete')}
                </button>
              )}
            </div>
            {silencing && !(silencedUntil && silencedUntil > now) && (
              <div className={ui.dangerRow}>
                <small className={styles.dim}>{t('panel.user.silenceHint')}</small>
                {SILENCE_HOURS.map((h) => (
                  <button
                    key={h}
                    type="button"
                    className="btn btn-secondary"
                    disabled={marks.isPending}
                    onClick={() => marks.mutate({ userId: user.id, silenceHours: h }, { onSuccess: () => setSilencing(false) })}
                  >
                    {h < 24 ? `${h} h` : `${h / 24} d`}
                  </button>
                ))}
              </div>
            )}
          </section>
        )}
        {marks.isError && <p className="error-text">{marks.error instanceof Error && marks.error.message ? marks.error.message : t('common.error')}</p>}
      </div>

      {modal === 'adjust' && (
        <Modal title={t('admin.adjust.title')} eyebrow={`@${user.username}`} onClose={() => setModal(null)}>
          <Adjust user={user} history={data?.adjustments} />
        </Modal>
      )}
      {modal === 'push' && <Push user={user} onClose={() => setModal(null)} />}
      {modal === 'view' && <ViewAs user={user} onClose={() => setModal(null)} />}
    </>
  )
}

/** Saves what the list shows now (segment, tag, search) under a name. */
function SaveSegment({ segment, tag, q }: { segment: Segment | null; tag: string | null; q: string }) {
  const { t } = useTranslation()
  const save = usePostSegment()
  const [name, setName] = useState<string | null>(null)
  if (!segment && !tag && !q) return null
  if (name === null)
    return (
      <button type="button" className={`btn btn-ghost btn-sm ${ui.quiet}`} onClick={() => setName('')}>
        {t('panel.users.save')}
      </button>
    )
  return (
    <form
      className={ui.inlineForm}
      onSubmit={(event) => {
        event.preventDefault()
        if (name.trim()) save.mutate({ name: name.trim(), segment, tag, q: q || null }, { onSuccess: () => setName(null) })
      }}
    >
      <input
        className={styles.fieldInput}
        autoFocus
        maxLength={30}
        value={name}
        placeholder={t('panel.users.segmentName')}
        aria-label={t('panel.users.segmentName')}
        onChange={(e) => setName(e.target.value)}
      />
      <button type="submit" className="btn btn-secondary btn-sm" disabled={!name.trim() || save.isPending}>
        {t('common.save')}
      </button>
    </form>
  )
}

export function UsersTab({ focus }: { focus: Focus | null }) {
  const { t } = useTranslation()
  const wide = useWide()
  const [query, setQuery] = useState('')
  const [segment, setSegment] = useState<Segment | null>(null)
  const [tag, setTag] = useState<string | null>(null)
  const [sort, setSort] = useState<Sort>('seen')
  const [selected, setSelected] = useState<string | null>(null)
  const q = useDeferredValue(query.trim())
  const { data, isError } = useAdminUsers(q, segment, tag)
  const { data: saved } = useSegments()
  const deleteSegment = usePostSegment()
  const remove = useDeleteUser()
  const ban = useBan()
  const [deleting, setDeleting] = useState<AdminUser | null>(null)
  const [banning, setBanning] = useState<AdminUser | null>(null)
  const language = currentLanguage()
  const now = Date.now()
  const users = data?.users ?? []
  const shown = [...users].sort((a, b) => SORT_VALUE[sort](b) - SORT_VALUE[sort](a))
  // On a wide screen the card is always open, on the first row until one is picked.
  const current = users.find((user) => user.id === selected) ?? (wide ? shown[0] : undefined) ?? null

  // Opened from somewhere else in the panel (the palette, the inbox, a feed line).
  useEffect(() => {
    if (!focus) return
    setQuery(focus.username)
    setSegment(null)
    setTag(null)
    setSelected(focus.id)
  }, [focus])

  const open = (user: AdminUser) => setSelected(user.id)
  const player = current && (
    <Player
      key={current.id}
      user={current}
      onBack={wide ? undefined : () => setSelected(null)}
      onBan={() => setBanning(current)}
      onDelete={() => setDeleting(current)}
    />
  )

  const filters = (
    <>
      <div className={styles.toolbar}>
        <p className="muted">{data ? t('panel.users.summary', { count: data.total, n: number(data.total) }) : '…'}</p>
        <div className={styles.toolbarEnd}>
          <label className={styles.searchBox}>
            <SearchIcon width={18} height={18} className={styles.dim} />
            <input
              type="search"
              placeholder={t('admin.searchShort')}
              aria-label={t('admin.search')}
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
          </label>
          <button
            className="btn btn-secondary"
            type="button"
            onClick={() => setSort(SORTS[(SORTS.indexOf(sort) + 1) % SORTS.length])}
          >
            {t('admin.sortBy', { key: t(`admin.sort.${sort}`) })}
          </button>
        </div>
      </div>

      <div className={styles.chips} role="group" aria-label={t('admin.filters')}>
        <button type="button" aria-pressed={!segment} onClick={() => setSegment(null)}>
          {t('panel.users.segment.all')}
        </button>
        {SEGMENTS.map((key) => (
          <button key={key} type="button" aria-pressed={segment === key} onClick={() => setSegment(segment === key ? null : key)}>
            {t(`panel.users.segment.${key}`)} <span className={styles.count}>{data?.segments[key] ?? 0}</span>
          </button>
        ))}
      </div>
      {(!!data?.tags.length || !!saved?.length) && (
        <div className={ui.segmentRow}>
          {data?.tags.map(({ tag: name, n }) => (
            <button key={name} type="button" className={ui.tagChip} data-tag={name} aria-pressed={tag === name} onClick={() => setTag(tag === name ? null : name)}>
              {name} · {n}
            </button>
          ))}
          {saved?.map((s) => (
            <span key={s.id} className={ui.savedSegment}>
              <button
                type="button"
                onClick={() => {
                  setSegment(s.segment ?? null)
                  setTag(s.tag ?? null)
                  setQuery(s.q ?? '')
                }}
              >
                ★ {s.name}
              </button>
              <button type="button" aria-label={t('panel.users.deleteSegment', { name: s.name })} onClick={() => deleteSegment.mutate({ id: s.id, delete: true })}>
                <CloseIcon width={10} height={10} />
              </button>
            </span>
          ))}
          <SaveSegment segment={segment} tag={tag} q={q} />
        </div>
      )}
      {!data?.tags.length && !saved?.length && <SaveSegment segment={segment} tag={tag} q={q} />}
      {segment && <p className={styles.dim}>{t(`panel.users.segmentHint.${segment}`)}</p>}
      {isError && <p className="error-text">{t('common.error')}</p>}
    </>
  )

  return (
    <>
      {!wide && selected && player ? (
        player
      ) : (
        <>
          {wide ? (
            <div className={ui.people}>
              <section className={`card ${ui.peopleList}`} aria-label={t('admin.tab.users')}>
                {filters}
                <ul className={ui.personList}>
                  {shown.map((user) => {
                    const first = tagsOf(user, now)[0]
                    return (
                      <li key={user.id}>
                        <button type="button" className={ui.person} aria-current={current?.id === user.id || undefined} onClick={() => open(user)}>
                          <Avatar seed={user.id} name={user.nombre ?? user.username} src={user.avatarUrl} size={34} />
                          <span className={styles.userName}>
                            <b className={styles.ellipsis}>{user.nombre ?? user.username}</b>
                            <small className={styles.ellipsis}>
                              {t('admin.agoShort', { time: ago(user.lastSeen, now) })} ·{' '}
                              {t('panel.users.chips', { n: user.balance === null ? '—' : formatNumber(user.balance, language) })}
                            </small>
                          </span>
                          {first && (
                            <span className={ui.tagChip} data-tag={first}>
                              {first}
                            </span>
                          )}
                        </button>
                      </li>
                    )
                  })}
                </ul>
                {data && shown.length === 0 && <p className="muted">{t('admin.nobody')}</p>}
              </section>
              {player ?? <section className={`card ${ui.fileEmpty} muted`}>{t('admin.pickPlayer')}</section>}
            </div>
          ) : (
            <>
              {filters}
              <ul className={styles.users}>
                {shown.map((user) => (
                  <li key={user.id}>
                    <button className={`card ${styles.row}`} type="button" onClick={() => open(user)}>
                      <Avatar seed={user.id} name={user.nombre ?? user.username} src={user.avatarUrl} size={40} />
                      <span className={styles.userName}>
                        <b className={styles.ellipsis}>{user.nombre ?? user.username}</b>
                        <small className={styles.ellipsis}>
                          @{user.username} · {t('admin.agoShort', { time: ago(user.lastSeen, now) })}
                        </small>
                        <Tags user={user} now={now} />
                      </span>
                      <span className={styles.rowNumbers}>
                        <b>{user.balance === null ? '—' : formatNumber(user.balance, language)}</b>
                        <small>{t('admin.handsCount', { count: user.hands, n: number(user.hands) })}</small>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </>
          )}

          {(ban.isError || remove.isError) && <p className="error-text">{t('common.error')}</p>}
        </>
      )}

      <ConfirmSheet
        open={deleting !== null}
        icon={deleting && <Avatar seed={deleting.id} name={deleting.nombre ?? deleting.username} src={deleting.avatarUrl} size={64} />}
        title={t('admin.deleteTitle', { name: deleting?.username ?? '' })}
        text={t('admin.deleteText')}
        confirm={t('admin.delete')}
        busy={remove.isPending}
        onCancel={() => setDeleting(null)}
        onConfirm={() => {
          if (deleting) remove.mutate({ id: deleting.id }, { onSettled: () => { setDeleting(null); setSelected(null) } })
        }}
      />
      <ConfirmSheet
        open={banning !== null}
        icon={banning && <Avatar seed={banning.id} name={banning.nombre ?? banning.username} src={banning.avatarUrl} size={64} />}
        title={t('admin.banTitle', { name: banning?.username ?? '' })}
        text={t('admin.banText')}
        confirm={t('admin.ban')}
        busy={ban.isPending}
        onCancel={() => setBanning(null)}
        onConfirm={() => {
          if (banning) ban.mutate({ userId: banning.id }, { onSettled: () => setBanning(null) })
        }}
      />
    </>
  )
}
