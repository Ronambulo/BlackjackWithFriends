import { and, count, desc, eq, gt, inArray, isNull, lte, or, sql } from 'drizzle-orm'
import { logAction, requireAdmin } from '../lib/admin.js'
import { requireUser } from '../lib/auth.js'
import { db } from '../lib/db.js'
import { HttpError, json } from '../lib/http.js'
import { campaignDevices, sendCampaignsNow } from '../lib/push.js'
import {
  AUDIENCES,
  devices,
  notices,
  noticeViews,
  PLATFORMS,
  polls,
  pollVotes,
  pushCampaigns,
  pushSubscriptions,
  user,
  type Audience,
  type Platform,
} from '../lib/schema.js'
import { deviceKind } from './push.js'

// What the admins tell the players: notices on top of the app (the important ones in a
// dialog when it opens), push campaigns and polls, each for an audience (iPhones,
// people without the app installed...).
// Devices say what they are when the app opens, which is how audiences are known.

const HOUR = 60 * 60 * 1000
const DAY = 24 * HOUR
// A device not opened in this long no longer counts in the figures.
const RECENT = 30 * DAY
const NOTICE_MAX = 280
const TITLE_MAX = 60
const BODY_MAX = 180
const QUESTION_MAX = 140
const OPTION_MAX = 60
const OPTIONS_MAX = 6
// How far ahead something may be scheduled, and how long it may stay up.
const AHEAD_MAX = 60 * DAY
const HOURS_MAX = 24 * 60

async function readBody(request: Request): Promise<Record<string, unknown>> {
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null
  if (!body || typeof body !== 'object') throw new HttpError(400, 'Cuerpo no válido')
  return body
}

function audienceOf(value: unknown): Audience {
  if (value === undefined) return 'all'
  if (!AUDIENCES.includes(value as Audience)) throw new HttpError(400, 'Audiencia no válida')
  return value as Audience
}

function idOf(value: unknown): number {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 1) throw new HttpError(400, 'Id no válido')
  return value
}

function textOf(value: unknown, max: number, what: string): string {
  const text = typeof value === 'string' ? value.trim() : ''
  if (!text || text.length > max) throw new HttpError(400, `${what} no válido`)
  return text
}

/** `at` (ms) as a start in the next two months, or now if it's missing or past. */
function startOf(value: unknown): Date {
  if (value === undefined || value === null) return new Date()
  if (typeof value !== 'number' || !Number.isFinite(value)) throw new HttpError(400, 'Fecha no válida')
  if (value > Date.now() + AHEAD_MAX) throw new HttpError(400, 'Demasiado lejos')
  return new Date(Math.max(value, Date.now()))
}

/** Hours from `from`, or null: until taken down. */
function endOf(value: unknown, from: Date): Date | null {
  if (value === undefined || value === null) return null
  if (typeof value !== 'number' || !(value > 0)) throw new HttpError(400, 'Duración no válida')
  return new Date(from.getTime() + Math.min(value, HOURS_MAX) * HOUR)
}

const live = (now: Date) => or(isNull(notices.expiresAt), gt(notices.expiresAt, now))

// ── Devices ─────────────────────────────────────────────────────────────────

// POST /api/devices { id, plataforma, pwa, push, endpoint? }: the device the app was just opened on.
export async function postDevice(request: Request): Promise<Response> {
  const me = await requireUser(request)
  const body = await readBody(request)
  const kind = deviceKind(body)
  if (typeof body.id !== 'string' || !/^[\w-]{8,64}$/.test(body.id) || !kind || typeof body.push !== 'boolean') {
    throw new HttpError(400, 'Dispositivo no válido')
  }
  const now = new Date()
  const d = db()
  d.insert(devices)
    .values({ id: body.id, userId: me.id, ...kind, push: body.push, lastSeen: now })
    // Signed in as someone else on the same device: it's theirs now.
    .onConflictDoUpdate({ target: devices.id, set: { userId: me.id, ...kind, push: body.push, lastSeen: now } })
    .run()
  // Devices subscribed before they said what they are.
  if (typeof body.endpoint === 'string') {
    d.update(pushSubscriptions)
      .set(kind)
      .where(and(eq(pushSubscriptions.endpoint, body.endpoint), eq(pushSubscriptions.userId, me.id)))
      .run()
  }
  return json({ ok: true })
}

