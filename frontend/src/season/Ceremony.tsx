'use client'

import { useEffect, useState, type CSSProperties } from 'react'
import { createPortal } from 'react-dom'
import { useTranslation } from 'react-i18next'
import { useUser } from '@/auth/session-context'
import { medal } from '@/groups/medal'
import { currentLanguage } from '@/i18n'
import { formatNumber } from '@/lib/format'
import { play } from '@/sound/sounds'
import { Avatar } from '@/ui/Avatar'
import { ChevronLeftIcon, ChevronRightIcon, CrownIcon } from '@/ui/icons'
import styles from './Ceremony.module.css'
import { JOKE_COINS, useCeremony, useCeremonyReplay, useCeremonySeen, type Ceremony as CeremonyData } from './useSeason'

type Step = 'drum' | 'podium' | 'jokes' | 'coins' | 'week'

// How long the drumroll lasts and how far apart the podium places show up.
const DRUM_MS = 2400
const REVEAL_MS = 1100

/** Shows the last closed week's ceremony once, anywhere but at the table. */
export function CeremonyGate({ paused }: { paused: boolean }) {
  const { data } = useCeremony()
  if (!data || paused) return null
  return <Ceremony key={data.semana} ceremony={data} />
}

/** For the first hour after watching it, a small card on the home screen plays it again. */
export function CeremonyReplayCard() {
  const { t } = useTranslation()
  const lang = currentLanguage()
  const { data, refetch } = useCeremonyReplay()
  const [open, setOpen] = useState(false)
  const hasta = data?.hasta

  // Gone on the dot when the hour is up.
  useEffect(() => {
    if (!hasta) return
    const timer = window.setTimeout(() => void refetch(), Math.max(0, new Date(hasta).getTime() - Date.now()) + 1000)
    return () => clearTimeout(timer)
  }, [hasta, refetch])

  if (!data) return null
  const until = new Intl.DateTimeFormat(lang, { hour: '2-digit', minute: '2-digit' }).format(new Date(data.hasta))
  return (
    <>
      <button type="button" className={`card ${styles.replay}`} onClick={() => setOpen(true)}>
        <span className={styles.replayIcon} aria-hidden="true">
          <CrownIcon width={20} height={20} />
        </span>
        <span className={styles.replayBody}>
          <span className={styles.replayTitle}>{t('season.replay.title')}</span>
          <span className={styles.replayText}>{t('season.replay.text', { time: until })}</span>
        </span>
        <ChevronRightIcon className={styles.replayChevron} width={18} height={18} />
      </button>
      {/* On the body: the page's pull to refresh moves it, and that would carry a fixed overlay along. */}
      {open && createPortal(<Ceremony ceremony={data} onDone={() => setOpen(false)} />, document.body)}
    </>
  )
}

