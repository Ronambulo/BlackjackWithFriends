import type { CSSProperties, ReactNode } from 'react'
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
  const art = frame ? ART[frame] : undefined
  return (
    <span className={`${ring} ${className}`} style={{ '--frame-w': `${Math.max(2, Math.round(size * 0.07))}px`, ...style } as CSSProperties}>
      {art?.back && <Art className="frame-art frame-art-back">{art.back}</Art>}
      {avatar}
      {art?.front && <Art className={`frame-art ${art.spin ? 'frame-orbit' : ''}`}>{art.front}</Art>}
    </span>
  )
}

/*
  Frames that add something beyond the ring: drawn on a box 1.7 times the
  avatar's size around it, where the avatar is the circle of radius 50 in the
  middle and the ring reaches about 57. "back" goes behind the avatar and its
  ring (ears, wings), "front" over them (a crown, a halo).
*/
function Art({ className, children }: { className: string; children: ReactNode }) {
  return (
    <svg className={className} viewBox="-85 -85 170 170" aria-hidden="true">
      {children}
    </svg>
  )
}

/** A point at `r` from the middle, `deg` clockwise from the right. */
const at = (r: number, deg: number) => {
  const rad = (deg * Math.PI) / 180
  return [r * Math.cos(rad), r * Math.sin(rad)] as const
}

const GOLD = (
  <linearGradient id="frame-gold" x1="0" y1="0" x2="1" y2="1">
    <stop offset="0" stopColor="#fff1b8" />
    <stop offset="0.45" stopColor="#e2b33c" />
    <stop offset="1" stopColor="#8a5f10" />
  </linearGradient>
)

// A leaf pointing up from its stalk at (0, 0).
const LEAF = 'M0 0C4.5 -5 4.5 -13 0 -19C-4.5 -13 -4.5 -5 0 0Z'

/** One golden branch up the left side, from the bow at the bottom almost to the top, its leaves smaller as it climbs. */
function laurelBranch() {
  const leaves = []
  for (let i = 0; i < 9; i++) {
    const angle = 112 + i * 16
    const [x, y] = at(61, angle)
    const scale = 1.05 - i * 0.06
    // Along the stem, leaning out and in by turns
    const turn = angle + 180 + (i % 2 ? 38 : -30)
    leaves.push(
      <path key={i} d={LEAF} fill="url(#frame-gold)" stroke="#7a5208" strokeWidth="0.8" transform={`translate(${x} ${y}) rotate(${turn}) scale(${scale})`} />,
    )
  }
  const [x0, y0] = at(61, 100)
  const [x1, y1] = at(61, 252)
  return (
    <>
      <path d={`M${x0} ${y0}A61 61 0 0 1 ${x1} ${y1}`} fill="none" stroke="#8a5f10" strokeWidth="2.2" strokeLinecap="round" />
      {leaves}
    </>
  )
}

/** A five-petal flower. */
function Flower({ x, y, r, petal, heart }: { x: number; y: number; r: number; petal: string; heart: string }) {
  return (
    <g transform={`translate(${x} ${y})`}>
      {[0, 72, 144, 216, 288].map((deg) => (
        <ellipse key={deg} cy={-r * 0.55} rx={r * 0.45} ry={r * 0.6} transform={`rotate(${deg})`} fill={petal} stroke="rgb(0 0 0 / 0.12)" strokeWidth="0.5" />
      ))}
      <circle r={r * 0.3} fill={heart} />
    </g>
  )
}

const FLOWERS = ['#ff8fb1', '#ffd84a', '#ffffff', '#b99bff', '#ff8fb1', '#ffd84a', '#ffffff']

/** A four-pointed sparkle. */
const star = (x: number, y: number, r: number) =>
  `M${x} ${y - r}Q${x} ${y} ${x + r} ${y}Q${x} ${y} ${x} ${y + r}Q${x} ${y} ${x - r} ${y}Q${x} ${y} ${x} ${y - r}Z`

const BLOOD = '#8a0a12'

/** A kitchen knife lying flat along x, its handle to the left and its bloody point to the right. */
const KNIFE = (
  <>
    <path d="M-62 -8H84Q103 -8 117 -6.5Q101 10 62 10H-62Z" fill="url(#frame-steel)" stroke="#3a3f45" strokeWidth="1.2" strokeLinejoin="round" />
    <path d="M-62 2.6H64Q92 2.6 113 -4.8" stroke="#fff" strokeWidth="0.9" fill="none" opacity="0.7" />
    <path d="M-62 9H62Q100 9 115.5 -6" stroke="#fff" strokeWidth="0.6" fill="none" opacity="0.5" />
    <path d="M55 -8H94C89 -5 95 -2 89 1.5C85 4 91 7.5 85 10H55Z" fill={BLOOD} />
    <path d="M60 -8H76C72 -4 78 -1 70 4C66 6.5 70 8.5 64 10H60Z" fill="#5e0309" opacity="0.7" />
    <circle cx="99" cy="-3" r="1.4" fill={BLOOD} />
    <circle cx="104" cy="-5" r="0.9" fill={BLOOD} />
    <rect x="-70" y="-10.5" width="8.5" height="21" rx="2.2" fill="#5d646b" stroke="#2a2e33" />
    <path d="M-117 -6.5Q-121 0 -117 6.5Q-112 8.6 -70 8.6V-8.6Q-112 -8.6 -117 -6.5Z" fill="url(#frame-wood)" stroke="#140a04" strokeWidth="1.2" />
    <path d="M-114 -3H-74" stroke="#a06a40" strokeWidth="0.6" opacity="0.5" />
    {[-106, -92, -78].map((x) => (
      <circle key={x} cx={x} r="2.1" fill="#d6dbe0" stroke="#4a4f55" strokeWidth="0.8" />
    ))}
  </>
)

