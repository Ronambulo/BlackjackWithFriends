import { describe, expect, it } from 'vitest'
import { createShoe, handValue, type Card, type Rank } from './cards.ts'
import {
  applyAction,
  IllegalActionError,
  legalActions,
  startRound,
  toPublicView,
  type Action,
  type RoundState,
} from './game.ts'
import { cryptoRng, seededRng } from './rng.ts'
import { DEFAULT_RULES, type Rules } from './rules.ts'

// Deal order is: player, dealer up card, player, dealer hole card, then draws in order.
const shoe = (...ranks: Rank[]): Card[] => ranks.map((rank, i) => ({ rank, suit: (['S', 'H', 'D', 'C'] as const)[i % 4] }))

const play = (s: RoundState, ...actions: Action[]) => actions.reduce(applyAction, s)

const outcomes = (s: RoundState) => s.settlement?.hands.map((h) => h.outcome)

describe('basic rounds', () => {
  it('player stands and dealer busts', () => {
    const s = play(startRound(100, shoe('10', '9', '8', '7', '10')), 'stand')
    expect(s.dealer.map((c) => c.rank)).toEqual(['9', '7', '10'])
    expect(outcomes(s)).toEqual(['win'])
    expect(s.settlement).toMatchObject({ totalWagered: 100, totalPayout: 200, net: 100 })
  })

  it('higher total wins, equal totals push, lower loses', () => {
    expect(outcomes(play(startRound(10, shoe('10', '10', '9', '8')), 'stand'))).toEqual(['win'])
    expect(outcomes(play(startRound(10, shoe('10', '10', '8', '8')), 'stand'))).toEqual(['push'])
    expect(outcomes(play(startRound(10, shoe('10', '10', '7', '8')), 'stand'))).toEqual(['lose'])
  })

  it('player busts and the dealer does not draw', () => {
    // No extra cards for the dealer: drawing would throw on an empty shoe.
    const s = play(startRound(100, shoe('10', '9', '6', '8', 'K')), 'hit')
    expect(s.phase).toBe('settled')
    expect(s.dealer).toHaveLength(2)
    expect(outcomes(s)).toEqual(['bust'])
    expect(s.settlement?.net).toBe(-100)
  })

  it('hitting to 21 stands automatically', () => {
    const s = play(startRound(10, shoe('5', '10', '6', '7', 'K')), 'hit')
    expect(s.phase).toBe('settled')
    expect(handValue(s.hands[0].cards).total).toBe(21)
    expect(outcomes(s)).toEqual(['win'])
  })

  it('dealer stands on soft 17 by default and hits it with H17', () => {
    // Player 18 vs dealer A,6 (soft 17); the next card is a 2.
    const cards = shoe('10', 'A', '8', '6', '2')
    const s17: Rules = { ...DEFAULT_RULES, insurance: false }
    const stood = play(startRound(10, cards, s17), 'stand')
    expect(stood.dealer).toHaveLength(2)
    expect(outcomes(stood)).toEqual(['win'])

    const hit = play(startRound(10, cards, { ...s17, dealerHitsSoft17: true }), 'stand')
    expect(hit.dealer.map((c) => c.rank)).toEqual(['A', '6', '2'])
    expect(outcomes(hit)).toEqual(['lose'])
  })

  it('rejects invalid bets', () => {
    expect(() => startRound(0, shoe('10', '9', '8', '7'))).toThrow(RangeError)
    expect(() => startRound(-5, shoe('10', '9', '8', '7'))).toThrow(RangeError)
    expect(() => startRound(2.5, shoe('10', '9', '8', '7'))).toThrow(RangeError)
  })

  it('throws when the shoe runs out', () => {
    expect(() => startRound(10, shoe('10', '9', '8'))).toThrow('The shoe is empty')
  })
})

