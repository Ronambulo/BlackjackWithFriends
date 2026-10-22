'use client'

import Link from 'next/link'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useUser } from '@/auth/session-context'
import { currentLanguage } from '@/i18n'
import { formatNumber } from '@/lib/format'
import { ShareSheet } from '@/social/ShareSheet'
import { CardsIcon, ChartIcon, ChatIcon, CheckIcon, ChevronRightIcon, ShareIcon } from '@/ui/icons'
import { percent, signed } from './numbers'
import { storyImage } from './storyImage'
import { useProfile } from './useProfile'
import { useStats, type Stats } from './useStats'
import styles from './Stats.module.css'

export type Range = 'week' | 'total'

// As many hands as the server sends back (routes/stats.ts).
const SLOTS = 30

function netTone(net: number) {
  return net > 0 ? 'win' : net < 0 ? 'lose' : 'push'
}


/** Won, pushed and lost as one bar, with the shares underneath. */
function Outcomes({ stats }: { stats: Stats }) {
  const { t } = useTranslation()
  const parts = [
    { key: 'wins', count: stats.wins, className: styles.win },
    { key: 'pushes', count: stats.pushes, className: styles.push },
    { key: 'losses', count: stats.losses, className: styles.loss },
  ] as const
  return (
    <>
      <div className={styles.bar} aria-hidden="true">
        {stats.hands === 0 ? (
          <span className={styles.push} style={{ flex: 1 }} />
        ) : (
          parts.map((part) => part.count > 0 && <span key={part.key} className={part.className} style={{ flex: part.count }} />)
        )}
      </div>
      <ul className={styles.legend}>
        {parts.map((part) => (
          <li key={part.key}>
            <span className={`${styles.dot} ${part.className}`} aria-hidden="true" />
            <b>{percent(part.count, stats.hands)}%</b>
            <span>{t(`stats.${part.key}`, { count: part.count })}</span>
          </li>
        ))}
      </ul>
    </>
  )
}

/** The last hands as bars above (won) or below (lost) a middle line. */
export function Recent({ nets }: { nets: number[] }) {
  const max = Math.max(1, ...nets.map(Math.abs))
  const slot = 10
  // Room for a full row from the start, so a few hands aren't drawn as fat bars.
  const offset = Math.max(0, SLOTS - nets.length)
  const width = (offset + nets.length) * slot
  return (
    <svg className={styles.chart} viewBox={`0 0 ${width} 80`} preserveAspectRatio="none" aria-hidden="true">
      <line x1="0" x2={width} y1="40" y2="40" className={styles.axis} />
      {nets.map((net, i) => {
        // Even a tiny result gets a visible bar; a push is just a notch.
        const height = net === 0 ? 2 : Math.max(4, (Math.abs(net) / max) * 38)
        return (
          <rect
            key={i}
            x={(offset + i) * slot + 2}
            y={net > 0 ? 40 - height : net < 0 ? 40 : 39}
            width={slot - 4}
            height={height}
            rx="1.5"
            className={net > 0 ? styles.win : net < 0 ? styles.loss : styles.push}
          />
        )
      })}
    </svg>
  )
}

/**
 * Makes an Instagram-story image with the numbers and sends it anywhere the phone
 * can with the system's share sheet, or saves it where there's none.
 */
function ShareStats({ stats, range }: { stats: Stats; range: Range }) {
  const { t } = useTranslation()
  const user = useUser()
  const { data: profile } = useProfile()
  const [state, setState] = useState<'idle' | 'busy' | 'saved'>('idle')
  const language = currentLanguage()

  async function onShare() {
    setState('busy')
    try {
      const blob = await storyImage({
        title: t(`stats.story.${range}`),
        name: profile?.nombre ?? user.displayUsername ?? user.username ?? '',
        seed: user.id,
        photo: profile?.avatar_url ?? null,
        net: signed(stats.net),
        tone: netTone(stats.net),
        chipsLabel: t('stats.story.chips', { count: stats.hands }),
        outcomes: [
          { count: stats.wins, label: t('stats.wins', { count: stats.wins }), tone: 'win' },
          { count: stats.pushes, label: t('stats.pushes', { count: stats.pushes }), tone: 'push' },
          { count: stats.losses, label: t('stats.losses', { count: stats.losses }), tone: 'lose' },
        ],
        tiles: [
          { value: formatNumber(stats.hands, language), label: t('stats.hands') },
          { value: formatNumber(stats.blackjacks, language), label: t('stats.blackjacks') },
          { value: stats.bestWin > 0 ? signed(stats.bestWin) : '—', label: t('stats.bestWin') },
          { value: formatNumber(stats.bestStreak, language), label: t('stats.bestStreak') },
        ],
        dare: t('stats.story.dare'),
        url: window.location.host,
      })
      const file = new File([blob], 'blackjack-with-friends.png', { type: 'image/png' })
      if (navigator.canShare?.({ files: [file] })) {
        setState('idle')
        await navigator.share({ files: [file], title: 'Blackjack with Friends', text: `${t('stats.story.dare')} ${window.location.origin}` })
        return
      }
      // No way to share files (most desktops): download it instead.
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = file.name
      link.click()
      setTimeout(() => URL.revokeObjectURL(url), 1000)
      setState('saved')
      setTimeout(() => setState('idle'), 2000)
    } catch {
      // Closing the share sheet throws too; nothing to do.
      setState('idle')
    }
  }

  return (
    <button
      className={styles.share}
      type="button"
      onClick={() => void onShare()}
      disabled={state === 'busy'}
      aria-busy={state === 'busy'}
      aria-live="polite"
    >
      {state === 'saved' ? <CheckIcon width={16} height={16} /> : <ShareIcon width={16} height={16} />}
      {state === 'saved' ? t('stats.saved') : t('stats.share')}
    </button>
  )
}

