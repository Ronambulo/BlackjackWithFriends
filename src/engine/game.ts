import { cardValue, handValue, isTwoCard21, type Card, type HandValue } from './cards.ts'
import { DEFAULT_RULES, type Rules } from './rules.ts'

// A round of blackjack as a pure state machine. The state is plain JSON so the
// server can store it between requests; the shoe never leaves the server (see
// toPublicView). Every function returns a new state and never mutates its input.

export type Action = 'hit' | 'stand' | 'double' | 'split' | 'surrender' | 'insurance' | 'noInsurance'

export type Phase = 'insurance' | 'player' | 'settled'

export type HandStatus = 'playing' | 'stood' | 'bust' | 'surrendered'

export type Outcome = 'blackjack' | 'win' | 'push' | 'lose' | 'bust' | 'surrender'

export interface PlayerHand {
  cards: Card[]
  bet: number
  doubled: boolean
  fromSplit: boolean
  status: HandStatus
}

export interface HandResult {
  outcome: Outcome
  /** Chips returned to the player for this hand, stake included (0 when lost). */
  payout: number
}

export interface Settlement {
  hands: HandResult[]
  dealerBlackjack: boolean
  insurancePayout: number
  /** Everything staked: hand bets (doubles and splits included) plus insurance. */
  totalWagered: number
  /** Everything returned to the player. */
  totalPayout: number
  /** totalPayout - totalWagered. */
  net: number
}

export interface RoundState {
  rules: Rules
  /** Remaining cards, drawn from the front. Server-only. */
  shoe: Card[]
  dealer: Card[]
  hands: PlayerHand[]
  activeHand: number
  phase: Phase
  insuranceBet: number
  settlement: Settlement | null
}

export class IllegalActionError extends Error {
  readonly action: Action
  constructor(action: Action, phase: Phase) {
    super(`Action "${action}" is not allowed now (phase: ${phase})`)
    this.name = 'IllegalActionError'
    this.action = action
  }
}

// ---------------------------------------------------------------------------
// Starting a round

export function startRound(bet: number, shoe: readonly Card[], rules: Rules = DEFAULT_RULES): RoundState {
  if (!Number.isInteger(bet) || bet <= 0) throw new RangeError(`Invalid bet: ${bet}`)

  const s: RoundState = {
    rules,
    shoe: shoe.slice(),
    dealer: [],
    hands: [{ cards: [], bet, doubled: false, fromSplit: false, status: 'playing' }],
    activeHand: 0,
    phase: 'player',
    insuranceBet: 0,
    settlement: null,
  }

  // Player, dealer up card, player, dealer hole card.
  s.hands[0].cards.push(draw(s))
  s.dealer.push(draw(s))
  s.hands[0].cards.push(draw(s))
  s.dealer.push(draw(s))

  if (rules.insurance && s.dealer[0].rank === 'A' && insuranceCost(s) > 0) {
    s.phase = 'insurance'
    return s
  }
  return afterDealerPeek(s)
}

// ---------------------------------------------------------------------------
// Queries

export function activeHand(s: RoundState): PlayerHand | null {
  return s.phase === 'player' ? s.hands[s.activeHand] : null
}

/**
 * Actions the player may take now. Pass the player's available chips to also
 * leave out actions they can't afford (double, split, insurance).
 */
export function legalActions(s: RoundState, availableChips = Infinity): Action[] {
  const actions = candidateActions(s)
  return actions.filter((a) => actionCost(s, a) <= availableChips)
}

/** Extra chips an action puts on the table (0 for actions that don't add a stake). */
export function actionCost(s: RoundState, action: Action): number {
  switch (action) {
    case 'double':
    case 'split':
      return s.phase === 'player' ? s.hands[s.activeHand].bet : 0
    case 'insurance':
      return insuranceCost(s)
    default:
      return 0
  }
}

/** The state as the player may see it: no shoe, and the hole card hidden until the round ends. */
export interface PublicRoundView {
  dealer: (Card | null)[]
  dealerValue: HandValue
  hands: (PlayerHand & { value: HandValue })[]
  activeHand: number
  phase: Phase
  insuranceBet: number
  settlement: Settlement | null
}

export function toPublicView(s: RoundState, availableChips = Infinity): PublicRoundView & { actions: Action[] } {
  const revealed = s.phase === 'settled'
  const dealer = revealed ? s.dealer : [s.dealer[0], null]
  return {
    dealer,
    dealerValue: handValue(revealed ? s.dealer : [s.dealer[0]]),
    hands: s.hands.map((h) => ({ ...h, value: handValue(h.cards) })),
    activeHand: s.activeHand,
    phase: s.phase,
    insuranceBet: s.insuranceBet,
    settlement: s.settlement,
    actions: legalActions(s, availableChips),
  }
}

// ---------------------------------------------------------------------------
// Applying actions

