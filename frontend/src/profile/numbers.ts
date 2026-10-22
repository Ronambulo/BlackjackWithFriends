import { currentLanguage } from '@/i18n'
import { formatNumber } from '@/lib/format'

/** A result with its sign: +120, −40, 0. */
export function signed(value: number) {
  const number = formatNumber(Math.abs(value), currentLanguage())
  return value > 0 ? `+${number}` : value < 0 ? `−${number}` : number
}

export function percent(part: number, whole: number) {
  return whole ? Math.round((part / whole) * 100) : 0
}
