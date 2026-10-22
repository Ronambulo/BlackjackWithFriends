'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { currentLanguage } from '@/i18n'
import { formatNumber } from '@/lib/format'
import { CheckIcon, ChevronRightIcon, LockIcon } from '@/ui/icons'
import styles from './Achievements.module.css'
import { useAchievements, useAchievementsSeen, type Achievement, type AchievementId, type Reward } from './useAchievements'

/** The profile's card: how many are done, the last one and any new ones; opens the whole list. */
export function AchievementsCard() {
  const { t } = useTranslation()
  const lang = currentLanguage()
  const { data } = useAchievements()
  if (!data) return null
  const unlocked = data.filter((a) => a.unlockedAt)
  const fresh = data.filter((a) => a.isNew).length
  const last = unlocked.reduce<(typeof unlocked)[number] | null>((a, b) => (!a || b.unlockedAt! > a.unlockedAt! ? b : a), null)

  return (
    <Link href="/logros" className={styles.card}>
      <span className={`${styles.badge} ${unlocked.length > 0 ? styles.gold : ''}`} aria-hidden="true">
        {unlocked.length > 0 ? <CheckIcon width={20} height={20} /> : <LockIcon width={18} height={18} />}
      </span>
      <span className={styles.text}>
        <span className={styles.cardHead}>
          <span className={styles.name}>{t('achievements.title')}</span>
          {fresh > 0 && <span className={styles.new}>{t('achievements.newCount', { count: fresh })}</span>}
          <span className={`muted ${styles.cardCount}`}>
            {t('achievements.progress', { done: formatNumber(unlocked.length, lang), total: formatNumber(data.length, lang) })}
          </span>
        </span>
        <span className={styles.bar} aria-hidden="true">
          <span style={{ width: `${(unlocked.length / data.length) * 100}%` }} />
        </span>
        <small className="muted">
          {last ? t('achievements.last', { name: t(`achievements.items.${last.id}.name`) }) : t('achievements.none')}
        </small>
      </span>
      <ChevronRightIcon className={styles.chevron} width={18} height={18} />
    </Link>
  )
}

type Filter = 'all' | 'pending' | 'done'
const FILTERS: Filter[] = ['all', 'pending', 'done']

/** The Logros page sorts them by where they're earned. */
const GROUPS: { key: 'table' | 'grind' | 'social'; ids: AchievementId[] }[] = [
  { key: 'table', ids: ['firstHand', 'firstBlackjack', 'doubleWin', 'splitWin', 'fiveCards', 'allIn'] },
  { key: 'grind', ids: ['streak5', 'survivor', 'hands1000', 'blackjack100', 'surrender25', 'dealerBust500'] },
  { key: 'social', ids: ['host', 'winWeek', 'podium10', 'chatty'] },
]

/** One stroke drawing per achievement (24×24). */
const ICONS: Record<AchievementId, string> = {
  firstHand: 'M7 4h8a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2zM11 9l1.5 3L11 15l-1.5-3z',
  firstBlackjack: 'M12 3c3 4 7 6 7 10a4 4 0 0 1-7 2.6A4 4 0 0 1 5 13c0-4 4-6 7-10zM12 15v6M9 21h6',
  doubleWin: 'M4 8l6 8M10 8l-6 8M14 9a3 3 0 0 1 6 0c0 2-6 4-6 7h6',
  splitWin: 'M12 21V12M12 12 6 4M12 12l6-8M4 7l2-3 3 1M20 7l-2-3-3 1',
  fiveCards: 'M17 4H8l-1 7a5 5 0 1 1-1 6',
  streak5: 'M12 3c1 4 6 6 6 11a6 6 0 0 1-12 0c0-3 2-4 3-6 0 2 1 3 2 3 0-3-1-5 1-8z',
  survivor: 'M12 20s-7-4.5-7-10a4 4 0 0 1 7-2.5A4 4 0 0 1 19 10c0 5.5-7 10-7 10z',
  host: 'M4 11 12 4l8 7M6 10v10h12V10M10 20v-5h4v5',
  winWeek: 'M4 8l4 4 4-7 4 7 4-4-2 11H6z',
  hands1000: 'M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z',
  podium10: 'M9 9h6v12H9zM3 14h6v7H3zM15 12h6v9h-6z',
  surrender25: 'M5 21V4M5 4h11l-2 4 2 4H5',
  chatty: 'M4 5h16v11H9l-5 4z',
  dealerBust500: 'M12 2v5M12 17v5M2 12h5M17 12h5M5 5l3.5 3.5M15.5 15.5 19 19M19 5l-3.5 3.5M8.5 15.5 5 19',
  allIn: 'M13 2 4 14h7l-1 8 9-12h-7z',
  blackjack100: 'M20 14A8 8 0 1 1 10 4a6.5 6.5 0 0 0 10 10z',
}

const ratio = (a: Achievement) => (a.progress ? a.progress.done / a.progress.goal : 0)

