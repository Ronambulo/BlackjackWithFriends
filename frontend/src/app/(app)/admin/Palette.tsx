'use client'

import { useDeferredValue, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useTranslation } from 'react-i18next'
import { number } from '@/admin/format'
import { useAdjustUser, useAdminUsers, type AdminUser } from '@/admin/useAdmin'
import { useSetMarks } from '@/admin/useAdminTools'
import { Avatar } from '@/ui/Avatar'
import { SearchIcon } from '@/ui/icons'
import { TABS, useAdminPanel, type Tab } from './context'
import ui from './tools.module.css'

/** "dar 200 monedas a @ana", "give 50 chips to ana", "quitar 100 fichas a @ana". */
const ADJUST = /^(dar|give|quitar|take)\s+(\d{1,7})\s+(monedas?|coins?|fichas?|chips?)\s+(?:a|to|from|de)\s+@?([\w.]+)/i
/** "silenciar @ana", "mute ana 2" (hours). */
const SILENCE = /^(silenciar|silence|mute)\s+@?([\w.]+)(?:\s+(\d{1,3}))?/i

interface Item {
  key: string
  title: string
  hint?: string
  user?: AdminUser
  run: () => void | Promise<unknown>
  /** Fills the box instead of running, for the actions that still need a number. */
  fill?: string
}

