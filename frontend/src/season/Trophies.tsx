'use client'

import { useTranslation } from 'react-i18next'
import { currentLanguage } from '@/i18n'
import { formatNumber } from '@/lib/format'
import { useStats } from '@/profile/useStats'
import { CrownIcon } from '@/ui/icons'
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
          <dl className={styles.record}>
            {(['played', 'won', 'podiums', 'coins'] as const).map((key) => (
              <div key={key}>
                <dt>{t(`season.record.${key}`)}</dt>
                <dd>{formatNumber(record[key], lang)}</dd>
              </div>
            ))}
          </dl>
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
