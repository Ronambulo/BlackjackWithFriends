import type { CSSProperties } from 'react'

// Gold, silver and bronze for the first three places.
const MEDALS = ['#f2c14e', '#d1d5db', '#d69a6a']

/** Sets `--medal` to the colour of a place. */
export function medal(rank: number) {
  return { '--medal': MEDALS[rank - 1] ?? 'var(--text-dim)' } as CSSProperties
}