// ── Notices ─────────────────────────────────────────────────────────────────

// GET /api/notices: the ones up now that the player hasn't closed; the app picks those for its device.
export async function getNotices(request: Request): Promise<Response> {
  const me = await requireUser(request)
  const now = new Date()
  const rows = db()
    .select({ id: notices.id, texto: notices.texto, audiencia: notices.audiencia, importante: notices.importante, startsAt: notices.startsAt })
    .from(notices)
    .leftJoin(noticeViews, and(eq(noticeViews.noticeId, notices.id), eq(noticeViews.userId, me.id)))
    .where(and(lte(notices.startsAt, now), live(now), or(isNull(noticeViews.cerrado), eq(noticeViews.cerrado, false))))
    .orderBy(desc(notices.startsAt))
    .all()
  return json(rows.map((row) => ({ ...row, startsAt: row.startsAt.getTime() })))
}

/** For apps from before notices had audiences: the newest one for everyone. */
export function legacyAnnouncement() {
  const now = new Date()
  const row = db()
    .select()
    .from(notices)
    .where(and(eq(notices.audiencia, 'all'), lte(notices.startsAt, now), live(now)))
    .orderBy(desc(notices.startsAt))
    .get()
  return row
    ? { text: row.texto, expiresAt: row.expiresAt?.getTime() ?? null, createdAt: row.startsAt.getTime(), by: row.por }
    : null
}

// POST /api/notices/seen { id, closed? }: the notice was on the player's screen (and they closed it).
export async function postNoticeSeen(request: Request): Promise<Response> {
  const me = await requireUser(request)
  const body = await readBody(request)
  const id = idOf(body.id)
  const closed = body.closed === true
  const d = db()
  if (!d.select({ id: notices.id }).from(notices).where(eq(notices.id, id)).get()) throw new HttpError(404, 'No existe')
  d.insert(noticeViews)
    .values({ noticeId: id, userId: me.id, cerrado: closed })
    .onConflictDoUpdate({
      target: [noticeViews.noticeId, noticeViews.userId],
      set: closed ? { cerrado: true } : { noticeId: id },
    })
    .run()
  return json({ ok: true })
}

// ── Polls ───────────────────────────────────────────────────────────────────

function pollResults(ids: number[]) {
  const counts = new Map<number, number[]>()
  if (ids.length === 0) return counts
  const rows = db()
    .select({ pollId: pollVotes.pollId, opcion: pollVotes.opcion, n: count() })
    .from(pollVotes)
    .where(inArray(pollVotes.pollId, ids))
    .groupBy(pollVotes.pollId, pollVotes.opcion)
    .all()
  for (const row of rows) {
    const list = counts.get(row.pollId) ?? []
    list[row.opcion] = row.n
    counts.set(row.pollId, list)
  }
  return counts
}

const open = (now: Date) => or(isNull(polls.endsAt), gt(polls.endsAt, now))

// GET /api/polls: the open ones, with the player's answer; the counts only once they've answered.
export async function getPolls(request: Request): Promise<Response> {
  const me = await requireUser(request)
  const rows = db()
    .select({ id: polls.id, pregunta: polls.pregunta, opciones: polls.opciones, endsAt: polls.endsAt, mine: pollVotes.opcion })
    .from(polls)
    .leftJoin(pollVotes, and(eq(pollVotes.pollId, polls.id), eq(pollVotes.userId, me.id)))
    .where(open(new Date()))
    .orderBy(desc(polls.createdAt))
    .all()
  const results = pollResults(rows.filter((row) => row.mine !== null).map((row) => row.id))
  return json(
    rows.map((row) => ({
      id: row.id,
      pregunta: row.pregunta,
      opciones: row.opciones,
      endsAt: row.endsAt?.getTime() ?? null,
      mine: row.mine,
      votes: row.mine === null ? null : row.opciones.map((_, i) => results.get(row.id)?.[i] ?? 0),
    })),
  )
}