describe('blackjack', () => {
  it('a natural pays 3:2 and ends the round at once', () => {
    const s = startRound(100, shoe('A', '9', 'K', '7'))
    expect(s.phase).toBe('settled')
    expect(outcomes(s)).toEqual(['blackjack'])
    expect(s.settlement).toMatchObject({ totalPayout: 250, net: 150 })
  })

  it('rounds the 3:2 payout down for odd bets', () => {
    expect(startRound(15, shoe('A', '9', 'K', '7')).settlement?.totalPayout).toBe(15 + 22)
  })

  it('pays 6:5 when configured', () => {
    const rules: Rules = { ...DEFAULT_RULES, blackjackPayout: [6, 5] }
    expect(startRound(100, shoe('A', '9', 'K', '7'), rules).settlement?.totalPayout).toBe(220)
  })

  it('player and dealer naturals push', () => {
    const s = startRound(100, shoe('A', 'K', 'Q', 'A'))
    expect(outcomes(s)).toEqual(['push'])
    expect(s.settlement?.net).toBe(0)
  })

  it('dealer natural with a 10 up ends the round before the player acts', () => {
    const s = startRound(100, shoe('10', 'K', '9', 'A'))
    expect(s.phase).toBe('settled')
    expect(s.settlement).toMatchObject({ dealerBlackjack: true, net: -100 })
  })
})

describe('insurance', () => {
  it('is offered when the dealer shows an ace', () => {
    const s = startRound(100, shoe('10', 'A', '9', '7'))
    expect(s.phase).toBe('insurance')
    expect(legalActions(s)).toEqual(['insurance', 'noInsurance'])
    expect(() => applyAction(s, 'hit')).toThrow(IllegalActionError)
  })

  it('pays 2:1 when the dealer has blackjack', () => {
    const s = play(startRound(100, shoe('10', 'A', '9', 'K')), 'insurance')
    expect(s.phase).toBe('settled')
    expect(s.insuranceBet).toBe(50)
    expect(s.settlement).toMatchObject({ insurancePayout: 150, totalWagered: 150, totalPayout: 150, net: 0 })
  })

  it('is lost when the dealer has no blackjack, and play continues', () => {
    let s = play(startRound(100, shoe('10', 'A', 'K', '7')), 'insurance')
    expect(s.phase).toBe('player')
    s = play(s, 'stand') // 20 vs soft 18
    expect(s.settlement).toMatchObject({ insurancePayout: 0, totalWagered: 150, totalPayout: 200, net: 50 })
  })

  it('declining with a dealer blackjack loses the hand', () => {
    const s = play(startRound(100, shoe('10', 'A', '9', 'Q')), 'noInsurance')
    expect(s.settlement).toMatchObject({ dealerBlackjack: true, net: -100 })
  })

  it('a player natural is settled after the insurance decision', () => {
    const s = play(startRound(100, shoe('A', 'A', 'K', '7')), 'noInsurance')
    expect(outcomes(s)).toEqual(['blackjack'])
  })

  it('is not offered when disabled or when the bet is too small to halve', () => {
    expect(startRound(100, shoe('10', 'A', '9', '7'), { ...DEFAULT_RULES, insurance: false }).phase).toBe('player')
    expect(startRound(1, shoe('10', 'A', '9', '7')).phase).toBe('player')
  })
})

describe('double', () => {
  it('doubles the bet, takes one card and stands', () => {
    const s = play(startRound(100, shoe('5', '9', '6', '7', '10', '10')), 'double')
    expect(s.hands[0]).toMatchObject({ bet: 200, doubled: true, status: 'stood' })
    expect(s.hands[0].cards).toHaveLength(3)
    expect(outcomes(s)).toEqual(['win'])
    expect(s.settlement).toMatchObject({ totalWagered: 200, totalPayout: 400, net: 200 })
  })

  it('can bust', () => {
    const s = play(startRound(100, shoe('10', '9', '6', '7', 'K')), 'double')
    expect(outcomes(s)).toEqual(['bust'])
    expect(s.settlement?.net).toBe(-200)
  })

  it('is only allowed on the first two cards', () => {
    const s = play(startRound(10, shoe('2', '9', '3', '7', '2')), 'hit')
    expect(legalActions(s)).not.toContain('double')
    expect(() => applyAction(s, 'double')).toThrow(IllegalActionError)
  })
})