/** Every achievement (the Logros page): the closest one on top, then by group, with how far along each counted one is. */
export function Achievements() {
  const { t } = useTranslation()
  const lang = currentLanguage()
  const { data } = useAchievements()
  const { mutate: seen } = useAchievementsSeen()
  const [picked, setPicked] = useState<Filter | null>(null)

  // Shown once as new; the mark stays until the list is fetched again.
  const fresh = data?.filter((a) => a.isNew).map((a) => a.id).join() ?? ''
  useEffect(() => {
    if (fresh) seen(fresh.split(',') as AchievementId[])
  }, [fresh, seen])

  if (!data) return null
  const byId = new Map(data.map((a) => [a.id, a]))
  const done = data.filter((a) => a.unlockedAt).length
  const filter = picked ?? (done < data.length ? 'pending' : 'all')
  const dateFormat = new Intl.DateTimeFormat(lang, { day: 'numeric', month: 'short', year: 'numeric' })

  // The locked one with the most of its count done.
  const almost =
    filter === 'done'
      ? null
      : data
          .filter((a) => !a.unlockedAt && a.progress && a.progress.done > 0)
          .reduce<Achievement | null>((best, a) => (!best || ratio(a) > ratio(best) ? a : best), null)
  const shows = (a: Achievement) =>
    a.id !== almost?.id && (filter === 'all' || (filter === 'done') === !!a.unlockedAt)

  const groups = GROUPS.map((g) => {
    const items = g.ids.flatMap((id) => byId.get(id) ?? [])
    return { key: g.key, total: items.length, done: items.filter((a) => a.unlockedAt).length, rows: items.filter(shows) }
  })
  const empty = !almost && groups.every((g) => g.rows.length === 0)

  return (
    <section className={styles.section}>
      <div className={`segmented ${styles.filters}`} role="group" aria-label={t('achievements.filter.label')}>
        {FILTERS.map((f) => (
          <button key={f} type="button" aria-pressed={filter === f} onClick={() => setPicked(f)}>
            {t(`achievements.filter.${f}`)}
          </button>
        ))}
      </div>

      {almost?.progress && (
        <div className={styles.almost}>
          <span className={styles.almostLabel}>{t('achievements.almost')}</span>
          <div className={styles.almostBody}>
            <span className={styles.almostIcon}>
              <AchievementIcon id={almost.id} size={26} />
            </span>
            <span className={styles.text}>
              <span className={styles.head}>
                <b className={styles.almostName}>{t(`achievements.items.${almost.id}.name`)}</b>
                <RewardTag reward={almost.reward} />
              </span>
              <small className="muted">
                {t(`achievements.items.${almost.id}.how`)} ·{' '}
                {t('achievements.left', {
                  count: almost.progress.goal - almost.progress.done,
                  n: formatNumber(almost.progress.goal - almost.progress.done, lang),
                })}
              </small>
              <ProgressBar done={almost.progress.done} goal={almost.progress.goal} big />
            </span>
          </div>
        </div>
      )}

      {groups.map(
        (g) =>
          g.rows.length > 0 && (
            <div key={g.key} className={styles.group}>
              <div className={styles.groupHead}>
                <h2>{t(`achievements.groups.${g.key}`)}</h2>
                <span className={styles.groupBar} aria-hidden="true">
                  <span style={{ width: `${(g.done / g.total) * 100}%` }} />
                </span>
                <small>
                  {g.done}/{g.total}
                </small>
              </div>
              <ul className={styles.list}>
                {g.rows.map(({ id, reward, unlockedAt, isNew, progress }) => (
                  <li key={id} className={`${styles.item} ${unlockedAt ? styles.unlocked : ''}`}>
                    <span className={styles.tile}>
                      <AchievementIcon id={id} size={20} />
                    </span>
                    <span className={styles.text}>
                      <span className={styles.head}>
                        <span className={styles.name}>
                          {t(`achievements.items.${id}.name`)}
                          {isNew && <span className={styles.new}>{t('achievements.new')}</span>}
                        </span>
                        <RewardTag reward={reward} />
                      </span>
                      <small className="muted">{t(`achievements.items.${id}.how`)}</small>
                      {unlockedAt && (
                        <small className={styles.date}>
                          {t('achievements.unlockedOn', { date: dateFormat.format(new Date(unlockedAt)) })}
                        </small>
                      )}
                      {progress && <ProgressBar done={progress.done} goal={progress.goal} />}
                    </span>
                    {!unlockedAt && <span className="sr-only">{t('achievements.locked')}</span>}
                  </li>
                ))}
              </ul>
            </div>
          ),
      )}

      {empty && (
        <p className={`muted ${styles.empty}`}>{t(filter === 'done' ? 'achievements.none' : 'achievements.allDone')}</p>
      )}

      {filter === 'pending' && done > 0 && (
        <button type="button" className={styles.more} onClick={() => setPicked('done')}>
          {t('achievements.showDone', { count: done })}
        </button>
      )}
    </section>
  )
}

function AchievementIcon({ id, size }: { id: AchievementId; size: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={ICONS[id]} />
    </svg>
  )
}

function ProgressBar({ done, goal, big }: { done: number; goal: number; big?: boolean }) {
  const lang = currentLanguage()
  return (
    <span className={`${styles.progress} ${big ? styles.progressBig : ''}`}>
      <span className={styles.track} aria-hidden="true">
        <span style={{ width: `${(done / goal) * 100}%` }} />
      </span>
      <small>
        {formatNumber(done, lang)}/{formatNumber(goal, lang)}
      </small>
    </span>
  )
}

function RewardTag({ reward }: { reward: Reward }) {
  const { t } = useTranslation()
  if ('coins' in reward)
    return (
      <span className={styles.reward} aria-label={t('common.coins', { count: reward.coins })}>
        +{formatNumber(reward.coins, currentLanguage())}
      </span>
    )
  return (
    <span className={`${styles.reward} ${styles.cosmetic}`}>
      {t(`achievements.cosmetic.${reward.cosmetic}`, { name: reward.name })}
    </span>
  )
}
