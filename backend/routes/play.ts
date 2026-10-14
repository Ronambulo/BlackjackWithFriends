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
import { and, desc, eq, ne, sql } from 'drizzle-orm'
import { requireUser } from '../lib/auth.js'
import { db } from '../lib/db.js'
import { HttpError, json } from '../lib/http.js'
import { hands, profiles } from '../lib/schema.js'

// The table, still with test chips (profiles.fichas_prueba) until groups exist.
// The server deals and settles; the app only sends actions and shows what comes back.

export const MIN_BET = 10
/** What a player who ran out of test chips gets back. */
const REFILL = 1000

const ACTIONS: readonly Action[] = ['hit', 'stand', 'double', 'split', 'surrender', 'insurance', 'noInsurance']

type HandRow = typeof hands.$inferSelect

function handJson(row: Pick<HandRow, 'id' | 'version'>, state: RoundState, chips: number) {
  return { id: row.id, version: row.version, ...toPublicView(state, chips) }
}

function tableJson(chips: number, hand: ReturnType<typeof handJson> | null) {
  return { chips, minBet: MIN_BET, hand }
}

/** Postgres error code, also when Drizzle wraps the driver's error. */
function pgCode(err: unknown): string | undefined {
  const e = err as { code?: string; cause?: { code?: string } }
  return e?.code ?? e?.cause?.code
}

// GET /api/play: the player's chips and the hand left half-played, if any.
export async function getTable(request: Request): Promise<Response> {
  const user = await requireUser(request)
  const [, [{ chips }], [open]] = await db().batch([
    db().insert(profiles).values({ id: user.id }).onConflictDoNothing(),
    db().select({ chips: profiles.fichasPrueba }).from(profiles).where(eq(profiles.id, user.id)),
    db()
      .select()
      .from(hands)
      .where(and(eq(hands.userId, user.id), eq(hands.modo, 'prueba'), ne(hands.fase, 'settled')))
      .orderBy(desc(hands.createdAt))
      .limit(1),
  ])
  return json(tableJson(chips, open ? handJson(open, open.ronda, chips) : null))
}

// POST /api/play
//   { action: 'bet', bet }                 deals a new hand
//   { action: 'refill' }                   tops the test chips back up when they ran out
//   { action, handId, version }            hit, stand, double, split, surrender, insurance, noInsurance
export async function postPlay(request: Request): Promise<Response> {
  const user = await requireUser(request)
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null
  if (!body || typeof body !== 'object') throw new HttpError(400, 'Cuerpo no válido')

  if (body.action === 'bet') return bet(user.id, body.bet)
  if (body.action === 'refill') return refill(user.id)
  if (ACTIONS.includes(body.action as Action)) return act(user.id, body.action as Action, body.handId, body.version)
  throw new HttpError(400, 'Acción no válida')
}

async function bet(userId: string, amount: unknown): Promise<Response> {
  if (typeof amount !== 'number' || !Number.isInteger(amount) || amount < MIN_BET) {
    throw new HttpError(400, 'Apuesta no válida')
  }
  const state = startRound(amount, createShoe(DEFAULT_RULES.decks, cryptoRng()), DEFAULT_RULES)
  // A natural (or a dealer blackjack without an ace showing) settles straight away.
  const payout = state.settlement?.totalPayout ?? 0
  const id = crypto.randomUUID()

  // One round trip, one transaction: make sure the profile exists, then take the bet
  // and save the hand in a single statement. The chips only move if they cover the
  // bet, and the hand is only saved if they moved; if another hand is still open
  // (unique index), nothing is saved.
  let result
  try {
    ;[, result] = await db().batch([
      db().insert(profiles).values({ id: userId }).onConflictDoNothing(),
      db().execute<{ chips: number }>(sql`
        with p as (
          update ${profiles}
          set fichas_prueba = fichas_prueba - ${amount} + ${payout}
          where id = ${userId} and fichas_prueba >= ${amount}
          returning fichas_prueba
        ), h as (
          insert into ${hands} (id, user_id, modo, apuesta, ronda, fase, neto)
          select ${id}, ${userId}, 'prueba', ${amount}, ${JSON.stringify(state)}::jsonb, ${state.phase}, ${state.settlement?.net ?? null}
          from p
          returning id
        )
        select p.fichas_prueba::float8 as chips from p, h
      `),
    ])
  } catch (err) {
    if (pgCode(err) === '23505') throw new HttpError(409, 'Ya tienes una mano en juego')
    throw err
  }
  const [updated] = result.rows
  if (!updated) throw new HttpError(400, 'No tienes fichas suficientes')
  return json(tableJson(updated.chips, handJson({ id, version: 0 }, state, updated.chips)))
}

async function refill(userId: string): Promise<Response> {
  const [, [updated]] = await db().batch([
    db().insert(profiles).values({ id: userId }).onConflictDoNothing(),
    db()
      .update(profiles)
      .set({ fichasPrueba: REFILL })
      .where(
        and(
          eq(profiles.id, userId),
          sql`${profiles.fichasPrueba} < ${MIN_BET}`,
          sql`not exists (select 1 from ${hands} where ${hands.userId} = ${userId} and ${hands.fase} <> 'settled')`,
        ),
      )
      .returning({ chips: profiles.fichasPrueba }),
  ])
  if (!updated) throw new HttpError(409, 'Todavía tienes fichas')
  return json(tableJson(updated.chips, null))
}

async function act(userId: string, action: Action, handId: unknown, version: unknown): Promise<Response> {
  if (typeof handId !== 'string' || typeof version !== 'number') throw new HttpError(400, 'Falta la mano')

  const [row] = await db()
    .select({ hand: hands, chips: profiles.fichasPrueba })
    .from(hands)
    .innerJoin(profiles, eq(profiles.id, hands.userId))
    .where(and(eq(hands.id, handId), eq(hands.userId, userId)))
  if (!row) throw new HttpError(404, 'No existe la mano')
  const { hand, chips } = row
  // Already played (e.g. a double tap): the app reloads the table.
  if (hand.fase === 'settled' || hand.version !== version) throw new HttpError(409, 'La mano ha cambiado')
  if (!legalActions(hand.ronda, chips).includes(action)) throw new HttpError(400, 'Ahora no puedes hacer eso')

  const cost = actionCost(hand.ronda, action)
  const next = applyAction(hand.ronda, action)
  const delta = (next.settlement?.totalPayout ?? 0) - cost

  // Hand and chips in one statement: the chips only move if this exact version of
  // the hand was the one updated, so two requests at once can't both count.
  let result
  try {
    result = await db().execute<{ chips: number }>(sql`
      with h as (
        update ${hands}
        set ronda = ${JSON.stringify(next)}::jsonb,
            fase = ${next.phase},
            neto = ${next.settlement?.net ?? null},
            version = version + 1,
            updated_at = now()
        where id = ${hand.id} and version = ${hand.version}
        returning id
      )
      update ${profiles}
      set fichas_prueba = fichas_prueba + ${delta}
      where id = ${userId} and exists (select 1 from h)
      returning fichas_prueba::float8 as chips
    `)
  } catch (err) {
    if (pgCode(err) === '23514') throw new HttpError(400, 'No tienes fichas suficientes')
    throw err
  }
  const [updated] = result.rows
  if (!updated) throw new HttpError(409, 'La mano ha cambiado')

  const view = handJson({ id: hand.id, version: hand.version + 1 }, next, updated.chips)
  return json(tableJson(updated.chips, view))
}
