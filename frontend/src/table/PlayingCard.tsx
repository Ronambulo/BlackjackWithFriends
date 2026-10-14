import type { Card, Suit } from '@bwf/engine'
import type { CSSProperties } from 'react'
import styles from './PlayingCard.module.css'

// U+FE0E keeps iOS from drawing the suits as emoji.
const SUIT_SYMBOL: Record<Suit, string> = { S: '♠︎', H: '♥︎', D: '♦︎', C: '♣︎' }

/**
 * A card that flies in from the shoe when it mounts (after `delay` seconds).
 * With `card` null it shows its back. With `flipAt`, it lands face down and
 * turns over at that moment (the dealer's hole card).
 */
export function PlayingCard({ card, delay = 0, flipAt }: { card: Card | null; delay?: number; flipAt?: number }) {
  const red = card?.suit === 'H' || card?.suit === 'D'
  const style = { '--deal-delay': `${delay}s`, '--flip-delay': `${flipAt ?? 0}s` } as CSSProperties
  const turn = !card ? styles.faceDown : flipAt !== undefined ? styles.flip : ''
  return (
    <div className={styles.slot} style={style} role="img" aria-label={card ? `${card.rank}${SUIT_SYMBOL[card.suit]}` : '?'}>
      <div className={`${styles.inner} ${turn}`}>
        <div className={`${styles.face} ${red ? styles.red : ''}`} aria-hidden="true">
          {card && (
            <>
              <span className={styles.corner}>
                {card.rank}
                <br />
                {SUIT_SYMBOL[card.suit]}
              </span>
              <span className={styles.pip}>{SUIT_SYMBOL[card.suit]}</span>
              <span className={`${styles.corner} ${styles.bottom}`}>
                {card.rank}
                <br />
                {SUIT_SYMBOL[card.suit]}
              </span>
            </>
          )}
        </div>
        <div className={styles.back} aria-hidden="true" />
      </div>
    </div>
  )
}
