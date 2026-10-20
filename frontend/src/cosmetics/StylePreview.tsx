'use client'

import type { CSSProperties } from 'react'
import { useUser } from '@/auth/session-context'
import { useProfile } from '@/profile/useProfile'
import { PlayingCard } from '@/table/PlayingCard'
import { Avatar } from '@/ui/Avatar'
import styles from './StylePreview.module.css'
import { themeStyle, type CosmeticKind, type Equipped } from './themes'

/** A chip in the colours of the chips worn around it. */
export function Chip({ value, small = false }: { value: number; small?: boolean }) {
  const style = {
    background: `var(--chip${value}-art, none) border-box center / 100% 100% no-repeat, var(--chip${value}-face)`,
    borderColor: `var(--chip${value}-stripe)`,
    color: `var(--chip${value}-text)`,
    boxShadow: `0 ${small ? 2 : 3}px 0 var(--chip${value}-edge)`,
  } as CSSProperties
  return (
    <span className={`${styles.chip} ${small ? styles.chipSmall : ''}`} style={style}>
      {value}
    </span>
  )
}

/** A little look at one style, on top of the rest of what's worn. */
export function StylePreview({
  id,
  tipo,
  equipped,
  className = '',
  spot = true,
}: {
  id: string
  tipo: CosmeticKind
  equipped?: Equipped
  className?: string
  /** The betting spot on a felt; off where the felt is a small swatch */
  spot?: boolean
}) {
  const user = useUser()
  const { data: profile } = useProfile()
  const style = themeStyle({ ...equipped, [tipo]: id })
  return (
    <span className={`${styles.preview} ${styles[`preview_${tipo}`]} ${className}`} style={style} aria-hidden="true">
      {tipo === 'tapete' && <span className={styles.feltArt} />}
      {tipo === 'tapete' && spot && <span className={styles.previewSpot} />}
      {tipo === 'cartas' && <PlayingCard card={{ rank: 'A', suit: 'H' }} still />}
      {tipo === 'dorso' && <PlayingCard card={null} still />}
      {tipo === 'fichas' && [5, 25, 100].map((value) => <Chip key={value} value={value} small />)}
      {tipo === 'marco' && <Avatar seed={user.id} name={profile?.nombre ?? ''} src={profile?.avatar_url} size={40} frame={id} />}
    </span>
  )
}