export function applyAction(state: RoundState, action: Action): RoundState {
  if (!candidateActions(state).includes(action)) throw new IllegalActionError(action, state.phase)

  const s = structuredClone(state)

  if (action === 'insurance' || action === 'noInsurance') {
    s.insuranceBet = action === 'insurance' ? insuranceCost(s) : 0
    return afterDealerPeek(s)
  }

  const hand = s.hands[s.activeHand]
  switch (action) {
    case 'hit': {
      hand.cards.push(draw(s))
      const { total } = handValue(hand.cards)
      if (total > 21) hand.status = 'bust'
      else if (total === 21) hand.status = 'stood'
      break
    }
    case 'stand':
      hand.status = 'stood'
      break
    case 'double':
      hand.bet *= 2
      hand.doubled = true
      hand.cards.push(draw(s))
      hand.status = handValue(hand.cards).total > 21 ? 'bust' : 'stood'
      break
    case 'split': {
      const [first, second] = hand.cards
      hand.cards = [first]
      hand.fromSplit = true
      const newHand: PlayerHand = { cards: [second], bet: hand.bet, doubled: false, fromSplit: true, status: 'playing' }
      s.hands.splice(s.activeHand + 1, 0, newHand)

      if (first.rank === 'A') {
        // Split aces get exactly one card each and can't be played further.
        hand.cards.push(draw(s))
        newHand.cards.push(draw(s))
        hand.status = 'stood'
        newHand.status = 'stood'
      } else {
        // The new hand gets its second card when it becomes active.
        hand.cards.push(draw(s))
        if (handValue(hand.cards).total === 21) hand.status = 'stood'
      }
      break
    }
    case 'surrender':
      hand.status = 'surrendered'
      break
  }

  if (hand.status !== 'playing') advance(s)
  return s
}

// ---------------------------------------------------------------------------
// Internals

function candidateActions(s: RoundState): Action[] {
  if (s.phase === 'insurance') return ['insurance', 'noInsurance']
  if (s.phase !== 'player') return []

  const { rules } = s
  const hand = s.hands[s.activeHand]
  const actions: Action[] = ['hit', 'stand']
  const twoCards = hand.cards.length === 2

  if (twoCards && (!hand.fromSplit || rules.doubleAfterSplit)) actions.push('double')
  if (twoCards && s.hands.length < rules.maxHands && canSplitPair(hand.cards, rules)) actions.push('split')
  if (rules.surrender && twoCards && s.hands.length === 1 && !hand.fromSplit) actions.push('surrender')

  return actions
}

function canSplitPair([a, b]: Card[], rules: Rules): boolean {
  if (a.rank === b.rank) return true
  return rules.splitByValue && cardValue(a.rank) === 10 && cardValue(b.rank) === 10
}

function insuranceCost(s: RoundState): number {
  return s.phase === 'settled' ? 0 : Math.floor(s.hands[0].bet / 2)
}

function draw(s: RoundState): Card {
  const card = s.shoe.shift()
  if (!card) throw new Error('The shoe is empty')
  return card
}

function isNatural(s: RoundState, hand: PlayerHand): boolean {
  return s.hands.length === 1 && !hand.fromSplit && isTwoCard21(hand.cards)
}

/** After insurance (or straight after the deal): settle on any blackjack, otherwise the player's turn starts. */
function afterDealerPeek(s: RoundState): RoundState {
  const hand = s.hands[0]
  if (isTwoCard21(s.dealer) || isNatural(s, hand)) {
    hand.status = 'stood'
    settle(s)
    return s
  }
  s.phase = 'player'
  return s
}

/** Moves to the next hand that still needs playing, or finishes the round. */
function advance(s: RoundState): void {
  for (let i = s.activeHand + 1; i < s.hands.length; i++) {
    const hand = s.hands[i]
    if (hand.status !== 'playing') continue
    s.activeHand = i
    if (hand.cards.length === 1) {
      hand.cards.push(draw(s))
      if (handValue(hand.cards).total === 21) {
        hand.status = 'stood'
        continue
      }
    }
    return
  }
  dealerPlays(s)
  settle(s)
}

function dealerPlays(s: RoundState): void {
  // No need to draw if every hand already lost or surrendered.
  if (!s.hands.some((h) => h.status === 'stood')) return
  for (;;) {
    const { total, soft } = handValue(s.dealer)
    const hits = total < 17 || (total === 17 && soft && s.rules.dealerHitsSoft17)
    if (!hits) return
    s.dealer.push(draw(s))
  }
}

function settle(s: RoundState): void {
  const [num, den] = s.rules.blackjackPayout
  const dealerBlackjack = isTwoCard21(s.dealer)
  const dealerTotal = handValue(s.dealer).total

  const hands = s.hands.map((hand): HandResult => {
    const bet = hand.bet
    if (hand.status === 'surrendered') return { outcome: 'surrender', payout: Math.floor(bet / 2) }
    if (hand.status === 'bust') return { outcome: 'bust', payout: 0 }

    if (isNatural(s, hand)) {
      return dealerBlackjack
        ? { outcome: 'push', payout: bet }
        : { outcome: 'blackjack', payout: bet + Math.floor((bet * num) / den) }
    }
    if (dealerBlackjack) return { outcome: 'lose', payout: 0 }

    const total = handValue(hand.cards).total
    if (dealerTotal > 21 || total > dealerTotal) return { outcome: 'win', payout: bet * 2 }
    if (total === dealerTotal) return { outcome: 'push', payout: bet }
    return { outcome: 'lose', payout: 0 }
  })

  const insurancePayout = dealerBlackjack ? s.insuranceBet * 3 : 0
  const totalWagered = s.hands.reduce((sum, h) => sum + h.bet, 0) + s.insuranceBet
  const totalPayout = hands.reduce((sum, h) => sum + h.payout, 0) + insurancePayout

  s.phase = 'settled'
  s.settlement = {
    hands,
    dealerBlackjack,
    insurancePayout,
    totalWagered,
    totalPayout,
    net: totalPayout - totalWagered,
  }
}
