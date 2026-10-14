import type { Language } from '@/i18n'

const formatters = new Map<Language, Intl.NumberFormat>()

/** 12.450 / 12,450. Groups 4-digit numbers too, which Spanish formatting doesn't by default. */
export function formatNumber(value: number, language: Language): string {
  let formatter = formatters.get(language)
  if (!formatter) {
    formatter = new Intl.NumberFormat(language, { useGrouping: 'always' })
    formatters.set(language, formatter)
  }
  return formatter.format(value)
}
