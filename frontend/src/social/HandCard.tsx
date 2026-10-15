'use client'

import { useTranslation } from 'react-i18next'
import { currentLanguage } from '@/i18n'
import { formatNumber } from '@/lib/format'
import { PlayingCard } from '@/table/PlayingCard'
import type { SharedHand } from './useChat'
import styles from './Chat.module.css'

/** A published hand: the dealer's cards over the player's, how it went and the chips. */
export function HandCard({ hand }: { hand: SharedHand }) {
  const { t } = useTranslation()
  const lang = currentLanguage()
  const tone = hand.net > 0 ? styles.win : hand.net < 0 ? styles.lose : styles.push
  const net = hand.net === 0 ? '±0' : `${hand.net > 0 ? '+' : '−'}${formatNumber(Math.abs(hand.net), lang)}`
  const bet = hand.hands.reduce((sum, h) => sum + h.bet, 0) + hand.insurance

  return (
    <div className={styles.handCard}>
      <div className={styles.handRow}>
        <span className={styles.handLabel}>
          {t('play.dealer')}
          <b>{hand.dealerBlackjack ? t('play.blackjack') : hand.dealerTotal}</b>
        </span>
        <span className={styles.miniCards}>
          {hand.dealer.map((card, i) => (
            <PlayingCard key={i} card={card} still />
          ))}
        </span>
      </div>
      {hand.hands.map((h, i) => {
        const natural = hand.hands.length === 1 && h.cards.length === 2 && h.total === 21
        return (
          <div key={i} className={styles.handRow}>
            <span className={styles.handLabel}>
              {t(`play.outcomes.${h.outcome}`)}
              <b>{natural ? t('play.blackjack') : h.total}</b>
            </span>
            <span className={styles.miniCards}>
              {h.cards.map((card, j) => (
                <PlayingCard key={j} card={card} still />
              ))}
            </span>
          </div>
        )
      })}
      <div className={styles.handFoot}>
        <span className="muted">{t('social.bet', { amount: formatNumber(bet, lang) })}</span>
        <span className={`${styles.handNet} ${tone}`}>{net}</span>
      </div>
    </div>
  )
}