// POST /api/polls/vote { id, opcion }: answers, or changes the answer while it's open.
export async function postVote(request: Request): Promise<Response> {
  const me = await requireUser(request)
  const body = await readBody(request)
  const id = idOf(body.id)
  const d = db()
  const poll = d.select().from(polls).where(and(eq(polls.id, id), open(new Date()))).get()
  if (!poll) throw new HttpError(404, 'La encuesta ya está cerrada')
  const opcion = body.opcion
  if (typeof opcion !== 'number' || !Number.isInteger(opcion) || opcion < 0 || opcion >= poll.opciones.length) {
    throw new HttpError(400, 'Opción no válida')
  }
  d.insert(pollVotes)
    .values({ pollId: id, userId: me.id, opcion })
    .onConflictDoUpdate({ target: [pollVotes.pollId, pollVotes.userId], set: { opcion, createdAt: new Date() } })
    .run()
  return getPolls(request)
}

// ── Admin: notices and campaigns ────────────────────────────────────────────

/** Players (not devices) in each audience, among those who opened the app lately. */
function audienceFigures() {
  const d = db()
  const since = new Date(Date.now() - RECENT)
  const recent = d
    .select({ userId: devices.userId, plataforma: devices.plataforma, pwa: devices.pwa, push: devices.push })
    .from(devices)
    .where(gt(devices.lastSeen, since))
    .all()
  const players = (test: (device: (typeof recent)[number]) => boolean) =>
    new Set(recent.filter(test).map((device) => device.userId)).size
  const reach = (audience: Audience) => new Set(campaignDevices(audience).map((device) => device.endpoint)).size
  const subscribed = d.select({ users: sql<number>`count(distinct ${pushSubscriptions.userId})`, devices: count() }).from(pushSubscriptions).get()
  return {
    users: d.select({ n: count() }).from(user).get()?.n ?? 0,
    seen: players(() => true),
    byPlatform: Object.fromEntries(PLATFORMS.map((p) => [p, players((device) => device.plataforma === p)])) as Record<Platform, number>,
    pwa: players((device) => device.pwa),
    browserOnly: new Set(
      recent.filter((device) => !recent.some((other) => other.userId === device.userId && other.pwa)).map((device) => device.userId),
    ).size,
    pushUsers: subscribed?.users ?? 0,
    pushDevices: subscribed?.devices ?? 0,
    // Devices a campaign to each audience reaches now.
    reach: Object.fromEntries(AUDIENCES.map((audience) => [audience, reach(audience)])) as Record<Audience, number>,
  }
}

// GET /api/admin/notices: every notice and campaign, newest first, and who can be reached.
export async function getAdminNotices(request: Request): Promise<Response> {
  await requireAdmin(request)
  const d = db()
  const viewCounts = new Map(
    d
      .select({
        id: noticeViews.noticeId,
        seen: count(),
        closed: sql<number>`sum(${noticeViews.cerrado})`,
      })
      .from(noticeViews)
      .groupBy(noticeViews.noticeId)
      .all()
      .map((row) => [row.id, row]),
  )
  const list = d
    .select()
    .from(notices)
    .orderBy(desc(notices.startsAt))
    .limit(30)
    .all()
    .map((row) => ({
      id: row.id,
      texto: row.texto,
      audiencia: row.audiencia,
      importante: row.importante,
      startsAt: row.startsAt.getTime(),
      expiresAt: row.expiresAt?.getTime() ?? null,
      por: row.por,
      seen: viewCounts.get(row.id)?.seen ?? 0,
      closed: viewCounts.get(row.id)?.closed ?? 0,
    }))
  const campaigns = d
    .select()
    .from(pushCampaigns)
    .orderBy(desc(pushCampaigns.sendAt))
    .limit(30)
    .all()
    .map((row) => ({
      id: row.id,
      titulo: row.titulo,
      cuerpo: row.cuerpo,
      url: row.url,
      audiencia: row.audiencia,
      sendAt: row.sendAt.getTime(),
      sentAt: row.sentAt?.getTime() ?? null,
      devices: row.dispositivos,
      failed: row.fallidos,
      por: row.por,
    }))
  return json({ now: Date.now(), notices: list, campaigns, audiences: audienceFigures() })
}

