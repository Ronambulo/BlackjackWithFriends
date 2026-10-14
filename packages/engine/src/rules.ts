export interface Rules {
  decks: number
  /** H17 when true, S17 when false. */
  dealerHitsSoft17: boolean
  /** Natural payout as [numerator, denominator], e.g. [3, 2]. */
  blackjackPayout: [number, number]
  /** Two-card totals you may double on; null allows any two cards. */
  doubleOn: readonly number[] | null
  doubleAfterSplit: boolean
  /** Maximum number of hands after splitting (4 = up to three splits). */
  maxHands: number
  /** Allow splitting any two 10-value cards (e.g. K+Q), not only equal ranks. */
  splitByValue: boolean
  /** Late surrender: only on the first two cards, after the dealer checks for blackjack. */
  surrender: boolean
  insurance: boolean
}

// Agreed in docs/DISENO.md: 6 decks, S17, 3:2, double on 9-11 only, DAS, split to 4 hands,
// split aces get one card, insurance and late surrender.
export const DEFAULT_RULES: Rules = {
  decks: 6,
  dealerHitsSoft17: false,
  blackjackPayout: [3, 2],
  doubleOn: [9, 10, 11],
  doubleAfterSplit: true,
  maxHands: 4,
  splitByValue: true,
  surrender: true,
  insurance: true,
}
