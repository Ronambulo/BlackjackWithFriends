import { useTranslation } from 'react-i18next'
import styles from './Ranking.module.css'

/** ▲2 / ▼1 for the places gained or lost today; nothing if unchanged. */
export function RankChange({ change }: { change: number }) {
  const { t } = useTranslation()
  if (change === 0) return null
  const up = change > 0
  const count = Math.abs(change)
  return (
    <span className={up ? styles.rankUp : styles.rankDown} aria-label={t(up ? 'ranking.up' : 'ranking.down', { count })}>
      <svg viewBox="0 0 24 24" width="10" height="10" fill="currentColor" aria-hidden="true">
        <path d={up ? 'M12 5 21 19H3z' : 'M12 19 3 5h18z'} />
      </svg>
      {count}
    </span>
  )
}
