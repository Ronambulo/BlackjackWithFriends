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

/**
 * A felt's colours. Its background goes on the whole screen (--felt-bg) and again over
 * the play area alone (--felt-art), so it's sized to the table, clear of the bar and the
 * rail; a felt can draw something else there instead. It can also turn the writing on it
 * dark and hide what's printed on it; the defaults are set here so a preview never takes
 * them from the felt around it.
 */
const felt = (background: string, bar: string, print = 'rgb(242 193 78)'): Vars => ({
  '--felt-bg': background,
  '--felt-bar': bar,
  '--felt-print': print,
  '--felt-art': background,
  '--felt-ink': '244 241 232',
  '--felt-text': '#f4f1e8',
  '--felt-printed': 'block',
})

/** An SVG drawing as a CSS image. */
const svg = (width: number, height: number, body: string) =>
  `url("data:image/svg+xml,${encodeURIComponent(
    `<svg xmlns='http://www.w3.org/2000/svg' width='${width}' height='${height}' viewBox='0 0 ${width} ${height}'>${body}</svg>`,
  )}")`

/**
 * A 260 × 260 tile of stars, scattered the same way every time (a fixed seed),
 * in a few sizes, white, blue and warm, with three four-pointed twinkles.
 */
function starField() {
  let seed = 7
  const random = () => (seed = (seed * 16807) % 2147483647) / 2147483647
  let stars = ''
  for (let i = 0; i < 46; i++) {
    const [x, y, size] = [random() * 260, random() * 260, random()]
    const r = size > 0.9 ? 1.3 : size > 0.6 ? 0.9 : 0.55
    const opacity = 0.35 + random() * 0.6
    const colour = random() > 0.8 ? '#ffe9c4' : random() > 0.6 ? '#c9d6ff' : '#fff'
    stars += `<circle cx='${x.toFixed(1)}' cy='${y.toFixed(1)}' r='${r}' fill='${colour}' opacity='${opacity.toFixed(2)}'/>`
  }
  const twinkle = (x: number, y: number, k: number) =>
    `<path d='M${x} ${y - k}Q${x} ${y} ${x + k} ${y}Q${x} ${y} ${x} ${y + k}Q${x} ${y} ${x - k} ${y}Q${x} ${y} ${x} ${y - k}Z' fill='#fff' opacity='0.9'/>`
  return svg(260, 260, stars + twinkle(48, 70, 4) + twinkle(190, 40, 3) + twinkle(150, 200, 3.5))
}

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

/**
 * A nebula: clouds of pink, violet and teal gas over a field of stars. Each cloud is
 * SVG fractal noise tinted one colour and faded out by a radial mask; drawn square
 * with everything near the middle, so a phone (which only shows the middle) gets it all.
 */
function nebula() {
  const random = seeded(13)
  const size = 1000
  // Noise in one colour, see-through wherever the noise is below 0.42
  const cloud = (id: string, seed: number, frequency: string, [r, g, b]: number[], strength: number) =>
    `<filter id='${id}' x='0' y='0' width='100%' height='100%'><feTurbulence type='fractalNoise' baseFrequency='${frequency}' numOctaves='5' seed='${seed}'/>` +
    `<feColorMatrix values='0 0 0 0 ${r} 0 0 0 0 ${g} 0 0 0 0 ${b} ${strength} 0 0 0 ${(-strength * 0.42).toFixed(2)}'/></filter>`
  const mask = (id: string, cx: number, cy: number, r: number) =>
    `<radialGradient id='${id}g' gradientUnits='userSpaceOnUse' cx='${cx}' cy='${cy}' r='${r}'><stop offset='0' stop-color='#fff'/><stop offset='1' stop-color='#000'/></radialGradient>` +
    `<mask id='${id}'><rect width='${size}' height='${size}' fill='url(#${id}g)'/></mask>`
  const colours = ['#fff', '#fff', '#ffd6f0', '#cfe0ff']
  const stars = Array.from(
    { length: 320 },
    () =>
      `<circle cx='${(random() * size).toFixed(0)}' cy='${(random() * size).toFixed(0)}' r='${(0.4 + random() ** 3 * 1.6).toFixed(2)}' fill='${colours[Math.floor(random() * colours.length)]}' opacity='${(0.35 + random() * 0.65).toFixed(2)}'/>`,
  ).join('')
  // A few bright stars with a soft glow, inside the clouds
  const bright = Array.from({ length: 7 }, () => {
    const x = (250 + random() * 500).toFixed(0)
    const y = (150 + random() * 700).toFixed(0)
    return `<circle cx='${x}' cy='${y}' r='9' fill='#fff' opacity='0.35' filter='url(#glow)'/><circle cx='${x}' cy='${y}' r='2' fill='#fff'/>`
  }).join('')
  const layer = (filter: string, mask: string, opacity = 1) =>
    `<rect width='${size}' height='${size}' filter='url(#${filter})' mask='url(#${mask})' opacity='${opacity}'/>`
  return svg(
    size,
    size,
    `<defs>${cloud('pink', 8, '0.0032 0.0045', [0.95, 0.28, 0.72], 2.4)}${cloud('violet', 21, '0.004', [0.48, 0.32, 1], 2.2)}${cloud('teal', 4, '0.006', [0.2, 0.85, 0.9], 2.6)}` +
      `${mask('m1', 420, 330, 420)}${mask('m2', 600, 660, 420)}${mask('m3', 520, 500, 230)}` +
      `<radialGradient id='core'><stop offset='0' stop-color='#ffe3f4' stop-opacity='0.55'/><stop offset='1' stop-color='#ffe3f4' stop-opacity='0'/></radialGradient>` +
      `<filter id='glow'><feGaussianBlur stdDeviation='5'/></filter></defs>` +
      `<rect width='${size}' height='${size}' fill='#08031a'/>` +
      stars +
      layer('violet', 'm2') +
      layer('pink', 'm1') +
      layer('teal', 'm3', 0.8) +
      `<ellipse cx='500' cy='470' rx='230' ry='170' fill='url(#core)'/>` +
      bright,
  )
}