// POST /api/admin/notices { texto, audiencia?, startsAt?, hours?, importante? }: a notice, now or later.
export async function postNotice(request: Request): Promise<Response> {
  const me = await requireAdmin(request)
  const body = await readBody(request)
  const texto = textOf(body.texto, NOTICE_MAX, 'Texto')
  const audiencia = audienceOf(body.audiencia)
  const startsAt = startOf(body.startsAt)
  const expiresAt = endOf(body.hours, startsAt)
  const importante = body.importante === true
  db().insert(notices).values({ texto, audiencia, startsAt, expiresAt, importante, por: me.name }).run()
  logAction(me, 'notice', audiencia, texto)
  return json({ ok: true }, 201)
}

// POST /api/admin/notices/end { id }: takes it down now; one that hadn't started yet goes altogether.
export async function endNotice(request: Request): Promise<Response> {
  const me = await requireAdmin(request)
  const id = idOf((await readBody(request)).id)
  const d = db()
  const row = d.select().from(notices).where(eq(notices.id, id)).get()
  if (!row) throw new HttpError(404, 'No existe')
  const now = new Date()
  if (row.startsAt > now) d.delete(notices).where(eq(notices.id, id)).run()
  else if (!row.expiresAt || row.expiresAt > now) d.update(notices).set({ expiresAt: now }).where(eq(notices.id, id)).run()
  logAction(me, 'notice_off', null, row.texto)
  return json({ ok: true })
}

function urlOf(value: unknown): string {
  if (value === undefined || value === '') return '/'
  // Only somewhere in the app.
  if (typeof value !== 'string' || !/^\/[\w\-/?=&%.]*$/.test(value) || value.startsWith('//') || value.length > 200) {
    throw new HttpError(400, 'Enlace no válido')
  }
  return value
}

/** Puts a campaign in the queue, and sends it at once if it's for now. */
function queueCampaign(por: string, campaign: { titulo: string; cuerpo: string; url: string; audiencia: Audience; sendAt: Date }) {
  db().insert(pushCampaigns).values({ ...campaign, por }).run()
  if (campaign.sendAt.getTime() <= Date.now()) sendCampaignsNow()
}

// POST /api/admin/campaigns { titulo, cuerpo, url?, audiencia?, sendAt? }: a push, now or later.
export async function postCampaign(request: Request): Promise<Response> {
  const me = await requireAdmin(request)
  const body = await readBody(request)
  const titulo = textOf(body.titulo, TITLE_MAX, 'Título')
  const cuerpo = textOf(body.cuerpo, BODY_MAX, 'Texto')
  const audiencia = audienceOf(body.audiencia)
  if (audiencia === 'noPush') throw new HttpError(400, 'Sin notificaciones no se les puede mandar una')
  const sendAt = startOf(body.sendAt)
  queueCampaign(me.name, { titulo, cuerpo, url: urlOf(body.url), audiencia, sendAt })
  logAction(me, 'campaign', audiencia, `${titulo} · ${cuerpo}`)
  return json({ ok: true }, 201)
}

