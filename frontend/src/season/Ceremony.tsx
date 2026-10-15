'use client'

import { useEffect, useState, type CSSProperties } from 'react'
import { useTranslation } from 'react-i18next'
import { useUser } from '@/auth/session-context'
import { medal } from '@/groups/medal'
import { currentLanguage } from '@/i18n'
import { formatNumber } from '@/lib/format'
import { play } from '@/sound/sounds'
import { Avatar } from '@/ui/Avatar'
import { CrownIcon } from '@/ui/icons'
import styles from './Ceremony.module.css'
import { useCeremony, useCeremonySeen, type Ceremony as CeremonyData } from './useSeason'

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

function Ceremony({ ceremony }: { ceremony: CeremonyData }) {
  const { t } = useTranslation()
  const seen = useCeremonySeen()
  const { group } = ceremony
  const steps: Step[] = ['drum']
  if (group) steps.push('podium')
  if (group?.jokes.length) steps.push('jokes')
  steps.push('coins', 'week')

  const [index, setIndex] = useState(0)
  const [revealed, setRevealed] = useState(0)
  const step = steps[index]
  const places = group?.conPremios ? group.standings.slice(0, 3) : []
  const podiumDone = revealed >= places.length

  const finish = () => seen.mutate(ceremony.semana)
  const next = () => {
    if (step === 'podium' && !podiumDone) setRevealed(revealed + 1)
    else if (index < steps.length - 1) setIndex(index + 1)
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
    if (step !== 'podium' || revealed === 0) return
    play(revealed === places.length ? 'blackjack' : 'flip')
  }, [step, revealed, places.length])

  useEffect(() => {
    if (step === 'coins' && ceremony.coins > 0) play('win')
  }, [step, ceremony.coins])

  return (
    <div className={styles.overlay} role="dialog" aria-modal="true" aria-label={t('season.label')} onClick={next}>
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
      {step !== 'week' && step !== 'drum' && <p className={styles.tap}>{t('season.tap')}</p>}
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
  const nameOf = (userId: string) =>
    userId === me.id ? t('ranking.you') : (group.standings.find((s) => s.userId === userId)?.nombre ?? '')
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
            <span className={styles.jokeTitle}>{t(`season.joke.${joke.prize}`)}</span>
            <span className={styles.jokeWho}>{joke.userIds.map(nameOf).join(', ')}</span>
            <span className={styles.jokeValue}>
              {joke.prize === 'biggestBet'
                ? t('season.jokeValue.biggestBet', { amount: formatNumber(joke.value, lang) })
                : t(`season.jokeValue.${joke.prize}`, { count: joke.value })}
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
