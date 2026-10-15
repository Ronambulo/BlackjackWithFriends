'use client'

import { useDeferredValue, useEffect, useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { date, ago, duration, number } from '@/admin/format'
import {
  useAdminUsers,
  useBan,
  useBans,
  useDeleteUser,
  useUnban,
  useUserDetail,
  type AdminUser,
} from '@/admin/useAdmin'
import { currentLanguage } from '@/i18n'
import { formatNumber } from '@/lib/format'
import { Avatar } from '@/ui/Avatar'
import { ConfirmSheet } from '@/ui/ConfirmSheet'
import { ChevronLeftIcon, CloseIcon, PhoneIcon, SearchIcon } from '@/ui/icons'
import pages from '../pages.module.css'
import styles from './admin.module.css'

const DAY = 24 * 60 * 60 * 1000
type Filter = 'all' | 'active' | 'new' | 'inactive' | 'banned' | 'admins'
const FILTERS: Filter[] = ['all', 'active', 'new', 'inactive', 'banned', 'admins']
type Sort = 'seen' | 'balance' | 'hands' | 'joined'
const SORTS: Sort[] = ['seen', 'balance', 'hands', 'joined']
type Status = 'admin' | 'banned' | 'new' | 'active' | 'idle'

function matches(user: AdminUser, filter: Filter, now: number) {
  switch (filter) {
    case 'active':
      return user.lastSeen !== null && now - user.lastSeen <= 7 * DAY
    case 'new':
      return now - user.createdAt <= 7 * DAY
    case 'inactive':
      return user.lastSeen === null || now - user.lastSeen > 14 * DAY
    case 'banned':
      return user.banned
    case 'admins':
      return user.admin
    default:
      return true
  }
}

const SORT_VALUE: Record<Sort, (user: AdminUser) => number> = {
  seen: (user) => user.lastSeen ?? 0,
  balance: (user) => user.balance ?? -1,
  hands: (user) => user.hands,
  joined: (user) => user.createdAt,
}

function status(user: AdminUser, now: number): Status {
  if (user.banned) return 'banned'
  if (user.admin) return 'admin'
  if (now - user.createdAt <= 7 * DAY) return 'new'
  return matches(user, 'active', now) ? 'active' : 'idle'
}

function StatusTag({ user, now }: { user: AdminUser; now: number }) {
  const { t } = useTranslation()
  const value = status(user, now)
  return (
    <span className={styles.status} data-status={value}>
      {t(`admin.status.${value}`)}
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

function Player({ user, onBack, onBan, onDelete }: { user: AdminUser; onBack?: () => void; onBan: () => void; onDelete: () => void }) {
  const { t } = useTranslation()
  const { data, isError } = useUserDetail(user.id)
  const language = currentLanguage()
  const now = Date.now()
  const facts: [string, string][] = [
    [t('admin.fact.balance'), user.balance === null ? '—' : formatNumber(user.balance, language)],
    [t('admin.fact.coins'), formatNumber(user.monedas ?? 0, language)],
    [t('admin.fact.hands'), formatNumber(user.hands, language)],
    [t('admin.fact.groups'), String(user.groups)],
    [t('admin.fact.time7'), data ? duration(data.weekPlayMs) : '…'],
    [t('admin.fact.net'), data ? formatNumber(data.totals.net, language) : '…'],
  ]
  const shared = [...new Set(data?.sharedWith.map((other) => `@${other.username}`))]

  return (
    <>
      {onBack && (
        <button className={styles.back} type="button" onClick={onBack}>
          <ChevronLeftIcon width={18} height={18} /> {t('admin.backToList')}
        </button>
      )}
      <aside className={`card ${styles.sheet}`} aria-label={t('admin.playerCard')}>
        <div className={styles.sheetHead}>
          <Avatar seed={user.id} name={user.nombre ?? user.username} src={user.avatarUrl} size={64} />
          <span className={styles.sheetName}>
            <b className={styles.ellipsis}>{user.nombre ?? user.username}</b>
            <small className={styles.ellipsis}>
              @{user.username} · {t('admin.since', { date: date(user.createdAt) })}
            </small>
            <span>
              <StatusTag user={user} now={now} />
            </span>
          </span>
        </div>

        <dl className={styles.factGrid}>
          {facts.map(([label, value]) => (
            <div key={label}>
              <dt>{label}</dt>
              <dd>{value}</dd>
            </div>
          ))}
        </dl>

        {isError && <p className="error-text">{t('common.error')}</p>}

        {data && (
          <>
            <div className={styles.block}>
              <h2 className="label">{t('admin.sessions')}</h2>
              {data.sessions.length === 0 ? (
                <p className="muted">{t('admin.nobody')}</p>
              ) : (
                <ul className={styles.sessions}>
                  {data.sessions.map((s, i) => (
                    <li key={i}>
                      <PhoneIcon width={18} height={18} className={styles.dim} />
                      <span className={styles.ellipsis}>
                        {device(s.userAgent)} <span className="muted">· {s.ip ?? '—'}</span>
                      </span>
                      <span className="muted">{s.banned ? t('admin.status.banned') : ago(s.lastSeen, now)}</span>
                    </li>
                  ))}
                </ul>
              )}
              {shared.length > 0 && <p className={styles.warn}>{t('admin.sharesIp', { names: shared.join(', ') })}</p>}
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
          </>
        )}

        {!user.admin && (
          <div className={styles.block}>
            <h2 className="label">{t('admin.actions')}</h2>
            <div className={styles.userActions}>
              <button className={`btn ${styles.softDanger}`} type="button" onClick={onBan}>
                {t('admin.banEllipsis')}
              </button>
              <button className="btn btn-danger" type="button" onClick={onDelete}>
                {t('admin.delete')}
              </button>
            </div>
          </div>
        )}
      </aside>
    </>
  )
}

export function UsersTab() {
  const { t } = useTranslation()
  const wide = useWide()
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<Filter>('all')
  const [sort, setSort] = useState<Sort>('seen')
  const [selected, setSelected] = useState<string | null>(null)
  const q = useDeferredValue(query.trim())
  const { data, isError } = useAdminUsers(q)
  const { data: bans } = useBans()
  const remove = useDeleteUser()
  const ban = useBan()
  const unban = useUnban()
  const [deleting, setDeleting] = useState<AdminUser | null>(null)
  const [banning, setBanning] = useState<AdminUser | null>(null)
  const [ip, setIp] = useState('')
  const language = currentLanguage()
  const now = Date.now()
  const users = data?.users ?? []
  const shown = users.filter((user) => matches(user, filter, now)).sort((a, b) => SORT_VALUE[sort](b) - SORT_VALUE[sort](a))
  // On a wide screen the card is always open, on the first row until one is picked.
  const current = users.find((user) => user.id === selected) ?? (wide ? shown[0] : undefined) ?? null
  const active = users.filter((user) => matches(user, 'active', now)).length

  function onBanIp(event: FormEvent) {
    event.preventDefault()
    if (ip.trim()) ban.mutate({ ip: ip.trim() }, { onSuccess: () => setIp('') })
  }

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

  return (
    <>
      {!wide && selected && player ? (
        player
      ) : (
        <>
          <div className={styles.toolbar}>
            <p className="muted">{data ? t('admin.usersSummary', { total: data.total, active }) : '…'}</p>
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
            {FILTERS.map((key) => (
              <button key={key} type="button" aria-pressed={filter === key} onClick={() => setFilter(key)}>
                {t(`admin.filter.${key}`)} <span className={styles.count}>{users.filter((user) => matches(user, key, now)).length}</span>
              </button>
            ))}
          </div>
          {isError && <p className="error-text">{t('common.error')}</p>}

          {wide ? (
            <div className={styles.master}>
              <section className={`card ${styles.tableCard}`}>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th scope="col">{t('admin.col.player')}</th>
                      <th scope="col" className={styles.num}>{t('admin.col.balance')}</th>
                      <th scope="col" className={styles.num}>{t('admin.col.coins')}</th>
                      <th scope="col" className={styles.num}>{t('admin.col.hands')}</th>
                      <th scope="col">{t('admin.col.seen')}</th>
                      <th scope="col">{t('admin.col.status')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {shown.map((user) => (
                      <tr key={user.id} aria-selected={current?.id === user.id}>
                        <td>
                          <button className={styles.rowButton} type="button" onClick={() => open(user)}>
                            <Avatar seed={user.id} name={user.nombre ?? user.username} src={user.avatarUrl} size={34} />
                            <span className={styles.userName}>
                              <b className={styles.ellipsis}>{user.nombre ?? user.username}</b>
                              <small className={styles.ellipsis}>@{user.username}</small>
                            </span>
                          </button>
                        </td>
                        <td className={styles.num}>
                          <b>{user.balance === null ? '—' : formatNumber(user.balance, language)}</b>
                        </td>
                        <td className={styles.num}>{formatNumber(user.monedas ?? 0, language)}</td>
                        <td className={styles.num}>{formatNumber(user.hands, language)}</td>
                        <td className="muted">{t('admin.agoShort', { time: ago(user.lastSeen, now) })}</td>
                        <td>
                          <StatusTag user={user} now={now} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {data && shown.length === 0 && <p className={`muted ${styles.empty}`}>{t('admin.nobody')}</p>}
              </section>
              {player ?? <aside className={`card ${styles.sheet} muted`}>{t('admin.pickPlayer')}</aside>}
            </div>
          ) : (
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
                    </span>
                    <span className={styles.rowNumbers}>
                      <b>{user.balance === null ? '—' : formatNumber(user.balance, language)}</b>
                      <small>{t('admin.handsCount', { count: user.hands, n: number(user.hands) })}</small>
                    </span>
                    <StatusTag user={user} now={now} />
                  </button>
                </li>
              ))}
            </ul>
          )}

          <section className={`card ${styles.block}`}>
            <h2 className="label">{t('admin.bans')}</h2>
            <form className={pages.formRow} onSubmit={onBanIp}>
              <input
                className="input"
                placeholder={t('admin.ipPlaceholder')}
                aria-label={t('admin.ipPlaceholder')}
                value={ip}
                onChange={(event) => setIp(event.target.value)}
              />
              <button className="btn btn-danger" type="submit" disabled={!ip.trim() || ban.isPending}>
                {t('admin.banIp')}
              </button>
            </form>
            {(ban.isError || unban.isError || remove.isError) && <p className="error-text">{t('common.error')}</p>}
            {bans && bans.length === 0 && <p className="muted">{t('admin.noBans')}</p>}
            <ul className={styles.banList}>
              {bans?.map((entry) => (
                <li key={entry.ip}>
                  <span className={styles.userName}>
                    <b className={styles.ellipsis}>{entry.ip}</b>
                    <small className={styles.ellipsis}>
                      {date(entry.createdAt)}
                      {entry.motivo ? ` · ${entry.motivo}` : ''}
                    </small>
                  </span>
                  <button
                    className={pages.iconButton}
                    type="button"
                    aria-label={t('admin.unban')}
                    disabled={unban.isPending}
                    onClick={() => unban.mutate({ ip: entry.ip })}
                  >
                    <CloseIcon width={18} height={18} />
                  </button>
                </li>
              ))}
            </ul>
          </section>
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