// POST /api/admin/campaigns/delete { id }: one that hasn't gone out yet.
export async function deleteCampaign(request: Request): Promise<Response> {
  const me = await requireAdmin(request)
  const id = idOf((await readBody(request)).id)
  const d = db()
  const row = d.select().from(pushCampaigns).where(eq(pushCampaigns.id, id)).get()
  if (!row) throw new HttpError(404, 'No existe')
  if (row.sentAt) throw new HttpError(409, 'Ya se ha enviado')
  d.delete(pushCampaigns).where(eq(pushCampaigns.id, id)).run()
  logAction(me, 'campaign_off', null, row.titulo)
  return json({ ok: true })
}

// ── Admin: polls ────────────────────────────────────────────────────────────

// GET /api/admin/polls: every poll, newest first, with how each answer is doing.
export async function getAdminPolls(request: Request): Promise<Response> {
  await requireAdmin(request)
  const d = db()
  const rows = d.select().from(polls).orderBy(desc(polls.createdAt)).limit(50).all()
  const results = pollResults(rows.map((row) => row.id))
  const recent = d
    .select({ n: sql<number>`count(distinct ${devices.userId})` })
    .from(devices)
    .where(gt(devices.lastSeen, new Date(Date.now() - RECENT)))
    .get()
  return json({
    now: Date.now(),
    // Who could have answered: players seen in the last 30 days.
    players: recent?.n ?? 0,
    polls: rows.map((row) => {
      const votes = row.opciones.map((_, i) => results.get(row.id)?.[i] ?? 0)
      return {
        id: row.id,
        pregunta: row.pregunta,
        opciones: row.opciones,
        endsAt: row.endsAt?.getTime() ?? null,
        createdAt: row.createdAt.getTime(),
        por: row.por,
        votes,
        total: votes.reduce((sum, n) => sum + n, 0),
      }
    }),
  })
}

// POST /api/admin/polls { pregunta, opciones, hours?, push? }: a new poll, and a push about it if asked.
export async function postPoll(request: Request): Promise<Response> {
  const me = await requireAdmin(request)
  const body = await readBody(request)
  const pregunta = textOf(body.pregunta, QUESTION_MAX, 'Pregunta')
  const opciones = Array.isArray(body.opciones) ? body.opciones.map((option) => textOf(option, OPTION_MAX, 'Opción')) : []
  if (opciones.length < 2 || opciones.length > OPTIONS_MAX || new Set(opciones).size !== opciones.length) {
    throw new HttpError(400, 'Opciones no válidas')
  }
  const now = new Date()
  db().insert(polls).values({ pregunta, opciones, endsAt: endOf(body.hours, now), por: me.name }).run()
  if (body.push === true) {
    queueCampaign(me.name, { titulo: textOf(body.pushTitle ?? 'Nueva encuesta', TITLE_MAX, 'Título'), cuerpo: pregunta, url: '/', audiencia: 'all', sendAt: now })
  }
  logAction(me, 'poll', null, pregunta)
  return json({ ok: true }, 201)
}

// POST /api/admin/polls/close { id }: no more answers; the results stay.
export async function closePoll(request: Request): Promise<Response> {
  const me = await requireAdmin(request)
  const id = idOf((await readBody(request)).id)
  const row = db().update(polls).set({ endsAt: new Date() }).where(and(eq(polls.id, id), open(new Date()))).returning().get()
  if (!row) throw new HttpError(404, 'Ya está cerrada')
  logAction(me, 'poll_close', null, row.pregunta)
  return json({ ok: true })
}

// POST /api/admin/polls/delete { id }: the poll and its answers.
export async function deletePoll(request: Request): Promise<Response> {
  const me = await requireAdmin(request)
  const id = idOf((await readBody(request)).id)
  const row = db().delete(polls).where(eq(polls.id, id)).returning().get()
  if (!row) throw new HttpError(404, 'No existe')
  logAction(me, 'poll_delete', null, row.pregunta)
  return json({ ok: true })
}
