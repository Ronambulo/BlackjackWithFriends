import type { CSSProperties } from 'react'

/*
  What each style looks like (the catalogue, prices and who owns what are in
  backend/lib/cosmetics.ts). Every style is a set of CSS variables: the shell
  sets the player's on the whole app, and a preview sets another one on just its
  own box. The felt (AppShell, Table), the cards (PlayingCard) and the chips
  (Table) read them; each kind's first entry is also the CSS's fallback.
*/

export type CosmeticKind = 'tapete' | 'dorso' | 'cartas' | 'fichas' | 'marco'
export type Equipped = Record<CosmeticKind, string>

export const KINDS: CosmeticKind[] = ['tapete', 'cartas', 'dorso', 'fichas', 'marco']

export const DEFAULT_EQUIPPED: Equipped = {
  tapete: 'tapete.verde',
  dorso: 'dorso.rojo',
  cartas: 'cartas.clasicas',
  fichas: 'fichas.casino',
  marco: 'marco.ninguno',
}

type Vars = Record<`--${string}`, string>

// ── Felts ───────────────────────────────────────────────────────────────────

/** A felt lit from above the middle, from its lit centre out to its dark edge. */
const lit = (centre: string, mid: string, edge: string) =>
  `radial-gradient(ellipse 90% 60% at 50% 38%, ${centre} 0%, ${mid} 60%, ${edge} 100%)`

const felt = (background: string, bar: string, print = 'rgb(242 193 78)'): Vars => ({
  '--felt-bg': background,
  '--felt-bar': bar,
  '--felt-print': print,
})

/** An SVG drawing as a CSS image. */
const svg = (width: number, height: number, body: string) =>
  `url("data:image/svg+xml,${encodeURIComponent(
    `<svg xmlns='http://www.w3.org/2000/svg' width='${width}' height='${height}' viewBox='0 0 ${width} ${height}'>${body}</svg>`,
  )}")`

/** Soft colour bands, one wave over the next, from the top down. */
const bands = (colours: string[]) => {
  const step = 600 / colours.length
  return svg(
    1000,
    600,
    colours
      .map((colour, i) => {
        const y = i * step - 20
        const lift = i % 2 ? 26 : -22
        return `<path d='M0 ${y} C250 ${y + lift} 450 ${y - lift} 700 ${y + lift / 2} S900 ${y - lift} 1000 ${y} V600 H0 Z' fill='${colour}'/>`
      })
      .join(''),
  )
}

/** The same random numbers every time, so a drawing doesn't change between renders. */
const seeded = (seed: number) => () => (seed = (seed * 16807) % 2147483647) / 2147483647

/** Clouds of coloured gas across the felt, with a dark lane of dust and stars all over. */
function galaxy() {
  const random = seeded(29)
  const stars = Array.from({ length: 260 }, () => {
    const r = (0.35 + random() ** 3 * 1.4).toFixed(2)
    return `<circle cx='${(random() * 1000).toFixed(0)}' cy='${(random() * 600).toFixed(0)}' r='${r}' fill='#fff' opacity='${(0.35 + random() * 0.65).toFixed(2)}'/>`
  }).join('')
  const glints = [
    [180, 120],
    [830, 90],
    [620, 470],
    [90, 430],
    [900, 380],
  ]
    .map(
      ([x, y]) =>
        `<g stroke='#fff' stroke-linecap='round' opacity='0.9'><path d='M${x - 7} ${y}h14M${x} ${y - 7}v14' stroke-width='0.8'/></g><circle cx='${x}' cy='${y}' r='1.8' fill='#fff'/>`,
    )
    .join('')
  return svg(
    1000,
    600,
    `<defs>${[
      ['p', '#6a2bd1', 0.7],
      ['k', '#d0408f', 0.6],
      ['u', '#2b5bd1', 0.55],
      ['c', '#ffd9f2', 0.75],
      ['d', '#070418', 0.6],
    ]
      .map(([id, colour, opacity]) => `<radialGradient id='${id}'><stop offset='0' stop-color='${colour}' stop-opacity='${opacity}'/><stop offset='1' stop-color='${colour}' stop-opacity='0'/></radialGradient>`)
      .join('')}</defs>` +
      `<g transform='rotate(-14 500 300)'>` +
      `<ellipse cx='300' cy='270' rx='400' ry='190' fill='url(#p)'/>` +
      `<ellipse cx='690' cy='320' rx='340' ry='160' fill='url(#k)'/>` +
      `<ellipse cx='520' cy='230' rx='380' ry='120' fill='url(#u)'/>` +
      `<ellipse cx='500' cy='300' rx='200' ry='80' fill='url(#c)'/>` +
      `<ellipse cx='480' cy='316' rx='400' ry='26' fill='url(#d)'/></g>` +
      stars +
      glints,
  )
}

