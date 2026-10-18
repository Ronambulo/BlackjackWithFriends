import type { Metadata } from 'next'
import { SQUARES, dailyPreview, signedNet } from '@/daily/dailyPreview'
import { DailyLanding } from './DailyLanding'

// The link a finished daily deck shares: /r/<code>. Outside the signed-in app so link
// previews find the result in the HTML; people are sent on to today's deck.

type Props = { params: Promise<{ codigo: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { codigo } = await params
  const run = await dailyPreview(codigo)
  if (!run) return { title: 'Blackjack with Friends', robots: { index: false } }

  const title = `🃏 Baraja del día #${run.number} · ${signedNet(run.net)}`
  const squares = [...run.results].map((r) => SQUARES[r] ?? '').join('')
  const description = `${run.nombre} · ${squares} · Las mismas cartas para todos. ¿Lo superas?`
  return {
    title,
    description,
    robots: { index: false },
    openGraph: { type: 'website', siteName: 'Blackjack with Friends', title, description, locale: 'es_ES' },
    twitter: { card: 'summary_large_image', title, description },
  }
}

export default function DailyLinkPage() {
  return <DailyLanding />
}
