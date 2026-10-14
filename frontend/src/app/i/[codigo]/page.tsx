import type { Metadata } from 'next'
import { invitePreview } from '@/groups/invitePreview'
import { formatNumber } from '@/lib/format'
import { InviteLanding } from './InviteLanding'

// The link friends get: /i/<code>. A page of its own, outside the signed-in app, so the
// bots behind WhatsApp, Telegram or Discord previews (which don't run JavaScript) find
// the group's name and ranking in the HTML. People are sent on to the app's join screen.

type Props = { params: Promise<{ codigo: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { codigo } = await params
  const invite = await invitePreview(codigo)
  // A dead link keeps the app's generic card (root layout).
  if (!invite) return { title: 'Blackjack with Friends', robots: { index: false } }

  const title = `Únete a «${invite.nombre}» 🃏`
  const leader = invite.top[0]
  const description = [
    invite.members === 1 ? '1 jugador' : `${invite.members} jugadores`,
    leader ? `Líder: ${leader.nombre} (${formatNumber(leader.balance, 'es')})` : null,
    'Tu liga semanal de blackjack con amigos',
  ]
    .filter(Boolean)
    .join(' · ')
  return {
    title,
    description,
    robots: { index: false },
    openGraph: { type: 'website', siteName: 'Blackjack with Friends', title, description, locale: 'es_ES' },
    twitter: { card: 'summary_large_image', title, description },
  }
}

export default async function InvitePage({ params }: Props) {
  const { codigo } = await params
  const invite = await invitePreview(codigo)
  return <InviteLanding codigo={codigo} valid={invite !== null} />
}
