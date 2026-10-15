import type { CSSProperties } from 'react'
import { avatarColor } from './avatarColor'

/** The player's photo, or their initial in a circle of their own colour. */
export function Avatar({
  seed,
  name,
  src,
  size = 36,
  className = '',
  style,
}: {
  seed: string
  name: string
  src?: string | null
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
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element -- a small photo from our own /api/media
        <img src={src} alt="" width={size} height={size} loading="lazy" decoding="async" />
      ) : (
        name.charAt(0).toUpperCase()
      )}
    </span>
  )
}