/** Bats flying over a graveyard on a 320 × 80 strip, the big ones near the middle. */
function bats() {
  const bat = (x: number, y: number, scale: number, opacity = 1) =>
    `<path transform='translate(${x} ${y}) scale(${scale})' opacity='${opacity}' d='M0 -2C2 -4 3 -4 3 -2L4 -4L4.4 -1C8 -4 13 -3 17 -6C15 -2 16 1 14 3C12 1 10 2 9 4C7 2 5 3 3.5 4C2 5 1 6 0 7C-1 6 -2 5 -3.5 4C-5 3 -7 2 -9 4C-10 2 -12 1 -14 3C-16 1 -15 -2 -17 -6C-13 -3 -8 -4 -4.4 -1L-4 -4L-3 -2C-3 -4 -2 -4 0 -2Z'/>`
  return svg(
    320,
    80,
    `<g fill='#07040c'>${bat(80, 36, 1.1)}${bat(118, 22, 0.6, 0.8)}${bat(210, 30, 0.9)}${bat(246, 52, 0.5, 0.7)}${bat(150, 52, 0.45, 0.6)}${bat(190, 64, 0.35, 0.5)}${bat(60, 70, 0.4, 0.55)}${bat(270, 24, 0.4, 0.55)}</g>`,
  )
}

/** Bare trees on a 320 × 90 strip of ground, the far ones fainter, with mist low down. */
function bareTrees() {
  // A trunk splitting in two four times, each branch shorter and thinner
  const tree = (x: number, height: number, lean: number, base = 196) => {
    let lines = ''
    const branch = (x: number, y: number, length: number, angle: number, depth: number) => {
      const [x2, y2] = [x + length * Math.sin(angle), y - length * Math.cos(angle)]
      lines += `<path d='M${x.toFixed(1)} ${y.toFixed(1)}L${x2.toFixed(1)} ${y2.toFixed(1)}' stroke-width='${(depth * 0.75 + 0.35).toFixed(2)}'/>`
      if (depth > 0) {
        branch(x2, y2, length * 0.66, angle - 0.5 * lean, depth - 1)
        branch(x2, y2, length * 0.72, angle + 0.36 * lean, depth - 1)
      }
    }
    branch(x, base, height * 0.42, 0, 4)
    return lines
  }
  return svg(
    320,
    90,
    `<defs><linearGradient id='fog' x1='0' y1='0' x2='0' y2='1'><stop offset='0' stop-color='#6b4f8f' stop-opacity='0'/><stop offset='1' stop-color='#6b4f8f' stop-opacity='0.28'/></linearGradient></defs>` +
      `<g transform='translate(0 -110)'>` +
      `<g stroke='#120a1d' stroke-linecap='round' opacity='0.55'>${tree(52, 40, 1, 192)}${tree(104, 26, -1, 193)}${tree(214, 30, 1, 192)}${tree(262, 22, -1, 193)}</g>` +
      `<g stroke='#0a0512' stroke-linecap='round' opacity='0.85'>${tree(22, 58, -1)}${tree(300, 64, 1)}${tree(160, 34, 1, 197)}</g>` +
      `<rect y='150' width='320' height='50' fill='url(#fog)'/><path d='M0 194Q80 186 160 192T320 190V200H0Z' fill='#0a0512'/></g>`,
  )
}

/**
 * The words on an ouija board, around the middle where the table prints its rules in
 * the board's own letters (FeltPrint): yes and no in the top corners (40 × 30 each), clear
 * of the dealer's cards and the shoe, and the letters and numbers at the foot (200 × 96),
 * faded so the cards read over them.
 */
function ouijaBoard() {
  const ink = '#1c150e'
  // Letters spread along an arc, each turned to face out from its middle
  const arc = (letters: string, cx: number, cy: number, r: number, from: number, to: number, size: number) =>
    [...letters]
      .map((letter, i) => {
        const angle = ((from + ((to - from) * i) / (letters.length - 1)) * Math.PI) / 180
        const [x, y] = [(cx + r * Math.cos(angle)).toFixed(1), (cy + r * Math.sin(angle)).toFixed(1)]
        return `<text x='${x}' y='${y}' font-size='${size}' transform='rotate(${((angle * 180) / Math.PI + 90).toFixed(1)} ${x} ${y})' text-anchor='middle'>${letter}</text>`
      })
      .join('')
  const words = (content: string) => `<g fill='${ink}' font-family='Georgia,serif' font-weight='700' text-anchor='middle'>${content}</g>`
  return {
    // In the top corners, either side of the dealer's cards
    yes: svg(40, 30, words(`<text x='20' y='24' font-size='20'>SÍ</text>`)),
    no: svg(40, 30, words(`<text x='20' y='24' font-size='20'>NO</text>`)),
    bottom: svg(
      200,
      96,
      words(
        `<g opacity='0.3'>${arc('ABCDEFGHIJKLM', 100, 110, 92, -136, -44, 12.5)}${arc('NOPQRSTUVWXYZ', 100, 110, 72, -139, -41, 12)}` +
          `<text x='100' y='92' font-size='12' textLength='118' lengthAdjust='spacing'>1234567890</text></g>`,
      ),
    ),
  }
}

/** A rectangle's outline `inset` px in from the edges, `width` px thick, as four background layers. */
const outline = (colour: string, inset: number, width: number) => {
  const line = `linear-gradient(${colour}, ${colour})`
  const across = `calc(100% - ${2 * inset}px) ${width}px no-repeat`
  const down = `${width}px calc(100% - ${2 * inset}px) no-repeat`
  return [
    `${line} ${inset}px ${inset}px / ${across}`,
    `${line} ${inset}px calc(100% - ${inset}px) / ${across}`,
    `${line} ${inset}px ${inset}px / ${down}`,
    `${line} calc(100% - ${inset}px) ${inset}px / ${down}`,
  ]
}

