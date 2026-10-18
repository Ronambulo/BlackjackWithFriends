// What a shared daily deck link shows before anyone signs in (docs/DISENO.md, "Baraja del
// día"): read on the server by the /r/[codigo] page and its preview image.

const apiOrigin = process.env.API_ORIGIN ?? 'http://127.0.0.1:3001'

export interface DailyPreview {
  nombre: string
  number: number
  day: string
  net: number
  /** One letter per hand: w won, l lost, p push. */
  results: string
}

/** The finished run behind a code, or null if there's none. */
export async function dailyPreview(codigo: string): Promise<DailyPreview | null> {
  try {
    const res = await fetch(`${apiOrigin}/api/daily/preview?codigo=${encodeURIComponent(codigo)}`, {
      // A run never changes once it's over.
      next: { revalidate: 300 },
    })
    return res.ok ? ((await res.json()) as DailyPreview) : null
  } catch {
    return null
  }
}

export const SQUARES: Record<string, string> = { w: '🟩', l: '🟥', p: '⬜' }

export const SQUARE_COLORS: Record<string, string> = { w: '#3fb950', l: '#e5484d', p: '#c9ccd1' }

/** +650, -300, ±0. */
export function signedNet(net: number): string {
  if (net === 0) return '±0'
  return `${net > 0 ? '+' : '−'}${Math.abs(net).toLocaleString('es-ES')}`
}
