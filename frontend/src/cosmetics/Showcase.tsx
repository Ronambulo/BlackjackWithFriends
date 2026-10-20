'use client'

import type { Card } from '@bwf/engine'
import { useUser } from '@/auth/session-context'
import { useProfile } from '@/profile/useProfile'
import { PlayingCard } from '@/table/PlayingCard'
import { Avatar } from '@/ui/Avatar'
import css from './Showcase.module.css'
import { Chip } from './StylePreview'
import { themeStyle, type Equipped } from './themes'

const SHOWN_CHIPS = [5, 25, 100, 500] as const

// As at the table: the up card, then the hole card tucked under it
const DEALER: (Card | null)[] = [{ rank: '7', suit: 'C' }, null]
const PLAYER: Card[] = [
  { rank: 'A', suit: 'H' },
  { rank: 'K', suit: 'S' },
  { rank: '10', suit: 'D' },
]

/** A small table wearing the styles being tried on. */
export function Showcase({ equipped, className = '' }: { equipped: Equipped | undefined; className?: string }) {
  const user = useUser()
  const { data: profile } = useProfile()
  return (
    <div className={`${css.showcase} ${className}`} style={themeStyle(equipped)} aria-hidden="true">
      <div className={css.cards}>
        {DEALER.map((card, i) => (
          <PlayingCard key={i} card={card} still />
        ))}
      </div>
      <div className={css.cards}>
        {PLAYER.map((card, i) => (
          <PlayingCard key={i} card={card} still />
        ))}
      </div>
      <div className={css.seat}>
        <Avatar seed={user.id} name={profile?.nombre ?? ''} src={profile?.avatar_url} size={40} frame={equipped?.marco} />
        <div className={css.chips}>
          {SHOWN_CHIPS.map((value) => (
            <Chip key={value} value={value} />
          ))}
        </div>
      </div>
    </div>
  )
}
