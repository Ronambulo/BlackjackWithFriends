'use client'

import { useTranslation } from 'react-i18next'
import { useUser } from '@/auth/session-context'
import { currentLanguage } from '@/i18n'
import { formatNumber } from '@/lib/format'
import { Avatar } from '@/ui/Avatar'
import { CrownIcon } from '@/ui/icons'
import { medal } from './medal'
import { RankChange } from './RankChange'
import type { RankedPlayer } from './useRankings'
import styles from './Ranking.module.css'

/** The top of a group in a few lines, with the player's own row highlighted. */
export function TopList({ members }: { members: RankedPlayer[] }) {
  const { t } = useTranslation()
  const me = useUser()
  const lang = currentLanguage()
  return (
    <ol className={styles.top}>
      {members.map((member) => {
        const mine = member.userId === me.id
        return (
          <li key={member.userId} className={`${styles.topRow} ${mine ? styles.mine : ''}`} style={medal(member.rank)}>
            <span className={styles.place}>{member.rank}</span>
            <Avatar seed={member.userId} name={member.nombre} src={member.avatarUrl} />
            <span className={styles.name}>{mine ? t('ranking.you') : member.nombre}</span>
            <span className={styles.balance}>{formatNumber(member.balance, lang)}</span>
          </li>
        )
      })}
    </ol>
  )
}

/** The first three on steps, the winner in the middle. */
export function Podium({ members }: { members: RankedPlayer[] }) {
  const { t } = useTranslation()
  const me = useUser()
  const lang = currentLanguage()
  // Second, first, third.
  const order = [members[1], members[0], members[2]]
  return (
    <section className={styles.podium} aria-label={t('ranking.podium')}>
      {order.map((member, index) =>
        member ? (
          <div key={member.userId} className={styles.step} style={medal(member.rank)}>
            {member.rank === 1 && <CrownIcon className={styles.crown} />}
            <Avatar
              seed={member.userId}
              name={member.nombre}
              src={member.avatarUrl}
              size={member.rank === 1 ? 68 : 56}
              className={styles.podiumAvatar}
            />
            <span className={styles.podiumName}>{member.userId === me.id ? t('ranking.you') : member.nombre}</span>
            <span className={styles.podiumBalance}>{formatNumber(member.balance, lang)}</span>
            <div className={`${styles.block} ${styles[`block${member.rank}`]}`}>
              <span className="sr-only">{t('ranking.place', { rank: member.rank })}</span>
              <span aria-hidden="true">{member.rank}</span>
            </div>
          </div>
        ) : (
          <div key={index} />
        ),
      )}
    </section>
  )
}

/** A group's standings as rows, with the player's own row highlighted. */
export function Ranking({ members }: { members: RankedPlayer[] }) {
  const { t } = useTranslation()
  const me = useUser()
  const lang = currentLanguage()
  return (
    <ol className={styles.list}>
      {members.map((member) => {
        const mine = member.userId === me.id
        return (
          <li key={member.userId} className={`${styles.row} ${mine ? styles.mine : ''}`}>
            <span className={styles.rowPlace}>{member.rank}</span>
            <Avatar seed={member.userId} name={member.nombre} src={member.avatarUrl} />
            <span className={styles.who}>
              <span className={styles.name}>{mine ? t('ranking.you') : member.nombre}</span>
              {member.balance === 0 && <span className={styles.broke}>{t('ranking.broke')}</span>}
            </span>
            <RankChange change={member.rankChange} />
            <span className={styles.rowBalance}>{formatNumber(member.balance, lang)}</span>
          </li>
        )
      })}
    </ol>
  )
}
