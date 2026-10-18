'use client'

import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { can, type Role } from '@/admin/useAdmin'
import { useSetTeam, useTeam } from '@/admin/useAdminTools'
import { Avatar } from '@/ui/Avatar'
import { CheckIcon, CrownIcon } from '@/ui/icons'
import styles from './admin.module.css'
import { useAdminPanel } from './context'
import ui from './tools.module.css'

const ROLES: Role[] = ['dueno', 'moderador', 'soporte']

/** What each role may do, as the server checks it (requireAdmin in routes/admin*.ts). */
const PERMISSIONS: ['see' | 'notes' | 'moderate' | 'adjust' | 'comms' | 'undo' | 'game' | 'server', Role | 'limit'][] = [
  ['see', 'soporte'],
  ['notes', 'soporte'],
  ['moderate', 'moderador'],
  ['adjust', 'limit'],
  ['comms', 'moderador'],
  ['undo', 'moderador'],
  ['game', 'dueno'],
  ['server', 'dueno'],
]

/** Who runs the app with you, and what each of them can touch. */
export function TeamTab() {
  const { t } = useTranslation()
  const { role } = useAdminPanel()
  const { data } = useTeam()
  const setTeam = useSetTeam()
  const [username, setUsername] = useState('')
  const [newRole, setNewRole] = useState<Role>('moderador')
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState<string | null>(null)
  const owner = can(role, 'dueno')

  const save = (name: string, next: Role | null) => {
    setError(null)
    setSaved(null)
    setTeam
      .mutateAsync({ username: name, role: next })
      .then(() => {
        setSaved(name)
        if (name === username) setUsername('')
      })
      .catch((err: Error) => setError(err.message || t('common.error')))
  }

  const members = [
    ...(data?.owners ?? []).map((name) => ({ username: name, role: 'dueno' as Role, fixed: true })),
    ...(data?.staff ?? []).map((m) => ({ ...m, fixed: false })),
  ]

  return (
    <>
      <section className={`card ${styles.block}`}>
        <div className={styles.sectionHead}>
          <h2 className="label">{t('panel.team.members', { count: members.length })}</h2>
        </div>
        <ul className={ui.list}>
          {members.map((m) => (
            <li key={m.username}>
              <Avatar seed={m.username} name={m.username} size={34} />
              <span className={ui.grow}>
                <b>@{m.username}</b>
                <small className={styles.dim}>{t(`panel.team.about.${m.role}`)}</small>
              </span>
              {m.fixed || !owner ? (
                <span className={ui.roleTag} data-role={m.role}>
                  {m.role === 'dueno' && <CrownIcon width={12} height={12} />} {t(`panel.role.${m.role}`)}
                </span>
              ) : (
                <>
                  <select
                    className={styles.fieldInput}
                    value={m.role}
                    aria-label={t('panel.team.role')}
                    disabled={setTeam.isPending}
                    onChange={(event) => save(m.username, event.target.value as Role)}
                  >
                    {ROLES.filter((r) => r !== 'dueno').map((r) => (
                      <option key={r} value={r}>
                        {t(`panel.role.${r}`)}
                      </option>
                    ))}
                  </select>
                  <button type="button" className={`btn btn-ghost btn-sm ${ui.quiet}`} disabled={setTeam.isPending} onClick={() => save(m.username, null)}>
                    {t('panel.team.remove')}
                  </button>
                </>
              )}
              {saved === m.username && <CheckIcon width={16} height={16} className={styles.up} />}
            </li>
          ))}
        </ul>
        {owner ? (
          <form
            className={ui.inlineForm}
            onSubmit={(event) => {
              event.preventDefault()
              if (username.trim()) save(username.trim().replace(/^@/, ''), newRole)
            }}
          >
            <b>{t('panel.team.invite')}</b>
            <input
              className={styles.fieldInput}
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              placeholder="@usuario"
              aria-label={t('panel.team.username')}
            />
            <select className={styles.fieldInput} value={newRole} onChange={(event) => setNewRole(event.target.value as Role)} aria-label={t('panel.team.role')}>
              {ROLES.filter((r) => r !== 'dueno').map((r) => (
                <option key={r} value={r}>
                  {t(`panel.role.${r}`)}
                </option>
              ))}
            </select>
            <button type="submit" className="btn btn-primary btn-sm" disabled={!username.trim() || setTeam.isPending}>
              {t('panel.team.add')}
            </button>
          </form>
        ) : (
          <p className={styles.dim}>{t('panel.team.ownerOnly')}</p>
        )}
        {error && <p className="error-text">{error}</p>}
        <p className={styles.dim}>{t('panel.team.ownersHint')}</p>
      </section>

      <section className={`card ${styles.block}`}>
        <h2 className="label">{t('panel.team.permissions')}</h2>
        <div className={styles.scroll}>
          <table className={`${styles.oddsTable} ${ui.permTable}`}>
            <thead>
              <tr>
                <th scope="col" />
                {ROLES.map((r) => (
                  <th key={r} scope="col">
                    {t(`panel.role.${r}`)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {PERMISSIONS.map(([key, min]) => (
                <tr key={key}>
                  <th scope="row">{t(`panel.team.perm.${key}`)}</th>
                  {ROLES.map((r) => (
                    <td key={r}>
                      {min === 'limit' ? (
                        r === 'dueno' ? (
                          <span className={ui.yes}>{t('panel.team.noLimit')}</span>
                        ) : r === 'moderador' ? (
                          <span className={ui.partial}>{t('panel.team.upTo', { n: 500 })}</span>
                        ) : (
                          <span className={ui.no}>—</span>
                        )
                      ) : can(r, min) ? (
                        <span className={ui.yes}>✓</span>
                      ) : (
                        <span className={ui.no}>—</span>
                      )}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </>
  )
}