const CRYPT_SKY = 'radial-gradient(ellipse 90% 75% at 50% 40%, #3d2457 0%, #1c0f2c 70%, #0b0612 100%)'

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
    [lit('transparent', 'rgb(0 0 0 / 0.1)', 'rgb(0 0 0 / 0.5)'), `${nebula()} center / cover`, '#08031a'].join(', '),
    '#0d0824',
    'rgb(245 225 255)',
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
  // A starry night with a faint Milky Way across it.
  'tapete.medianoche': felt(
    [
      `${starField()} 0 0 / 260px repeat`,
      'linear-gradient(155deg, transparent 28%, rgb(150 165 255 / 0.07) 42%, rgb(215 195 255 / 0.11) 50%, rgb(150 165 255 / 0.07) 58%, transparent 72%)',
      lit('#26337a', '#131b4a', '#070a20'),
    ].join(', '),
    '#0c1029',
    'rgb(222 228 255)',
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
  // A graveyard at night: bats over bare trees, and mist on the ground.
  'tapete.cripta': {
    ...felt(CRYPT_SKY, '#120a1d', 'rgb(255 170 70)'),
    '--felt-art': [
      `${bats()} center 3% / min(100%, 640px) auto no-repeat`,
      `${bareTrees()} left bottom / auto min(30%, 170px) repeat-x`,
      CRYPT_SKY,
    ].join(', '),
  },
  // An ouija board on old cream paper. Its own words take the place of what's
  // printed on the felt, so that goes, and the writing on it turns dark.
  'tapete.ouija': {
    ...felt('#ece2c8', '#2a1d10', 'rgb(28 21 14)'),
    '--felt-art': [
      `${ouijaBoard().yes} left 36px top 56px / 40px 30px no-repeat`,
      `${ouijaBoard().no} right 36px top 56px / 40px 30px no-repeat`,
      `${ouijaBoard().bottom} center bottom 9% / auto min(19%, 140px) no-repeat`,
      ...outline('#1c150e', 10, 5),
      ...outline('#1c150e', 18, 1),
      'radial-gradient(ellipse 75% 75% at 50% 50%, transparent 60%, rgb(90 61 28 / 0.45))',
      '#ece2c8',
    ].join(', '),
    '--felt-ink': '28 21 14',
    '--felt-text': '#1c150e',
    '--felt-printed': 'none',
    '--felt-board': 'block',
  },
}

// ── Card backs ──────────────────────────────────────────────────────────────

const cross = (colour: string) =>
  [
    'repeating-linear-gradient(45deg, rgb(255 255 255 / 0.12) 0 3px, transparent 3px 8px)',
    'repeating-linear-gradient(-45deg, rgb(255 255 255 / 0.12) 0 3px, transparent 3px 8px)',
    colour,
  ].join(', ')

const back = (background: string, edge = '#fbfaf6'): Vars => ({
  '--card-back': background,
  '--card-back-edge': edge,
  '--card-under': 'auto',
})

const diamonds = (a: string, b: string) =>
  [
    `linear-gradient(135deg, ${b} 25%, transparent 25%) -6px 0 / 12px 12px`,
    `linear-gradient(225deg, ${b} 25%, transparent 25%) -6px 0 / 12px 12px`,
    `linear-gradient(315deg, ${b} 25%, transparent 25%) 0 0 / 12px 12px`,
    `linear-gradient(45deg, ${b} 25%, transparent 25%) 0 0 / 12px 12px`,
    a,
  ].join(', ')

/** Fine white grain over a whole 50 × 70 back, like an old photo. */
const GRAIN =
  `<filter id='n'><feTurbulence type='fractalNoise' baseFrequency='1.6' numOctaves='2' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 1 0 0 0 0 1 0 0 0 0 1 0.22 0 0 0 0'/></filter>`
const GRAIN_RECT = `<rect width='50' height='70' filter='url(#n)'/>`

/** A pale face peeping round a dark doorway, in murky teal. */
const PEEKER = svg(
  50,
  70,
  `<defs>${GRAIN}<linearGradient id='w' x1='0' y1='0' x2='.3' y2='1'><stop offset='0' stop-color='#1e4855'/><stop offset='1' stop-color='#0d2730'/></linearGradient><radialGradient id='fc' cx='.6' cy='.4' r='.7'><stop offset='0' stop-color='#a7c7cf'/><stop offset='.55' stop-color='#5f8a96'/><stop offset='1' stop-color='#24434d'/></radialGradient><radialGradient id='ho'><stop offset='.5' stop-color='#010405'/><stop offset='1' stop-color='#010405' stop-opacity='0'/></radialGradient><filter id='s'><feGaussianBlur stdDeviation='0.45'/></filter><radialGradient id='vg' cx='.45' cy='.4' r='.8'><stop offset='.45' stop-color='#000' stop-opacity='0'/><stop offset='1' stop-color='#000' stop-opacity='.75'/></radialGradient></defs>` +
    `<rect width='50' height='70' fill='url(#w)'/>` +
    `<path d='M50 0H35C33 5 33.5 10 35 13C35.4 14.2 34.8 15.2 33.6 15.6H21C14.5 15.6 10.6 20 10.6 25.2C10.6 30.4 14.5 34.6 21 34.6H33.6C34.8 35 35.4 36 35 37.2C33 42 34 48 36 54C37 58 37.5 62 37 70H50Z' fill='#030809' filter='url(#s)'/>` +
    `<g filter='url(#s)'><ellipse cx='22.5' cy='25' rx='9' ry='7.8' transform='rotate(-12 22.5 25)' fill='url(#fc)'/><ellipse cx='19.6' cy='21.4' rx='3.4' ry='3.1' fill='url(#ho)'/><ellipse cx='20.4' cy='29' rx='3.2' ry='2.8' fill='url(#ho)'/><ellipse cx='27' cy='24.6' rx='2.4' ry='4' fill='#c3dde3' opacity='.35'/></g>` +
    `<rect y='56' width='50' height='14' fill='#0a1f27'/><path d='M0 56.2H38' stroke='#3d6c79' stroke-width='.5' opacity='.6' filter='url(#s)'/>` +
    `<g filter='url(#s)' opacity='.5'><rect x='9' y='61' width='14' height='3' fill='#5d6d34'/><rect x='12' y='60' width='9' height='1.2' fill='#8a9a4a'/><ellipse cx='27' cy='62.5' rx='2.2' ry='2.6' fill='#8ea23a'/><path d='M29 60L44 64' stroke='#4b6670' stroke-width='1.6'/></g>` +
    `<rect width='50' height='70' fill='url(#vg)'/>` +
    GRAIN_RECT,
)