const TAPETES: Record<string, Vars> = {
  'tapete.verde': felt(lit('#14834c', '#0c5a34', '#073a22'), '#0b5231'),
  'tapete.azul': felt(lit('#2468b5', '#13407a', '#0a254a'), '#103869'),
  'tapete.burdeos': felt(lit('#9a2a40', '#621527', '#380a14'), '#541121'),
  'tapete.morado': felt(lit('#6a40ad', '#3d2270', '#221240'), '#351d61'),
  'tapete.grafito': felt(lit('#474d55', '#2a2e34', '#15181b'), '#22262b', 'rgb(214 220 228)'),
  'tapete.madera': felt(
    [
      'repeating-linear-gradient(93deg, rgb(0 0 0 / 0.1) 0 2px, transparent 2px 11px)',
      'repeating-linear-gradient(87deg, rgb(255 220 180 / 0.05) 0 1px, transparent 1px 27px)',
      lit('#94603a', '#643f22', '#3a2412'),
    ].join(', '),
    '#4a2e17',
    'rgb(255 222 160)',
  ),
  'tapete.pixel': felt(
    [
      lit('rgb(255 255 255 / 0.08)', 'transparent', 'rgb(0 0 0 / 0.35)'),
      'conic-gradient(#23914f 25%, #1b7b42 0 50%, #23914f 0 75%, #1b7b42 0) 0 0 / 16px 16px',
    ].join(', '),
    '#145c33',
    'rgb(255 225 77)',
  ),
  'tapete.cosmos': felt(
    [lit('transparent', 'rgb(0 0 0 / 0.1)', 'rgb(0 0 0 / 0.45)'), `${galaxy()} center / cover`, '#070418'].join(', '),
    '#0d0824',
    'rgb(230 210 255)',
  ),
  'tapete.turquesa': felt(lit('#1ba3a0', '#0f6f6d', '#073f3e'), '#0b5c5a'),
  'tapete.escoces': felt(
    [
      'repeating-linear-gradient(90deg, rgb(0 0 0 / 0.28) 0 18px, transparent 18px 36px, rgb(242 193 78 / 0.22) 36px 38px, transparent 38px 54px)',
      'repeating-linear-gradient(0deg, rgb(0 0 0 / 0.28) 0 18px, transparent 18px 36px, rgb(242 193 78 / 0.22) 36px 38px, transparent 38px 54px)',
      lit('#b0313a', '#7c1d26', '#470c13'),
    ].join(', '),
    '#5f1820',
  ),
  'tapete.medianoche': felt(
    [
      'radial-gradient(1.5px 1.5px at 12% 18%, rgb(255 255 255 / 0.7), transparent)',
      'radial-gradient(1px 1px at 78% 12%, rgb(255 255 255 / 0.6), transparent)',
      'radial-gradient(1.5px 1.5px at 64% 44%, rgb(255 255 255 / 0.5), transparent)',
      'radial-gradient(1px 1px at 30% 62%, rgb(255 255 255 / 0.5), transparent)',
      'radial-gradient(1px 1px at 88% 70%, rgb(255 255 255 / 0.6), transparent)',
      lit('#1f2a5e', '#0f1536', '#06081a'),
    ].join(', '),
    '#0c1029',
    'rgb(200 210 255)',
  ),
  'tapete.campeon': felt(lit('#c9921f', '#8a5f10', '#4a3006'), '#6e4c0c', 'rgb(255 244 200)'),
  'tapete.coral': felt(lit('#e0705a', '#b24a39', '#6e2a1f'), '#8e3b2d', 'rgb(255 236 210)'),
  'tapete.oliva': felt(lit('#7d8a3c', '#566126', '#2f3613'), '#454e1d'),
  // Beach awning stripes.
  'tapete.riviera': felt(
    [
      'repeating-linear-gradient(90deg, rgb(255 255 255 / 0.12) 0 16px, transparent 16px 32px)',
      lit('#1aa2b0', '#0f6e78', '#063c42'),
    ].join(', '),
    '#0b5860',
    'rgb(255 236 210)',
  ),
  // Black marble with pale veins.
  'tapete.marmol': felt(
    [
      'linear-gradient(118deg, transparent 38%, rgb(255 255 255 / 0.09) 39.5%, transparent 41%)',
      'linear-gradient(140deg, transparent 62%, rgb(255 255 255 / 0.07) 63%, transparent 64%)',
      'radial-gradient(ellipse 60% 18% at 30% 40%, rgb(255 255 255 / 0.09), transparent 70%)',
      'radial-gradient(ellipse 40% 12% at 72% 72%, rgb(255 255 255 / 0.07), transparent 70%)',
      lit('#3d3f44', '#26272b', '#141517'),
    ].join(', '),
    '#1f2023',
  ),
  // Picnic gingham.
  'tapete.vichy': felt(
    [
      'linear-gradient(90deg, rgb(255 255 255 / 0.13) 50%, transparent 50%) 0 0 / 26px 26px',
      'linear-gradient(rgb(255 255 255 / 0.13) 50%, transparent 50%) 0 0 / 26px 26px',
      lit('#c23a3a', '#8e2424', '#521212'),
    ].join(', '),
    '#721c1c',
    'rgb(255 236 210)',
  ),
  // Iridescent like a foil card, toned down so the cards still read.
  'tapete.holografico': felt(
    [
      'linear-gradient(rgb(20 18 40 / 0.4), rgb(20 18 40 / 0.4))',
      'linear-gradient(120deg, rgb(255 255 255 / 0.18), transparent 40%)',
      'conic-gradient(from 200deg at 50% 60%, #8fd3ff, #c6a3ff, #ffb3e1, #fff1a8, #a6ffd9, #8fd3ff)',
    ].join(', '),
    '#4a4470',
    'rgb(255 255 255)',
  ),
  // Private-room green with a gold inlay just inside the edge.
  'tapete.montecarlo': felt(
    [
      'linear-gradient(#d4af37, #d4af37) 8px 8px / calc(100% - 16px) 2px no-repeat',
      'linear-gradient(#d4af37, #d4af37) 8px calc(100% - 8px) / calc(100% - 16px) 2px no-repeat',
      'linear-gradient(#d4af37, #d4af37) 8px 8px / 2px calc(100% - 16px) no-repeat',
      'linear-gradient(#d4af37, #d4af37) calc(100% - 8px) 8px / 2px calc(100% - 16px) no-repeat',
      'radial-gradient(circle, rgb(242 193 78 / 0.12) 0 2px, transparent 2.5px) 0 0 / 30px 30px',
      lit('#17834f', '#0d5a35', '#063620'),
    ].join(', '),
    '#0a3d24',
  ),
  // Dark, metal and nature
  'tapete.abismo': felt(lit('#2a2236', '#151020', '#07050c'), '#110c1a', 'rgb(190 170 230)'),
  'tapete.musgo': felt(lit('#4f6b3a', '#324722', '#1a2711'), '#2a3b1c', 'rgb(220 230 170)'),
  // Volcanic glass: near black, with a violet sheen.
  'tapete.obsidiana': felt(
    [
      'linear-gradient(125deg, transparent 35%, rgb(160 120 255 / 0.12) 45%, transparent 55%)',
      'linear-gradient(60deg, transparent 55%, rgb(255 255 255 / 0.06) 62%, transparent 70%)',
      lit('#1e1a26', '#0d0b12', '#040306'),
    ].join(', '),
    '#0b0910',
    'rgb(200 180 255)',
  ),
  // Warm-to-teal waves, like a retro sunset; its light bands need a shadow under the writing.
  'tapete.ondas': {
    ...felt(
      [
        lit('transparent', 'rgb(0 0 0 / 0.08)', 'rgb(0 0 0 / 0.35)'),
        `${bands(['#e0846c', '#c96a5e', '#a35a52', '#8c4648', '#b8554e', '#e06e5c', '#ed9a6e', '#f3c07a', '#e9d48a', '#b7c08e', '#7fa88c', '#5e8f86'])} center / cover`,
        '#8c4648',
      ].join(', '),
      '#5b3236',
      'rgb(255 236 210)',
    ),
    '--felt-shadow': 'rgb(70 25 30 / 0.7)',
  },
}

