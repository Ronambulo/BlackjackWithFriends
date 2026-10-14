import type { CSSProperties } from 'react'
import { avatarColor } from './avatarColor'

/** The player's initial in a coloured circle. */
export function Avatar({
  seed,
  name,
  size = 36,
  className = '',
  style,
}: {
  seed: string
  name: string
  size?: number
  className?: string
  style?: CSSProperties
}) {
  return (
    <span
      className={`avatar ${className}`}
      aria-hidden="true"
      style={{ width: size, height: size, fontSize: Math.round(size * 0.38), background: avatarColor(seed), ...style }}
    >
      {name.charAt(0).toUpperCase()}
    </span>
  )
}