function Ceremony({ ceremony, onDone }: { ceremony: CeremonyData; onDone?: () => void }) {
  const { t } = useTranslation()
  const seen = useCeremonySeen()
  const { group } = ceremony
  const steps: Step[] = ['drum']
  if (group) steps.push('podium')
  if (group?.jokes.length) steps.push('jokes')
  steps.push('coins', 'week')

  const [index, setIndex] = useState(0)
  const [revealed, setRevealed] = useState(0)
  // Came back to this screen: it shows as it ended, without its sounds again.
  const [returned, setReturned] = useState(false)
  // Which half was just tapped, lit for a moment as in stories; the count replays it on every tap.
  const [flash, setFlash] = useState<{ side: 'left' | 'right'; n: number } | null>(null)
  const step = steps[index]
  const places = group?.conPremios ? group.standings.slice(0, 3) : []
  const podiumDone = revealed >= places.length

  // Watching it again only closes it.
  const finish = () => (onDone ? onDone() : seen.mutate(ceremony.semana))
  const next = () => {
    if (step === 'podium' && !podiumDone) setRevealed(revealed + 1)
    else if (index < steps.length - 1) {
      setIndex(index + 1)
      setReturned(false)
    }
  }
  // The drumroll is only an intro: going back stops at the screen after it.
  const canGoBack = index > 1
  const back = () => {
    if (!canGoBack) return
    if (steps[index - 1] === 'podium') setRevealed(places.length)
    setIndex(index - 1)
    setReturned(true)
  }

  // The drumroll: chips falling faster and higher, then the podium.
  useEffect(() => {
    if (step !== 'drum') return
    const timers: number[] = []
    let at = 0
    for (let gap = 260; at < DRUM_MS - 200; gap = Math.max(45, gap * 0.86)) {
      timers.push(window.setTimeout(() => play('chip'), at))
      at += gap
    }
    timers.push(window.setTimeout(() => setIndex(1), DRUM_MS))
    return () => timers.forEach(clearTimeout)
  }, [step])

  // Third, second and first, one after the other.
  useEffect(() => {
    if (step !== 'podium' || podiumDone) return
    const timer = window.setTimeout(() => setRevealed((r) => r + 1), REVEAL_MS)
    return () => clearTimeout(timer)
  }, [step, podiumDone, revealed])

  useEffect(() => {
    if (step !== 'podium' || revealed === 0 || returned) return
    play(revealed === places.length ? 'blackjack' : 'flip')
  }, [step, revealed, places.length, returned])

  useEffect(() => {
    if (step === 'coins' && ceremony.coins > 0 && !returned) play('win')
  }, [step, ceremony.coins, returned])

  return (
    <div
      className={styles.overlay}
      role="dialog"
      aria-modal="true"
      aria-label={t('season.label')}
      // Like stories: a tap on the left edge goes back, anywhere else goes on.
      onClick={(event) => {
        const left = canGoBack && event.clientX < event.currentTarget.clientWidth * 0.3
        setFlash({ side: left ? 'left' : 'right', n: (flash?.n ?? 0) + 1 })
        if (left) back()
        else next()
      }}
    >
      {/* One bar per screen, like stories: the ones seen full, the current one filling. */}
      <div className={styles.bars} aria-hidden="true">
        {steps.map((s, i) => (
          <span key={s} className={styles.bar}>
            {i <= index && (
              <span
                className={styles.barFill}
                data-timed={i === index && s === 'drum'}
                style={
                  i === index && s === 'podium' && places.length > 0
                    ? { transform: `scaleX(${revealed / places.length})` }
                    : undefined
                }
              />
            )}
          </span>
        ))}
      </div>
      {flash && step !== 'drum' && <span key={flash.n} className={styles.flash} data-side={flash.side} aria-hidden="true" />}
      {canGoBack && (
        <button
          type="button"
          className={styles.back}
          aria-label={t('season.back')}
          onClick={(event) => {
            event.stopPropagation()
            back()
          }}
        >
          <ChevronLeftIcon width={18} height={18} />
        </button>
      )}
      <button
        type="button"
        className={styles.skip}
        onClick={(event) => {
          event.stopPropagation()
          finish()
        }}
      >
        {t('season.skip')}
      </button>

      <div key={step} className={styles.stage}>
        {step === 'drum' && <Drum ceremony={ceremony} />}
        {step === 'podium' && <PodiumStep ceremony={ceremony} revealed={revealed} />}
        {step === 'jokes' && <Jokes ceremony={ceremony} />}
        {step === 'coins' && <Coins ceremony={ceremony} />}
        {step === 'week' && (
          <>
            <h2 className={styles.big}>{t('season.newWeek')}</h2>
            <p className={styles.text}>{t('season.newWeekText')}</p>
            <button
              type="button"
              className={`btn btn-primary ${styles.start}`}
              disabled={seen.isPending}
              onClick={(event) => {
                event.stopPropagation()
                finish()
              }}
            >
              {t('season.start')}
            </button>
          </>
        )}
      </div>

      {step === 'podium' && podiumDone && places.length > 0 && <Confetti />}
      {step !== 'drum' && (
        <p className={styles.tap}>
          {canGoBack && <span>‹ {t('season.tapBack')}</span>}
          {step !== 'week' && <span className={styles.tapNext}>{t('season.tap')} ›</span>}
        </p>
      )}
    </div>
  )
}

function Drum({ ceremony }: { ceremony: CeremonyData }) {
  const { t } = useTranslation()
  return (
    <>
      <p className={styles.kicker}>{t('season.over')}</p>
      <div className={styles.drum} aria-hidden="true">
        <span />
        <span />
        <span />
      </div>
      <h2 className={styles.title}>
        {ceremony.group ? t('season.drum', { group: ceremony.group.nombre }) : t('season.drumAlone')}
      </h2>
    </>
  )
}

