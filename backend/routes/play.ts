import { isOn } from '../lib/settings.js'
import {
  actionCost,
  applyAction,
  createShoe,
  cryptoRng,
  DEFAULT_RULES,
  legalActions,
  startRound,
  toPublicView,
  type Action,
  type RoundState,
} from '@bwf/engine'
import { and, desc, eq, gte, ne, sql } from 'drizzle-orm'
import { ACHIEVEMENTS, syncAchievements, type AchievementId } from '../lib/achievements.js'
import { requireUser } from '../lib/auth.js'
import { db, sqliteCode } from '../lib/db.js'
import { HttpError, json } from '../lib/http.js'
import { rollover } from '../lib/league.js'
import { hands, profiles } from '../lib/schema.js'

// The table, played with the league balance (profiles.saldo, see lib/league.ts).
// The server deals and settles; the app only sends actions and shows what comes back.

export const MIN_BET = 10
// So one hand can't decide the week: a big win or loss still takes a few hands.
export const MAX_BET = 500

const ACTIONS: readonly Action[] = ['hit', 'stand', 'double', 'split', 'surrender', 'insurance', 'noInsurance']

type HandRow = typeof hands.$inferSelect

function handJson(row: Pick<HandRow, 'id' | 'version'>, state: RoundState, chips: number) {
  return { id: row.id, version: row.version, ...toPublicView(state, chips) }
}

function tableJson(chips: number, hand: ReturnType<typeof handJson> | null, unlocked: AchievementId[] = []) {
  // With their rewards, for the notice at the table.
  return { chips, minBet: MIN_BET, maxBet: MAX_BET, hand, unlocked: ACHIEVEMENTS.filter((a) => unlocked.includes(a.id)) }
}

// GET /api/play: the player's chips and the hand left half-played, if any.
export async function getTable(request: Request): Promise<Response> {
  const user = await requireUser(request)
  const { chips, open } = db().transaction((tx) => {
    rollover(tx, user.id)
    const profile = tx.select({ chips: profiles.saldo }).from(profiles).where(eq(profiles.id, user.id)).get()
    const open = tx
      .select()
      .from(hands)
      .where(and(eq(hands.userId, user.id), eq(hands.modo, 'liga'), ne(hands.fase, 'settled')))
      .orderBy(desc(hands.createdAt))
      .limit(1)
      .get()
    return { chips: profile?.chips ?? 0, open }
  })
  return json(tableJson(chips, open ? handJson(open, open.ronda, chips) : null))
}

// POST /api/play
//   { action: 'bet', bet }                 deals a new hand
//   { action, handId, version }            hit, stand, double, split, surrender, insurance, noInsurance
export async function postPlay(request: Request): Promise<Response> {
  const user = await requireUser(request)
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null
  if (!body || typeof body !== 'object') throw new HttpError(400, 'Cuerpo no válido')

  // With play switched off (admin panel) no new hand starts; one in progress can still finish.
  if (body.action === 'bet' && !isOn('play')) throw new HttpError(503, 'La mesa está cerrada un momento')
  if (body.action === 'bet') return bet(user.id, body.bet)
  if (ACTIONS.includes(body.action as Action)) return act(user.id, body.action as Action, body.handId, body.version)
  throw new HttpError(400, 'Acción no válida')
}

function bet(userId: string, amount: unknown): Response {
  if (typeof amount !== 'number' || !Number.isInteger(amount) || amount < MIN_BET || amount > MAX_BET) {
    throw new HttpError(400, 'Apuesta no válida')
  }
  const state = startRound(amount, createShoe(DEFAULT_RULES.decks, cryptoRng()), DEFAULT_RULES)
  // A natural (or a dealer blackjack without an ace showing) settles straight away.
  const payout = state.settlement?.totalPayout ?? 0
  const id = crypto.randomUUID()

  // One transaction: make sure the profile exists and is in this week, then take
  // the bet and save the hand. The chips only move if they cover the bet; if
  // another hand is still open (unique index), the whole thing is undone.
  let result
  try {
    result = db().transaction((tx) => {
      rollover(tx, userId)
      const profile = tx
        .update(profiles)
        .set({ saldo: sql`${profiles.saldo} - ${amount} + ${payout}` })
        .where(and(eq(profiles.id, userId), gte(profiles.saldo, amount)))
        .returning({ chips: profiles.saldo })
        .get()
      if (!profile) return null
      tx.insert(hands)
        .values({
          id,
          userId,
          modo: 'liga',
          apuesta: amount,
          ronda: state,
          fase: state.phase,
          neto: state.settlement?.net ?? null,
        })
        .run()
      return { chips: profile.chips, unlocked: state.settlement ? syncAchievements(tx, userId) : [] }
    })
  } catch (err) {
    if (sqliteCode(err) === 'SQLITE_CONSTRAINT_UNIQUE') throw new HttpError(409, 'Ya tienes una mano en juego')
    throw err
  }
  if (result === null) throw new HttpError(400, 'No tienes fichas suficientes')
  return json(tableJson(result.chips, handJson({ id, version: 0 }, state, result.chips), result.unlocked))
}

function act(userId: string, action: Action, handId: unknown, version: unknown): Response {
  if (typeof handId !== 'string' || typeof version !== 'number') throw new HttpError(400, 'Falta la mano')

  // Read, check and write in one transaction: nothing else runs in between, so two
  // taps at once can't both count (the second sees the new version).
  let result
  try {
    result = db().transaction((tx) => {
      const row = tx
        .select({ hand: hands, chips: profiles.saldo })
        .from(hands)
        .innerJoin(profiles, eq(profiles.id, hands.userId))
        .where(and(eq(hands.id, handId), eq(hands.userId, userId)))
        .get()
      if (!row) throw new HttpError(404, 'No existe la mano')
      const { hand, chips } = row
      // Already played (e.g. a double tap): the app reloads the table.
      if (hand.fase === 'settled' || hand.version !== version) throw new HttpError(409, 'La mano ha cambiado')
      if (!legalActions(hand.ronda, chips).includes(action)) throw new HttpError(400, 'Ahora no puedes hacer eso')

      const cost = actionCost(hand.ronda, action)
      const next = applyAction(hand.ronda, action)
      const delta = (next.settlement?.totalPayout ?? 0) - cost

      tx.update(hands)
        .set({ ronda: next, fase: next.phase, neto: next.settlement?.net ?? null, version: hand.version + 1 })
        .where(and(eq(hands.id, hand.id), eq(hands.version, hand.version)))
        .run()
      const updated = tx
        .update(profiles)
        .set({ saldo: sql`${profiles.saldo} + ${delta}` })
        .where(eq(profiles.id, userId))
        .returning({ chips: profiles.saldo })
        .get()
      const unlocked = next.settlement ? syncAchievements(tx, userId) : []
      return { id: hand.id, version: hand.version + 1, next, chips: updated?.chips ?? chips + delta, unlocked }
    })
  } catch (err) {
    if (sqliteCode(err) === 'SQLITE_CONSTRAINT_CHECK') throw new HttpError(400, 'No tienes fichas suficientes')
    throw err
  }

  const view = handJson(result, result.next, result.chips)
  return json(tableJson(result.chips, view, result.unlocked))
}
