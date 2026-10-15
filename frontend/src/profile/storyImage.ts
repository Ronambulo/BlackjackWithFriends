import { avatarColor, initials } from '@/ui/avatarColor'

// The stats as a ready-made Instagram story (1080x1920). Instagram covers about the
// top and bottom 250 px with its own buttons, so everything that matters stays between.

const W = 1080
const H = 1920

export interface StoryContent {
  title: string
  name: string
  seed: string
  photo: string | null
  net: string
  tone: 'win' | 'lose' | 'push'
  chipsLabel: string
  /** Won, pushed and lost: share of the bar and its label underneath. */
  outcomes: { count: number; label: string; tone: 'win' | 'push' | 'lose' }[]
  tiles: { value: string; label: string }[]
  dare: string
  url: string
}

const COLORS = {
  bg: '#0a0c0f',
  glow: '#0d2a1c',
  felt: '#0b6b3a',
  gold: '#f2c14e',
  text: '#f2f3f5',
  dim: '#9ba3ad',
  win: '#4ade80',
  lose: '#ff6b6b',
  push: '#6b7380',
  tile: 'rgb(255 255 255 / 0.06)',
  border: 'rgb(255 255 255 / 0.1)',
}

/** The app's own fonts, as next/font named them on this page. */
function fonts() {
  const root = getComputedStyle(document.documentElement)
  const body = getComputedStyle(document.body)
  return {
    sans: body.fontFamily || 'system-ui, sans-serif',
    felt: root.getPropertyValue('--font-felt').trim() || 'Georgia, serif',
  }
}

function loadImage(src: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const image = new Image()
    image.onload = () => resolve(image)
    image.onerror = () => resolve(null)
    image.src = src
  })
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath()
  ctx.roundRect(x, y, w, h, r)
}

/** Shrinks the font until the text fits the width. */
function fit(ctx: CanvasRenderingContext2D, text: string, font: (size: number) => string, size: number, width: number) {
  ctx.font = font(size)
  while (size > 40 && ctx.measureText(text).width > width) {
    size -= 8
    ctx.font = font(size)
  }
}

/** A faint suit pattern over the felt glow. */
function background(ctx: CanvasRenderingContext2D, felt: string) {
  ctx.fillStyle = COLORS.bg
  ctx.fillRect(0, 0, W, H)
  const glow = ctx.createRadialGradient(W / 2, 700, 0, W / 2, 700, 1100)
  glow.addColorStop(0, COLORS.felt)
  glow.addColorStop(0.45, COLORS.glow)
  glow.addColorStop(1, COLORS.bg)
  ctx.globalAlpha = 0.85
  ctx.fillStyle = glow
  ctx.fillRect(0, 0, W, H)
  ctx.globalAlpha = 0.045
  ctx.fillStyle = COLORS.text
  ctx.font = `110px ${felt}`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  const suits = ['♠', '♥', '♣', '♦']
  for (let row = 0; row < 11; row++) {
    for (let col = 0; col < 6; col++) {
      const x = col * 200 + (row % 2 ? 100 : 0)
      ctx.fillText(suits[(row + col) % 4], x, row * 190 + 40)
    }
  }
  ctx.globalAlpha = 1
}

async function avatar(ctx: CanvasRenderingContext2D, content: StoryContent, sans: string, x: number, y: number, size: number) {
  const image = content.photo ? await loadImage(content.photo) : null
  ctx.save()
  ctx.beginPath()
  ctx.arc(x + size / 2, y + size / 2, size / 2, 0, Math.PI * 2)
  ctx.clip()
  if (image) {
    ctx.drawImage(image, x, y, size, size)
  } else {
    ctx.fillStyle = avatarColor(content.seed)
    ctx.fillRect(x, y, size, size)
    ctx.fillStyle = '#10141a'
    ctx.font = `800 ${size * 0.42}px ${sans}`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(initials(content.name), x + size / 2, y + size / 2 + 4)
  }
  ctx.restore()
  ctx.strokeStyle = COLORS.gold
  ctx.lineWidth = 6
  ctx.beginPath()
  ctx.arc(x + size / 2, y + size / 2, size / 2 + 3, 0, Math.PI * 2)
  ctx.stroke()
}

