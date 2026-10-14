// Renders the PWA icons in public/ from public/icon.svg:
//   npm run generate-icons -w @bwf/frontend
//
// - Truecolor PNGs: palette (indexed) PNGs make iOS ignore the home screen
//   icon and show a letter instead.
// - Padding is felt green, never white: no white frame on iOS and no white
//   corners when Android crops the maskable icon.
// - The Apple icon is opaque (iOS adds the rounded corners itself).
import { copyFile, readFile } from 'node:fs/promises'
import { join } from 'node:path'
import sharp from 'sharp'

const PUBLIC = join(import.meta.dirname, '..', 'public')
const FELT = '#0b6b3a'

const svg = await readFile(join(PUBLIC, 'icon.svg'))

/** The SVG at `size`, scaled down by `padding` (fraction of each side) and centred on felt green. */
async function render(size, padding, file) {
  const inner = Math.round(size * (1 - padding * 2))
  const art = await sharp(svg, { density: 384 }).resize(inner, inner).png().toBuffer()
  await sharp({ create: { width: size, height: size, channels: 3, background: FELT } })
    .composite([{ input: art, gravity: 'center' }])
    .removeAlpha()
    .png({ compressionLevel: 9, palette: false })
    .toFile(join(PUBLIC, file))
  console.log(`✔ ${file}`)
}

await render(64, 0, 'pwa-64x64.png')
await render(192, 0, 'pwa-192x192.png')
await render(512, 0, 'pwa-512x512.png')
// Android crops maskable icons to a shape inside the central 80% circle.
await render(512, 0.15, 'maskable-icon-512x512.png')
await render(180, 0.05, 'apple-touch-icon-180x180.png')

// iOS requests these default paths too, whatever the <link> in index.html says.
for (const alias of ['apple-touch-icon.png', 'apple-touch-icon-precomposed.png']) {
  await copyFile(join(PUBLIC, 'apple-touch-icon-180x180.png'), join(PUBLIC, alias))
  console.log(`✔ ${alias}`)
}

// Link preview card (WhatsApp, iMessage, Telegram…): 1200x630, dark like the app.
{
  const width = 1200
  const height = 630
  const iconSize = 300
  const art = await sharp(svg, { density: 384 }).resize(iconSize, iconSize).png().toBuffer()
  const rounded = await sharp(art)
    .composite([
      {
        input: Buffer.from(
          `<svg width="${iconSize}" height="${iconSize}"><rect width="${iconSize}" height="${iconSize}" rx="66"/></svg>`,
        ),
        blend: 'dest-in',
      },
    ])
    .png()
    .toBuffer()
  const text = Buffer.from(`<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <radialGradient id="glow" cx="30%" cy="50%" r="70%">
        <stop offset="0" stop-color="#0d3a24"/>
        <stop offset="1" stop-color="#0a0c0f"/>
      </radialGradient>
    </defs>
    <rect width="${width}" height="${height}" fill="url(#glow)"/>
    <text x="480" y="270" font-family="Segoe UI, Helvetica, Arial, sans-serif" font-size="74" font-weight="800" fill="#f2f3f5">Blackjack</text>
    <text x="480" y="352" font-family="Segoe UI, Helvetica, Arial, sans-serif" font-size="74" font-weight="800" fill="#f2c14e">with Friends</text>
    <text x="482" y="420" font-family="Segoe UI, Helvetica, Arial, sans-serif" font-size="32" fill="#9ba3ad">Tu liga semanal de blackjack con amigos</text>
  </svg>`)
  await sharp(text)
    .composite([{ input: rounded, left: 120, top: Math.round((height - iconSize) / 2) }])
    .removeAlpha()
    .png({ compressionLevel: 9 })
    .toFile(join(PUBLIC, 'og-image.png'))
  console.log('✔ og-image.png')
}
