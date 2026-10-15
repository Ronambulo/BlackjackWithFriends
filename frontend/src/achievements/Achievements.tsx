'use client'

import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { currentLanguage } from '@/i18n'
import { formatNumber } from '@/lib/format'
import { CheckIcon, LockIcon } from '@/ui/icons'
import styles from './Achievements.module.css'
import { useAchievements, useAchievementsSeen, type AchievementId, type Reward } from './useAchievements'

/** Every achievement with its reward: the unlocked ones first, then the rest locked. */
export function Achievements() {
  const { t } = useTranslation()
  const lang = currentLanguage()
  const { data } = useAchievements()
  const { mutate: seen } = useAchievementsSeen()

  // Shown once as new; the mark stays until the list is fetched again.
  const fresh = data?.filter((a) => a.isNew).map((a) => a.id).join() ?? ''
  useEffect(() => {
    if (fresh) seen(fresh.split(',') as AchievementId[])
  }, [fresh, seen])

  if (!data) return null
  const list = [...data].sort((a, b) => Number(!!b.unlockedAt) - Number(!!a.unlockedAt))
  const done = data.filter((a) => a.unlockedAt).length
  const dateFormat = new Intl.DateTimeFormat(lang, { day: 'numeric', month: 'short', year: 'numeric' })

  return (
    <section className={styles.section}>
      <div className={styles.head}>
        <h2 className="label">{t('achievements.title')}</h2>
        <span className="muted">{t('achievements.progress', { done, total: data.length })}</span>
      </div>
      <ul className={styles.list}>
        {list.map(({ id, reward, unlockedAt, isNew }) => (
          <li key={id} className={`${styles.item} ${unlockedAt ? styles.unlocked : ''}`}>
            <span className={styles.badge} aria-hidden="true">
              {unlockedAt ? <CheckIcon width={20} height={20} /> : <LockIcon width={18} height={18} />}
            </span>
            <span className={styles.text}>
              <span className={styles.name}>
                {t(`achievements.items.${id}.name`)}
                {isNew && <span className={styles.new}>{t('achievements.new')}</span>}
              </span>
              <small className="muted">
                {unlockedAt
                  ? t('achievements.unlockedOn', { date: dateFormat.format(new Date(unlockedAt)) })
                  : t(`achievements.items.${id}.how`)}
              </small>
            </span>
            <RewardTag reward={reward} />
            {!unlockedAt && <span className="sr-only">{t('achievements.locked')}</span>}
          </li>
        ))}
      </ul>
    </section>
  )
}

function RewardTag({ reward }: { reward: Reward }) {
  const { t } = useTranslation()
  if ('coins' in reward)
    return (
      <span className={styles.reward} aria-label={t('common.coins', { count: reward.coins })}>
        <span className={styles.coin} aria-hidden="true" />
        {formatNumber(reward.coins, currentLanguage())}
      </span>
    )
  return (
    <span className={`${styles.reward} ${styles.cosmetic}`}>
      {t(`achievements.cosmetic.${reward.cosmetic}`, { name: reward.name })}
    </span>
  )
}