// ── Card backs ──────────────────────────────────────────────────────────────

const cross = (colour: string) =>
  [
    'repeating-linear-gradient(45deg, rgb(255 255 255 / 0.12) 0 3px, transparent 3px 8px)',
    'repeating-linear-gradient(-45deg, rgb(255 255 255 / 0.12) 0 3px, transparent 3px 8px)',
    colour,
  ].join(', ')

const back = (background: string, edge = '#fbfaf6'): Vars => ({ '--card-back': background, '--card-back-edge': edge })

const diamonds = (a: string, b: string) =>
  [
    `linear-gradient(135deg, ${b} 25%, transparent 25%) -6px 0 / 12px 12px`,
    `linear-gradient(225deg, ${b} 25%, transparent 25%) -6px 0 / 12px 12px`,
    `linear-gradient(315deg, ${b} 25%, transparent 25%) 0 0 / 12px 12px`,
    `linear-gradient(45deg, ${b} 25%, transparent 25%) 0 0 / 12px 12px`,
    a,
  ].join(', ')

const DORSOS: Record<string, Vars> = {
  'dorso.rojo': back(cross('#8e1d2c')),
  'dorso.azul': back(cross('#1f4fa8')),
  'dorso.verde': back(cross('#17703f')),
  'dorso.negro': back(cross('#1b1d22')),
  'dorso.morado': back(cross('#5b2d91')),
  'dorso.rombos': back(diamonds('#1c3f6e', '#2d64a8')),
  'dorso.retro': back(
    'repeating-linear-gradient(180deg, #e8a33d 0 5px, #d2622b 5px 10px, #8c2f39 10px 15px, #2b6f6b 15px 20px)',
    '#f3e6c8',
  ),
  'dorso.artdeco': back(
    [
      'repeating-radial-gradient(circle at 50% 100%, transparent 0 5px, rgb(212 175 55 / 0.6) 5px 6px)',
      'repeating-radial-gradient(circle at 50% 0%, transparent 0 5px, rgb(212 175 55 / 0.35) 5px 6px)',
      '#121212',
    ].join(', '),
    '#d4af37',
  ),
  'dorso.pixel': back('conic-gradient(#3b2a8f 25%, #5a3fd0 0 50%, #3b2a8f 0 75%, #5a3fd0 0) 0 0 / 8px 8px', '#ffe14d'),
  'dorso.kamikaze': back(
    [
      'radial-gradient(circle at 50% 55%, #d1192b 0 20%, transparent 21%)',
      'repeating-conic-gradient(from 0deg at 50% 55%, #d1192b 0 9deg, #f4efe6 9deg 18deg)',
    ].join(', '),
  ),
  'dorso.abismo': back(cross('#241a33')),
  'dorso.musgo': back(cross('#3c5a2a')),
  'dorso.carbono': back('conic-gradient(from 45deg, #1d1f22 25%, #2c2f33 0 50%, #1d1f22 0 75%, #2c2f33 0) 0 0 / 6px 6px', '#9aa3ad'),
  'dorso.obsidiana': back(
    [
      'linear-gradient(125deg, transparent 30%, rgb(170 130 255 / 0.25) 45%, transparent 60%)',
      'repeating-linear-gradient(60deg, rgb(255 255 255 / 0.04) 0 1px, transparent 1px 6px)',
      '#0c0a12',
    ].join(', '),
    '#6f5aa8',
  ),
  // The glass card itself, clear, with no frame and nothing printed on it.
  'dorso.cristal': {
    ...back(
      [
        'linear-gradient(115deg, transparent 18%, rgb(255 255 255 / 0.55) 22%, transparent 30%, transparent 58%, rgb(255 255 255 / 0.3) 62%, transparent 66%)',
        'linear-gradient(160deg, rgb(225 245 255 / 0.55), rgb(170 215 240 / 0.35))',
      ].join(', '),
      'transparent',
    ),
    '--card-back-origin': 'border-box',
    '--card-back-blur': 'blur(3px) saturate(1.4)',
  },
}

