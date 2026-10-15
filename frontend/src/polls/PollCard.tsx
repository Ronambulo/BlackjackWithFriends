'use client'

import { useTranslation } from 'react-i18next'
import { currentLanguage } from '@/i18n'
import { formatNumber } from '@/lib/format'
import { CheckIcon } from '@/ui/icons'
import { usePolls, useVote, type Poll } from './usePolls'
import styles from './PollCard.module.css'

function PollItem({ poll }: { poll: Poll }) {
  const { t } = useTranslation()
  const vote = useVote()
  const total = poll.votes?.reduce((sum, n) => sum + n, 0) ?? 0
  const answered = poll.mine !== null

  return (
    <section className={`card ${styles.card}`}>
      <div className={styles.header}>
        <span className={styles.kicker}>{t('polls.kicker')}</span>
        {answered && <span className={styles.count}>{t('polls.votes', { count: total, n: formatNumber(total, currentLanguage()) })}</span>}
      </div>
      <h2 className={styles.question}>{poll.pregunta}</h2>
      <ul className={styles.options}>
        {poll.opciones.map((option, i) => {
          const share = answered && total > 0 ? Math.round(((poll.votes?.[i] ?? 0) / total) * 100) : 0
          const mine = poll.mine === i
          return (
            <li key={i}>
              <button
                type="button"
                className={`${styles.option} ${mine ? styles.mine : ''}`}
                aria-pressed={mine}
                disabled={vote.isPending}
                onClick={() => !mine && vote.mutate({ id: poll.id, opcion: i })}
              >
                {answered && <span className={styles.fill} style={{ width: `${share}%` }} aria-hidden="true" />}
                <span className={styles.label}>
                  {mine && <CheckIcon width={14} height={14} strokeWidth={3} />}
                  {option}
                </span>
                {answered && <span className={styles.share}>{share}%</span>}
              </button>
            </li>
          )
        })}
      </ul>
      {vote.isError && <p className="error-text">{t('common.error')}</p>}
      <p className={styles.footer}>{answered ? t('polls.change') : t('polls.hint')}</p>
    </section>
  )
}

/** The admins' open polls on the home screen; answering shows how everyone answered. */
export function PollCard() {
  const { data } = usePolls()
  if (!data?.length) return null
  return (
    <>
      {data.map((poll) => (
        <PollItem key={poll.id} poll={poll} />
      ))}
    </>
  )
}
