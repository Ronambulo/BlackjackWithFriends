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
