import { actionCost, applyAction, DEFAULT_RULES, legalActions, startRound, toPublicView, type Action } from '@bwf/engine'
import { and, eq, inArray, isNotNull, isNull, or, sql } from 'drizzle-orm'
import { requireUser } from '../lib/auth.js'
import { frameColumn } from '../lib/cosmetics.js'
import {
  DAILY_BET,
  DAILY_HANDS,
  DAILY_PRIZE,
  DAILY_START,
  dailyShoe,
  deckFor,
  deckNumber,
  resultOf,
  runOver,
  shareLine,
} from '../lib/daily.js'
import { db, sqliteCode, type Tx } from '../lib/db.js'
import { HttpError, json } from '../lib/http.js'
import { addDays, leagueClock, madridMidnight } from '../lib/league.js'
import { dailyRuns, groupMembers, profiles, user } from '../lib/schema.js'
import { isOn } from '../lib/settings.js'
import { newCode } from './groups.js'

// The daily deck's table (lib/daily.ts). Like /api/play, the server deals and
// settles and the app only sends actions; the chips are the run's, never the league's.

const ACTIONS: readonly Action[] = ['hit', 'stand', 'double', 'split', 'surrender', 'insurance', 'noInsurance']

type RunRow = typeof dailyRuns.$inferSelect

function findRun(tx: Tx, userId: string, dia: string): RunRow | undefined {
  return tx
    .select()
    .from(dailyRuns)
    .where(and(eq(dailyRuns.userId, userId), eq(dailyRuns.dia, dia)))
    .get()
}

function english(tx: Tx, userId: string) {
  return tx.select({ idioma: profiles.idioma }).from(profiles).where(eq(profiles.id, userId)).get()?.idioma === 'en'
}

/** Everything the app shows of the player's run today. */
function dailyJson(tx: Tx, userId: string) {
  const { today } = leagueClock()
  const deck = deckFor(tx, today)
  const number = deckNumber(tx, today)
  const run = findRun(tx, userId, today)
  const chips = run?.fichas ?? DAILY_START
  const results = run?.resultados ?? ''
  const yesterday = findRun(tx, userId, addDays(today, -1))
  return {
    number,
    day: deck.dia,
    endsAt: madridMidnight(addDays(today, 1)).toISOString(),
    bet: DAILY_BET,
    start: DAILY_START,
    total: DAILY_HANDS,
    // Coins for 1st in a group, paid when the day closes.
    prize: DAILY_PRIZE,
    chips,
    results,
    // The id changes with every hand, so the table deals it afresh.
    hand: run?.ronda ? { id: `${today}:${run.resultados.length - (run.ronda.phase === 'settled' ? 1 : 0)}`, version: run.version, ...toPublicView(run.ronda, chips) } : null,
    version: run?.version ?? 0,
    done: Boolean(run?.terminada),
    codigo: run?.codigo ?? null,
    share: run?.terminada ? shareLine(number, chips, results, english(tx, userId)) : null,
    yesterday: yesterday?.terminada
      ? {
          number: number - 1,
          net: yesterday.fichas - DAILY_START,
          prize: yesterday.premio,
          // Whether the app already told them they won it.
          seen: yesterday.premioVisto !== null,
        }
      : null,
  }
}

// GET /api/daily
export async function getDaily(request: Request): Promise<Response> {
  const me = await requireUser(request)
  return json(db().transaction((tx) => dailyJson(tx, me.id)))
}

// POST /api/daily/seen: the player saw that they won yesterday's deck.
export async function postDailySeen(request: Request): Promise<Response> {
  const me = await requireUser(request)
  const dia = addDays(leagueClock().today, -1)
  db()
    .update(dailyRuns)
    .set({ premioVisto: new Date() })
    .where(and(eq(dailyRuns.userId, me.id), eq(dailyRuns.dia, dia), isNull(dailyRuns.premioVisto)))
    .run()
  return json({ ok: true })
}

