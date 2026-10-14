import { describe, expect, it } from 'vitest'
import { createDeck, createShoe, handValue, isTwoCard21, type Card, type Rank } from './cards.ts'
import { seededRng, shuffle } from './rng.ts'

const hand = (...ranks: Rank[]): Card[] => ranks.map((rank) => ({ rank, suit: 'S' }))

describe('handValue', () => {
  it.each([
    [['10', '7'], 17, false],
    [['K', 'Q'], 20, false],
    [['A', '6'], 17, true],
    [['A', '6', '10'], 17, false],
    [['A', 'A'], 12, true],
    [['A', 'A', '9'], 21, true],
    [['A', 'A', 'A', 'A'], 14, true],
    [['A', 'K'], 21, true],
    [['10', '6', 'K'], 26, false],
    [['5', 'A', 'A', 'K'], 17, false],
  ] as [Rank[], number, boolean][])('%j → %i (soft: %s)', (ranks, total, soft) => {
    expect(handValue(hand(...ranks))).toEqual({ total, soft })
  })

  it('detects two-card 21 only with exactly two cards', () => {
    expect(isTwoCard21(hand('A', 'Q'))).toBe(true)
    expect(isTwoCard21(hand('7', '7', '7'))).toBe(false)
    expect(isTwoCard21(hand('10', '9'))).toBe(false)
  })
})

describe('decks and shoes', () => {
  it('a deck has 52 unique cards', () => {
    const deck = createDeck()
    expect(deck).toHaveLength(52)
    expect(new Set(deck.map((c) => c.rank + c.suit)).size).toBe(52)
  })

  it('a 6-deck shoe has every card six times', () => {
    const shoe = createShoe(6, seededRng('test'))
    expect(shoe).toHaveLength(312)
    const counts = new Map<string, number>()
    for (const c of shoe) counts.set(c.rank + c.suit, (counts.get(c.rank + c.suit) ?? 0) + 1)
    expect(counts.size).toBe(52)
    expect([...counts.values()].every((n) => n === 6)).toBe(true)
  })
})

describe('seeded randomness (Baraja del día)', () => {
  it('the same seed gives the same shoe', () => {
    expect(createShoe(6, seededRng('grupo:2026-10-14:3'))).toEqual(createShoe(6, seededRng('grupo:2026-10-14:3')))
  })

  it('different seeds give different shoes', () => {
    expect(createShoe(6, seededRng('a'))).not.toEqual(createShoe(6, seededRng('b')))
  })

  it('produces floats in [0, 1)', () => {
    const rng = seededRng('range')
    for (let i = 0; i < 10_000; i++) {
      const x = rng()
      expect(x >= 0 && x < 1).toBe(true)
    }
  })

  it('shuffle is a permutation and does not mutate its input', () => {
    const input = Array.from({ length: 100 }, (_, i) => i)
    const copy = input.slice()
    const out = shuffle(input, seededRng('perm'))
    expect(input).toEqual(copy)
    expect(out.slice().sort((a, b) => a - b)).toEqual(input)
    expect(out).not.toEqual(input)
  })

  it('shuffles without obvious bias', () => {
    // Where does item 0 of a 4-item list end up over many shuffles?
    const rng = seededRng('bias')
    const positions = [0, 0, 0, 0]
    const runs = 40_000
    for (let i = 0; i < runs; i++) positions[shuffle([0, 1, 2, 3], rng).indexOf(0)]++
    for (const n of positions) expect(Math.abs(n / runs - 0.25)).toBeLessThan(0.01)
  })
})