/** Search or do: players, tabs and quick actions, from the keyboard. */
export function Palette({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation()
  const { go, openUser } = useAdminPanel()
  const [text, setText] = useState('')
  const [index, setIndex] = useState(0)
  const [done, setDone] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const input = useRef<HTMLInputElement>(null)
  const adjust = useAdjustUser()
  const marks = useSetMarks()

  const adjustMatch = text.trim().match(ADJUST)
  const silenceMatch = text.trim().match(SILENCE)
  const named = adjustMatch?.[4] ?? silenceMatch?.[2]
  const q = useDeferredValue((named ?? text.trim().replace(/^@/, '')).slice(0, 40))
  const { data } = useAdminUsers(q)
  // The exact name, or the only one that starts that way ("@ron" for ronambulo).
  const startsWith = named ? data?.users.filter((u) => u.username.toLowerCase().startsWith(named.toLowerCase())) : undefined
  const target = named
    ? (data?.users.find((u) => u.username.toLowerCase() === named.toLowerCase()) ?? (startsWith?.length === 1 ? startsWith[0] : undefined))
    : undefined

  useEffect(() => input.current?.focus(), [])

  const items = useMemo<Item[]>(() => {
    const list: Item[] = []
    const finish = (message: string) => {
      setDone(message)
      setTimeout(onClose, 900)
    }
    if (adjustMatch && target) {
      const take = /^(quitar|take)$/i.test(adjustMatch[1])
      const tipo = /^(monedas?|coins?)$/i.test(adjustMatch[3]) ? 'monedas' : 'saldo'
      const n = Number(adjustMatch[2])
      const cantidad = take ? -n : n
      list.push({
        key: 'adjust',
        title: t(take ? 'panel.palette.take' : 'panel.palette.give', {
          n: number(n),
          unit: t(`admin.adjust.unit.${tipo}`),
          name: target.username,
        }),
        hint: t('panel.palette.enter'),
        user: target,
        run: () =>
          adjust.mutateAsync({ id: target.id, tipo, cantidad, motivo: t('panel.palette.reason') }).then(() =>
            finish(t('panel.palette.done')),
          ),
      })
    }
    if (silenceMatch && target) {
      const hours = Number(silenceMatch[3] ?? 24)
      list.push({
        key: 'silence',
        title: t('panel.palette.silence', { name: target.username, count: hours }),
        hint: t('panel.palette.enter'),
        user: target,
        run: () => marks.mutateAsync({ userId: target.id, silenceHours: hours }).then(() => finish(t('panel.palette.done'))),
      })
    }
    if (!adjustMatch && !silenceMatch) {
      for (const u of (q ? data?.users ?? [] : []).slice(0, 5)) {
        list.push({
          key: `open:${u.id}`,
          title: t('panel.palette.openUser', { name: u.nombre ?? u.username }),
          hint: `@${u.username}`,
          user: u,
          run: () => {
            openUser({ id: u.id, username: u.username })
            onClose()
          },
        })
      }
      const first = q ? data?.users[0] : undefined
      if (first) {
        list.push({
          key: 'give',
          title: t('panel.palette.giveTemplate', { name: first.username }),
          fill: t('panel.palette.giveFill', { name: first.username }),
          run: () => {},
        })
        list.push({
          key: 'mute',
          title: t('panel.palette.silenceTemplate', { name: first.username }),
          fill: t('panel.palette.silenceFill', { name: first.username }),
          run: () => {},
        })
      }
      const lower = text.trim().toLowerCase()
      for (const tab of TABS as readonly Tab[]) {
        const name = t(`admin.tab.${tab}`)
        if (lower && !name.toLowerCase().includes(lower)) continue
        list.push({
          key: `tab:${tab}`,
          title: t('panel.palette.goTo', { name }),
          run: () => {
            go(tab)
            onClose()
          },
        })
      }
    }
    return list
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text, q, data, target])

  const pick = (item: Item | undefined) => {
    if (!item) return
    if (item.fill) {
      setText(item.fill)
      setIndex(0)
      input.current?.focus()
      return
    }
    setError(null)
    const result = item.run()
    if (result instanceof Promise) result.catch((err: Error) => setError(err.message || t('common.error')))
  }

  const onKey = (event: React.KeyboardEvent) => {
    if (event.key === 'Escape') onClose()
    else if (event.key === 'ArrowDown') {
      event.preventDefault()
      setIndex((i) => Math.min(items.length - 1, i + 1))
    } else if (event.key === 'ArrowUp') {
      event.preventDefault()
      setIndex((i) => Math.max(0, i - 1))
    } else if (event.key === 'Enter') {
      event.preventDefault()
      pick(items[Math.min(index, items.length - 1)])
    }
  }

  const waiting = (adjustMatch || silenceMatch) && !target
  const busy = adjust.isPending || marks.isPending

  return createPortal(
    <div className={ui.paletteBackdrop} onMouseDown={onClose}>
      <div className={ui.palette} role="dialog" aria-label={t('panel.palette.open')} onMouseDown={(e) => e.stopPropagation()}>
        <label className={ui.paletteInput}>
          <SearchIcon width={18} height={18} />
          <input
            ref={input}
            value={text}
            placeholder={t('panel.palette.placeholder')}
            onChange={(event) => {
              setText(event.target.value)
              setIndex(0)
              setError(null)
            }}
            onKeyDown={onKey}
            aria-label={t('panel.palette.open')}
          />
          <kbd>Esc</kbd>
        </label>
        {done ? (
          <p className={ui.paletteDone}>✓ {done}</p>
        ) : (
          <ul className={ui.paletteList} role="listbox">
            {items.map((item, i) => (
              <li key={item.key}>
                <button
                  type="button"
                  role="option"
                  aria-selected={i === index}
                  disabled={busy}
                  onMouseEnter={() => setIndex(i)}
                  onClick={() => pick(item)}
                >
                  {item.user ? (
                    <Avatar seed={item.user.id} name={item.user.nombre ?? item.user.username} src={item.user.avatarUrl} size={26} />
                  ) : (
                    <span className={ui.paletteGlyph}>{item.fill ? '+' : '→'}</span>
                  )}
                  <span className={ui.grow}>{item.title}</span>
                  {item.hint && <small>{item.hint}</small>}
                </button>
              </li>
            ))}
            {waiting && <li className={ui.paletteEmpty}>{t('panel.palette.noUser', { name: named })}</li>}
            {!waiting && items.length === 0 && <li className={ui.paletteEmpty}>{t('panel.palette.nothing')}</li>}
          </ul>
        )}
        {error && <p className={`error-text ${ui.paletteError}`}>{error}</p>}
        <p className={ui.paletteFoot}>{t('panel.palette.examples')}</p>
      </div>
    </div>,
    document.body,
  )
}