// ── Card faces and shapes ───────────────────────────────────────────────────

/** Light falling on a coloured card from the top left. */
const CARD_SHEEN = 'linear-gradient(155deg, rgb(255 255 255 / 0.2), transparent 45%, rgb(0 0 0 / 0.12))'

/** A five-petal cherry blossom. */
const blossom = (x: number, y: number, r: number) =>
  `<g transform='translate(${x} ${y})'>` +
  [0, 72, 144, 216, 288]
    .map((deg) => `<ellipse cy='${-r * 0.55}' rx='${r * 0.42}' ry='${r * 0.58}' transform='rotate(${deg})' fill='#f9b3c9'/>`)
    .join('') +
  `<circle r='${r * 0.32}' fill='#e5668f'/><circle r='${r * 0.13}' fill='#ffd36b'/></g>`

/** Two cherry branches across the corners the indices leave free, on a 50 × 70 card. */
function blossoms() {
  const branch =
    `<path d='M52 17 C45 14 41 9 33 1 M42 10 C44 6 47 4 50 3' fill='none' stroke='#8a5a4a' stroke-width='1.1' stroke-linecap='round'/>` +
    blossom(41, 9, 4.6) +
    blossom(34, 3, 3.4) +
    blossom(48, 14, 3) +
    `<circle cx='49' cy='3.4' r='1.3' fill='#f48fb1'/>` +
    `<ellipse cx='30' cy='12' rx='1.1' ry='0.7' fill='#f9b3c9' transform='rotate(30 30 12)'/>`
  return svg(50, 70, `${branch}<g transform='rotate(180 25 35)'>${branch}</g>`)
}

/*
  --card-ink: spades (and clubs, unless --card-club); --card-red: hearts (and
  diamonds, unless --card-diamond); --card-face-s/h/d/c: one suit's own card.
  Sizes are fractions of the card's width.
*/
const CARTAS: Record<string, Vars> = {
  'cartas.clasicas': {},
  // Each suit on a card of its own colour, so the suit reads at a glance.
  'cartas.cuatro': {
    '--card-face-s': `${CARD_SHEEN}, #262a33`,
    '--card-face-h': `${CARD_SHEEN}, #c8283a`,
    '--card-face-d': `${CARD_SHEEN}, #1f63c6`,
    '--card-face-c': `${CARD_SHEEN}, #1d8a3e`,
    '--card-ink': '#fff',
    '--card-red': '#fff',
  },
  'cartas.vintage': {
    '--card-face': '#f3e6c8',
    '--card-ink': '#2b2118',
    '--card-red': '#9c2a1f',
    '--card-font': 'Georgia, "Times New Roman", serif',
    '--card-frame': 'inset 0 0 0 3px #f3e6c8, inset 0 0 0 4px #b89b6a',
  },
  'cartas.noir': {
    '--card-face': '#16181c',
    '--card-ink': '#f2f3f5',
    '--card-red': '#ff5a6e',
    '--card-frame': 'inset 0 0 0 1px rgb(255 255 255 / 0.16)',
  },
  'cartas.neon': {
    '--card-face': '#0b0718',
    '--card-ink': '#00e5ff',
    '--card-red': '#ff2ec4',
    '--card-glow': '0 0 6px currentColor',
    '--card-frame': 'inset 0 0 0 1.5px rgb(0 229 255 / 0.55), inset 0 0 14px rgb(255 46 196 / 0.3)',
    '--card-back-edge': '#00e5ff',
  },
  'cartas.pastel': {
    '--card-face': '#fff7f0',
    '--card-ink': '#4b5a8a',
    '--card-red': '#e2788f',
    '--card-diamond': '#e49a5c',
    '--card-club': '#4f9a86',
    '--card-frame': 'inset 0 0 0 3px #fff7f0, inset 0 0 0 4px #f1d9e2',
  },
  // The classic deck in pink, with a cherry branch in bloom in two corners.
  'cartas.sakura': {
    '--card-face': `${blossoms()} center / 100% 100% no-repeat, #fff3f6`,
    '--card-ink': '#16181c',
    '--card-red': '#d23a62',
  },
  // After Balatro's glass cards: see-through, with a sheen across it.
  'cartas.cristal': {
    '--card-face': [
      'linear-gradient(115deg, transparent 18%, rgb(255 255 255 / 0.55) 22%, transparent 30%, transparent 58%, rgb(255 255 255 / 0.3) 62%, transparent 66%)',
      'linear-gradient(160deg, rgb(225 245 255 / 0.55), rgb(170 215 240 / 0.35))',
    ].join(', '),
    '--card-blur': 'blur(3px) saturate(1.4)',
    '--card-ink': '#0f2a3d',
    '--card-red': '#c11d4a',
    '--card-glow': '0 0 2px rgb(255 255 255 / 0.9)',
    '--card-frame': 'inset 0 0 0 1.5px rgb(255 255 255 / 0.8), inset 0 0 10px rgb(255 255 255 / 0.45)',
  },
  // Black with a red that glows, for the metalheads.
  'cartas.sangre': {
    '--card-face': 'radial-gradient(ellipse at 50% 120%, rgb(160 10 20 / 0.35), transparent 60%), #0e0b0c',
    '--card-ink': '#e8e2e2',
    '--card-red': '#e0142c',
    '--card-glow': '0 0 3px currentColor',
    '--card-frame': 'inset 0 0 0 1px rgb(224 20 44 / 0.5)',
  },
  // Brushed steel with a band of light across it.
  'cartas.acero': {
    '--card-face': [
      'repeating-linear-gradient(90deg, rgb(255 255 255 / 0.06) 0 1px, transparent 1px 3px)',
      'linear-gradient(135deg, #e3e7eb, #a7afb7 45%, #eef1f4 55%, #9099a2)',
    ].join(', '),
    '--card-ink': '#15181b',
    '--card-red': '#9a1222',
    '--card-frame': 'inset 0 0 0 2px rgb(255 255 255 / 0.5), inset 0 0 0 3px rgb(0 0 0 / 0.25)',
  },
}