/** A tall faceless man in a suit holding a little girl's hand in a misty wood, in black and white. */
const SLENDER = svg(
  50,
  70,
  `<defs>${GRAIN}<linearGradient id='sk' x1='0' y1='0' x2='0' y2='1'><stop offset='0' stop-color='#26292c'/><stop offset='.55' stop-color='#686c71'/><stop offset='.7' stop-color='#8a8e92'/><stop offset='1' stop-color='#2a2c2e'/></linearGradient><filter id='bl'><feGaussianBlur stdDeviation='0.9'/></filter><filter id='b2'><feGaussianBlur stdDeviation='0.22'/></filter><radialGradient id='vg' cx='.5' cy='.5' r='.75'><stop offset='.45' stop-color='#000' stop-opacity='0'/><stop offset='1' stop-color='#000' stop-opacity='.85'/></radialGradient></defs>` +
    `<rect width='50' height='70' fill='url(#sk)'/>` +
    `<g filter='url(#bl)' fill='#17191b' opacity='.75'><rect x='3' width='2.4' height='70'/><rect x='9.5' width='1' height='70' opacity='.5'/><rect x='39.5' width='1.4' height='70' opacity='.55'/><rect x='45.5' width='2.8' height='70'/></g>` +
    `<g filter='url(#bl)' stroke='#17191b' stroke-width='.7' fill='none' opacity='.7'><path d='M5 12L14 4M5 22L11 19M46 14L37 6M46 26L41 22M40 18L34 14'/></g>` +
    `<ellipse cx='25' cy='49' rx='32' ry='6.5' fill='#b1b5b8' opacity='.45' filter='url(#bl)'/><path d='M17 70L23 51H30L37 70Z' fill='#7d8185' opacity='.35' filter='url(#bl)'/>` +
    `<g filter='url(#bl)' fill='#141617'><circle cx='46' cy='58' r='4'/><circle cx='43' cy='62' r='3.4'/><circle cx='48' cy='64' r='4'/><circle cx='4' cy='60' r='3'/></g>` +
    `<g filter='url(#b2)'><path d='M17.6 34H20.6L20.3 64H17.8ZM21.4 34H24.4L24.2 64H21.7Z' fill='#0e0f10'/><path d='M16.4 15.6Q21 14.2 25.6 15.6L24.8 35H17.2Z' fill='#121314'/><path d='M20.4 15.2L21 19L21.6 15.2Z' fill='#9a9c9e'/><path d='M20.85 15.8H21.15L21.3 19L21 19.6L20.7 19Z' fill='#0a0a0a'/>` +
    `<path d='M16.4 16Q15.2 30 15.4 45' stroke='#121314' stroke-width='2' stroke-linecap='round' fill='none'/><ellipse cx='15.5' cy='46.2' rx='1' ry='1.6' fill='#b9bbbc'/><path d='M25.6 16Q27.8 34 29.2 52' stroke='#121314' stroke-width='2' stroke-linecap='round' fill='none'/><ellipse cx='29.5' cy='53.5' rx='1' ry='1.4' fill='#b9bbbc'/>` +
    `<rect x='20.3' y='13' width='1.8' height='2.6' fill='#a9abad'/><ellipse cx='21.2' cy='10.6' rx='2.7' ry='3.4' fill='#c4c6c7'/><ellipse cx='22.2' cy='11.2' rx='1.4' ry='2.6' fill='#8f9294' opacity='.5'/>` +
    `<path d='M30.1 45.2C30 42.4 31.2 41.4 32.4 41.4C33.8 41.4 34.8 42.4 34.7 45.2L35 50H29.8Z' fill='#1e1a18'/><ellipse cx='32.4' cy='44.1' rx='1.25' ry='1.65' fill='#b7b4af'/><path d='M30.4 47.6H34.4L35.6 60.4H29.2Z' fill='#2a2b2e'/><rect x='29.2' y='59.8' width='6.4' height='.8' fill='#8d8f91'/><path d='M30.6 48.4Q30 51 29.9 53.4' stroke='#2a2b2e' stroke-width='1' fill='none' stroke-linecap='round'/><path d='M31.4 60.6V63.4M33.4 60.6V63.4' stroke='#a7a7a5' stroke-width='.7'/><path d='M30.8 63.4H32M32.8 63.4H34' stroke='#111' stroke-width='.8'/></g>` +
    `<rect width='50' height='70' fill='url(#vg)'/>` +
    GRAIN_RECT,
)

/** Two yellow cat's eyes with slit pupils in the dark, flat like a cut-out. */
function catEyes() {
  const outline = 'M6 28.4Q14.4 26 22.6 34.2Q12 39.6 6 28.4Z'
  const eye = `<path d='${outline}' fill='#f7b416'/><path d='M16.2 26.6Q18.3 32.6 16.2 38.6Q14.1 32.6 16.2 26.6Z' fill='#0b0b0b' clip-path='url(#ce)'/>`
  return svg(
    50,
    70,
    `<defs><clipPath id='ce'><path d='${outline}'/></clipPath></defs><rect width='50' height='70' fill='#0e0e0f'/>${eye}<g transform='translate(50 0) scale(-1 1)'>${eye}</g>`,
  )
}

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
    // Through the glass the up card would show blurred, so this back tucks under it
    '--card-under': '-1',
  },
  'dorso.asoma': back(`${PEEKER} center / 100% 100% no-repeat, #0a1f27`, '#0f2d36'),
  'dorso.slender': back(`${SLENDER} center / 100% 100% no-repeat, #141516`, '#d8d9da'),
  'dorso.gato': back(`${catEyes()} center / 100% 100% no-repeat, #0e0e0f`, '#222'),
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

