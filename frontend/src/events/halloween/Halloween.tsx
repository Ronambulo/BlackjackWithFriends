import type { EventTheme } from '../themes'
import styles from './Halloween.module.css'

/** Halloween: a night sky in purple, pumpkin orange for the light, a carved pumpkin for the box. */
export const halloween: EventTheme = {
  style: {
    '--event-ink': '#f6ecff',
    '--event-accent': '#ffa24a',
    '--event-bright': '#ffc24a',
    '--event-glow': '#ff7814',
    '--event-shade': '#07040c',
    '--event-border': 'rgb(255 140 40 / 0.28)',
    '--event-card': `radial-gradient(ellipse 70% 45% at 18% 0%, rgb(255 130 30 / 0.22), transparent 70%),
      radial-gradient(ellipse 90% 60% at 50% 110%, rgb(255 110 20 / 0.16), transparent 70%),
      linear-gradient(170deg, #2a1640 0%, #170c26 55%, #0d0716 100%)`,
    '--event-item': 'linear-gradient(180deg, rgb(40 22 60 / 0.8), rgb(16 8 26 / 0.8))',
    '--event-item-border': 'rgb(255 160 70 / 0.18)',
    '--event-bar': 'linear-gradient(90deg, #ff7a1a, #ffc24a)',
    '--event-button': 'linear-gradient(180deg, #ff9a2e, #e8620f)',
    '--event-button-ink': '#2a1204',
    '--event-title-font': "Georgia, 'Times New Roman', serif",
  },
  // Purple layers, pumpkin accents and stars over the top
  sky: {
    '--bg': '#120a1d',
    '--layer-1': '#21142f',
    '--layer-2': '#2b1a3d',
    '--layer-3': '#3a2450',
    '--nav-bg': '#160c24',
    '--surface': 'rgb(255 170 90 / 0.06)',
    '--surface-strong': 'rgb(255 170 90 / 0.1)',
    '--border': 'rgb(255 160 70 / 0.16)',
    '--text': '#f6ecff',
    '--text-dim': '#b8a3cc',
    '--accent': '#ff9a2e',
    '--accent-text': '#2a1204',
    '--event-line': 'rgb(255 160 70 / 0.14)',
    '--event-sky': `radial-gradient(1px 1px at 12% 18%, #fff8 50%, transparent),
      radial-gradient(1px 1px at 32% 8%, #fff6 50%, transparent),
      radial-gradient(1.5px 1.5px at 58% 22%, #fff9 50%, transparent),
      radial-gradient(1px 1px at 78% 12%, #fff5 50%, transparent),
      radial-gradient(1px 1px at 90% 30%, #fff7 50%, transparent),
      radial-gradient(1px 1px at 22% 40%, #fff4 50%, transparent),
      radial-gradient(1.5px 1.5px at 66% 46%, #fff5 50%, transparent),
      radial-gradient(ellipse 80% 40% at 50% 105%, rgb(255 110 20 / 0.22), transparent 70%),
      linear-gradient(180deg, #1c0f2e 0%, #120a1d 60%, #0c0614 100%)`,
  },
  Icon: Pumpkin,
  BannerArt: () => (
    <>
      <span className={styles.graves} aria-hidden="true" />
      <span className={styles.moon} aria-hidden="true" />
      <Bats className={styles.bats} />
    </>
  ),
  HeroArt: () => (
    <>
      <span className={styles.heroMoon} aria-hidden="true" />
      <Bats className={`${styles.bats} ${styles.heroBats}`} />
    </>
  ),
}

/** The box: a carved pumpkin with a lid, glowing from inside. */
function Pumpkin({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 64 64" aria-hidden="true">
      <defs>
        <radialGradient id="hw-skin" cx="0.4" cy="0.35" r="0.75">
          <stop offset="0" stopColor="#ffb347" />
          <stop offset="0.6" stopColor="#f07a1a" />
          <stop offset="1" stopColor="#a8440c" />
        </radialGradient>
      </defs>
      <path d="M31 14C30 9 32 5 36 3" stroke="#3f5a1e" strokeWidth="4" strokeLinecap="round" fill="none" />
      <path d="M36 9c5-3 10-2 12 1-4 1-8 1-12-1z" fill="#5c8a2a" />
      <ellipse cx="20" cy="38" rx="14" ry="20" fill="url(#hw-skin)" />
      <ellipse cx="44" cy="38" rx="14" ry="20" fill="url(#hw-skin)" />
      <ellipse cx="32" cy="38" rx="13" ry="21" fill="url(#hw-skin)" />
      <path d="M26 19c-2 8-2 30 0 38M38 19c2 8 2 30 0 38" stroke="#a8440c" strokeWidth="1.2" fill="none" opacity="0.6" />
      <g className={styles.face} fill="#ffe27a">
        <path d="M17 33l6-6 4 7zM47 33l-6-6-4 7z" />
        <path d="M30 37h4l-2 4z" />
        <path d="M15 44q17 12 34 0l-4 3-3-3-4 4-4-4-4 4-4-4-3 3z" />
      </g>
    </svg>
  )
}

/** A few bats crossing the top of the card. */
function Bats({ className }: { className: string }) {
  const bat = 'M0 0c2-3 5-3 6-1 1-2 2-2 3 0 1-2 2-2 3 0 1-2 4-2 6 1-3-1-5 0-6 2-1-1-2-1-3 0-1-1-2-1-3 0-1-2-3-3-6-2z'
  return (
    <svg className={className} viewBox="0 0 120 40" aria-hidden="true">
      <path d={bat} transform="translate(8 14) scale(0.9)" />
      <path d={bat} transform="translate(40 6) scale(0.6)" />
      <path d={bat} transform="translate(64 20) scale(0.75)" />
      <path d={bat} transform="translate(96 9) scale(0.5)" />
    </svg>
  )
}
