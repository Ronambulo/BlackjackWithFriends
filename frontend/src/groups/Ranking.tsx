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

/** Medal colours only for those who reached the week's minimum: the rest can't take a place. */
const placeStyle = (member: RankedPlayer) => medal(member.qualified ? member.rank : 0)

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
          <li
            key={member.userId}
            className={`${styles.topRow} ${mine ? styles.mine : ''} ${member.qualified ? '' : styles.out}`}
            style={placeStyle(member)}
          >
            <span className={styles.place}>{member.rank}</span>
            <Avatar seed={member.userId} name={member.nombre} src={member.avatarUrl} frame={member.marco} />
            <span className={styles.name}>{mine ? t('ranking.you') : member.nombre}</span>
            {!member.qualified && <span className={styles.noMinimum}>{t('ranking.noMinimum')}</span>}
            <span className={styles.balance}>{formatNumber(member.balance, lang)}</span>
          </li>
        )
      })}
    </ol>
  )
}

/** Chips won or lost today, signed and coloured. */
export function DayChange({ amount, className = '' }: { amount: number; className?: string }) {
  const lang = currentLanguage()
  if (amount === 0) return <span className={`${styles.day} ${className}`}>=</span>
  const sign = amount > 0 ? '+' : '−'
  return (
    <span className={`${styles.day} ${amount > 0 ? styles.rankUp : styles.rankDown} ${className}`}>
      {amount > 0 ? '▲' : '▼'} {sign}
      {formatNumber(Math.abs(amount), lang)}
    </span>
  )
}

/**
 * Who is shown on the group's chart. With `onPick`, tapping someone on the podium or
 * in the rows adds them to it or takes them off.
 */
export interface Picker {
  picked: string[]
  onPick: (userId: string) => void
}

/** The first three on steps, the winner in the middle. */
export function Podium({ members, picker, dayChange }: { members: RankedPlayer[]; picker?: Picker; dayChange?: boolean }) {
  const { t } = useTranslation()
  const me = useUser()
  const lang = currentLanguage()
  // Second, first, third.
  const order = [members[1], members[0], members[2]]
  return (
    <section className={styles.podium} aria-label={t('ranking.podium')}>
      {order.map((member, index) => {
        if (!member) return <div key={index} />
        const mine = member.userId === me.id
        const content = (
          <>
            {member.rank === 1 && member.qualified && <CrownIcon className={styles.crown} />}
            <Avatar
              seed={member.userId}
              name={member.nombre}
              src={member.avatarUrl}
              frame={member.marco}
              size={member.rank === 1 ? 68 : 56}
              // A frame already rings it.
              className={member.marco ? '' : styles.podiumAvatar}
            />
            <span className={styles.podiumName}>{mine ? t('ranking.you') : member.nombre}</span>
            <span className={styles.podiumBalance}>{formatNumber(member.balance, lang)}</span>
            {!member.qualified && <span className={styles.noMinimum}>{t('ranking.noMinimum')}</span>}
            <div className={`${styles.block} ${styles[`block${member.rank}`] ?? ''} ${mine ? styles.mineBlock : ''}`}>
              <span className="sr-only">{t('ranking.place', { rank: member.rank })}</span>
              <span aria-hidden="true">{member.rank}</span>
            </div>
            {dayChange && <DayChange amount={member.dayChange} />}
          </>
        )
        const className = `${styles.step} ${member.qualified ? '' : styles.out}`
        return picker ? (
          <button
            key={member.userId}
            type="button"
            className={`${className} ${styles.pick}`}
            style={placeStyle(member)}
            aria-pressed={picker.picked.includes(member.userId)}
            onClick={() => picker.onPick(member.userId)}
          >
            {content}
          </button>
        ) : (
          <div key={member.userId} className={className} style={placeStyle(member)}>
            {content}
          </div>
        )
      })}
    </section>
  )
}

/**
 * A group's standings as rows, with the player's own row highlighted. With `leader`, each
 * row has a bar as long as its balance next to the leader's; with `minHands`, those below
 * the minimum say how many hands they have.
 */
export function Ranking({
  members,
  leader,
  minHands,
  picker,
}: {
  members: RankedPlayer[]
  leader?: number
  minHands?: number
  picker?: Picker
}) {
  const { t } = useTranslation()
  const me = useUser()
  const lang = currentLanguage()
  return (
    <ol className={leader === undefined ? styles.list : styles.bars}>
      {members.map((member) => {
        const mine = member.userId === me.id
        const content = (
          <>
            {leader !== undefined && member.qualified && (
              <span
                className={styles.bar}
                aria-hidden="true"
                style={{ width: `${leader > 0 ? Math.max(0, Math.min(100, (member.balance / leader) * 100)) : 0}%` }}
              />
            )}
            <span className={styles.rowPlace}>{member.rank}</span>
            <Avatar seed={member.userId} name={member.nombre} src={member.avatarUrl} frame={member.marco} />
            <span className={styles.who}>
              <span className={styles.name}>{mine ? t('ranking.you') : member.nombre}</span>
              {member.balance === 0 ? (
                <span className={styles.broke}>{t('ranking.broke')}</span>
              ) : (
                !member.qualified && (
                  <span className={styles.noMinimum}>
                    {minHands === undefined
                      ? t('ranking.noMinimum')
                      : member.hands >= minHands
                        ? t('ranking.noMinimumWagered')
                        : t('ranking.noMinimumHands', { hands: member.hands, min: minHands })}
                  </span>
                )
              )}
            </span>
            {leader === undefined && <RankChange change={member.rankChange} />}
            <span className={styles.rowEnd}>
              <span className={styles.rowBalance}>{formatNumber(member.balance, lang)}</span>
              {leader !== undefined && member.qualified && <DayChange amount={member.dayChange} />}
            </span>
          </>
        )
        const className = `${styles.row} ${mine ? styles.mine : ''} ${member.qualified ? '' : styles.out}`
        return (
          <li key={member.userId} className={picker ? undefined : className} style={placeStyle(member)}>
            {picker ? (
              <button
                type="button"
                className={`${className} ${styles.pick}`}
                aria-pressed={picker.picked.includes(member.userId)}
                onClick={() => picker.onPick(member.userId)}
              >
                {content}
              </button>
            ) : (
              content
            )}
          </li>
        )
      })}
    </ol>
  )
}