// ── Chips ───────────────────────────────────────────────────────────────────

export const CHIP_VALUES = [1, 5, 10, 25, 100, 500, 1000] as const
export type ChipValue = (typeof CHIP_VALUES)[number]

/** The face, the darker edge seen on a stack, the number, the stripes and maybe a drawing over the whole chip. */
type Chip = [face: string, edge: string, text: string, stripe: string, art?: string]

/**
 * The numbers' font and weight, how far they sit above the middle (as bottom padding, so half of it)
 * and whether a stack shows each chip's darker side (1) or only the chips themselves (0, for flat sprites).
 */
type ChipText = { font: string; weight: string; lift: string; rim?: string; radius?: string; halo?: string }

function chips(set: Record<ChipValue, Chip>, text: ChipText = { font: 'inherit', weight: '800', lift: '0px' }): Vars {
  const vars: Vars = { '--chip-font': text.font, '--chip-weight': text.weight, '--chip-lift': text.lift, '--chip-rim': text.rim ?? '1', '--chip-radius': text.radius ?? '50%', '--chip-halo': text.halo ?? 'none' }
  for (const value of CHIP_VALUES) {
    const [face, edge, text, stripe, art = 'none'] = set[value]
    vars[`--chip${value}-face`] = face
    vars[`--chip${value}-edge`] = edge
    vars[`--chip${value}-text`] = text
    vars[`--chip${value}-stripe`] = stripe
    vars[`--chip${value}-art`] = art
  }
  return vars
}

const neonChip = (colour: string, edge: string): Chip => ['#0d0a1a', edge, colour, colour]

/** A point on a circle round the middle of a 40 × 40 chip, at an angle in degrees from the top. */
const onRim = (r: number, deg: number) => {
  const t = (deg * Math.PI) / 180
  return `${(20 + r * Math.sin(t)).toFixed(2)} ${(20 - r * Math.cos(t)).toFixed(2)}`
}

/** A piece of a ring, between two radii and two angles. */
const ringPiece = (inner: number, outer: number, from: number, to: number) =>
  `M${onRim(outer, from)}A${outer} ${outer} 0 0 1 ${onRim(outer, to)}L${onRim(inner, to)}A${inner} ${inner} 0 0 0 ${onRim(inner, from)}Z`

/**
 * A flat casino chip drawn from a style's colours: six square inserts round the
 * edge and a dot between each two, in the stripe colour, and a dashed ring
 * round the middle.
 */
function casinoChip([face, edge, text, stripe]: Chip): Chip {
  const inserts = Array.from({ length: 6 }, (_, i) => ringPiece(14.2, 20, i * 60 - 9, i * 60 + 9)).join('')
  const dots = Array.from({ length: 6 }, (_, i) => {
    const [x, y] = onRim(17.3, i * 60 + 30).split(' ')
    return `<circle cx='${x}' cy='${y}' r='1'/>`
  }).join('')
  return [
    face,
    edge,
    text,
    'transparent',
    svg(
      40,
      40,
      `<circle cx='20' cy='20' r='20' fill='${face}'/>` +
        `<path d='${inserts}' fill='${stripe}'/>` +
        `<g fill='${stripe}'>${dots}</g>` +
        // The middle sits a touch lower than the edge, so a thin darker line rings it
        `<circle cx='20' cy='20' r='14.2' fill='none' stroke='${edge}' stroke-width='0.5' opacity='0.6'/>` +
        `<circle cx='20' cy='20' r='12.4' fill='none' stroke='${stripe}' stroke-width='1' stroke-dasharray='1.9 1.35'/>`,
    ),
  ]
}