export async function storyImage(content: StoryContent): Promise<Blob> {
  const { sans, felt } = fonts()
  await Promise.all([document.fonts.load(`800 100px ${sans}`), document.fonts.load(`italic 600 100px ${felt}`)]).catch(() => {})

  const canvas = document.createElement('canvas')
  canvas.width = W
  canvas.height = H
  const ctx = canvas.getContext('2d')!
  background(ctx, felt)
  ctx.textAlign = 'center'
  ctx.textBaseline = 'alphabetic'

  // Brand
  ctx.fillStyle = COLORS.gold
  ctx.font = `italic 600 64px ${felt}`
  ctx.fillText('Blackjack with Friends', W / 2, 330)

  // Who and when
  await avatar(ctx, content, sans, W / 2 - 90, 410, 180)
  ctx.fillStyle = COLORS.text
  fit(ctx, content.name, (size) => `800 ${size}px ${sans}`, 64, W - 160)
  ctx.fillText(content.name, W / 2, 680)
  ctx.fillStyle = COLORS.dim
  ctx.font = `700 40px ${sans}`
  ctx.fillText(content.title.toUpperCase(), W / 2, 745)

  // The result, big
  ctx.fillStyle = content.tone === 'win' ? COLORS.win : content.tone === 'lose' ? COLORS.lose : COLORS.text
  ctx.shadowColor = ctx.fillStyle
  ctx.shadowBlur = 60
  fit(ctx, content.net, (size) => `800 ${size}px ${sans}`, 250, W - 120)
  ctx.fillText(content.net, W / 2, 990)
  ctx.shadowBlur = 0
  ctx.fillStyle = COLORS.dim
  ctx.font = `600 44px ${sans}`
  ctx.fillText(content.chipsLabel, W / 2, 1060)

  // Won / pushed / lost bar
  const barX = 100
  const barW = W - 200
  const total = content.outcomes.reduce((sum, part) => sum + part.count, 0) || 1
  ctx.save()
  roundRect(ctx, barX, 1120, barW, 28, 14)
  ctx.clip()
  let x = barX
  for (const part of content.outcomes) {
    const width = (part.count / total) * barW
    ctx.fillStyle = COLORS[part.tone]
    ctx.fillRect(x, 1120, width, 28)
    x += width
  }
  ctx.restore()
  content.outcomes.forEach((part, i) => {
    const cx = barX + (barW / 3) * (i + 0.5)
    ctx.fillStyle = COLORS.text
    ctx.font = `800 48px ${sans}`
    ctx.fillText(`${Math.round((part.count / total) * 100)}%`, cx, 1220)
    ctx.fillStyle = COLORS.dim
    ctx.font = `600 34px ${sans}`
    ctx.fillText(part.label, cx, 1268)
  })

  // Tiles, two by two
  const gap = 24
  const tileW = (barW - gap) / 2
  const tileH = 130
  content.tiles.forEach((tile, i) => {
    const tx = barX + (i % 2) * (tileW + gap)
    const ty = 1300 + Math.floor(i / 2) * (tileH + gap)
    roundRect(ctx, tx, ty, tileW, tileH, 28)
    ctx.fillStyle = COLORS.tile
    ctx.fill()
    ctx.strokeStyle = COLORS.border
    ctx.lineWidth = 2
    ctx.stroke()
    ctx.fillStyle = COLORS.text
    fit(ctx, tile.value, (size) => `800 ${size}px ${sans}`, 64, tileW - 40)
    ctx.fillText(tile.value, tx + tileW / 2, ty + 70)
    ctx.fillStyle = COLORS.dim
    fit(ctx, tile.label, (size) => `600 ${size}px ${sans}`, 32, tileW - 40)
    ctx.fillText(tile.label, tx + tileW / 2, ty + 110)
  })

  // The dare and where to play
  ctx.fillStyle = COLORS.gold
  ctx.font = `italic 600 60px ${felt}`
  ctx.fillText(content.dare, W / 2, 1680)
  ctx.fillStyle = COLORS.text
  ctx.font = `700 36px ${sans}`
  ctx.fillText(content.url, W / 2, 1738)

  return new Promise((resolve, reject) =>
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('toBlob'))), 'image/png'),
  )
}