// POST /api/daily
//   { action: 'deal', version }            deals the next hand
//   { action, version }                    hit, stand, double, split, surrender, insurance, noInsurance
export async function postDaily(request: Request): Promise<Response> {
  const me = await requireUser(request)
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null
  if (!body || typeof body !== 'object') throw new HttpError(400, 'Cuerpo no válido')
  const action = body.action
  if (action !== 'deal' && !ACTIONS.includes(action as Action)) throw new HttpError(400, 'Acción no válida')
  if (typeof body.version !== 'number') throw new HttpError(400, 'Falta la versión')
  const version = body.version
  if (action === 'deal' && !isOn('play')) throw new HttpError(503, 'La mesa está cerrada un momento')

  try {
    return json(
      db().transaction((tx) => {
        const { today } = leagueClock()
        const run = findRun(tx, me.id, today)
        // A double tap, or another device: the app reloads.
        if ((run?.version ?? 0) !== version) throw new HttpError(409, 'La mano ha cambiado')
        if (run?.terminada) throw new HttpError(409, 'Ya has jugado la baraja de hoy')
        if (action === 'deal') deal(tx, me.id, today, run)
        else act(tx, run, action as Action)
        return dailyJson(tx, me.id)
      }),
    )
  } catch (err) {
    if (sqliteCode(err) === 'SQLITE_CONSTRAINT_PRIMARYKEY') throw new HttpError(409, 'La mano ha cambiado')
    throw err
  }
}

/** Saves the hand; once it settles, its result, and the end of the run if that was the last. */
function save(tx: Tx, run: Pick<RunRow, 'userId' | 'dia' | 'version' | 'resultados'>, ronda: RunRow['ronda'] & {}, fichas: number) {
  const resultados = ronda.phase === 'settled' ? run.resultados + resultOf(ronda) : run.resultados
  const over = ronda.phase === 'settled' && runOver(fichas, resultados)
  const saved = tx
    .update(dailyRuns)
    .set({ ronda, fichas, resultados, version: run.version + 1, ...(over ? { terminada: new Date(), codigo: newCode() } : {}) })
    .where(and(eq(dailyRuns.userId, run.userId), eq(dailyRuns.dia, run.dia), eq(dailyRuns.version, run.version)))
    .returning({ dia: dailyRuns.dia })
    .get()
  if (!saved) throw new HttpError(409, 'La mano ha cambiado')
}

function deal(tx: Tx, userId: string, today: string, run: RunRow | undefined) {
  if (run?.ronda && run.ronda.phase !== 'settled') throw new HttpError(409, 'Ya tienes una mano en juego')
  const deck = deckFor(tx, today)
  const index = run?.resultados.length ?? 0
  const state = startRound(DAILY_BET, dailyShoe(deck.semilla, index), DEFAULT_RULES)
  const fichas = (run?.fichas ?? DAILY_START) - DAILY_BET + (state.settlement?.totalPayout ?? 0)
  if (!run) {
    // The run starts at version 0, so save() below moves it to 1 like any other hand.
    tx.insert(dailyRuns).values({ userId, dia: today, fichas: DAILY_START }).run()
  }
  save(tx, run ?? { userId, dia: today, version: 0, resultados: '' }, state, fichas)
}

function act(tx: Tx, run: RunRow | undefined, action: Action) {
  if (!run?.ronda || run.ronda.phase === 'settled') throw new HttpError(409, 'No hay mano en juego')
  if (!legalActions(run.ronda, run.fichas).includes(action)) throw new HttpError(400, 'Ahora no puedes hacer eso')
  const cost = actionCost(run.ronda, action)
  const next = applyAction(run.ronda, action)
  save(tx, run, next, run.fichas - cost + (next.settlement?.totalPayout ?? 0))
}

// ── Ranking ─────────────────────────────────────────────────────────────────

export interface DailyRanked {
  userId: string
  nombre: string
  avatarUrl: string | null
  marco: string | null
  net: number
  results: string
  rank: number
}

