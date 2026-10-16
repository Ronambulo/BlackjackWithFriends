import type { CSSProperties } from 'react'
import { frameClass } from '@/cosmetics/themes'
import { avatarColor } from './avatarColor'

/**
 * The player's photo, or their initial in a circle of their own colour. With a
 * `frame` (a style from the shop, globals.css) it wears a ring around it that
 * doesn't take up room.
 */
export function Avatar({
  seed,
  name,
  src,
  size = 36,
  frame,
  className = '',
  style,
}: {
  seed: string
  name: string
  src?: string | null
  size?: number
  frame?: string | null
  className?: string
  style?: CSSProperties
}) {
  const ring = frameClass(frame)
  const avatar = (
    <span
      className={`avatar ${ring ? '' : className}`}
      aria-hidden="true"
      style={{ width: size, height: size, fontSize: Math.round(size * 0.38), background: avatarColor(seed), ...(ring ? {} : style) }}
    >
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element -- a small photo from our own /api/media
        <img src={src} alt="" width={size} height={size} loading="lazy" decoding="async" />
      ) : (
        name.charAt(0).toUpperCase()
      )}
    </span>
  )
  if (!ring) return avatar
  return (
    <span className={`${ring} ${className}`} style={{ '--frame-w': `${Math.max(2, Math.round(size * 0.07))}px`, ...style } as CSSProperties}>
      {avatar}
      {frame === 'marco.laurel' && <Laurel />}
    </span>
  )
}

// Two branches of leaves up the sides, meeting at the top.
const LEAVES = Array.from({ length: 7 }, (_, i) => 205 + i * 20)

function Laurel() {
  return (
    <svg className="frame-leaves" viewBox="-60 -60 120 120" aria-hidden="true">
      {[1, -1].map((side) =>
        LEAVES.map((angle, i) => (
          <ellipse
            key={`${side}${angle}`}
            rx="5"
            ry="11"
            fill={i % 2 ? '#3f8f4a' : '#5fb46a'}
            stroke="#d9b24a"
            strokeWidth="1"
            transform={`scale(${side} 1) rotate(${angle}) translate(0 -52) rotate(28)`}
          />
        )),
      )}
    </svg>
  )
}