/** Publishes the numbers in view in the app's own chats; the server works them out again. */
function ShareToChat({ range }: { range: Range }) {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const [done, setDone] = useState(false)
  const label = t(done ? 'stats.toChatDone' : 'stats.toChat')
  return (
    <>
      <button
        className={`${styles.toChat} ${done ? styles.toChatDone : ''}`}
        type="button"
        aria-label={label}
        title={label}
        onClick={() => setOpen(true)}
      >
        {done ? <CheckIcon width={17} height={17} strokeWidth={2.6} /> : <ChatIcon width={17} height={17} />}
      </button>
      {open && (
        <ShareSheet
          what={{ stats: range }}
          onClose={() => setOpen(false)}
          onShared={() => {
            setOpen(false)
            setDone(true)
            setTimeout(() => setDone(false), 2500)
          }}
        />
      )}
    </>
  )
}

export function StatsPanel() {
  const { t } = useTranslation()
  const { data, isError, refetch } = useStats()
  const [range, setRange] = useState<Range>('week')
  const language = currentLanguage()

  if (isError) {
    return (
      <section className="card">
        <p className="muted">{t('common.error')}</p>
        <button className="btn btn-secondary" onClick={() => void refetch()}>
          {t('common.retry')}
        </button>
      </section>
    )
  }
  if (!data) {
    return <section className={`card ${styles.placeholder}`} aria-busy="true" />
  }

  if (data.total.hands === 0) {
    return (
      <section className={`card ${styles.empty}`}>
        <CardsIcon width={28} height={28} />
        <p className="muted">{t('stats.empty')}</p>
        <Link className="btn btn-primary" href="/jugar">
          {t('stats.play')}
        </Link>
      </section>
    )
  }

  // Until there are hands from an earlier week, both ranges are the same numbers.
  const pastWeeks = data.total.hands > data.week.hands
  const shown = pastWeeks ? range : 'week'
  const stats = data[shown]

  return (
    <section className={styles.panel} aria-label={t('profile.stats')}>
      {pastWeeks && (
        <div className="segmented" role="group" aria-label={t('profile.stats')}>
          {(['week', 'total'] as const).map((key) => (
            <button key={key} type="button" aria-pressed={range === key} onClick={() => setRange(key)}>
              {t(`stats.${key}`)}
            </button>
          ))}
        </div>
      )}

      <div className={`card ${styles.summary}`}>
        <div className={styles.summaryHead}>
          <span className="label">{t('stats.result')}</span>
          {stats.hands > 0 && (
            <div className={styles.shareButtons}>
              <ShareToChat range={shown} />
              <ShareStats stats={stats} range={shown} />
            </div>
          )}
        </div>
        <p className={`${styles.net} ${stats.net > 0 ? styles.up : stats.net < 0 ? styles.down : ''}`}>{signed(stats.net)}</p>
        <p className="muted">
          {stats.hands === 0
            ? t('stats.noneThisWeek')
            : t('stats.wagered', { count: stats.hands, amount: formatNumber(stats.wagered, language) })}
        </p>
        <Outcomes stats={stats} />
      </div>

      <Link href="/estadisticas" className={styles.link}>
        <span className={styles.linkIcon} aria-hidden="true">
          <ChartIcon width={20} height={20} />
        </span>
        <span className={styles.linkText}>
          <b>{t('profile.stats')}</b>
          <small className="muted">{t('stats.more')}</small>
        </span>
        <ChevronRightIcon className={styles.chevron} width={18} height={18} />
      </Link>
    </section>
  )
}
