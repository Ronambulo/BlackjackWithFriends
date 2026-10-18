'use client'

import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { TFunction } from 'i18next'
import { useCalendar, type CalendarItem } from '@/admin/useAdminTools'
import { currentLanguage } from '@/i18n'
import { ChevronLeftIcon, ChevronRightIcon } from '@/ui/icons'
import styles from './admin.module.css'
import { useAdminPanel } from './context'
import ui from './tools.module.css'

type CalendarKind = 'event' | 'notice' | 'push' | 'test' | 'weekClose' | 'weeklyReport' | 'pollEnd'

const DAY = 24 * 60 * 60 * 1000

type Family = 'events' | 'weeks' | 'comms'

/** Which colour of the legend an item takes. */
function family(kind: string): Family {
  if (kind.startsWith('event:') || kind === 'test') return 'events'
  if (kind === 'weekClose') return 'weeks'
  return 'comms'
}

/** Midnight of that day, local time. */
const startOfDay = (ms: number) => {
  const d = new Date(ms)
  d.setHours(0, 0, 0, 0)
  return d.getTime()
}

/** The month at a glance: events, notices, pushes, polls ending and the weeks closing. */
export function CalendarTab() {
  const { t } = useTranslation()
  const { go } = useAdminPanel()
  const [month, setMonth] = useState(() => {
    const d = new Date()
    return new Date(d.getFullYear(), d.getMonth(), 1).getTime()
  })
  const first = new Date(month)
  // The grid starts on the Monday on or before the 1st and runs whole weeks.
  const gridStart = startOfDay(month - ((first.getDay() + 6) % 7) * DAY)
  const last = new Date(first.getFullYear(), first.getMonth() + 1, 0)
  const weeks = Math.ceil(((first.getDay() + 6) % 7 + last.getDate()) / 7)
  const gridEnd = gridStart + weeks * 7 * DAY + 2 * 60 * 60 * 1000
  const { data } = useCalendar(gridStart, gridEnd)
  const today = startOfDay(Date.now())

  const days = useMemo(() => {
    const out: { at: number; items: CalendarItem[] }[] = []
    for (let i = 0; i < weeks * 7; i++) {
      // By date, not by adding 24 h, so a change of clocks doesn't shift a day.
      const at = new Date(first.getFullYear(), first.getMonth(), 1 - ((first.getDay() + 6) % 7) + i).getTime()
      const end = at + DAY
      out.push({
        at,
        items: (data ?? []).filter((item) => (item.end ? item.at < end && item.end >= at : item.at >= at && item.at < end)),
      })
    }
    return out
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, month])

  const shift = (n: number) => setMonth(new Date(first.getFullYear(), first.getMonth() + n, 1).getTime())
  const lang = currentLanguage()
  const weekday = new Intl.DateTimeFormat(lang, { weekday: 'short' })
  const time = new Intl.DateTimeFormat(lang, { hour: '2-digit', minute: '2-digit' })

  return (
    <section className={`card ${styles.block}`}>
      <div className={styles.sectionHead}>
        <div className={ui.monthNav}>
          <button type="button" className={ui.iconBtn} onClick={() => shift(-1)} aria-label={t('panel.calendar.prev')}>
            <ChevronLeftIcon width={18} height={18} />
          </button>
          <h2 className={ui.monthTitle}>{new Intl.DateTimeFormat(lang, { month: 'long', year: 'numeric' }).format(month).replace(/^./, (c) => c.toUpperCase())}</h2>
          <button type="button" className={ui.iconBtn} onClick={() => shift(1)} aria-label={t('panel.calendar.next')}>
            <ChevronRightIcon width={18} height={18} />
          </button>
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={() => setMonth(new Date(new Date().getFullYear(), new Date().getMonth(), 1).getTime())}
          >
            {t('panel.calendar.today')}
          </button>
        </div>
        <div className={ui.legend}>
          {(['events', 'weeks', 'comms'] as Family[]).map((f) => (
            <span key={f}>
              <i data-family={f} /> {t(`panel.calendar.legend.${f}`)}
            </span>
          ))}
          <button type="button" className="btn btn-primary btn-sm" onClick={() => go('economy')}>
            {t('panel.calendar.schedule')}
          </button>
        </div>
      </div>
      <div className={ui.calendar}>
        {days.slice(0, 7).map((d) => (
          <span key={`h${d.at}`} className={ui.calHead}>
            {weekday.format(d.at)}
          </span>
        ))}
        {days.map((d) => {
          const date = new Date(d.at)
          return (
            <div
              key={d.at}
              className={ui.calDay}
              data-out={date.getMonth() !== first.getMonth() || undefined}
              data-today={d.at === today || undefined}
              data-past={d.at < today || undefined}
            >
              <span className={ui.calNumber}>{date.getDate()}</span>
              {d.items.slice(0, 4).map((item, i) => (
                <span
                  key={`${item.kind}${item.id ?? item.title}${i}`}
                  className={ui.calItem}
                  data-family={family(item.kind)}
                  title={`${t(`panel.calendar.kind.${item.kind.split(':')[0] as CalendarKind}`)} · ${item.title}`}
                >
                  {item.at >= d.at && item.at < d.at + DAY && !item.end ? `${time.format(item.at)} ` : ''}
                  {label(item, t)}
                </span>
              ))}
              {d.items.length > 4 && <small className={styles.dim}>{t('panel.calendar.more', { count: d.items.length - 4 })}</small>}
            </div>
          )
        })}
      </div>
    </section>
  )
}

function label(item: CalendarItem, t: TFunction) {
  if (item.kind === 'weekClose') return t('panel.calendar.weekClose')
  if (item.kind === 'weeklyReport') return t('panel.calendar.weeklyReport')
  if (item.kind === 'test') return t('panel.calendar.test', { name: t(`styles.items.${item.title}`, { defaultValue: item.title }) })
  if (item.kind === 'pollEnd') return t('panel.calendar.pollEnd', { name: item.title })
  return item.title
}
