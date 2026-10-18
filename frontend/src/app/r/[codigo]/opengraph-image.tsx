import { ImageResponse } from 'next/og'
import { SQUARE_COLORS, dailyPreview, signedNet } from '@/daily/dailyPreview'

// The picture in a daily deck link's preview: the player's result and its squares
// on the felt. Drawn on the server for each code (docs/DISENO.md, "Baraja del día").

export const alt = 'Blackjack with Friends'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

// public/icon.svg, inlined: the image is drawn without reading files.
const ICON = `data:image/svg+xml;utf8,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <rect width="512" height="512" fill="#0b6b3a"/>
  <g transform="rotate(-12 256 256)">
    <rect x="96" y="104" width="200" height="290" rx="24" fill="#f4f1ea" stroke="#0a3d22" stroke-width="6"/>
    <text x="120" y="170" font-family="Georgia, serif" font-size="64" font-weight="700" fill="#1a1a1a">A</text>
    <path d="M196 200c-30 34-62 52-62 82 0 20 16 34 34 34 12 0 22-6 28-14-4 22-12 36-24 46h48c-12-10-20-24-24-46 6 8 16 14 28 14 18 0 34-14 34-34 0-30-32-48-62-82z" fill="#1a1a1a"/>
  </g>
  <g transform="rotate(10 256 256)">
    <rect x="220" y="128" width="200" height="290" rx="24" fill="#f4f1ea" stroke="#0a3d22" stroke-width="6"/>
    <text x="242" y="194" font-family="Georgia, serif" font-size="64" font-weight="700" fill="#c0262d">K</text>
    <path d="M320 340c-44-36-70-58-70-86 0-20 16-34 34-34 16 0 28 10 36 22 8-12 20-22 36-22 18 0 34 14 34 34 0 28-26 50-70 86z" fill="#c0262d"/>
  </g>
</svg>`)}`

/** A Google font as TTF, just the weight wanted; undefined if it can't be fetched (the default font is used). */
async function googleFont(family: string, weight: number, italic = false): Promise<ArrayBuffer | undefined> {
  try {
    const axis = italic ? `ital,wght@1,${weight}` : `wght@${weight}`
    const css = await (await fetch(`https://fonts.googleapis.com/css2?family=${family}:${axis}`)).text()
    const url = /src: url\((.+?)\) format\('(?:opentype|truetype)'\)/.exec(css)?.[1]
    return url ? await (await fetch(url)).arrayBuffer() : undefined
  } catch {
    return undefined
  }
}

// The app's fonts: Manrope, and Fraunces for what's printed on the felt.
const fonts = Promise.all([
  googleFont('Manrope', 600).then((data) => data && { name: 'Manrope', data, weight: 600 as const }),
  googleFont('Manrope', 800).then((data) => data && { name: 'Manrope', data, weight: 800 as const }),
  googleFont('Fraunces', 600, true).then((data) => data && { name: 'Fraunces', data, weight: 600 as const, style: 'italic' as const }),
]).then((list) => list.filter((font) => font !== undefined))

const CREAM = '#f4f1e8'
const GOLD = '#f2c14e'

export default async function Image({ params }: { params: Promise<{ codigo: string }> }) {
  const { codigo } = await params
  const run = await dailyPreview(codigo)
  const netColor = !run || run.net === 0 ? CREAM : run.net > 0 ? '#5fd17a' : '#ff7b80'

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          padding: '56px 72px',
          backgroundColor: '#0c5a34',
          backgroundImage: 'radial-gradient(ellipse 90% 70% at 50% 35%, #14834c 0%, #0c5a34 60%, #073a22 100%)',
          color: CREAM,
          fontFamily: 'Manrope, sans-serif',
          fontWeight: 600,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
          {/* oxlint-disable-next-line nextjs/no-img-element -- next/og only draws plain <img> */}
          <img alt="" src={ICON} width={64} height={64} style={{ borderRadius: 14 }} />
          <span style={{ fontSize: 30, fontWeight: 700, opacity: 0.85 }}>Blackjack with Friends</span>
        </div>

        {run ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 56 }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: 170,
                height: 236,
                borderRadius: 18,
                backgroundColor: '#f7f3ea',
                color: '#1d1d1f',
                fontSize: 64,
                fontWeight: 800,
                transform: 'rotate(-5deg)',
                boxShadow: '0 14px 30px rgba(0, 0, 0, 0.4)',
              }}
            >
              #{run.number}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
              <span style={{ fontSize: 30, color: GOLD, fontWeight: 700, letterSpacing: 4 }}>
                BARAJA DEL DÍA #{run.number}
              </span>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 24 }}>
                <span style={{ fontSize: 120, fontWeight: 800, lineHeight: 1, color: netColor }}>{signedNet(run.net)}</span>
                <span
                  style={{ fontFamily: 'Fraunces, serif', fontStyle: 'italic', fontSize: 44, maxWidth: 420, overflow: 'hidden' }}
                >
                  {run.nombre}
                </span>
              </div>
              <div style={{ display: 'flex', gap: 10 }}>
                {[...run.results].map((r, i) => (
                  <div
                    key={i}
                    style={{ width: 44, height: 44, borderRadius: 8, backgroundColor: SQUARE_COLORS[r] ?? 'rgba(255,255,255,0.14)' }}
                  />
                ))}
              </div>
            </div>
          </div>
        ) : (
          <span style={{ fontSize: 64, fontWeight: 800 }}>Juega la Baraja del día</span>
        )}

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontSize: 30, opacity: 0.75 }}>Las mismas cartas para todos · 1 intento</span>
          <span
            style={{
              display: 'flex',
              padding: '16px 34px',
              borderRadius: 999,
              backgroundColor: GOLD,
              color: '#1a1a1a',
              fontSize: 32,
              fontWeight: 800,
            }}
          >
            ¿Lo superas?
          </span>
        </div>
      </div>
    ),
    { ...size, fonts: await fonts },
  )
}