/** Every chip in a set drawn as a casino chip. */
const casinoChips = (set: Record<ChipValue, Chip>) =>
  Object.fromEntries(Object.entries(set).map(([value, chip]) => [value, casinoChip(chip)])) as Record<ChipValue, Chip>

/** A chip that is a pixel-art sprite from public/styles, with the number on top. */
const spriteChip = (sprite: string, face: string, edge: string, text: string): Chip => [
  face,
  edge,
  text,
  'transparent',
  `url('/styles/${sprite}.png')`,
]

/** A gem's shades, from the facet facing away from the light to the one facing it, and the number's colour. */
type Gem = [deep: string, dark: string, mid: string, light: string, text: string]

type Point = readonly [number, number]

/** An outline scaled to fill a 40 × 40 chip, a little above the middle to leave room for its side below. */
function fit(points: Point[]): Point[] {
  const xs = points.map(([x]) => x)
  const ys = points.map(([, y]) => y)
  const [minX, maxX, minY, maxY] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)]
  const scale = Math.min(35 / (maxX - minX), 34 / (maxY - minY))
  return points.map(([x, y]) => [20 + (x - (minX + maxX) / 2) * scale, 18.5 + (y - (minY + maxY) / 2) * scale] as const)
}

/** An emerald cut seen from above: a long octagon, going round clockwise. */
const EMERALD_CUT: Point[] = [[-0.62, -1], [0.62, -1], [0.82, -0.8], [0.82, 0.8], [0.62, 1], [-0.62, 1], [-0.82, 0.8], [-0.82, -0.8]]

/**
 * A cut gem seen from above: a table in the middle and two rows of facets
 * round it, each shaded by how much it faces the light from the top left,
 * standing on its darker side. The chip under it is see-through.
 */
function gemChip([deep, dark, mid, light, text]: Gem): Chip {
  const outline = fit(EMERALD_CUT)
  const n = outline.length
  const cx = outline.reduce((sum, [x]) => sum + x, 0) / n
  const cy = outline.reduce((sum, [, y]) => sum + y, 0) / n
  const table = outline.map(([x, y]) => [cx + (x - cx) * 0.56, cy + (y - cy) * 0.56] as const)
  const shades = [deep, dark, mid, light]
  const pts = (points: readonly Point[]) => points.map(([x, y]) => `${x.toFixed(2)},${y.toFixed(2)}`).join(' ')
  const facet = (points: Point[], lift: number) => {
    const fx = points.reduce((sum, [x]) => sum + x, 0) / points.length - cx
    const fy = points.reduce((sum, [, y]) => sum + y, 0) / points.length - cy
    // 1 facing the light (top left), -1 facing away
    const facing = (-fx - fy) / Math.SQRT2 / (Math.hypot(fx, fy) || 1)
    const shade = Math.max(0, Math.min(3, Math.round(1.5 + facing * 1.5 + lift)))
    return `<polygon points='${pts(points)}' fill='${shades[shade]}'/>`
  }
  let facets = ''
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n
    const edge: Point = [(outline[i][0] + outline[j][0]) / 2, (outline[i][1] + outline[j][1]) / 2]
    // Neighbouring facets catch the light differently, so the cut sparkles
    const turn = i % 2 ? 0.35 : -0.35
    facets += facet([outline[i], edge, table[i]], -0.5 + turn)
    facets += facet([edge, outline[j], table[j]], 0.3 - turn)
    facets += facet([table[i], edge, table[j]], 0.6)
  }
  const side = outline.map(([x, y]) => [x, y + 2.2] as const)
  return [
    'transparent',
    'transparent',
    text,
    'transparent',
    svg(
      40,
      40,
      `<defs><linearGradient id='t' x1='0' y1='0' x2='1' y2='1'><stop offset='0' stop-color='#fff'/><stop offset='0.35' stop-color='${light}'/><stop offset='1' stop-color='${mid}'/></linearGradient></defs>` +
        `<polygon points='${pts(side)}' fill='${deep}' stroke='${deep}' stroke-width='1' stroke-linejoin='round'/>` +
        `<g stroke='${deep}' stroke-width='0.35' stroke-linejoin='round'>${facets}<polygon points='${pts(table)}' fill='url(#t)'/></g>` +
        `<polygon points='${pts(outline)}' fill='none' stroke='${deep}' stroke-width='0.9' stroke-linejoin='round'/>` +
        `<path d='M${(cx - 11).toFixed(1)} ${(cy - 15.5).toFixed(1)}l0.9 2.1 2.1 0.9-2.1 0.9-0.9 2.1-0.9-2.1-2.1-0.9 2.1-0.9z' fill='#fff'/>`,
    ),
  ]
}

/** Gems stand on their own drawn side, with no round chip, stripe or painted rim under them. */
const GEM_TEXT: ChipText = {
  font: 'inherit',
  weight: '900',
  lift: '2px',
  rim: '0',
  radius: '0',
  // A white outline round the black number, so it reads on the dark facets too
  halo: '0 0 1px #fff, 0 0 2px #fff, 0 0 3px rgb(255 255 255 / 0.9)',
}