function PodiumStep({ ceremony, revealed }: { ceremony: CeremonyData; revealed: number }) {
  const { t } = useTranslation()
  const me = useUser()
  const lang = currentLanguage()
  const group = ceremony.group!
  if (!group.conPremios) {
    return (
      <>
        <p className={styles.kicker}>{group.nombre}</p>
        <p className={styles.text}>{t('season.noPodium', { group: group.nombre })}</p>
      </>
    )
  }
  const places = group.standings.slice(0, 3)
  // Second on the left, first in the middle, third on the right.
  const columns = [1, 0, 2].filter((i) => i < places.length)
  return (
    <>
      <p className={styles.kicker}>{group.nombre}</p>
      <ol className={styles.podium}>
        {columns.map((i) => {
          const player = places[i]
          // Revealed from the last place shown up to first.
          const shown = i >= places.length - revealed
          return (
            <li
              key={player.userId}
              className={`${styles.step} ${shown ? styles.shown : ''}`}
              style={medal(player.posicion)}
            >
              <div className={styles.who}>
                {player.trofeo && <CrownIcon className={styles.crown} width={26} height={26} />}
                <Avatar
                  seed={player.userId}
                  name={player.nombre}
                  src={player.avatarUrl}
                  size={i === 0 ? 72 : 58}
                  className={styles.avatar}
                />
                <span className={styles.name}>{player.userId === me.id ? t('ranking.you') : player.nombre}</span>
                <span className={styles.balance}>{formatNumber(player.saldo, lang)}</span>
              </div>
              <span className={`${styles.block} ${styles[`block${Math.min(player.posicion, 3)}`]}`}>
                {t('season.place', { place: player.posicion })}
              </span>
            </li>
          )
        })}
      </ol>
    </>
  )
}

function Jokes({ ceremony }: { ceremony: CeremonyData }) {
  const { t } = useTranslation()
  const me = useUser()
  const lang = currentLanguage()
  const group = ceremony.group!
  const playerOf = (userId: string) => group.standings.find((s) => s.userId === userId)
  const nameOf = (userId: string) => (userId === me.id ? t('ranking.you') : (playerOf(userId)?.nombre ?? ''))
  return (
    <>
      <h2 className={styles.title}>{t('season.jokes')}</h2>
      <ul className={styles.jokes}>
        {group.jokes.map((joke, i) => (
          <li
            key={joke.prize}
            className={`${styles.joke} ${joke.userIds.includes(me.id) ? styles.mine : ''}`}
            style={{ animationDelay: `${i * 160}ms` }}
          >
            {/* Ties overlap, the first few only */}
            <span className={styles.jokeFaces}>
              {joke.userIds.slice(0, 3).map((userId) => (
                <Avatar key={userId} seed={userId} name={playerOf(userId)?.nombre ?? ''} src={playerOf(userId)?.avatarUrl} size={40} />
              ))}
            </span>
            <span className={styles.jokeTitle}>{t(`season.joke.${joke.prize}`)}</span>
            <span className={styles.jokeWho}>{joke.userIds.map(nameOf).join(', ')}</span>
            <span className={styles.jokeValue}>
              {t(`season.jokeValue.${joke.prize}`, { count: joke.value, amount: formatNumber(joke.value, lang) })}
              {group.conPremios && <span className={styles.jokeReward}>{t('season.jokeReward', { n: JOKE_COINS })}</span>}
            </span>
          </li>
        ))}
      </ul>
    </>
  )
}

function Coins({ ceremony }: { ceremony: CeremonyData }) {
  const { t } = useTranslation()
  const lang = currentLanguage()
  const placed = ceremony.group?.conPremios ? ceremony.bestPlace : null
  return (
    <>
      <p className={styles.kicker}>
        {placed && ceremony.group
          ? t('season.youPlaced', { place: placed, group: ceremony.group.nombre })
          : t('season.youPlayed', { count: ceremony.stats.hands })}
      </p>
      <h2 className={styles.title}>{t('season.youWon')}</h2>
      <div className={styles.coins}>
        <span className={styles.coin} aria-hidden="true" />
        {t('season.coins', { count: ceremony.coins, formatted: formatNumber(ceremony.coins, lang) })}
      </div>
    </>
  )
}

const COLORS = ['#f2c14e', '#4ade80', '#ff6b6b', '#60a5fa', '#f2f3f5', '#c084fc']

/** 0..1, the same every render for the same inputs. */
function noise(i: number, k: number) {
  const x = Math.sin(i * 12.9898 + k * 78.233) * 43758.5453
  return x - Math.floor(x)
}

function Confetti() {
  return (
    <div className={styles.confetti} aria-hidden="true">
      {Array.from({ length: 80 }, (_, i) => (
        <span
          key={i}
          style={
            {
              '--x': `${noise(i, 1) * 100}%`,
              '--drift': `${(noise(i, 2) - 0.5) * 160}px`,
              '--spin': `${noise(i, 3) * 900 - 450}deg`,
              '--delay': `${noise(i, 4) * 600}ms`,
              '--time': `${1800 + noise(i, 5) * 1600}ms`,
              '--color': COLORS[i % COLORS.length],
            } as CSSProperties
          }
        />
      ))}
    </div>
  )
}