describe('split', () => {
  it('plays each hand in turn, with double after split', () => {
    // 8,8 vs 10,7. Hand 1 gets a 3 and doubles onto a 10 (21); hand 2 gets a 10 (18).
    let s = play(startRound(100, shoe('8', '10', '8', '7', '3', '10', '10')), 'split')
    expect(s.hands.map((h) => h.cards.length)).toEqual([2, 1])
    expect(legalActions(s)).toContain('double')

    s = play(s, 'double')
    expect(s.activeHand).toBe(1)
    expect(s.hands[1].cards.map((c) => c.rank)).toEqual(['8', '10'])

    s = play(s, 'stand')
    expect(outcomes(s)).toEqual(['win', 'win'])
    expect(s.settlement).toMatchObject({ totalWagered: 300, totalPayout: 600, net: 300 })
  })

  it('split aces get one card each, and 21 there is not a blackjack', () => {
    const s = play(startRound(100, shoe('A', '10', 'A', '6', 'K', '5', '10')), 'split')
    expect(s.phase).toBe('settled')
    expect(s.hands.map((h) => h.cards.length)).toEqual([2, 2])
    expect(outcomes(s)).toEqual(['win', 'win']) // dealer 16 draws a 10 and busts
    expect(s.settlement?.totalPayout).toBe(400)
  })

  it('allows splitting up to the max number of hands', () => {
    let s = startRound(10, shoe('8', '10', '8', '7', '8', '8', '2', '3', '4', '5', '6'))
    s = play(s, 'split') // hand 0 gets 8 → 8,8
    s = play(s, 'split') // hand 0 gets 8 → 8,8 (3 hands)
    s = play(s, 'split') // hand 0 gets 2 → 8,2 (4 hands)
    expect(s.hands).toHaveLength(4)
    s = play(s, 'stand') // hand 1 activates with a 3 → 8,3
    expect(s.activeHand).toBe(1)
    expect(legalActions(s)).not.toContain('split')
  })

  it('blocks resplitting once the max is reached', () => {
    let s = startRound(10, shoe('8', '10', '8', '7', '8', '8', '8', '8'), { ...DEFAULT_RULES, maxHands: 2 })
    s = play(s, 'split')
    expect(s.hands[0].cards.map((c) => c.rank)).toEqual(['8', '8'])
    expect(legalActions(s)).not.toContain('split')
  })

  it('splits any two 10-value cards unless splitByValue is off', () => {
    expect(legalActions(startRound(10, shoe('K', '9', 'Q', '7')))).toContain('split')
    const strict: Rules = { ...DEFAULT_RULES, splitByValue: false }
    expect(legalActions(startRound(10, shoe('K', '9', 'Q', '7'), strict))).not.toContain('split')
    expect(legalActions(startRound(10, shoe('K', '9', 'K', '7'), strict))).toContain('split')
  })

  it('no double after split when DAS is off', () => {
    const noDas: Rules = { ...DEFAULT_RULES, doubleAfterSplit: false }
    const s = play(startRound(10, shoe('8', '10', '8', '7', '3', '10'), noDas), 'split')
    expect(legalActions(s)).not.toContain('double')
  })

  it('a split hand that reaches 21 when activated is skipped', () => {
    // 10,10 split: hand 1 gets 5 (15, stands); hand 2 gets an A → 21 and the round ends.
    const s = play(startRound(10, shoe('10', '10', '10', '7', '5', 'A')), 'split', 'stand')
    expect(s.phase).toBe('settled')
    expect(outcomes(s)).toEqual(['lose', 'win'])
  })

  it('the dealer does not draw when every split hand busts', () => {
    const s = play(startRound(10, shoe('8', '10', '8', '7', '6', 'K', '6', 'K')), 'split', 'hit', 'hit')
    expect(outcomes(s)).toEqual(['bust', 'bust'])
    expect(s.dealer).toHaveLength(2)
  })
})