const FICHAS: Record<string, Vars> = {
  'fichas.casino': chips(casinoChips({
    1: ['#f1ede4', '#a9a291', '#1c130d', '#9a968c'],
    5: ['#d23f4c', '#8f2731', '#fff', '#fff'],
    10: ['#2f62c9', '#1e4a92', '#fff', '#fff'],
    25: ['#1b9a59', '#11693c', '#fff', '#fff'],
    100: ['#222327', '#050506', '#fff', '#fff'],
    500: ['#7b47c9', '#522d8c', '#fff', '#fff'],
    1000: ['#f0a42a', '#b26f12', '#1c130d', '#fff'],
  })),
  // The seventies: mustard, orange, teal and brown.
  'fichas.retro': chips(casinoChips({
    1: ['#f3e6c8', '#bfae86', '#4a3420', '#c96a2b'],
    5: ['#d2622b', '#8f3f17', '#fff3dc', '#f3e6c8'],
    10: ['#2b6f6b', '#184744', '#fff3dc', '#f3e6c8'],
    25: ['#e8a33d', '#a8701c', '#3a2410', '#fff3dc'],
    100: ['#5a3a24', '#352113', '#fff3dc', '#e8a33d'],
    500: ['#8c2f39', '#5a1a22', '#fff3dc', '#e8a33d'],
    1000: ['#c9a227', '#8a6d12', '#2a1d04', '#5a3a24'],
  })),
  // Black, white and greys, telling values apart by the stripe.
  'fichas.mono': chips(casinoChips({
    1: ['#f4f4f4', '#a8a8a8', '#111', '#bdbdbd'],
    5: ['#d9d9d9', '#8f8f8f', '#111', '#fff'],
    10: ['#a6a6a6', '#666', '#111', '#fff'],
    25: ['#6e6e6e', '#3d3d3d', '#fff', '#d9d9d9'],
    100: ['#3a3a3a', '#141414', '#fff', '#a6a6a6'],
    500: ['#1a1a1a', '#000', '#fff', '#fff'],
    1000: ['#0a0a0a', '#000', '#f2c14e', '#f2c14e'],
  })),
  'fichas.pastel': chips(casinoChips({
    1: ['#f6f1ff', '#c9bfe0', '#5a4a7a', '#c9bfe0'],
    5: ['#ffb3ba', '#d98a92', '#5a2a30', '#fff'],
    10: ['#a8d8ff', '#7fb0d9', '#1d3f5e', '#fff'],
    25: ['#b5ead7', '#86c2ab', '#1f4a3a', '#fff'],
    100: ['#d6c8ff', '#a99bd6', '#352a5e', '#fff'],
    500: ['#ffdfba', '#d9b48a', '#5e4020', '#fff'],
    1000: ['#fff3a8', '#d6c870', '#5a4e10', '#fff'],
  })),
  'fichas.neon': chips(casinoChips({
    1: neonChip('#e0e0ff', '#5a5a78'),
    5: neonChip('#ff2e63', '#7a1030'),
    10: neonChip('#00e5ff', '#006a78'),
    25: neonChip('#39ff88', '#14783c'),
    100: neonChip('#ffffff', '#6a6a6a'),
    500: neonChip('#c04bff', '#5a1a80'),
    1000: neonChip('#ffd400', '#806a00'),
  })),
  // Dark stone, each value only tinted, with steel stripes.
  'fichas.obsidiana': chips(casinoChips({
    1: ['#2a2a30', '#111114', '#e9e4dc', '#8d959d'],
    5: ['#3a1218', '#1a070a', '#e9e4dc', '#8d959d'],
    10: ['#121e3a', '#070c1a', '#e9e4dc', '#8d959d'],
    25: ['#0f2a1c', '#05130c', '#e9e4dc', '#8d959d'],
    100: ['#0a0a0c', '#000', '#e9e4dc', '#8d959d'],
    500: ['#24143a', '#10081a', '#e9e4dc', '#8d959d'],
    1000: ['#3a2a0c', '#1a1205', '#f1d58a', '#c9a24a'],
  })),
  // Earth, leaves, river and bark.
  'fichas.bosque': chips(casinoChips({
    1: ['#e9e1c8', '#a99d78', '#2e2a1a', '#7d8a3c'],
    5: ['#b5532a', '#73311a', '#fff', '#f1d9a8'],
    10: ['#3f6e8c', '#244659', '#fff', '#d9ead2'],
    25: ['#4f7d36', '#2e4d1e', '#fff', '#e9e1c8'],
    100: ['#4a3424', '#2a1c12', '#fff', '#c9a46a'],
    500: ['#6a4a7a', '#3e2a4a', '#fff', '#e0d0e8'],
    1000: ['#c99a2e', '#80611a', '#2a1d04', '#fff4d0'],
  })),
  'fichas.oceano': chips(casinoChips({
    1: ['#e6f6f8', '#9cc6cc', '#0d2e36', '#5fb8c4'],
    5: ['#ff7a6a', '#b0453a', '#fff', '#ffe0da'],
    10: ['#1f7fae', '#11506e', '#fff', '#c9ecff'],
    25: ['#1aa39a', '#0c6660', '#fff', '#cdf5f0'],
    100: ['#0b2a40', '#04121e', '#fff', '#7fd6ff'],
    500: ['#5a5fc8', '#33378a', '#fff', '#d6d8ff'],
    1000: ['#f2c14e', '#a8801c', '#2a1d04', '#fff'],
  })),
  // Painted steel, worn at the stripes.
  'fichas.acero': chips(casinoChips({
    1: ['#e3e7eb', '#9099a2', '#15181b', '#ffffff'],
    5: ['#a8323a', '#5e1a1f', '#fff', '#d7dce1'],
    10: ['#3a5a80', '#1f3350', '#fff', '#d7dce1'],
    25: ['#3d6b4a', '#1f3d28', '#fff', '#d7dce1'],
    100: ['#2a2d31', '#0e0f11', '#fff', '#9aa3ad'],
    500: ['#5c4a7a', '#33284a', '#fff', '#d7dce1'],
    1000: ['#b08d57', '#6e5530', '#1b1406', '#f4f6f8'],
  })),
  // Emerald-cut gems, each value its own colour: aquamarine, ruby, sapphire, emerald, tourmaline, amethyst and topaz.
  'fichas.joyas': chips(
    {
      1: gemChip(['#0e5a6e', '#2a9bb5', '#6fd3e6', '#dcf9ff', '#111']),
      5: gemChip(['#4a0614', '#8f0f2a', '#d81e48', '#ff8aa3', '#111']),
      10: gemChip(['#0a1a4f', '#13358f', '#2a66db', '#8fc0ff', '#111']),
      25: gemChip(['#033a24', '#0a6b43', '#14a86b', '#7ff5c0', '#111']),
      100: gemChip(['#5e0a3c', '#a8236e', '#e8559e', '#ffb3dc', '#111']),
      500: gemChip(['#2a0a4a', '#5a1fa0', '#9150e0', '#dcb8ff', '#111']),
      1000: gemChip(['#6b3d00', '#b87200', '#f2a91c', '#fff0a8', '#111']),
    },
    GEM_TEXT,
  ),
  // Pixel-art sprites, like an old arcade game; the 1000 is a clown.
  'fichas.pixel': chips(
    {
      1: spriteChip('fichas-pixel/1', '#ebf6f8', '#7c9195', '#445457'),
      5: spriteChip('fichas-pixel/5', '#fd5f55', '#cc4846', '#fff'),
      10: spriteChip('fichas-pixel/10', '#009cfd', '#1685cb', '#fff'),
      25: spriteChip('fichas-pixel/25', '#55a383', '#4d8276', '#fff'),
      100: spriteChip('fichas-pixel/100', '#4f6367', '#445457', '#fff'),
      500: spriteChip('fichas-pixel/500', '#8a71e1', '#6059a0', '#fff'),
      1000: spriteChip('fichas-pixel/1000', '#ebf6f8', '#7c9195', '#445457'),
    },
    { font: 'var(--font-pixel), monospace', weight: '400', lift: '2px', rim: '0' },
  ),
}