/** A drop of blood hanging from a point, this long. */
const drop = (x: number, y: number, len: number, half: number, inner: number, top: number) =>
  `M${x - half} ${y - top}C${x - half} ${y + len * 0.6} ${x - inner} ${y + len} ${x} ${y + len}C${x + inner} ${y + len} ${x + half} ${y + len * 0.6} ${x + half} ${y - top}Z`

/** Blood running down from the ring, at an angle. */
const ringDrip = (deg: number, len: number) => <path d={drop(...at(57, deg), len, 2.4, 1.6, 2)} fill={BLOOD} />

/** Blood running down from the blade, this far along it (the knife lies at -45°). */
const bladeDrip = (along: number, len: number) => <path d={drop(0.7071 * (along + 10), 0.7071 * (10 - along), len, 1.6, 1, 1)} fill={BLOOD} />

/** One lobe of the pumpkin round the avatar. */
const lobe = (cx: number, rx: number, ry: number) => <ellipse key={cx} cx={cx} cy="6" rx={rx} ry={ry} fill="#e8711a" stroke="#8a3c06" strokeWidth="2" />

const ART: Record<string, { back?: ReactNode; front?: ReactNode; spin?: boolean }> = {
  'marco.laurel': {
    front: (
      <>
        <defs>{GOLD}</defs>
        {laurelBranch()}
        <g transform="scale(-1 1)">{laurelBranch()}</g>
        {/* The ribbon tying the two branches at the bottom */}
        <g transform="translate(0 62)">
          <path d="M-3 2L-13 22L-8 19L-5 24L0 4ZM3 2L13 22L8 19L5 24L0 4Z" fill="#a8121f" />
          <path d="M0 0C-8 -10 -20 -8 -18 0C-20 8 -8 10 0 0C8 10 20 8 18 0C20 -8 8 -10 0 0Z" fill="#d42a3a" stroke="#7a0a14" strokeWidth="1" />
          <circle r="4" fill="#e8394a" stroke="#7a0a14" strokeWidth="1" />
        </g>
      </>
    ),
  },
  'marco.corona': {
    front: (
      <g transform="rotate(-14)">
        <defs>{GOLD}</defs>
        <path
          d="M-30 -53L-35 -76L-17 -64L0 -81L17 -64L35 -76L30 -53Z"
          fill="url(#frame-gold)"
          stroke="#7a5208"
          strokeWidth="1.5"
          strokeLinejoin="round"
        />
        <path d="M-31 -53Q0 -47 31 -53L31.8 -59Q0 -53 -31.8 -59Z" fill="#c9921f" stroke="#7a5208" strokeWidth="1" />
        <circle cx="-35" cy="-76" r="3.2" fill="#fff1b8" stroke="#7a5208" />
        <circle cx="0" cy="-81" r="3.4" fill="#fff1b8" stroke="#7a5208" />
        <circle cx="35" cy="-76" r="3.2" fill="#fff1b8" stroke="#7a5208" />
        <circle cx="0" cy="-63" r="4.6" fill="#d81e48" stroke="#7a0a14" />
        <circle cx="-18" cy="-60" r="3.5" fill="#2a66db" stroke="#0a1a4f" />
        <circle cx="18" cy="-60" r="3.5" fill="#14a86b" stroke="#033a24" />
        <circle cx="-1.4" cy="-64.4" r="1.4" fill="#fff" opacity="0.8" />
      </g>
    ),
  },
  'marco.diablo': {
    back: (
      <>
        <defs>
          <linearGradient id="frame-horn" x1="0" y1="1" x2="0" y2="0">
            <stop offset="0" stopColor="#8a0d0d" />
            <stop offset="1" stopColor="#ff5a3a" />
          </linearGradient>
        </defs>
        {[1, -1].map((side) => (
          <path
            key={side}
            d="M-14 -42C-16 -62 -8 -78 6 -86C0 -72 2 -58 12 -45Z"
            fill="url(#frame-horn)"
            stroke="#4a0505"
            strokeWidth="1.5"
            transform={`scale(${side} 1) rotate(-34)`}
          />
        ))}
        <path d="M30 40C52 60 70 52 72 36" fill="none" stroke="#b3121b" strokeWidth="4" strokeLinecap="round" />
        <path d="M72 24L80 40L64 38Z" fill="#b3121b" stroke="#4a0505" strokeWidth="1.2" strokeLinejoin="round" />
      </>
    ),
  },
  'marco.angel': {
    front: (
      <>
        <ellipse cy="-70" rx="30" ry="8" fill="none" stroke="#fff1b8" strokeWidth="9" opacity="0.35" />
        <ellipse cy="-70" rx="30" ry="8" fill="none" stroke="#f2c14e" strokeWidth="4.5" />
        <ellipse cy="-71" rx="28" ry="6.5" fill="none" stroke="#fff6d0" strokeWidth="1.2" />
      </>
    ),
  },
  'marco.flores': {
    front: (
      <>
        {Array.from({ length: 14 }, (_, i) => {
          const deg = i * (360 / 14) + 12
          const [x, y] = at(57, deg)
          return <path key={i} d={LEAF} fill={i % 2 ? '#3f8a30' : '#5aab44'} transform={`translate(${x} ${y}) rotate(${deg + 90 + (i % 2 ? 30 : -30)}) scale(0.62)`} />
        })}
        {Array.from({ length: 18 }, (_, i) => {
          const deg = i * 20 - 90
          // In and out of the ring by turns, so they overlap like a real wreath
          const [x, y] = at(i % 2 ? 61 : 55, deg)
          const petal = FLOWERS[i % FLOWERS.length]
          return <Flower key={i} x={x} y={y} r={i % 3 ? 10 : 12} petal={petal} heart={petal === '#ffd84a' ? '#e08a1a' : '#ffd84a'} />
        })}
      </>
    ),
  },
  'marco.orbita': {
    spin: true,
    front: (
      <g>
        <circle r="66" fill="none" stroke="rgb(190 210 255 / 0.55)" strokeWidth="1.2" strokeDasharray="3 5" />
        <path d={star(...at(66, 200), 9)} fill="#fff6c8" />
        <path d={star(...at(66, 320), 6)} fill="#b9e3ff" />
        <path d={star(...at(66, 80), 7)} fill="#ffd6f5" />
        <circle cx={at(66, 20)[0]} cy={at(66, 20)[1]} r="6" fill="#ff9a5a" />
        <ellipse cx={at(66, 20)[0]} cy={at(66, 20)[1]} rx="10" ry="2.6" fill="none" stroke="#ffd9b0" strokeWidth="1.4" transform={`rotate(-20 ${at(66, 20)[0]} ${at(66, 20)[1]})`} />
      </g>
    ),
  },
  // A knife stuck through the avatar: the blade behind it, the handle in front, and blood running down the ring.
  'marco.cuchillo': {
    back: (
      <>
        <defs>
          <linearGradient id="frame-steel" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#f7f9fb" />
            <stop offset="0.45" stopColor="#c3cad1" />
            <stop offset="0.52" stopColor="#8d969f" />
            <stop offset="1" stopColor="#dfe4e8" />
          </linearGradient>
          <linearGradient id="frame-wood" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#7a4a2a" />
            <stop offset="0.5" stopColor="#3b2214" />
            <stop offset="1" stopColor="#1f1109" />
          </linearGradient>
        </defs>
        <g transform="rotate(-45)">{KNIFE}</g>
        {bladeDrip(66, 9)}
        {bladeDrip(80, 14)}
      </>
    ),
    front: (
      <>
        <defs>
          <clipPath id="frame-knife-stub">
            <rect x="-130" y="-30" width="80" height="60" />
          </clipPath>
        </defs>
        <g transform="rotate(-45)" clipPath="url(#frame-knife-stub)">
          {KNIFE}
        </g>
        <path d={`M${at(56, 105).join(' ')}A56 56 0 0 1 ${at(56, 165).join(' ')}`} stroke={BLOOD} strokeWidth="5" fill="none" opacity="0.85" strokeLinecap="round" />
        <g fill={BLOOD}>
          <circle cx="-34" cy="34" r="5" />
          <circle cx="-27" cy="38" r="2.2" />
          <circle cx="-38" cy="27" r="1.8" />
          <circle cx="-24" cy="31" r="1.2" />
          <path d="M-36 33L-20 24L-31 38Z" />
        </g>
        {ringDrip(100, 13)}
        {ringDrip(122, 18)}
        {ringDrip(142, 10)}
        {ringDrip(70, 8)}
      </>
    ),
  },
  // The avatar inside a pumpkin, with its stem, a leaf and a curling tendril.
  'marco.calabaza': {
    back: <>{[lobe(-38, 38, 56), lobe(38, 38, 56), lobe(-20, 40, 62), lobe(20, 40, 62)]}</>,
    front: (
      <>
        <path d="M-20 -60C-32 -72 -44 -66 -40 -57C-37 -51 -29 -56 -33 -61" fill="none" stroke="#4f8f37" strokeWidth="2.4" strokeLinecap="round" />
        <path d="M-6 -56C-7 -67 -4 -75 4 -80L10 -76C4 -71 4 -65 6 -56Z" fill="#6b5a2a" stroke="#3a2c10" strokeWidth="1.5" />
        <path d="M6 -64C16 -80 34 -78 40 -69C29 -62 16 -60 6 -64Z" fill="#4f8f37" stroke="#2e5a1e" strokeWidth="1.3" />
      </>
    ),
  },
}
