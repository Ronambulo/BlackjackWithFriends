import { currentLanguage } from '@/i18n'

export function number(value: number, digits = 0) {
  return new Intl.NumberFormat(currentLanguage(), { maximumFractionDigits: digits, useGrouping: 'always' }).format(value)
}

export function duration(ms: number) {
  const minutes = Math.round(ms / 60_000)
  return minutes < 60 ? `${minutes} min` : `${Math.floor(minutes / 60)} h ${minutes % 60} min`
}

export function date(ms: number | null) {
  return ms ? new Intl.DateTimeFormat(currentLanguage(), { dateStyle: 'short', timeStyle: 'short' }).format(ms) : '—'
}

export function percent(value: number | null, digits = 0) {
  return value === null ? '—' : `${number(value * 100, digits)} %`
}

/** How long ago, in the biggest unit that fits ("3 min", "2 h", "4 d"). */
export function ago(ms: number | null, now = Date.now()) {
  if (!ms) return '—'
  const minutes = Math.max(0, Math.round((now - ms) / 60_000))
  if (minutes < 1) return '<1 min'
  if (minutes < 60) return `${minutes} min`
  if (minutes < 60 * 24) return `${Math.round(minutes / 60)} h`
  return `${Math.round(minutes / 60 / 24)} d`
}

/** Change from one week to the next, as text and whether it's good news (null: no change). */
export function delta(current: number, previous: number, format: (value: number) => string = (v) => number(v)) {
  const diff = current - previous
  if (Math.abs(diff) < 1e-9) return { text: '=', up: null as boolean | null }
  const text = previous ? `${diff > 0 ? '+' : '−'}${number(Math.abs(diff / previous) * 100)} %` : `${diff > 0 ? '+' : '−'}${format(Math.abs(diff))}`
  return { text, up: diff > 0 }
}