const BY_KIND: Record<Exclude<CosmeticKind, 'marco'>, Record<string, Vars>> = {
  tapete: TAPETES,
  dorso: DORSOS,
  cartas: CARTAS,
  fichas: FICHAS,
}

/*
  A card style only sets what it changes, so the rest is reset first: otherwise
  a preview of the classic deck would inherit the face the player is wearing.
  'initial' makes the CSS fall back to the free look. The back isn't reset: it
  comes from the back style.
*/
const CARD_RESET: Vars = Object.fromEntries(
  [
    'face', 'face-s', 'face-h', 'face-d', 'face-c', 'ink', 'red', 'diamond', 'club', 'font', 'frame', 'glow', 'blur',
    'radius', 'ratio', 'clip', 'index', 'pip', 'corner-x', 'corner-y',
  ].map((name) => [`--card-${name}`, 'initial']),
)

/**
 * The CSS variables for a set of styles. The back goes before the faces: a face
 * style can bring its own back edge (the neon deck).
 */
export function themeStyle(equipped: Partial<Equipped> | undefined): CSSProperties {
  const e = { ...DEFAULT_EQUIPPED, ...equipped }
  return {
    ...BY_KIND.tapete[e.tapete],
    ...BY_KIND.dorso[e.dorso],
    ...BY_KIND.fichas[e.fichas],
    ...CARD_RESET,
    ...BY_KIND.cartas[e.cartas],
  } as CSSProperties
}

/** The frame's class (globals.css), null for none. */
// The daily deck's own table: not in the shop, so it can only be the daily deck.
const SUITS_TILE = svg(
  96,
  96,
  ['♠:18:30', '♥:66:30', '♦:42:78', '♣:90:78', '♣:-6:78']
    .map((spec) => spec.split(':'))
    .map(([suit, x, y]) => `<text x='${x}' y='${y}' font-size='22' text-anchor='middle' fill='white' fill-opacity='0.055'>${suit}</text>`)
    .join(''),
)

export const DAILY_FELT = felt(
  [`${SUITS_TILE} 0 0 / 96px 96px`, lit('#1d5566', '#0e3542', '#061a22')].join(', '),
  '#0a2a35',
  'rgb(242 193 78)',
) as CSSProperties

export function frameClass(frame: string | null | undefined): string | null {
  if (!frame || frame === 'marco.ninguno') return null
  return `frame frame-${frame.slice('marco.'.length)}`
}
