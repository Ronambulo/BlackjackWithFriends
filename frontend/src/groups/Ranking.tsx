'use client'

import { useTranslation } from 'react-i18next'
import { useUser } from '@/auth/session-context'
import { currentLanguage } from '@/i18n'
import { formatNumber } from '@/lib/format'
import { RankChange } from './RankChange'
import type { RankedMember } from './useGroups'
import styles from './Ranking.module.css'

const MEDALS = ['🥇', '🥈', '🥉']

/** A group's standings, with the player's own row highlighted. */
export function Ranking({ members }: { members: RankedMember[] }) {
  const { t } = useTranslation()
  const me = useUser()
  const lang = currentLanguage()
  const fmt = (n: number) => formatNumber(n, lang)
  return (
    <ol className={styles.list}>
      {members.map((member) => {
        const mine = member.userId === me.id
        return (
          <li key={member.userId} className={`${styles.row} ${mine ? styles.mine : ''}`}>
            <span className={styles.place}>{MEDALS[member.rank - 1] ?? `${member.rank}º`}</span>
            <span className={styles.avatar} aria-hidden="true">
              {member.nombre.charAt(0).toUpperCase()}
            </span>
            <span className={styles.who}>
              <span className={styles.name}>{mine ? `${member.nombre} · ${t('ranking.you')}` : member.nombre}</span>
              {member.dayChange !== 0 && (
                <span className={member.dayChange > 0 ? styles.gain : styles.loss}>
                  {t('league.today', { change: `${member.dayChange > 0 ? '+' : '−'}${fmt(Math.abs(member.dayChange))}` })}
                </span>
              )}
            </span>
            <RankChange change={member.rankChange} />
            <span className={styles.balance}>{fmt(member.balance)}</span>
          </li>
        )
      })}
    </ol>
  )
}