// GET /api/daily/ranking?group=friends|<id>: today's results of everyone the player
// shares a group with (or one group's members). Hidden until the player has finished.
export async function getDailyRanking(request: Request): Promise<Response> {
  const me = await requireUser(request)
  const group = new URL(request.url).searchParams.get('group') ?? 'friends'
  return json(
    db().transaction((tx) => {
      const { today } = leagueClock()
      let players
      if (group === 'friends') {
        const mine = sql`(select ${groupMembers.groupId} from ${groupMembers} where ${groupMembers.userId} = ${me.id})`
        const shared = tx.selectDistinct({ id: groupMembers.userId }).from(groupMembers).where(inArray(groupMembers.groupId, mine))
        players = or(eq(dailyRuns.userId, me.id), inArray(dailyRuns.userId, shared))
      } else {
        const member = tx
          .select({ userId: groupMembers.userId })
          .from(groupMembers)
          .where(and(eq(groupMembers.groupId, group), eq(groupMembers.userId, me.id)))
          .get()
        if (!member) throw new HttpError(404, 'No existe el grupo')
        players = inArray(dailyRuns.userId, tx.select({ id: groupMembers.userId }).from(groupMembers).where(eq(groupMembers.groupId, group)))
      }
      const rows = tx
        .select({
          userId: dailyRuns.userId,
          nombre: sql<string>`coalesce(${profiles.nombre}, ${user.displayUsername}, ${user.name})`,
          avatarUrl: profiles.avatarUrl,
          marco: frameColumn(),
          fichas: dailyRuns.fichas,
          results: dailyRuns.resultados,
        })
        .from(dailyRuns)
        .innerJoin(user, eq(user.id, dailyRuns.userId))
        .leftJoin(profiles, eq(profiles.id, dailyRuns.userId))
        .where(and(eq(dailyRuns.dia, today), isNotNull(dailyRuns.terminada), players))
        .all()
      // No peeking: the others' results show once the player's 10 hands are done.
      if (!findRun(tx, me.id, today)?.terminada) return { locked: true, finished: rows.length, rows: [] }
      const all = rows.map((row) => row.fichas)
      const ranked: DailyRanked[] = rows
        .map(({ fichas, ...row }) => ({ ...row, net: fichas - DAILY_START, rank: 1 + all.filter((other) => other > fichas).length }))
        .sort((a, b) => a.rank - b.rank || a.nombre.localeCompare(b.nombre))
      return { locked: false, finished: rows.length, rows: ranked }
    }),
  )
}

// ── Sharing ─────────────────────────────────────────────────────────────────

/** The line a finished run shares in the chats; a 400 if today's isn't over. */
export function dailyShareText(userId: string): string {
  return db().transaction((tx) => {
    const { today } = leagueClock()
    const run = findRun(tx, userId, today)
    if (!run?.terminada) throw new HttpError(400, 'Aún no has terminado la baraja de hoy')
    return shareLine(deckNumber(tx, today), run.fichas, run.resultados, english(tx, userId))
  })
}

// GET /api/daily/preview?codigo=: a shared run's link preview, without a session.
export function getDailyPreview(request: Request): Response {
  const codigo = new URL(request.url).searchParams.get('codigo')?.trim() ?? ''
  if (codigo.length !== 10) throw new HttpError(404, 'No existe')
  return json(
    db().transaction((tx) => {
      const run = tx
        .select({
          dia: dailyRuns.dia,
          fichas: dailyRuns.fichas,
          results: dailyRuns.resultados,
          nombre: sql<string>`coalesce(${profiles.nombre}, ${user.displayUsername}, ${user.name})`,
        })
        .from(dailyRuns)
        .innerJoin(user, eq(user.id, dailyRuns.userId))
        .leftJoin(profiles, eq(profiles.id, dailyRuns.userId))
        .where(eq(dailyRuns.codigo, codigo))
        .get()
      if (!run) throw new HttpError(404, 'No existe')
      return { nombre: run.nombre, number: deckNumber(tx, run.dia), day: run.dia, net: run.fichas - DAILY_START, results: run.results }
    }),
  )
}
