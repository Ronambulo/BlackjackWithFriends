'use client'

import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { currentLanguage } from '@/i18n'
import { formatNumber } from '@/lib/format'
import { play as playSound } from '@/sound/sounds'
import { CheckIcon } from '@/ui/icons'
import styles from './UnlockToast.module.css'
import type { UnlockedAchievement } from './useAchievements'

/** How long each notice stays before the next one. */
const SHOW_MS = 3800
/** After the hand's own sound, so the two don't land together. */
const DELAY_MS = 500

/** "Achievement unlocked", one at a time, at the top of the table. Tap to skip it. */
export function UnlockToast({ achievement, onDone }: { achievement: UnlockedAchievement; onDone: () => void }) {
  const { t } = useTranslation()
  const { id, reward } = achievement

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
        <small>{t('achievements.unlocked')}</small>
        <strong>{t(`achievements.items.${id}.name`)}</strong>
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
