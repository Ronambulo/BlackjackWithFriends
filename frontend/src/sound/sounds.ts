'use client'

import { useSyncExternalStore } from 'react'

// Table sounds: real chip and card recordings and short stings (Kenney's "Casino
// Audio", wobbleboxx's "Level up, power up, Coin get" and a Freesound casino hit by
// modusmogulus, all CC0, in public/sounds). Chips and cards in a quick run
// climb a step each, the way Balatro does it. They are on by default; the choice is
// kept on this device.

const KEY = 'sounds-off'
const listeners = new Set<() => void>()

function readOff(): boolean {
  try {
    return localStorage.getItem(KEY) === '1'
  } catch {
    return false
  }
}

let off = typeof window === 'undefined' ? false : readOff()

export function setSoundsOn(on: boolean) {
  off = !on
  try {
    if (off) localStorage.setItem(KEY, '1')
    else localStorage.removeItem(KEY)
  } catch {
    // Storage unavailable: the choice lasts until the page closes.
  }
  listeners.forEach((listener) => listener())
  if (on) {
    preloadSounds()
    play('chip')
  }
}

export function useSoundsOn(): boolean {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    () => !off,
    () => true,
  )
}

const SAMPLES = {
  chip: ['chip-1', 'chip-2', 'chip-3'],
  card: ['card-1', 'card-2', 'card-4'],
  flip: ['flip'],
  double: ['double'],
  split: ['split'],
  win: ['win'],
  blackjack: ['blackjack'],
  lose: ['lose'],
  push: ['push'],
} as const
type Sample = keyof typeof SAMPLES

let context: AudioContext | null = null
let output: AudioNode | null = null
const buffers = new Map<string, AudioBuffer>()
let loading: Promise<void> | null = null

function audio(): AudioContext | null {
  if (off || typeof window === 'undefined') return null
  try {
    if (!context) {
      context = new AudioContext()
      // A slightly dull, roomy mix: a gentle low-pass and a short slapback echo.
      const warm = context.createBiquadFilter()
      warm.type = 'lowpass'
      warm.frequency.value = 9000
      const echo = context.createDelay()
      echo.delayTime.value = 0.07
      const echoGain = context.createGain()
      echoGain.gain.value = 0.12
      warm.connect(context.destination)
      warm.connect(echo).connect(echoGain).connect(context.destination)
      output = warm
    }
    // Browsers start it suspended until the first tap.
    if (context.state === 'suspended') void context.resume()
    return context
  } catch {
    return null
  }
}

/** Fetches and decodes every recording once (about 40 KB in all). */
export function preloadSounds() {
  const ctx = audio()
  if (!ctx || loading) return
  const names = [...new Set(Object.values(SAMPLES).flat())]
  loading = Promise.all(
    names.map(async (name) => {
      try {
        const response = await fetch(`/sounds/${name}.mp3`)
        buffers.set(name, await ctx.decodeAudioData(await response.arrayBuffer()))
      } catch {
        // A sound that can't load just stays silent.
      }
    }),
  ).then(() => undefined)
}

const semitones = (n: number) => Math.pow(2, n / 12)

/** Plays one take of a sample, `rate` faster (and higher), `at` seconds from now. */
function hit(
  sample: Sample,
  { rate = 1, volume = 1, at = 0, detune = true }: { rate?: number; volume?: number; at?: number; detune?: boolean } = {},
) {
  const ctx = audio()
  const takes = SAMPLES[sample]
  const buffer = buffers.get(takes[Math.floor(Math.random() * takes.length)])
  if (!ctx || !buffer || !output) return
  const source = ctx.createBufferSource()
  source.buffer = buffer
  // A touch of random detune so repeats don't sound copy-pasted.
  source.playbackRate.value = detune ? rate * semitones((Math.random() - 0.5) * 0.4) : rate
  const gain = ctx.createGain()
  gain.gain.value = volume
  source.connect(gain).connect(output)
  source.start(ctx.currentTime + at)
}

// Quick runs climb: each sound within RUN_GAP seconds of the last of its kind goes a step up.
const RUN_GAP = 0.9
const runs = new Map<string, { at: number; step: number }>()
function nextStep(kind: string, max: number): number {
  const now = performance.now() / 1000
  const last = runs.get(kind)
  const step = last && now - last.at < RUN_GAP ? Math.min(last.step + 1, max) : 0
  runs.set(kind, { at: now, step })
  return step
}

/** An event box's sounds: the table's own chips and sting. */
function box(sound: BoxSound) {
  switch (sound) {
    case 'box-open':
      hit('chip', { volume: 0.8 })
      break
    case 'box-tick':
      hit('chip', { rate: 1.7, volume: 0.4 })
      break
    case 'box-reveal':
      hit('win', { volume: 0.9, detune: false })
      break
  }
}

export type BoxSound = 'box-open' | 'box-tick' | 'box-reveal'

export type Sound = 'chip' | 'card' | 'flip' | 'double' | 'split' | 'win' | 'blackjack' | 'lose' | 'push' | 'achievement' | BoxSound

export function play(sound: Sound) {
  if (!audio()) return
  preloadSounds()
  switch (sound) {
    case 'chip':
      hit('chip', { rate: semitones(nextStep('chip', 12)), volume: 0.9 })
      break
    case 'card':
      hit('card', { rate: 1.1 * semitones(nextStep('card', 6)), volume: 0.8 })
      break
    case 'flip':
      hit('flip', { rate: 1.15, volume: 0.9 })
      break
    case 'achievement':
      // The blackjack sting, a fifth up: brighter, and not mistaken for the hand's result.
      hit('blackjack', { rate: semitones(7), volume: 0.8, detune: false })
      break
    case 'box-open':
    case 'box-tick':
    case 'box-reveal':
      box(sound)
      break
    default:
      // Stings and one-off gestures: as recorded, no detune that would put them out of tune.
      hit(sound, { volume: sound === 'lose' ? 0.7 : 0.9, detune: false })
  }
}
