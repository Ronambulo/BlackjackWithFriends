'use client'

import { useTranslation } from 'react-i18next'
import { currentLanguage } from '@/i18n'
import { formatNumber } from '@/lib/format'
import { useStats } from '@/profile/useStats'
import { CardsIcon, CoinsIcon, CrownIcon, PodiumIcon } from '@/ui/icons'
import styles from './Season.module.css'
import { formatWeek } from './useSeason'

/** The profile's closed weeks: how many played, won and podiums, and every trophy. */
export function Trophies() {
  const { t } = useTranslation()
  const { data } = useStats()
  const lang = currentLanguage()
  const record = data?.seasons

  return (
    <section className={styles.section}>
      <h2 className="label">{t('profile.trophies')}</h2>
      {!record?.played ? (
        <p className="muted">{t('profile.noTrophies')}</p>
      ) : (
        <>
          <div className={styles.record}>
            {/* The weeks won lead; the rest sit under them */}
            <div className={styles.recordHero} data-won={record.won > 0}>
              <span className={styles.medal} aria-hidden="true">
                <CrownIcon width={30} height={24} />
              </span>
              <div className={styles.recordWon}>
                <span className={styles.recordBig}>{formatNumber(record.won, lang)}</span>
                <span className={styles.recordLabel}>{t('season.record.wonWeeks', { count: record.won })}</span>
              </div>
              <span className={styles.recordRate}>
                {t('season.record.rate', { pct: Math.round((record.won / record.played) * 100) })}
              </span>
            </div>
            <dl className={styles.recordRow}>
              {(
                [
                  ['played', CardsIcon],
                  ['podiums', PodiumIcon],
                  ['coins', CoinsIcon],
                ] as const
              ).map(([key, Icon]) => (
                <div key={key} data-key={key}>
                  <dt>
                    <Icon width={14} height={14} aria-hidden="true" />
                    {t(`season.record.${key}`)}
                  </dt>
                  <dd>{formatNumber(record[key], lang)}</dd>
                </div>
              ))}
            </dl>
          </div>
          {record.trophies.length > 0 && (
            <ul className={styles.trophies}>
              {record.trophies.map((trophy) => (
                <li key={`${trophy.semana}-${trophy.groupId}`}>
                  <CrownIcon width={20} height={20} />
                  {t('season.trophy', { group: trophy.nombre, date: formatWeek(trophy.semana, lang) })}
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </section>
  )
}
