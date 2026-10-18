'use client'

import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ago, date } from '@/admin/format'
import { can, useAdminLog, type LogEntry } from '@/admin/useAdmin'
import { useUndo } from '@/admin/useAdminTools'
import { ConfirmSheet } from '@/ui/ConfirmSheet'
import { RenewIcon, SearchIcon } from '@/ui/icons'
import styles from './admin.module.css'
import { useAdminPanel } from './context'
import { detail, target } from './SystemTab'
import ui from './tools.module.css'

/** Everything the team did, newest first, and a way back for what can be undone. */
export function LogTab() {
  const { t } = useTranslation()
  const { role } = useAdminPanel()
  const { data } = useAdminLog()
  const undo = useUndo()
  const [who, setWho] = useState<string | null>(null)
  const [q, setQ] = useState('')
  const [onlyUndo, setOnlyUndo] = useState(false)
  const [asking, setAsking] = useState<LogEntry | null>(null)
  const [error, setError] = useState<string | null>(null)

  const admins = [...new Set((data ?? []).map((entry) => entry.admin))]
  const text = (entry: LogEntry) =>
    `${t(`admin.log.${entry.accion}`, { defaultValue: entry.accion })}${entry.objetivo ? ` · ${target(entry.accion, entry.objetivo, t)}` : ''}`
  const needle = q.trim().toLowerCase()
  const rows = (data ?? []).filter(
    (entry) =>
      (!who || entry.admin === who) &&
      (!onlyUndo || (entry.undoable && !entry.deshecho)) &&
      (!needle || `${text(entry)} ${entry.detalle ?? ''}`.toLowerCase().includes(needle)),
  )

  return (
    <section className={`card ${styles.block}`}>
      <div className={styles.toolbar}>
        <label className={styles.searchBox}>
          <SearchIcon width={16} height={16} />
          <input value={q} onChange={(event) => setQ(event.target.value)} placeholder={t('panel.log.search')} aria-label={t('panel.log.search')} />
        </label>
        <div className={styles.chips} role="group" aria-label={t('admin.audit.who')}>
          <button type="button" aria-pressed={who === null} onClick={() => setWho(null)}>
            {t('panel.log.everyone')}
          </button>
          {admins.map((name) => (
            <button key={name} type="button" aria-pressed={who === name} onClick={() => setWho(name)}>
              {name === 'auto' ? t('panel.log.auto') : `@${name}`}
            </button>
          ))}
          <button type="button" aria-pressed={onlyUndo} onClick={() => setOnlyUndo((v) => !v)}>
            {t('panel.log.onlyUndo')}
          </button>
        </div>
      </div>
      {error && <p className="error-text">{error}</p>}
      {rows.length === 0 ? (
        <p className={styles.emptyBox}>{data?.length === 0 ? t('admin.auditEmpty') : t('panel.log.none')}</p>
      ) : (
        <ol className={ui.timeline}>
          {rows.map((entry) => (
            <li key={entry.id} data-undone={entry.deshecho || undefined}>
              <span className={ui.timelineDot} data-auto={entry.admin === 'auto' || undefined} />
              <div className={ui.grow}>
                <b>{text(entry)}</b>
                <span className={styles.dim}>
                  {entry.admin === 'auto' ? t('panel.log.auto') : `@${entry.admin}`} · <time title={date(entry.createdAt)}>{t('admin.agoShort', { time: ago(entry.createdAt) })}</time>
                  {entry.detalle ? ` · ${detail(entry.accion, entry.detalle, t)}` : ''}
                </span>
              </div>
              {entry.deshecho ? (
                <span className={ui.tagChip}>{t('panel.log.undone')}</span>
              ) : (
                entry.undoable &&
                can(role, 'moderador') && (
                  <button type="button" className="btn btn-ghost btn-sm" onClick={() => setAsking(entry)}>
                    <RenewIcon width={14} height={14} /> {t('panel.log.undo')}
                  </button>
                )
              )}
            </li>
          ))}
        </ol>
      )}
      <ConfirmSheet
        open={asking !== null}
        icon={<RenewIcon />}
        title={t('panel.log.undoTitle')}
        text={asking ? text(asking) : ''}
        confirm={t('panel.log.undo')}
        tone="accent"
        busy={undo.isPending}
        onConfirm={() =>
          asking &&
          undo
            .mutateAsync(asking.id)
            .then(() => setAsking(null))
            .catch((err: Error) => {
              setError(err.message || t('common.error'))
              setAsking(null)
            })
        }
        onCancel={() => setAsking(null)}
      />
    </section>
  )
}