/**
 * Old paper slashed five times from the edges in, on a 50 × 70 card: each gash
 * dark inside, with a notch cut out of the edge where it starts, a raised lip and
 * blood dripping under it, and more blood running down from the top.
 */
function slashedPaper() {
  const red = '#8e0a14'
  const dark = '#5e0309'
  const f = (n: number) => n.toFixed(2)
  const p = ([x, y]: readonly [number, number]) => `${f(x)} ${f(y)}`
  // Where each cut comes in from the edge, where its tip ends and how far it gapes
  const slashes = [
    [0, 37.6, 9.8, 35.8, 1.5],
    [50, 21.8, 37.75, 26.7, 1.25],
    [50, 39.4, 43, 40.4, 0.9],
    [0, 55.2, 7, 54.4, 0.85],
    [19.4, 70, 23.3, 64.1, 0.9],
  ]
  let notches = ''
  let cuts = ''
  for (const [x1, y1, x2, y2, w] of slashes) {
    const [dx, dy] = [x2 - x1, y2 - y1]
    const length = Math.hypot(dx, dy)
    // Square to the cut, on its upper side
    let [nx, ny] = [-dy / length, dx / length]
    if (ny > 0) [nx, ny] = [-nx, -ny]
    const at = (t: number, off: number) => [x1 + dx * t + nx * off, y1 + dy * t + ny * off] as const
    const [a, b, c1, c2] = [at(-0.05, w), at(-0.05, -w * 0.9), at(0.45, w * 0.95), at(0.5, -w * 0.75)]
    const gash = `M${p(a)}Q${p(c1)} ${x2} ${y2}Q${p(c2)} ${p(b)}Z`
    notches += `<path d='M${p(at(-0.1, w * 0.75))}L${p(at(0.12, 0))}L${p(at(-0.1, -w * 0.7))}Z'/>`
    const drips = [[0.15, 3.2], [0.42, 1.8]]
      .map(([t, h]) => {
        const [x, y] = at(t, -w * 0.72)
        return `<path d='M${f(x - 0.5)} ${f(y)}C${f(x - 0.5)} ${f(y + h * 0.6)} ${f(x - 0.38)} ${f(y + h)} ${f(x)} ${f(y + h)}C${f(x + 0.38)} ${f(y + h)} ${f(x + 0.5)} ${f(y + h * 0.6)} ${f(x + 0.5)} ${f(y)}Z' fill='${red}'/>`
      })
      .join('')
    cuts +=
      `<path d='${gash}' fill='${red}' opacity='.28' stroke='${red}' stroke-width='2' stroke-linejoin='round'/>` +
      `<path d='M${p(b)}Q${p(c2)} ${x2} ${y2}' fill='none' stroke='${red}' stroke-width='1.2' stroke-linecap='round'/>` +
      drips +
      `<path d='${gash}' fill='url(#in)'/>` +
      `<path d='M${p(at(0.05, 0))}L${p(at(0.7, 0))}' stroke='#000' stroke-width='${f(w * 0.55)}' stroke-linecap='round' opacity='.7'/>` +
      `<path d='M${p(a)}Q${p(c1)} ${x2} ${y2}' fill='none' stroke='#fff7e4' stroke-width='.45'/>` +
      `<path d='M${x2} ${y2}L${p(at(1.22, 0))}' stroke='${dark}' stroke-width='.25' stroke-linecap='round' opacity='.8'/>`
  }
  return svg(
    50,
    70,
    `<defs><radialGradient id='g' cx='.5' cy='.45' r='.75'><stop offset='.5' stop-color='#efe6d4'/><stop offset='1' stop-color='#c9b591'/></radialGradient>` +
      `<linearGradient id='in' x1='0' y1='0' x2='0' y2='1'><stop offset='0' stop-color='#160103'/><stop offset='.6' stop-color='#3a0207'/><stop offset='1' stop-color='#7a0711'/></linearGradient>` +
      `<mask id='m'><rect x='-2' y='-2' width='54' height='74' fill='#fff'/><g fill='#000'>${notches}</g></mask></defs>` +
      `<g mask='url(#m)'><rect width='50' height='70' fill='url(#g)'/>` +
      `<ellipse cx='36' cy='50' rx='7' ry='4' fill='#a8865a' opacity='.2'/><ellipse cx='13' cy='22' rx='5' ry='7' fill='#a8865a' opacity='.14'/>` +
      `<path d='M0 0H50V3C48.5 3 48 3.6 48 7.5C48 9.6 46.2 9.6 46.2 7.5C46.2 4 45 3.4 41 3.4C38.4 3.4 37.8 4.2 37.8 11C37.8 13.4 35.8 13.4 35.8 11C35.8 4.4 34.6 3.6 31 3.6C28 3.6 27.4 4.4 27.4 6.8C27.4 8.4 25.8 8.4 25.8 6.8C25.8 4 24 3.2 20.5 3.2C18 3.2 17.4 4 17.4 15C17.4 17.6 15.3 17.6 15.3 15C15.3 4.4 14.4 3 11 3H0Z' fill='${red}'/>` +
      `<rect width='50' height='1.4' fill='${dark}'/><g fill='${red}'><circle cx='9' cy='47' r='1.3'/><circle cx='11.2' cy='45.6' r='.55'/></g>` +
      `${cuts}</g>`,
  )
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
  // Slashed, with blood running down from the top: the corners sit a little lower, clear of it.
  'cartas.acuchilladas': {
    '--card-face': `${slashedPaper()} center / 100% 100% no-repeat, #efe6d4`,
    '--card-ink': '#1d1112',
    '--card-red': '#9b0d17',
    '--card-corner-y': '10%',
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
/** `drawn`: the chip is all drawing, with no face or rim, so out of reach it stays drawn, greyed. */
type ChipText = { font: string; weight: string; lift: string; rim?: string; radius?: string; halo?: string; drawn?: boolean }

/*
  The app's own font, written out: 'inherit' in a custom property would take the
  font of the chip style equipped around a preview (the pixel one's, say)
*/
const APP_FONT = "var(--font-sans), system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif"

function chips(set: Record<ChipValue, Chip>, text: ChipText = { font: APP_FONT, weight: '800', lift: '0px' }): Vars {
  const drawn = text.drawn ?? false
  const vars: Vars = {
    '--chip-font': text.font,
    '--chip-weight': text.weight,
    '--chip-lift': text.lift,
    '--chip-rim': text.rim ?? '1',
    '--chip-radius': text.radius ?? '50%',
    '--chip-halo': text.halo ?? 'none',
    '--chip-off-border': drawn ? 'transparent' : 'rgb(255 255 255 / 0.3)',
    '--chip-off-look': drawn ? 'grayscale(1) brightness(0.55)' : 'none',
    // Drawings are smoothed; only the pixel art keeps its hard edges
    '--chip-render': drawn ? 'auto' : 'pixelated',
  }
  for (const value of CHIP_VALUES) {
    const [face, edge, text, stripe, art = 'none'] = set[value]
    vars[`--chip${value}-off`] = drawn ? `${art} border-box center / 100% 100% no-repeat` : '#2a1e16'
    vars[`--chip${value}-off-ink`] = drawn ? text : 'rgb(242 193 78 / 0.4)'
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
  font: APP_FONT,
  weight: '900',
  lift: '2px',
  rim: '0',
  radius: '0',
  // A white outline round the black number, so it reads on the dark facets too
  halo: '0 0 1px #fff, 0 0 2px #fff, 0 0 3px rgb(255 255 255 / 0.9)',
}

/** Something drawn on a 72 × 72 see-through chip, round its middle, with no round chip, stripe or rim under it. */
const drawnChip = (text: string, art: string): Chip => ['transparent', 'transparent', text, 'transparent', svg(72, 72, `<g transform='translate(36 36)'>${art}</g>`)]

const DRAWN_TEXT = { rim: '0', radius: '0', drawn: true }

/** A jack-o'-lantern without a mouth: the number glows where it would be. */
function pumpkinChip(skin: string, dark: string, eyes: string): string {
  return (
    `<defs><radialGradient id='s' cx='.4' cy='.35' r='.8'><stop offset='0' stop-color='#fff' stop-opacity='.35'/><stop offset='.4' stop-color='${skin}' stop-opacity='0'/></radialGradient></defs>` +
    `<path d='M-2 -24C-3 -30 0 -33 4 -33L5 -30C2 -30 2 -27 2 -24Z' fill='#5a4320'/><path d='M3 -27C9 -33 16 -31 17 -27C11 -24 7 -25 3 -27Z' fill='#4f8f37'/>` +
    [-17, 17, -8, 8, 0].map((x, k) => `<ellipse cx='${x}' cy='3' rx='${k < 2 ? 14 : k < 4 ? 15 : 13}' ry='25' fill='${skin}' stroke='${dark}' stroke-width='1.6'/>`).join('') +
    `<ellipse cy='3' rx='31' ry='26' fill='url(#s)'/>` +
    `<path d='${eyes}' transform='translate(0 -3)' fill='${skin === '#2a2530' ? '#9dff6a' : '#ffd23a'}' stroke='${dark}' stroke-width='.8'/>`
  )
}

/** The twisted ends of a wrapped sweet, on the left. */
const twist = (colour: string, dark: string) =>
  `<path d='M-17 -3L-33 -14Q-29 0 -33 14L-17 3Z' fill='${colour}' stroke='${dark}' stroke-width='1.2' stroke-linejoin='round'/><path d='M-30 -9L-21 -1M-30 9L-21 1M-31 0H-20' stroke='${dark}' stroke-width='.8' opacity='.6'/>`
const wrapped = (colour: string, dark: string) => `${twist(colour, dark)}<g transform='scale(-1 1)'>${twist(colour, dark)}</g>`

function lollipopSpiral() {
  let d = ''
  for (let t = 0; t <= 20; t += 0.25) d += `${d ? 'L' : 'M'}${(1.1 * t * Math.cos(t)).toFixed(1)} ${(1.1 * t * Math.sin(t)).toFixed(1)}`
  return d
}

const CANDY_CORN = 'M0 -31C6 -31 27 15 27 22C27 31 -27 31 -27 22C-27 15 -6 -31 0 -31Z'

/** A little grave on its mound of grass. */
const grave = (stone: string) =>
  `<ellipse cy='29' rx='27' ry='5.5' fill='#3b2a1a'/><path d='M-22 27l1.5-5 1 5M-15 28l1-4 1.4 4M12 28l1.2-5 1 5M19 27l1.4-4 .8 4M-4 30l1-3.6 1 3.6' stroke='#4f8f37' stroke-width='1.4' fill='#4f8f37' stroke-linejoin='round'/>${stone}`

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
  // Pixel-art sprites, like an old arcade game.
  'fichas.pixel': chips(
    {
      1: spriteChip('fichas-pixel/1', '#ebf6f8', '#7c9195', '#445457'),
      5: spriteChip('fichas-pixel/5', '#fd5f55', '#cc4846', '#fff'),
      10: spriteChip('fichas-pixel/10', '#009cfd', '#1685cb', '#fff'),
      25: spriteChip('fichas-pixel/25', '#55a383', '#4d8276', '#fff'),
      100: spriteChip('fichas-pixel/100', '#4f6367', '#445457', '#fff'),
      500: spriteChip('fichas-pixel/500', '#8a71e1', '#6059a0', '#fff'),
      1000: spriteChip('fichas-pixel/1000', '#f2c255', '#bd983c', '#445457'),
    },
    { font: 'var(--font-pixel), monospace', weight: '400', lift: '2px', rim: '0' },
  ),
  // Jack-o'-lanterns in seven skins; the number glows where the mouth would be.
  'fichas.calabaza': chips(
    {
      1: drawnChip('#ffd23a', pumpkinChip('#ff8a1f', '#b9530a', 'M-9 -4L-4 -9L1 -4ZM9 -4L4 -9L-1 -4Z')),
      5: drawnChip('#ffd23a', pumpkinChip('#8fbf3a', '#4f7a1c', 'M-10 -9L-3 -4L-9 -2ZM10 -9L3 -4L9 -2Z')),
      10: drawnChip('#ffd23a', pumpkinChip('#efe7d6', '#b3a68a', 'M-8 -8A3 3 0 1 0 -8 -2A3 3 0 1 0 -8 -8ZM8 -8A3 3 0 1 0 8 -2A3 3 0 1 0 8 -8Z')),
      25: drawnChip('#ffd23a', pumpkinChip('#9b5ad6', '#5a2a8a', 'M-11 -8L-2 -5L-6 -1ZM11 -8L2 -5L6 -1Z')),
      100: drawnChip('#ffd23a', pumpkinChip('#ff5a1f', '#a8230a', 'M-10 -4L-6 -10L-2 -4ZM10 -4L6 -10L2 -4Z')),
      500: drawnChip('#9dff6a', pumpkinChip('#2a2530', '#0d0b10', 'M-10 -5Q-6 -10 -2 -5ZM10 -5Q6 -10 2 -5Z')),
      1000: drawnChip('#ffd23a', pumpkinChip('#f2c255', '#a8801c', 'M-11 -3L-6 -11L-1 -3ZM11 -3L6 -11L1 -3Z')),
    },
    { ...DRAWN_TEXT, font: APP_FONT, weight: '900', lift: '-0.75em', halo: '0 0 1px #3a1400, 0 0 2px #3a1400, 0 0 6px rgb(255 160 40 / 0.9)' },
  ),
  // A sweet for each value: candy corn, a wrapped sweet, a lollipop, a gummy, a toffee, a marshmallow ghost and a gold bonbon.
  'fichas.caramelos': chips(
    {
      1: drawnChip('#a8500a', `<defs><clipPath id='c'><path d='${CANDY_CORN}'/></clipPath></defs><g clip-path='url(#c)'><rect x='-30' y='-34' width='60' height='70' fill='#ffd23a'/><rect x='-30' y='-34' width='60' height='48' fill='#ff8a1a'/><rect x='-30' y='-34' width='60' height='24' fill='#fff6e0'/></g><path d='${CANDY_CORN}' fill='none' stroke='#a8500a' stroke-width='1.6'/><path d='M-5 -22Q-9 -10 -13 0' stroke='#fff' stroke-width='2' opacity='.6' fill='none' stroke-linecap='round'/>`),
      5: drawnChip('#e83a5a', `${wrapped('#ff6d86', '#9b1a33')}<circle r='19' fill='#e83a5a' stroke='#9b1a33' stroke-width='1.4'/>${[0, 60, 120, 180, 240, 300].map((a) => `<path d='M0 0Q10 -6 16 -10' stroke='#fff' stroke-width='3' fill='none' transform='rotate(${a})'/>`).join('')}<circle r='10' fill='#fff' stroke='#9b1a33' stroke-width='1.2'/>`),
      10: drawnChip('#5a2a8a', `<rect x='-1.8' y='10' width='3.6' height='24' rx='1.5' fill='#efe3c4' stroke='#b3a68a'/><circle r='23' fill='#9b5ad6' stroke='#4a1f78' stroke-width='1.6'/><path d='${lollipopSpiral()}' stroke='#1c1c22' stroke-width='3.4' fill='none' stroke-linecap='round'/><circle r='10.5' fill='#fff' stroke='#4a1f78' stroke-width='1.2'/><path d='M-14 -14Q-8 -19 -2 -20' stroke='#fff' stroke-width='2' opacity='.5' fill='none' stroke-linecap='round'/>`),
      25: drawnChip('#136b34', `<path d='M-25 22C-27 -8 -13 -27 0 -27C13 -27 27 -8 25 22Q0 29 -25 22Z' fill='#28b45e' stroke='#136b34' stroke-width='1.6'/><path d='M-14 -16Q-8 -22 -1 -23' stroke='#c9ffd9' stroke-width='3' opacity='.6' fill='none' stroke-linecap='round'/>${[[-16, 4], [-10, -10], [12, -12], [17, 6], [-4, 18], [8, 16], [-18, 16], [0, -20], [20, -2]].map(([x, y]) => `<rect x='${x}' y='${y}' width='1.6' height='1.6' fill='#fff' opacity='.85' transform='rotate(30 ${x} ${y})'/>`).join('')}`),
      100: drawnChip('#1c1c22', `${wrapped('#ffa04a', '#8a3c06')}<rect x='-21' y='-14' width='42' height='28' rx='6' fill='#ff7a1a' stroke='#8a3c06' stroke-width='1.4'/>${[-12, 0, 12].map((x) => `<path d='M${x - 4} -14L${x + 4} 14' stroke='#1c1c22' stroke-width='3' opacity='.9'/>`).join('')}<rect x='-15' y='-7.5' width='30' height='15' rx='3' fill='#fff6e0' stroke='#8a3c06'/>`),
      500: drawnChip('#5a2a8a', `<g transform='translate(0 -5)'><path d='M-21 27V-5C-21 -20 -11 -29 0 -29C11 -29 21 -20 21 -5V27L14 21L7 27L0 21L-7 27L-14 21Z' fill='#f8f4ec' stroke='#a79e90' stroke-width='1.6' stroke-linejoin='round'/><ellipse cx='-7' cy='-13' rx='2.6' ry='3.6' fill='#1c1c22'/><ellipse cx='7' cy='-13' rx='2.6' ry='3.6' fill='#1c1c22'/><ellipse cx='-12' cy='-5' rx='3' ry='1.6' fill='#ffb3c8' opacity='.7'/><ellipse cx='12' cy='-5' rx='3' ry='1.6' fill='#ffb3c8' opacity='.7'/></g>`),
      1000: drawnChip('#5a3a06', `<defs><radialGradient id='au' cx='.35' cy='.3' r='.8'><stop offset='0' stop-color='#fff3b8'/><stop offset='.45' stop-color='#f2c255'/><stop offset='1' stop-color='#9a6d12'/></radialGradient></defs>${wrapped('#f2c255', '#7a5208')}<circle r='20' fill='url(#au)' stroke='#7a5208' stroke-width='1.4'/><path d='M-12 -8L-6 -4L-10 2M8 -12L4 -6L10 -2M-4 12L2 8L6 14' stroke='#7a5208' stroke-width='.7' fill='none' opacity='.5'/>`),
    },
    { ...DRAWN_TEXT, font: APP_FONT, weight: '900', lift: '0px', halo: GEM_TEXT.halo },
  ),
  // A gravestone for each value, on its mound of grass, the number carved low on it.
  'fichas.lapidas': chips(
    {
      1: drawnChip('#3e4247', grave(`<path d='M-19 27V-9C-19 -25 19 -25 19 -9V27Z' fill='#8d9196' stroke='#3e4247' stroke-width='1.6'/><path d='M-14 -12C-14 -19 -6 -21 0 -21' stroke='#c9ccd0' stroke-width='2' fill='none' opacity='.6' stroke-linecap='round'/><text y='-12' font-family='Georgia,serif' font-size='6.5' font-weight='700' text-anchor='middle' fill='#3e4247' letter-spacing='1'>RIP</text>`)),
      5: drawnChip('#3e4247', grave(`<path d='M-7.5 -31H7.5V-17H20V-4H7.5V27H-7.5V-4H-20V-17H-7.5Z' fill='#9a9ea3' stroke='#3e4247' stroke-width='1.6' stroke-linejoin='round'/><path d='M-4.5 -28V-19' stroke='#d2d5d8' stroke-width='1.6' opacity='.6' stroke-linecap='round'/>`)),
      10: drawnChip('#36402f', grave(`<path d='M-17 27V-6C-17 -14 -9 -24 0 -31C9 -24 17 -14 17 -6V27Z' fill='#7d8a76' stroke='#36402f' stroke-width='1.6'/><g fill='#4f8f37' opacity='.85'><ellipse cx='-12' cy='20' rx='6' ry='3.4'/><ellipse cx='10' cy='-9' rx='4' ry='2'/><ellipse cx='13' cy='22' rx='4' ry='2.6'/></g>`)),
      25: drawnChip('#5a4e3a', grave(`<path d='M-24 27V-6H-20C-20 -18 -12 -22 -8 -20C-6 -28 6 -28 8 -20C12 -22 20 -18 20 -6H24V27Z' fill='#b8ad98' stroke='#5a4e3a' stroke-width='1.6' stroke-linejoin='round'/><rect x='-15' y='-4' width='30' height='21' rx='2' fill='none' stroke='#5a4e3a' stroke-width='.8' opacity='.7'/>`)),
      100: drawnChip('#1e2024', grave(`<path d='M-20 27V-11C-20 -24 20 -24 20 -11V27Z' fill='#5d6168' stroke='#25282c' stroke-width='1.6'/><path d='M4 -22L0 -14L5 -8L1 -3' stroke='#1a1c1f' stroke-width='1.2' fill='none' stroke-linejoin='round'/><path d='M4.6 -22L0.8 -14L5.8 -8' stroke='#8a8f96' stroke-width='.5' fill='none'/>`)),
      500: drawnChip('#c9cbd6', grave(`<path d='M-18 27V-12C-18 -21 -10 -26 0 -26C10 -26 18 -21 18 -12V27Z' fill='#1f1f24' stroke='#000' stroke-width='1.6'/><path d='M-14 -16C-6 -10 -10 0 -2 6C4 11 2 18 10 22M8 -22C4 -14 12 -10 14 -2' stroke='#d8d8e0' stroke-width='.6' fill='none' opacity='.45'/><path d='M-12 -14C-10 -19 -5 -22 0 -22' stroke='#6a6a78' stroke-width='2' fill='none' opacity='.7' stroke-linecap='round'/>`)),
      1000: drawnChip('#5a3a06', grave(`<defs><linearGradient id='tg' x1='0' y1='0' x2='1' y2='1'><stop offset='0' stop-color='#fff1b8'/><stop offset='.45' stop-color='#e2b33c'/><stop offset='1' stop-color='#8a5f10'/></linearGradient></defs><path d='M-20 27V-10C-20 -25 20 -25 20 -10V27Z' fill='url(#tg)' stroke='#7a5208' stroke-width='1.6'/><g transform='translate(0 -11)'><path d='M-6 0C-6 -5 6 -5 6 0C6 3 4 3.6 4 5H-4C-4 3.6 -6 3 -6 0Z' fill='#fff6d0' stroke='#7a5208' stroke-width='.8'/><circle cx='-2.3' cy='-.4' r='1.5' fill='#7a5208'/><circle cx='2.3' cy='-.4' r='1.5' fill='#7a5208'/><path d='M-1.6 5V6.6M0 5V6.6M1.6 5V6.6' stroke='#7a5208' stroke-width='.6'/></g>`)),
    },
    { ...DRAWN_TEXT, font: 'Georgia, serif', weight: '700', lift: '-0.85em', halo: '0 1px 0 rgb(255 255 255 / 0.35)' },
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
