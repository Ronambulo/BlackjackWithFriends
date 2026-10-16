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
  'tapete.damasco': felt(
    [
      'radial-gradient(circle at 50% 50%, rgb(242 193 78 / 0.13) 0 3px, transparent 3.5px) 0 0 / 34px 34px',
      'radial-gradient(ellipse 7px 12px at 50% 50%, rgb(242 193 78 / 0.08) 0 100%, transparent 100%) 17px 17px / 34px 34px',
      lit('#1c6b63', '#0f4741', '#072723'),
    ].join(', '),
    '#0c3d38',
  ),
  'tapete.neon': felt(
    [
      'linear-gradient(rgb(255 46 196 / 0.14) 1px, transparent 1px) 0 0 / 30px 30px',
      'linear-gradient(90deg, rgb(0 229 255 / 0.14) 1px, transparent 1px) 0 0 / 30px 30px',
      lit('#2a1257', '#130a2c', '#07040f'),
    ].join(', '),
    '#0e0822',
    'rgb(255 79 216)',
  ),
  'tapete.pixel': felt(
    [
      lit('rgb(255 255 255 / 0.08)', 'transparent', 'rgb(0 0 0 / 0.35)'),
      'conic-gradient(#23914f 25%, #1b7b42 0 50%, #23914f 0 75%, #1b7b42 0) 0 0 / 16px 16px',
    ].join(', '),
    '#145c33',
    'rgb(255 225 77)',
  ),
  'tapete.turquesa': felt(lit('#1ba3a0', '#0f6f6d', '#073f3e'), '#0b5c5a'),
  // Leather, with a stitched seam just inside the edge.
  'tapete.cuero': felt(
    [
      'linear-gradient(90deg, transparent 10px, rgb(255 226 180 / 0.35) 10px 11px, transparent 11px) 0 0 / 100% 100% no-repeat',
      'repeating-linear-gradient(180deg, transparent 0 4px, rgb(0 0 0 / 0.5) 4px 7px) 10px 0 / 1px 100% no-repeat',
      'radial-gradient(rgb(0 0 0 / 0.08) 1px, transparent 1.5px) 0 0 / 5px 5px',
      lit('#a4542e', '#6e3218', '#3d190a'),
    ].join(', '),
    '#552612',
    'rgb(255 214 160)',
  ),
  'tapete.escoces': felt(
    [
      'repeating-linear-gradient(90deg, rgb(0 0 0 / 0.28) 0 18px, transparent 18px 36px, rgb(242 193 78 / 0.22) 36px 38px, transparent 38px 54px)',
      'repeating-linear-gradient(0deg, rgb(0 0 0 / 0.28) 0 18px, transparent 18px 36px, rgb(242 193 78 / 0.22) 36px 38px, transparent 38px 54px)',
      lit('#b0313a', '#7c1d26', '#470c13'),
    ].join(', '),
    '#5f1820',
  ),
  // A synthwave sunset: a striped sun sinking into a grid.
  'tapete.atardecer': felt(
    [
      'linear-gradient(90deg, rgb(255 79 216 / 0.22) 1px, transparent 1px) 0 100% / 34px 38% repeat-x',
      'radial-gradient(circle at 50% 62%, #ffcf5c 0 18%, #ff6b8b 30%, transparent 31%) 0 0 / 100% 62% no-repeat',
      'linear-gradient(#2a0f4f, #561a6b 45%, #ff6b8b 62%, #1a0a33 62%, #0c0620)',
    ].join(', '),
    '#2a0f4f',
    'rgb(255 207 92)',
  ),
  // Royal blue velvet with gold fleurs.
  'tapete.realeza': felt(
    [
      'radial-gradient(circle at 50% 40%, rgb(242 193 78 / 0.3) 0 2px, transparent 2.5px) 0 0 / 40px 40px',
      'radial-gradient(ellipse 3px 8px at 50% 60%, rgb(242 193 78 / 0.18) 0 100%, transparent 100%) 0 0 / 40px 40px',
      'radial-gradient(circle at 50% 40%, rgb(242 193 78 / 0.14) 0 1.5px, transparent 2px) 20px 20px / 40px 40px',
      lit('#3a3fb8', '#1d2178', '#0b0d3d'),
    ].join(', '),
    '#171a5e',
    'rgb(255 214 102)',
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
  'tapete.topos': felt(
    [
      'radial-gradient(circle, rgb(255 255 255 / 0.11) 0 4px, transparent 4.5px) 0 0 / 22px 22px',
      'radial-gradient(circle, rgb(255 255 255 / 0.11) 0 4px, transparent 4.5px) 11px 11px / 22px 22px',
      lit('#2a3f78', '#18264d', '#0b1229'),
    ].join(', '),
    '#141f40',
    'rgb(255 236 210)',
  ),
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
  'tapete.aurora': felt(
    [
      'radial-gradient(ellipse 80% 26% at 30% 22%, rgb(46 229 157 / 0.5), transparent 70%)',
      'radial-gradient(ellipse 70% 22% at 70% 38%, rgb(124 92 255 / 0.45), transparent 70%)',
      'radial-gradient(ellipse 60% 18% at 50% 12%, rgb(46 229 200 / 0.3), transparent 70%)',
      'linear-gradient(#0a2236, #04101c)',
    ].join(', '),
    '#081a2a',
    'rgb(170 255 220)',
  ),
  // A circuit board: green traces with a solder point at every crossing.
  'tapete.circuito': felt(
    [
      'radial-gradient(circle, rgb(57 255 136 / 0.55) 0 2px, transparent 2.5px) -20px -20px / 40px 40px',
      'linear-gradient(90deg, rgb(57 255 136 / 0.16) 1px, transparent 1px) 0 0 / 40px 40px',
      'linear-gradient(rgb(57 255 136 / 0.12) 1px, transparent 1px) 0 0 / 40px 40px',
      lit('#0f3d2a', '#08261a', '#03120c'),
    ].join(', '),
    '#06201a',
    'rgb(120 255 170)',
  ),
  'tapete.lava': felt(
    [
      'radial-gradient(ellipse 30% 7% at 25% 62%, rgb(255 90 20 / 0.6), transparent 70%)',
      'radial-gradient(ellipse 26% 5% at 72% 30%, rgb(255 140 30 / 0.55), transparent 70%)',
      'radial-gradient(ellipse 22% 5% at 60% 84%, rgb(255 60 20 / 0.5), transparent 70%)',
      lit('#3a1a14', '#1f0d0a', '#0d0504'),
    ].join(', '),
    '#1a0b08',
    'rgb(255 170 90)',
  ),
  'tapete.nebulosa': felt(
    [
      'radial-gradient(1.5px 1.5px at 15% 25%, #fff, transparent)',
      'radial-gradient(1px 1px at 82% 14%, #fff, transparent)',
      'radial-gradient(1px 1px at 56% 78%, #fff, transparent)',
      'radial-gradient(1.5px 1.5px at 90% 70%, #fff, transparent)',
      'radial-gradient(ellipse 50% 40% at 35% 45%, rgb(214 64 160 / 0.5), transparent 70%)',
      'radial-gradient(ellipse 45% 35% at 70% 60%, rgb(64 120 230 / 0.45), transparent 70%)',
      '#0a0618',
    ].join(', '),
    '#120a28',
    'rgb(230 210 255)',
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
  'tapete.acero': felt(
    [
      'repeating-linear-gradient(90deg, rgb(255 255 255 / 0.05) 0 1px, transparent 1px 3px)',
      'linear-gradient(115deg, transparent 30%, rgb(255 255 255 / 0.12) 45%, transparent 60%)',
      lit('#6b737c', '#454b52', '#24282c'),
    ].join(', '),
    '#33383d',
    'rgb(230 236 242)',
  ),
  'tapete.carbono': felt(
    [
      'radial-gradient(ellipse 90% 60% at 50% 38%, rgb(255 255 255 / 0.08), rgb(0 0 0 / 0.5))',
      'conic-gradient(from 45deg, #1d1f22 25%, #2a2d31 0 50%, #1d1f22 0 75%, #2a2d31 0) 0 0 / 8px 8px',
    ].join(', '),
    '#17191c',
    'rgb(210 216 224)',
  ),
  // Shade from the leaves above, with a few patches of sun.
  'tapete.bosque': felt(
    [
      'radial-gradient(ellipse 22% 14% at 20% 30%, rgb(255 240 160 / 0.1), transparent 70%)',
      'radial-gradient(ellipse 18% 12% at 74% 66%, rgb(255 240 160 / 0.08), transparent 70%)',
      'radial-gradient(ellipse 30% 18% at 70% 20%, rgb(0 20 5 / 0.35), transparent 70%)',
      'radial-gradient(ellipse 26% 16% at 30% 78%, rgb(0 20 5 / 0.3), transparent 70%)',
      lit('#2e6b3a', '#1b4524', '#0b2412'),
    ].join(', '),
    '#163a1e',
    'rgb(230 220 160)',
  ),
  'tapete.desierto': felt(
    [
      'repeating-linear-gradient(170deg, rgb(255 255 255 / 0.07) 0 2px, transparent 2px 22px)',
      lit('#d6a35e', '#a8723a', '#6a4220'),
    ].join(', '),
    '#7e5228',
    'rgb(255 245 220)',
  ),
  // Diamond tread plate, the floor of a workshop.
  'tapete.chapa': felt(
    [
      'linear-gradient(45deg, transparent 44%, rgb(255 255 255 / 0.2) 45% 55%, transparent 56%) 0 0 / 14px 14px',
      'linear-gradient(-45deg, transparent 44%, rgb(255 255 255 / 0.2) 45% 55%, transparent 56%) 7px 7px / 14px 14px',
      lit('#5d646c', '#3a3f45', '#1c1f22'),
    ].join(', '),
    '#2c3035',
    'rgb(230 236 242)',
  ),
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
  // Deep water with light rippling through from above.
  'tapete.oceano': felt(
    [
      'radial-gradient(ellipse 34% 5% at 28% 26%, rgb(140 230 255 / 0.2), transparent 70%)',
      'radial-gradient(ellipse 28% 4% at 70% 40%, rgb(140 230 255 / 0.16), transparent 70%)',
      'radial-gradient(ellipse 30% 4% at 44% 70%, rgb(140 230 255 / 0.12), transparent 70%)',
      'linear-gradient(180deg, rgb(120 220 255 / 0.12), transparent 40%)',
      lit('#0f6c8c', '#0a4460', '#03192a'),
    ].join(', '),
    '#07364d',
    'rgb(200 245 255)',
  ),
  'tapete.otono': felt(
    [
      'radial-gradient(ellipse 7px 4px at 18% 24%, rgb(214 98 32 / 0.85) 0 100%, transparent 100%)',
      'radial-gradient(ellipse 4px 7px at 80% 18%, rgb(232 170 40 / 0.8) 0 100%, transparent 100%)',
      'radial-gradient(ellipse 6px 4px at 64% 72%, rgb(176 48 30 / 0.8) 0 100%, transparent 100%)',
      'radial-gradient(ellipse 5px 7px at 30% 80%, rgb(232 170 40 / 0.7) 0 100%, transparent 100%)',
      'radial-gradient(ellipse 7px 5px at 90% 86%, rgb(214 98 32 / 0.75) 0 100%, transparent 100%)',
      'radial-gradient(ellipse 4px 6px at 48% 12%, rgb(176 48 30 / 0.7) 0 100%, transparent 100%)',
      lit('#5a4a2a', '#3b2f19', '#1e170b'),
    ].join(', '),
    '#2f2513',
    'rgb(255 214 140)',
  ),
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
  'dorso.hojas': back(
    [
      'radial-gradient(ellipse 5px 3px at 30% 30%, #6fae4b 0 100%, transparent 100%) 0 0 / 14px 14px',
      'radial-gradient(ellipse 3px 5px at 70% 70%, #4f8f37 0 100%, transparent 100%) 0 0 / 14px 14px',
      '#1f3d1a',
    ].join(', '),
    '#e8f0d8',
  ),
  // Black leather with steel studs.
  'dorso.tachuelas': back(
    [
      'radial-gradient(circle at 35% 35%, #f4f6f8 0 1px, #9aa3ad 1.5px, #3a3f45 3px, transparent 3.5px) 0 0 / 10px 10px',
      '#111214',
    ].join(', '),
    '#9aa3ad',
  ),
  'dorso.obsidiana': back(
    [
      'linear-gradient(125deg, transparent 30%, rgb(170 130 255 / 0.25) 45%, transparent 60%)',
      'repeating-linear-gradient(60deg, rgb(255 255 255 / 0.04) 0 1px, transparent 1px 6px)',
      '#0c0a12',
    ].join(', '),
    '#6f5aa8',
  ),
}

// ── Card faces and shapes ───────────────────────────────────────────────────

/*
  --card-ink: spades (and clubs, unless --card-club); --card-red: hearts (and
  diamonds, unless --card-diamond). Sizes are fractions of the card's width.
*/
const CARTAS: Record<string, Vars> = {
  'cartas.clasicas': {},
  'cartas.jumbo': { '--card-index': '0.34', '--card-pip': '0.42' },
  'cartas.cuatro': { '--card-diamond': '#1f63c6', '--card-club': '#1d8a3e' },
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
  'cartas.pizarra': {
    '--card-face': 'radial-gradient(ellipse at 30% 20%, #3c4a44, #26302c 70%)',
    '--card-ink': '#eef0e8',
    '--card-red': '#ffb3a7',
    '--card-font': '"Segoe Print", "Bradley Hand", "Comic Sans MS", cursive',
    '--card-glow': '0 0 1px rgb(255 255 255 / 0.6)',
    '--card-frame': 'inset 0 0 0 3px #6b4a2b, inset 0 0 0 4px #8a6440',
  },
  'cartas.sakura': {
    '--card-face': [
      'radial-gradient(ellipse 5px 3px at 20% 30%, rgb(244 143 177 / 0.35) 0 100%, transparent 100%)',
      'radial-gradient(ellipse 4px 6px at 75% 65%, rgb(244 143 177 / 0.3) 0 100%, transparent 100%)',
      'radial-gradient(ellipse 5px 4px at 40% 85%, rgb(244 143 177 / 0.25) 0 100%, transparent 100%)',
      '#fff4f7',
    ].join(', '),
    '--card-ink': '#3a2a3f',
    '--card-red': '#d4386e',
    '--card-frame': 'inset 0 0 0 3px #fff4f7, inset 0 0 0 4px #f4b6cb',
  },
  // After Balatro's lucky cards: a warm face scattered with clovers and glints.
  'cartas.suerte': {
    '--card-face': [
      'radial-gradient(circle at 22% 26%, rgb(255 214 77 / 0.75) 0 1.5px, transparent 2px)',
      'radial-gradient(circle at 78% 72%, rgb(255 214 77 / 0.75) 0 1.5px, transparent 2px)',
      'radial-gradient(circle at 70% 22%, rgb(255 255 255 / 0.9) 0 1px, transparent 1.5px)',
      'radial-gradient(circle at 50% 50%, rgb(76 175 80 / 0.16) 0 3px, transparent 3.5px) 0 0 / 14px 14px',
      'radial-gradient(circle at 50% 50%, rgb(76 175 80 / 0.1) 0 2px, transparent 2.5px) 7px 7px / 14px 14px',
      'linear-gradient(160deg, #fffbe6, #f1f7d6)',
    ].join(', '),
    '--card-ink': '#1d3a1f',
    '--card-red': '#c8283a',
    '--card-frame': 'inset 0 0 0 2.5px #fffbe6, inset 0 0 0 4px #4caf50, inset 0 0 12px rgb(255 214 77 / 0.45)',
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
  // Round cards are a real thing: the corners sit further in.
  'cartas.redondas': {
    '--card-ratio': '1',
    '--card-radius': '0.5',
    '--card-corner-y': '16%',
    '--card-corner-x': '20%',
    '--card-index': '0.2',
    '--card-pip': '0.42',
    '--card-frame': 'inset 0 0 0 4px #fbfaf6, inset 0 0 0 5px rgb(0 0 0 / 0.14)',
  },
  'cartas.octogono': {
    '--card-radius': '0',
    '--card-clip': 'polygon(22% 0, 78% 0, 100% 16%, 100% 84%, 78% 100%, 22% 100%, 0 84%, 0 16%)',
    '--card-corner-y': '13%',
    '--card-corner-x': '13%',
    '--card-index': '0.2',
    '--card-frame': 'inset 0 0 0 2px rgb(0 0 0 / 0.1)',
  },
  'cartas.hexagono': {
    '--card-radius': '0',
    '--card-clip': 'polygon(50% 0, 100% 15%, 100% 85%, 50% 100%, 0 85%, 0 15%)',
    '--card-corner-y': '17%',
    '--card-corner-x': '11%',
    '--card-index': '0.2',
    '--card-pip': '0.44',
    '--card-frame': 'inset 0 0 0 2px rgb(0 0 0 / 0.1)',
  },
  'cartas.tarot': {
    '--card-ratio': '4 / 7',
    '--card-radius': '0.08',
    '--card-face': '#1e1336',
    '--card-ink': '#f1d58a',
    '--card-red': '#ff9fb2',
    '--card-font': 'Georgia, "Times New Roman", serif',
    '--card-corner-y': '7%',
    '--card-corner-x': '13%',
    '--card-frame': 'inset 0 0 0 3px #1e1336, inset 0 0 0 4.5px #c9a24a, inset 0 0 18px rgb(201 162 74 / 0.3)',
    '--card-back': [
      'radial-gradient(circle at 50% 50%, transparent 0 18%, rgb(201 162 74 / 0.7) 18.5% 20%, transparent 20.5%)',
      'repeating-conic-gradient(from 0deg at 50% 50%, rgb(201 162 74 / 0.22) 0 6deg, transparent 6deg 30deg)',
      '#1e1336',
    ].join(', '),
    '--card-back-edge': '#c9a24a',
  },
  // Gold foil, black ink, and a matching black-and-gold back.
  'cartas.dorada': {
    '--card-face': 'linear-gradient(135deg, #fff1b8 0%, #e2b33c 35%, #fff4cc 50%, #c9921f 70%, #f6dc7a 100%)',
    '--card-ink': '#1d1505',
    '--card-red': '#8a1020',
    '--card-font': 'Georgia, "Times New Roman", serif',
    '--card-frame': 'inset 0 0 0 3px rgb(255 255 255 / 0.25), inset 0 0 0 4px rgb(90 60 10 / 0.5)',
    '--card-back': [
      'repeating-linear-gradient(45deg, rgb(226 179 60 / 0.35) 0 1px, transparent 1px 7px)',
      'repeating-linear-gradient(-45deg, rgb(226 179 60 / 0.35) 0 1px, transparent 1px 7px)',
      '#14110a',
    ].join(', '),
    '--card-back-edge': '#e2b33c',
  },
  'cartas.ceniza': {
    '--card-face': '#d9d9d6',
    '--card-ink': '#1f2023',
    '--card-red': '#8e2230',
    '--card-frame': 'inset 0 0 0 3px #d9d9d6, inset 0 0 0 4px #9a9a96',
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
  'cartas.bosque': {
    '--card-face': [
      'radial-gradient(ellipse 6px 3px at 18% 80%, rgb(79 143 55 / 0.3) 0 100%, transparent 100%)',
      'radial-gradient(ellipse 3px 6px at 82% 20%, rgb(79 143 55 / 0.3) 0 100%, transparent 100%)',
      'linear-gradient(170deg, #f4f1e1, #e5ead2)',
    ].join(', '),
    '--card-ink': '#1f3320',
    '--card-red': '#a63a1e',
    '--card-diamond': '#c46a1b',
    '--card-club': '#2f6b2a',
    '--card-font': 'Georgia, "Times New Roman", serif',
    '--card-frame': 'inset 0 0 0 3px #f4f1e1, inset 0 0 0 4.5px #6b8f4e',
  },
  // A slab of grey stone with the marks carved in.
  'cartas.piedra': {
    '--card-face': [
      'radial-gradient(circle at 20% 30%, rgb(0 0 0 / 0.08) 0 2px, transparent 3px) 0 0 / 11px 13px',
      'radial-gradient(circle at 70% 60%, rgb(255 255 255 / 0.1) 0 1.5px, transparent 2.5px) 0 0 / 9px 7px',
      'linear-gradient(160deg, #8a8d8f, #5f6366)',
    ].join(', '),
    '--card-ink': '#f1f1ee',
    '--card-red': '#ffb3a0',
    '--card-font': 'Georgia, "Times New Roman", serif',
    '--card-glow': '0 1px 0 rgb(0 0 0 / 0.4)',
    '--card-frame': 'inset 0 0 0 2px rgb(0 0 0 / 0.25)',
  },
}

// ── Chips ───────────────────────────────────────────────────────────────────

export const CHIP_VALUES = [1, 5, 10, 25, 100, 500, 1000] as const
export type ChipValue = (typeof CHIP_VALUES)[number]

/** The face, the darker edge seen on a stack, the number and the stripes. */
type Chip = [face: string, edge: string, text: string, stripe: string]

function chips(set: Record<ChipValue, Chip>): Vars {
  const vars: Vars = {}
  for (const value of CHIP_VALUES) {
    const [face, edge, text, stripe] = set[value]
    vars[`--chip${value}-face`] = face
    vars[`--chip${value}-edge`] = edge
    vars[`--chip${value}-text`] = text
    vars[`--chip${value}-stripe`] = stripe
  }
  return vars
}

const neonChip = (colour: string, edge: string): Chip => ['#0d0a1a', edge, colour, colour]
const goldChip = (stripe: string): Chip => ['#e2b33c', '#9c7314', '#2a1d04', stripe]
const copperChip = (stripe: string): Chip => ['#c87a45', '#7a4421', '#2a1408', stripe]
// The face is a plain colour: it also tints the chips under it in a stack.
const gemChip = (colour: string, edge: string, text: string, shine: string): Chip => [colour, edge, text, shine]

const FICHAS: Record<string, Vars> = {
  'fichas.casino': chips({
    1: ['#f1ede4', '#a9a291', '#1c130d', '#9a968c'],
    5: ['#d23f4c', '#8f2731', '#fff', '#fff'],
    10: ['#2f62c9', '#1e4a92', '#fff', '#fff'],
    25: ['#1b9a59', '#11693c', '#fff', '#fff'],
    100: ['#222327', '#050506', '#fff', '#fff'],
    500: ['#7b47c9', '#522d8c', '#fff', '#fff'],
    1000: ['#f0a42a', '#b26f12', '#1c130d', '#fff'],
  }),
  // The seventies: mustard, orange, teal and brown.
  'fichas.retro': chips({
    1: ['#f3e6c8', '#bfae86', '#4a3420', '#c96a2b'],
    5: ['#d2622b', '#8f3f17', '#fff3dc', '#f3e6c8'],
    10: ['#2b6f6b', '#184744', '#fff3dc', '#f3e6c8'],
    25: ['#e8a33d', '#a8701c', '#3a2410', '#fff3dc'],
    100: ['#5a3a24', '#352113', '#fff3dc', '#e8a33d'],
    500: ['#8c2f39', '#5a1a22', '#fff3dc', '#e8a33d'],
    1000: ['#c9a227', '#8a6d12', '#2a1d04', '#5a3a24'],
  }),
  // Black, white and greys, telling values apart by the stripe.
  'fichas.mono': chips({
    1: ['#f4f4f4', '#a8a8a8', '#111', '#bdbdbd'],
    5: ['#d9d9d9', '#8f8f8f', '#111', '#fff'],
    10: ['#a6a6a6', '#666', '#111', '#fff'],
    25: ['#6e6e6e', '#3d3d3d', '#fff', '#d9d9d9'],
    100: ['#3a3a3a', '#141414', '#fff', '#a6a6a6'],
    500: ['#1a1a1a', '#000', '#fff', '#fff'],
    1000: ['#0a0a0a', '#000', '#f2c14e', '#f2c14e'],
  }),
  'fichas.pastel': chips({
    1: ['#f6f1ff', '#c9bfe0', '#5a4a7a', '#c9bfe0'],
    5: ['#ffb3ba', '#d98a92', '#5a2a30', '#fff'],
    10: ['#a8d8ff', '#7fb0d9', '#1d3f5e', '#fff'],
    25: ['#b5ead7', '#86c2ab', '#1f4a3a', '#fff'],
    100: ['#d6c8ff', '#a99bd6', '#352a5e', '#fff'],
    500: ['#ffdfba', '#d9b48a', '#5e4020', '#fff'],
    1000: ['#fff3a8', '#d6c870', '#5a4e10', '#fff'],
  }),
  'fichas.neon': chips({
    1: neonChip('#e0e0ff', '#5a5a78'),
    5: neonChip('#ff2e63', '#7a1030'),
    10: neonChip('#00e5ff', '#006a78'),
    25: neonChip('#39ff88', '#14783c'),
    100: neonChip('#ffffff', '#6a6a6a'),
    500: neonChip('#c04bff', '#5a1a80'),
    1000: neonChip('#ffd400', '#806a00'),
  }),
  // Precious stones: bright jewel colours with pale, glassy stripes.
  'fichas.gemas': chips({
    1: gemChip('#eaf6ff', '#a9c3d9', '#1d2b3a', '#ffffff'),
    5: gemChip('#ff3b7f', '#a3124a', '#fff', '#ffc2d8'),
    10: gemChip('#3f8cff', '#1a4fa8', '#fff', '#c4dcff'),
    25: gemChip('#1fd69a', '#0c7a55', '#06301f', '#c2f7e3'),
    100: gemChip('#4a4e6a', '#22243a', '#fff', '#b9bdd9'),
    500: gemChip('#b45cff', '#6420a6', '#fff', '#e6c9ff'),
    1000: gemChip('#ffc928', '#a87b00', '#2a1d04', '#fff3c4'),
  }),
  'fichas.oro': chips({
    1: goldChip('#fff6d8'),
    5: goldChip('#c8283a'),
    10: goldChip('#2559c4'),
    25: goldChip('#1b8a4f'),
    100: goldChip('#1a1a1a'),
    500: goldChip('#6e3cc0'),
    1000: ['#f6dc7a', '#a8801c', '#2a1d04', '#fff'],
  }),
  // Dark stone, each value only tinted, with steel stripes.
  'fichas.obsidiana': chips({
    1: ['#2a2a30', '#111114', '#e9e4dc', '#8d959d'],
    5: ['#3a1218', '#1a070a', '#e9e4dc', '#8d959d'],
    10: ['#121e3a', '#070c1a', '#e9e4dc', '#8d959d'],
    25: ['#0f2a1c', '#05130c', '#e9e4dc', '#8d959d'],
    100: ['#0a0a0c', '#000', '#e9e4dc', '#8d959d'],
    500: ['#24143a', '#10081a', '#e9e4dc', '#8d959d'],
    1000: ['#3a2a0c', '#1a1205', '#f1d58a', '#c9a24a'],
  }),
  // Earth, leaves, river and bark.
  'fichas.bosque': chips({
    1: ['#e9e1c8', '#a99d78', '#2e2a1a', '#7d8a3c'],
    5: ['#b5532a', '#73311a', '#fff', '#f1d9a8'],
    10: ['#3f6e8c', '#244659', '#fff', '#d9ead2'],
    25: ['#4f7d36', '#2e4d1e', '#fff', '#e9e1c8'],
    100: ['#4a3424', '#2a1c12', '#fff', '#c9a46a'],
    500: ['#6a4a7a', '#3e2a4a', '#fff', '#e0d0e8'],
    1000: ['#c99a2e', '#80611a', '#2a1d04', '#fff4d0'],
  }),
  'fichas.oceano': chips({
    1: ['#e6f6f8', '#9cc6cc', '#0d2e36', '#5fb8c4'],
    5: ['#ff7a6a', '#b0453a', '#fff', '#ffe0da'],
    10: ['#1f7fae', '#11506e', '#fff', '#c9ecff'],
    25: ['#1aa39a', '#0c6660', '#fff', '#cdf5f0'],
    100: ['#0b2a40', '#04121e', '#fff', '#7fd6ff'],
    500: ['#5a5fc8', '#33378a', '#fff', '#d6d8ff'],
    1000: ['#f2c14e', '#a8801c', '#2a1d04', '#fff'],
  }),
  // Painted steel, worn at the stripes.
  'fichas.acero': chips({
    1: ['#e3e7eb', '#9099a2', '#15181b', '#ffffff'],
    5: ['#a8323a', '#5e1a1f', '#fff', '#d7dce1'],
    10: ['#3a5a80', '#1f3350', '#fff', '#d7dce1'],
    25: ['#3d6b4a', '#1f3d28', '#fff', '#d7dce1'],
    100: ['#2a2d31', '#0e0f11', '#fff', '#9aa3ad'],
    500: ['#5c4a7a', '#33284a', '#fff', '#d7dce1'],
    1000: ['#b08d57', '#6e5530', '#1b1406', '#f4f6f8'],
  }),
  'fichas.cobre': chips({
    1: copperChip('#f4e1cf'),
    5: copperChip('#c8283a'),
    10: copperChip('#2559c4'),
    25: copperChip('#3aa58a'),
    100: copperChip('#1a1a1a'),
    500: copperChip('#6e3cc0'),
    1000: ['#e8a06a', '#8a4f22', '#2a1408', '#5fd0b0'],
  }),
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
    'face', 'ink', 'red', 'diamond', 'club', 'font', 'frame', 'glow', 'blur',
    'radius', 'ratio', 'clip', 'index', 'pip', 'corner-x', 'corner-y',
  ].map((name) => [`--card-${name}`, 'initial']),
)

/**
 * The CSS variables for a set of styles. The back goes before the faces: a face
 * style can bring its own back (the tarot deck).
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
export function frameClass(frame: string | null | undefined): string | null {
  if (!frame || frame === 'marco.ninguno') return null
  return `frame frame-${frame.slice('marco.'.length)}`
}