describe('surrender', () => {
  it('returns half the bet and the dealer does not draw', () => {
    const s = play(startRound(100, shoe('10', '10', '6', '6')), 'surrender')
    expect(outcomes(s)).toEqual(['surrender'])
    expect(s.dealer).toHaveLength(2)
    expect(s.settlement).toMatchObject({ totalPayout: 50, net: -50 })
  })

  it('is only allowed as the first decision and never after a split', () => {
    const afterHit = play(startRound(10, shoe('2', '10', '3', '7', '2')), 'hit')
    expect(legalActions(afterHit)).not.toContain('surrender')

    const afterSplit = play(startRound(10, shoe('8', '10', '8', '7', '3', '10')), 'split')
    expect(legalActions(afterSplit)).not.toContain('surrender')
  })
})

describe('chips and visibility', () => {
  it('leaves out actions the player cannot afford', () => {
    const s = startRound(100, shoe('8', '9', '8', '7'))
    expect(legalActions(s, 99)).toEqual(['hit', 'stand', 'surrender'])
    expect(legalActions(s, 100)).toContain('split')
    expect(legalActions(startRound(100, shoe('10', 'A', '9', '7')), 10)).toEqual(['noInsurance'])
  })

  it('hides the shoe and the hole card until the round ends', () => {
    const s = startRound(10, shoe('10', '9', '8', '7', '10'))
    const view = toPublicView(s)
    expect(view).not.toHaveProperty('shoe')
    expect(view.dealer).toEqual([s.dealer[0], null])
    expect(view.dealerValue.total).toBe(9)
    expect(view.actions).toContain('hit')

    const done = toPublicView(play(s, 'stand'))
    expect(done.dealer).toHaveLength(3)
    expect(done.dealer.every((c) => c !== null)).toBe(true)
    expect(done.actions).toEqual([])
  })

  it('never mutates the state it is given', () => {
    const s = startRound(10, shoe('8', '10', '8', '7', '3', '10', '10'))
    const before = structuredClone(s)
    play(s, 'split', 'stand', 'stand')
    expect(s).toEqual(before)
  })

  it('round state survives a JSON round trip (stored in the database)', () => {
    const s = play(startRound(10, shoe('8', '10', '8', '7', '3', '10', '10')), 'split')
    const restored = JSON.parse(JSON.stringify(s)) as RoundState
    expect(play(restored, 'stand', 'stand')).toEqual(play(s, 'stand', 'stand'))
  })
})

describe('random play (invariants)', () => {
  const run = (rng: () => number, shoeRng: () => number) => {
    const bet = 1 + Math.floor(rng() * 500)
    let s = startRound(bet, createShoe(6, shoeRng))
    let steps = 0
    while (s.phase !== 'settled') {
      const actions = legalActions(s)
      expect(actions.length).toBeGreaterThan(0)
      s = applyAction(s, actions[Math.floor(rng() * actions.length)])
      expect(++steps).toBeLessThan(50)
    }
    return { s, bet }
  }

  it('every random round ends settled with consistent chip accounting', () => {
    const rng = seededRng('fuzz')
    const shoeRng = cryptoRng()
    for (let i = 0; i < 5_000; i++) {
      const { s, bet } = run(rng, shoeRng)
      const st = s.settlement!
      const dealt = s.dealer.length + s.hands.reduce((n, h) => n + h.cards.length, 0)

      expect(s.shoe.length + dealt).toBe(312)
      expect(st.hands).toHaveLength(s.hands.length)
      expect(st.net).toBe(st.totalPayout - st.totalWagered)
      expect(st.totalWagered).toBe(s.hands.reduce((n, h) => n + h.bet, 0) + s.insuranceBet)
      expect(st.hands.every((h) => h.payout >= 0 && Number.isInteger(h.payout))).toBe(true)
      expect(s.hands.length).toBeLessThanOrEqual(DEFAULT_RULES.maxHands)
      // Most you can lose: four hands, all doubled, plus insurance.
      expect(st.net).toBeGreaterThanOrEqual(-(bet * 8 + Math.floor(bet / 2)))
      for (const h of s.hands) expect(h.status).not.toBe('playing')
    }
  })
})
