'use client'

import { useTranslation } from 'react-i18next'
import { currentLanguage } from '@/i18n'
import { useCountdown } from '@/league/useCountdown'
import { formatNumber } from '@/lib/format'
import { CheckIcon, TimerIcon } from '@/ui/icons'
import { useChallenges } from './useChallenges'
import styles from './ChallengesCard.module.css'

/** Today's three challenges on the home screen: how far the player has got and what each pays. */
export function ChallengesCard() {
  const { t } = useTranslation()
  const lang = currentLanguage()
  const { data } = useChallenges()
  const countdown = useCountdown(data?.endsAt)
  if (!data) return null
  const done = data.challenges.filter((c) => c.done).length
  const fmt = (n: number) => formatNumber(n, lang)

  return (
    <section className={`card ${styles.card}`}>
      <div className={styles.header}>
        <h2 className="card-title">{t('challenges.title')}</h2>
        <span className={styles.count}>{t('challenges.count', { done, total: data.challenges.length })}</span>
      </div>
      <ul className={styles.list}>
        {data.challenges.map((c) => (
          <li key={c.id} className={`${styles.item} ${c.done ? styles.done : ''}`}>
            <span className={`${styles.tier} ${styles[c.tier]}`} title={t(`challenges.tiers.${c.tier}`)} aria-hidden="true">
              {c.done ? <CheckIcon width={14} height={14} strokeWidth={3} /> : null}
            </span>
            <div className={styles.body}>
              <p className={styles.text}>{t(`challenges.items.${c.id}`, { count: c.target, amount: fmt(c.target) })}</p>
              {c.target > 1 && (
                <div className={styles.progressRow}>
                  <div
                    className={styles.bar}
                    role="progressbar"
                    aria-valuemin={0}
                    aria-valuemax={c.target}
                    aria-valuenow={c.progress}
                    aria-label={t(`challenges.items.${c.id}`, { count: c.target, amount: fmt(c.target) })}
                  >
                    <span style={{ width: `${(c.progress / c.target) * 100}%` }} />
                  </div>
                  <span className={styles.fraction}>
                    {fmt(c.progress)}/{fmt(c.target)}
                  </span>
                </div>
              )}
            </div>
            <span className={styles.reward} aria-label={t('challenges.reward', { count: c.coins })}>
              <span className={styles.coin} aria-hidden="true" />+{fmt(c.coins)}
            </span>
          </li>
        ))}
      </ul>
      {countdown && (
        <p className={styles.footer}>
          <TimerIcon width={14} height={14} />
          {t('challenges.newIn', { time: countdown })}
        </p>
      )}
    </section>
  )
}
