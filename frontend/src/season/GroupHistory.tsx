'use client'

import { useTranslation } from 'react-i18next'
import { useUser } from '@/auth/session-context'
import { medal } from '@/groups/medal'
import { currentLanguage } from '@/i18n'
import { formatNumber } from '@/lib/format'
import { Avatar } from '@/ui/Avatar'
import { ChevronDownIcon, CrownIcon } from '@/ui/icons'
import styles from './Season.module.css'
import { formatWeek, useGroupSeasons, type GroupWeek } from './useSeason'

/** A group's closed weeks: who won each one, opened to see the whole table and the joke prizes. */
export function GroupHistory({ groupId }: { groupId: string }) {
  const { t } = useTranslation()
  const { data: weeks } = useGroupSeasons(groupId)
  if (!weeks?.length) return null
  return (
    <section className={styles.section}>
      <h2 className="label">{t('season.history')}</h2>
      <div className={styles.weeks}>
        {weeks.map((week) => (
          <Week key={week.semana} week={week} />
        ))}
      </div>
    </section>
  )
}

function Week({ week }: { week: GroupWeek }) {
  const { t } = useTranslation()
  const me = useUser()
  const lang = currentLanguage()
  const nameOf = (userId: string, nombre: string) => (userId === me.id ? t('ranking.you') : nombre)
  const winners = week.standings.filter((s) => s.trofeo)
  const mine = week.standings.find((s) => s.userId === me.id)

  return (
    <details className={styles.week}>
      <summary className={styles.weekHead}>
        <span className={styles.weekText}>
          <span>{t('season.weekOf', { date: formatWeek(week.semana, lang) })}</span>
          <small className={`muted ${styles.weekWinner}`}>
            {winners.length > 0 && <CrownIcon className={styles.weekCrown} width={14} height={14} />}
            {winners.length ? winners.map((w) => nameOf(w.userId, w.nombre)).join(', ') : t('season.noPrizes')}
          </small>
        </span>
        {mine && week.conPremios && mine.clasificado && (
          <span className={styles.weekPlace} style={medal(mine.posicion)}>
            {t('season.place', { place: mine.posicion })}
          </span>
        )}
        <ChevronDownIcon className={styles.weekChevron} width={18} height={18} />
      </summary>

      <ol className={styles.standings}>
        {week.standings.map((s) => (
          <li
            key={s.userId}
            className={s.userId === me.id ? styles.me : undefined}
            style={medal(week.conPremios && s.clasificado ? s.posicion : 0)}
          >
            <span className={styles.standingPlace}>{s.posicion}</span>
            <Avatar seed={s.userId} name={s.nombre} src={s.avatarUrl} size={28} />
            <span className={styles.standingName}>{nameOf(s.userId, s.nombre)}</span>
            {!s.clasificado && <small className="muted">{t('ranking.noMinimum')}</small>}
            <span className={styles.standingBalance}>{formatNumber(s.saldo, lang)}</span>
          </li>
        ))}
      </ol>

      {week.jokes.length > 0 && (
        <ul className={styles.weekJokes}>
          {week.jokes.map((joke) => (
            <li key={joke.prize}>
              <b>{t(`season.joke.${joke.prize}`)}</b>{' '}
              {joke.userIds
                .map((id) => nameOf(id, week.standings.find((s) => s.userId === id)?.nombre ?? ''))
                .join(', ')}{' '}
              <span className="muted">
                ·{' '}
                {t(`season.jokeValue.${joke.prize}`, { count: joke.value, amount: formatNumber(joke.value, lang) })}
              </span>
            </li>
          ))}
        </ul>
      )}
    </details>
  )
}
