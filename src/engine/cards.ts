import { shuffle, type Rng } from './rng.ts'

export const SUITS = ['S', 'H', 'D', 'C'] as const
export const RANKS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'] as const

export type Suit = (typeof SUITS)[number]
export type Rank = (typeof RANKS)[number]

export interface Card {
  rank: Rank
  suit: Suit
}

export interface HandValue {
  total: number
  /** An ace is currently counted as 11. */
  soft: boolean
}

export function createDeck(): Card[] {
  return SUITS.flatMap((suit) => RANKS.map((rank) => ({ rank, suit })))
}

/** A freshly shuffled shoe; cards are drawn from the front. */
export function createShoe(decks: number, rng: Rng): Card[] {
  const cards: Card[] = []
  for (let i = 0; i < decks; i++) cards.push(...createDeck())
  return shuffle(cards, rng)
}

/** Blackjack value with aces counted as 1. */
export function cardValue(rank: Rank): number {
  if (rank === 'A') return 1
  if (rank === 'J' || rank === 'Q' || rank === 'K') return 10
  return Number(rank)
}

export function handValue(cards: readonly Card[]): HandValue {
  let total = 0
  let hasAce = false
  for (const c of cards) {
    total += cardValue(c.rank)
    if (c.rank === 'A') hasAce = true
  }
  if (hasAce && total + 10 <= 21) return { total: total + 10, soft: true }
  return { total, soft: false }
}

/** Two cards worth 21. Whether it pays as a natural is decided by the game (not after a split). */
export function isTwoCard21(cards: readonly Card[]): boolean {
  return cards.length === 2 && handValue(cards).total === 21
}
