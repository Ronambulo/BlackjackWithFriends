'use client'

import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { currentLanguage } from '@/i18n'
import { formatNumber } from '@/lib/format'
import { play as playSound } from '@/sound/sounds'
import { CheckIcon } from '@/ui/icons'
import type { CompletedChallenge } from '@/challenges/useChallenges'
import styles from './UnlockToast.module.css'
import type { UnlockedAchievement } from './useAchievements'

/** What a hand can announce: an achievement unlocked, or one of the day's challenges done. */
export type Notice = ({ kind: 'achievement' } & UnlockedAchievement) | ({ kind: 'challenge' } & CompletedChallenge)

/** How long each notice stays before the next one. */
const SHOW_MS = 3800
/** After the hand's own sound, so the two don't land together. */
const DELAY_MS = 500

/** "Achievement unlocked" or "Challenge done", one at a time, at the top of the table. Tap to skip it. */
export function UnlockToast({ notice, onDone }: { notice: Notice; onDone: () => void }) {
  const { t } = useTranslation()
  const { id } = notice
  const reward = notice.kind === 'achievement' ? notice.reward : { coins: notice.coins }

  useEffect(() => {
    const sound = setTimeout(() => playSound('achievement'), DELAY_MS)
    const done = setTimeout(onDone, DELAY_MS + SHOW_MS)
    return () => {
      clearTimeout(sound)
      clearTimeout(done)
    }
  }, [id, onDone])

  return (
    <button type="button" className={styles.toast} onClick={onDone} role="status">
      <span className={styles.medal} aria-hidden="true">
        <CheckIcon width={22} height={22} />
      </span>
      <span className={styles.text}>
        <small>{t(notice.kind === 'achievement' ? 'achievements.unlocked' : 'challenges.done')}</small>
        <strong>
          {notice.kind === 'achievement'
            ? t(`achievements.items.${notice.id}.name`)
            : t(`challenges.items.${notice.id}`, { count: notice.target, amount: formatNumber(notice.target, currentLanguage()) })}
        </strong>
      </span>
      <span className={styles.reward}>
        {'coins' in reward ? (
          <>
            <span className={styles.coin} aria-hidden="true" />+{formatNumber(reward.coins, currentLanguage())}
          </>
        ) : (
          t(`achievements.cosmetic.${reward.cosmetic}`, { name: reward.name })
        )}
      </span>
    </button>
  )
}
