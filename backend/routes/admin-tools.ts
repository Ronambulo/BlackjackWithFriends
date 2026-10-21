import { toPublicView } from '@bwf/engine'
import { and, desc, eq, gte, inArray, isNotNull, isNull, lte, ne, or, sql } from 'drizzle-orm'
import { ACHIEVEMENTS } from '../lib/achievements.js'
import { forgetBans, logAction, ownerNames, requireAdmin, ROLES, roleOfName, staffRoles, type Role } from '../lib/admin.js'
import { AUTOMATIONS, automationSettings, weeklyReportSettings } from '../lib/automations.js'
import { playerChallenges } from '../lib/challenges.js'
import { catalogue, COSMETICS, equipped, ownedCosmetics } from '../lib/cosmetics.js'
import { db } from '../lib/db.js'
import { notifyGroups } from '../lib/events.js'
import { HttpError, json } from '../lib/http.js'
import { addDays, currentBalance, leagueClock, madridAt, madridMidnight, rollover, rulesFor } from '../lib/league.js'
import { sendPush } from '../lib/push.js'
import { forgetSchedule, testGroup } from '../lib/schedule.js'
import { getSetting, setSetting } from '../lib/settings.js'
import {
  achievements,
  adjustments,
  adminEvents,
  adminLog,
  adminNotes,
  challengeCompletions,
  COSMETIC_KINDS,
  dailyRuns,
  EVENT_KINDS,
  groupMembers,
  groups,
  hands,
  ipBans,
  messages,
  notices,
  pays,
  playerMarks,
  polls,
  pollVotes,
  priceTests,
  profiles,
  pushCampaigns,
  reports,
  reviews,
  seasonResults,
  session,
  user,
  userCosmetics,
  type CosmeticKind,
  type EventKind,
  type Undo,
} from '../lib/schema.js'
import { deleteObject, keyOf } from '../lib/storage.js'
import { getModeration } from './admin.js'

// The newer half of the admin panel: the inbox, the tables being played now, the
// player's file (notes, tags, related accounts), scheduled events, price tests, the
// team's roles, automations, undo and the calendar.

const DAY = 24 * 60 * 60 * 1000
const HOUR = 60 * 60 * 1000
const LIVE = 5 * 60 * 1000
const FEED_WINDOW = 2 * DAY
const FEED_LIMIT = 40
const TAG_MAX = 8
const NOTE_MAX = 1000
const DISMISSED_MAX = 300

async function readBody(request: Request): Promise<Record<string, unknown>> {
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null
  if (!body || typeof body !== 'object') throw new HttpError(400, 'Cuerpo no válido')
  return body
}

const handle = sql<string>`coalesce(${user.displayUsername}, ${user.username}, ${user.name})`

function usernames(ids: Iterable<string>): Map<string, string> {
  const list = [...new Set(ids)]
  if (!list.length) return new Map()
  return new Map(
    db()
      .select({ id: user.id, n: handle })
      .from(user)
      .where(inArray(user.id, list))
      .all()
      .map((row) => [row.id, row.n]),
  )
}

function playerId(value: unknown): string {
  if (typeof value !== 'string' || !value) throw new HttpError(400, 'Usuario no válido')
  if (!db().select({ id: user.id }).from(user).where(eq(user.id, value)).get()) throw new HttpError(404, 'No existe')
  return value
}

function numberId(value: unknown): number {
  if (typeof value !== 'number' || !Number.isInteger(value)) throw new HttpError(400, 'Id no válido')
  return value
}

// ── Inbox ───────────────────────────────────────────────────────────────────

type Level = 'high' | 'mid' | 'low'

interface InboxItem {
  key: string
  level: Level
  kind: 'flag' | 'report' | 'review' | 'shared' | 'poll' | 'campaign' | 'auto' | 'broke'
  at: number
  userId?: string | null
  username?: string | null
  ip?: string | null
  users?: { id: string; username: string }[]
  text?: string | null
  value?: number | null
  id?: number
}

function dismissed(): string[] {
  return getSetting<string[]>('inbox.dismissed') ?? []
}

// GET /api/admin/inbox: everything waiting for an admin, most urgent first.
export async function getInbox(request: Request): Promise<Response> {
  await requireAdmin(request)
  const now = Date.now()
  const d = db()
  const items: InboxItem[] = []
  const moderation = (await (await getModeration(request)).json()) as {
    flags: { level: 'high' | 'mid'; kind: string; userId: string | null; ip: string | null; value: number; username: string | null }[]
    clusters: { ip: string; since: number; users: { id: string; username: string }[] }[]
  }
  for (const flag of moderation.flags) {
    items.push({ key: `flag:${flag.kind}:${flag.userId ?? flag.ip}`, level: flag.level, kind: 'flag', at: now, userId: flag.userId, username: flag.username, ip: flag.ip, text: flag.kind, value: flag.value })
  }
  // Accounts on one connection that nobody has marked as the same person yet.
  const marks = new Map(d.select().from(playerMarks).all().map((row) => [row.userId, row]))
  for (const cluster of moderation.clusters) {
    const known = cluster.users.every((u) => cluster.users.every((o) => o.id === u.id || marks.get(u.id)?.hermanas.includes(o.id)))
    if (known) continue
    items.push({ key: `shared:${cluster.ip}:${cluster.users.length}`, level: 'mid', kind: 'shared', at: cluster.since, ip: cluster.ip, users: cluster.users })
  }
  for (const row of d
    .select({ id: reports.id, userId: reports.userId, texto: reports.texto, at: sql<number>`${reports.createdAt}` })
    .from(reports)
    .where(eq(reports.resuelto, false))
    .orderBy(desc(reports.createdAt))
    .limit(20)
    .all()) {
    items.push({ key: `report:${row.id}`, level: 'mid', kind: 'report', at: row.at, userId: row.userId, text: row.texto, id: row.id })
  }
  const queued = d.select({ n: sql<number>`count(*)`, at: sql<number>`min(${reviews.createdAt})` }).from(reviews).get()
  if (queued?.n) items.push({ key: `review:${queued.at}`, level: 'mid', kind: 'review', at: queued.at, value: queued.n })
  // Polls that ended in the last three days: their result.
  for (const poll of d
    .select({ id: polls.id, pregunta: polls.pregunta, opciones: polls.opciones, endsAt: sql<number>`${polls.endsAt}` })
    .from(polls)
    .where(and(isNotNull(polls.endsAt), lte(polls.endsAt, new Date(now)), gte(polls.endsAt, new Date(now - 3 * DAY))))
    .all()) {
    const votes = d.select({ opcion: pollVotes.opcion, n: sql<number>`count(*)` }).from(pollVotes).where(eq(pollVotes.pollId, poll.id)).groupBy(pollVotes.opcion).all()
    const best = votes.sort((a, b) => b.n - a.n)[0]
    items.push({
      key: `poll:${poll.id}`,
      level: 'low',
      kind: 'poll',
      at: poll.endsAt,
      id: poll.id,
      text: `${poll.pregunta} → ${best ? poll.opciones[best.opcion] : '—'}`,
      value: votes.reduce((sum, v) => sum + v.n, 0),
    })
  }
  for (const campaign of d
    .select({ id: pushCampaigns.id, titulo: pushCampaigns.titulo, fallidos: pushCampaigns.fallidos, at: sql<number>`${pushCampaigns.sentAt}` })
    .from(pushCampaigns)
    .where(and(isNotNull(pushCampaigns.sentAt), gte(pushCampaigns.sentAt, new Date(now - 3 * DAY)), sql`${pushCampaigns.fallidos} > 0`))
    .all()) {
    items.push({ key: `campaign:${campaign.id}`, level: 'low', kind: 'campaign', at: campaign.at, id: campaign.id, text: campaign.titulo, value: campaign.fallidos })
  }
  // What the automations did in the last day, to undo if it was wrong.
  for (const row of d
    .select({ id: adminLog.id, accion: adminLog.accion, objetivo: adminLog.objetivo, detalle: adminLog.detalle, deshecho: adminLog.deshecho, at: sql<number>`${adminLog.createdAt}` })
    .from(adminLog)
    .where(and(eq(adminLog.admin, 'auto'), gte(adminLog.createdAt, new Date(now - DAY))))
    .orderBy(desc(adminLog.id))
    .limit(20)
    .all()) {
    if (row.deshecho) continue
    items.push({ key: `auto:${row.id}`, level: 'low', kind: 'auto', at: row.at, id: row.id, text: row.accion, username: row.objetivo, value: null })
  }
  const names = usernames(items.flatMap((item) => (item.userId && !item.username ? [item.userId] : [])))
  const hidden = new Set(dismissed())
  const order: Record<Level, number> = { high: 0, mid: 1, low: 2 }
  return json(
    items
      .filter((item) => !hidden.has(item.key))
      .map((item) => ({ ...item, username: item.username ?? (item.userId ? (names.get(item.userId) ?? null) : null) }))
      .sort((a, b) => order[a.level] - order[b.level] || b.at - a.at),
  )
}

// POST /api/admin/inbox/dismiss { key }: out of the inbox (it comes back if it changes).
export async function dismissInbox(request: Request): Promise<Response> {
  await requireAdmin(request)
  const key = (await readBody(request)).key
  if (typeof key !== 'string' || key.length > 200) throw new HttpError(400, 'Clave no válida')
  setSetting('inbox.dismissed', [...dismissed().filter((k) => k !== key), key].slice(-DISMISSED_MAX))
  return json({ ok: true })
}

// ── Live tables and the feed ────────────────────────────────────────────────

// GET /api/admin/live: the hands being played now, as the player sees them (the hole card hidden).
export async function getLive(request: Request): Promise<Response> {
  await requireAdmin(request)
  const now = Date.now()
  const clock = leagueClock()
  const rows = db()
    .select({
      id: hands.id,
      userId: hands.userId,
      username: handle,
      nombre: profiles.nombre,
      avatarUrl: profiles.avatarUrl,
      bet: hands.apuesta,
      ronda: hands.ronda,
      startedAt: sql<number>`${hands.createdAt}`,
      updatedAt: sql<number>`${hands.updatedAt}`,
      chips: currentBalance(clock),
    })
    .from(hands)
    .innerJoin(user, eq(user.id, hands.userId))
    .innerJoin(profiles, eq(profiles.id, hands.userId))
    .where(and(ne(hands.fase, 'settled'), gte(hands.updatedAt, new Date(now - LIVE))))
    .orderBy(desc(hands.updatedAt))
    .all()
  // Today's busiest five minutes, by players at the table.
  const today = madridMidnight(clock.today).getTime()
  const buckets = new Map<number, Set<string>>()
  for (const row of db()
    .select({ userId: hands.userId, at: sql<number>`${hands.createdAt}` })
    .from(hands)
    .where(gte(hands.createdAt, new Date(today)))
    .all()) {
    const bucket = Math.floor(row.at / (5 * 60 * 1000))
    const set = buckets.get(bucket) ?? new Set()
    set.add(row.userId)
    buckets.set(bucket, set)
  }
  let peak = 0
  let peakAt: number | null = null
  for (const [bucket, set] of buckets)
    if (set.size > peak) {
      peak = set.size
      peakAt = bucket * 5 * 60 * 1000
    }
  return json({
    now,
    peak,
    peakAt,
    tables: rows.map(({ ronda, chips, ...row }) => ({ ...row, view: toPublicView(ronda, chips) })),
  })
}

// GET /api/admin/feed: what has just happened, newest first.
export async function getFeed(request: Request): Promise<Response> {
  await requireAdmin(request)
  const since = new Date(Date.now() - FEED_WINDOW)
  const d = db()
  type Entry = { kind: string; at: number; userId: string | null; text?: string | null; value?: number | null }
  const entries: Entry[] = []
  for (const row of d.select({ id: user.id, at: sql<number>`${user.createdAt}` }).from(user).where(gte(user.createdAt, since)).all())
    entries.push({ kind: 'signup', at: row.at, userId: row.id })
  for (const row of d
    .select({ userId: hands.userId, at: sql<number>`${hands.updatedAt}`, net: hands.neto, bj: sql<number>`json_extract(${hands.ronda}, '$.settlement.hands[0].outcome') = 'blackjack'` })
    .from(hands)
    .where(and(eq(hands.fase, 'settled'), gte(hands.updatedAt, since), or(gte(hands.neto, 500), sql`json_extract(${hands.ronda}, '$.settlement.hands[0].outcome') = 'blackjack'`)))
    .orderBy(desc(hands.updatedAt))
    .limit(FEED_LIMIT)
    .all())
    entries.push({ kind: row.bj ? 'blackjack' : 'bigWin', at: row.at, userId: row.userId, value: row.net })
  for (const row of d
    .select({ userId: userCosmetics.userId, estilo: userCosmetics.estilo, monedas: userCosmetics.monedas, at: sql<number>`${userCosmetics.createdAt}` })
    .from(userCosmetics)
    .where(gte(userCosmetics.createdAt, since))
    .all())
    entries.push({ kind: 'purchase', at: row.at, userId: row.userId, text: row.estilo, value: row.monedas })
  for (const row of d
    .select({ userId: achievements.userId, logro: achievements.logro, at: sql<number>`${achievements.createdAt}` })
    .from(achievements)
    .where(gte(achievements.createdAt, since))
    .all())
    entries.push({ kind: 'achievement', at: row.at, userId: row.userId, text: row.logro })
  for (const row of d
    .select({ userId: dailyRuns.userId, fichas: dailyRuns.fichas, at: sql<number>`${dailyRuns.terminada}` })
    .from(dailyRuns)
    .where(gte(dailyRuns.terminada, since))
    .all())
    entries.push({ kind: 'daily', at: row.at, userId: row.userId, value: row.fichas })
  for (const row of d
    .select({ admin: adminLog.admin, accion: adminLog.accion, objetivo: adminLog.objetivo, at: sql<number>`${adminLog.createdAt}` })
    .from(adminLog)
    .where(gte(adminLog.createdAt, since))
    .orderBy(desc(adminLog.id))
    .limit(FEED_LIMIT)
    .all())
    entries.push({ kind: 'admin', at: row.at, userId: null, text: `${row.admin} · ${row.accion}${row.objetivo ? ` · ${row.objetivo}` : ''}` })
  entries.sort((a, b) => b.at - a.at)
  const shown = entries.slice(0, FEED_LIMIT)
  const names = usernames(shown.flatMap((e) => (e.userId ? [e.userId] : [])))
  return json(shown.map((e) => ({ ...e, username: e.userId ? (names.get(e.userId) ?? null) : null })))
}

// ── The player's file: notes, tags, siblings, silence ───────────────────────

export function marksOf(userId: string) {
  const row = db().select().from(playerMarks).where(eq(playerMarks.userId, userId)).get()
  return {
    etiquetas: row?.etiquetas ?? [],
    hermanas: row?.hermanas ?? [],
    silenciadoHasta: row?.silenciadoHasta?.getTime() ?? null,
  }
}

export function saveMarks(userId: string, next: { etiquetas: string[]; hermanas: string[]; silenciadoHasta: number | null }) {
  const values = { etiquetas: next.etiquetas, hermanas: next.hermanas, silenciadoHasta: next.silenciadoHasta ? new Date(next.silenciadoHasta) : null }
  db()
    .insert(playerMarks)
    .values({ userId, ...values })
    .onConflictDoUpdate({ target: playerMarks.userId, set: { ...values, updatedAt: new Date() } })
    .run()
}

/** Marks two or more accounts as the same person, on every side. */
export function linkSiblings(ids: string[], linked = true) {
  for (const id of ids) {
    const marks = marksOf(id)
    const others = ids.filter((other) => other !== id)
    const hermanas = linked ? [...new Set([...marks.hermanas, ...others])] : marks.hermanas.filter((h) => !others.includes(h))
    saveMarks(id, { ...marks, hermanas })
  }
}

// POST /api/admin/marks { userId, etiquetas?, silenceHours?, siblings?: { ids, linked } }
export async function postMarks(request: Request): Promise<Response> {
  const body = await readBody(request)
  const me = await requireAdmin(request, (body.etiquetas !== undefined || body.addTags !== undefined) && Object.keys(body).length === 2 ? 'soporte' : 'moderador')
  const id = playerId(body.userId)
  const before = marksOf(id)
  const target = `@${usernames([id]).get(id)}`
  const next = { ...before }
  // addTags: added to the ones they already have (the inbox marks a whole connection at once).
  if (Array.isArray(body.addTags) && body.etiquetas === undefined) body.etiquetas = [...before.etiquetas, ...(body.addTags as unknown[])]
  if (body.etiquetas !== undefined) {
    if (!Array.isArray(body.etiquetas) || body.etiquetas.some((t) => typeof t !== 'string' || !t.trim() || t.length > 20)) throw new HttpError(400, 'Etiquetas no válidas')
    next.etiquetas = [...new Set((body.etiquetas as string[]).map((t) => t.trim().toUpperCase()))].slice(0, TAG_MAX)
    logAction(me, 'tags', target, next.etiquetas.join(', ') || '—', { kind: 'marks', userId: id, ...before })
  }
  if (body.silenceHours !== undefined) {
    const hours = body.silenceHours
    if (typeof hours !== 'number' || hours < 0 || hours > 24 * 365) throw new HttpError(400, 'Horas no válidas')
    next.silenciadoHasta = hours === 0 ? null : Date.now() + hours * HOUR
    logAction(me, hours === 0 ? 'unsilence' : 'silence', target, hours ? `${hours} h` : null, { kind: 'marks', userId: id, ...before })
  }
  saveMarks(id, next)
  if (body.siblings !== undefined) {
    const s = body.siblings as { ids?: unknown; linked?: unknown }
    if (!Array.isArray(s.ids) || s.ids.some((x) => typeof x !== 'string')) throw new HttpError(400, 'Cuentas no válidas')
    const ids = [...new Set([id, ...(s.ids as string[]).map(playerId)])]
    linkSiblings(ids, s.linked !== false)
    logAction(me, s.linked === false ? 'unlink_siblings' : 'link_siblings', target, [...usernames(ids).values()].map((n) => `@${n}`).join(' '))
  }
  return json({ ok: true, marks: marksOf(id) })
}

// POST /api/admin/notes { userId, texto }: a note for the other admins.
export async function postNote(request: Request): Promise<Response> {
  const me = await requireAdmin(request)
  const body = await readBody(request)
  const id = playerId(body.userId)
  const texto = typeof body.texto === 'string' ? body.texto.trim() : ''
  if (!texto || texto.length > NOTE_MAX) throw new HttpError(400, 'Nota no válida')
  db().insert(adminNotes).values({ userId: id, admin: me.name, texto }).run()
  return json({ ok: true })
}

// POST /api/admin/notes/delete { id }: only your own, unless you're an owner.
export async function deleteNote(request: Request): Promise<Response> {
  const me = await requireAdmin(request)
  const id = numberId((await readBody(request)).id)
  const note = db().select().from(adminNotes).where(eq(adminNotes.id, id)).get()
  if (!note) throw new HttpError(404, 'No existe')
  if (note.admin !== me.name && me.role !== 'dueno') throw new HttpError(403, 'Solo puedes borrar tus notas')
  db().delete(adminNotes).where(eq(adminNotes.id, id)).run()
  return json({ ok: true })
}

// POST /api/admin/users/sessions { userId }: signs the player out everywhere.
export async function closeSessions(request: Request): Promise<Response> {
  const me = await requireAdmin(request, 'moderador')
  const id = playerId((await readBody(request)).userId)
  const closed = db().delete(session).where(eq(session.userId, id)).returning({ id: session.id }).all().length
  logAction(me, 'close_sessions', `@${usernames([id]).get(id)}`, String(closed))
  return json({ ok: true, closed })
}

// POST /api/admin/users/reset-week { userId }: starts the player's league week over,
// as if they had not played it: their hands, pay and chip corrections go, and the
// balance is back at the start. For testing on a real account.
export async function resetWeek(request: Request): Promise<Response> {
  const me = await requireAdmin(request, 'dueno')
  const id = playerId((await readBody(request)).userId)
  const c = leagueClock()
  const { startBalance } = rulesFor(c.weekStart)
  const removed = db().transaction((tx) => {
    rollover(tx, id, c)
    const gone = tx
      .delete(hands)
      .where(and(eq(hands.userId, id), eq(hands.modo, 'liga'), gte(hands.createdAt, c.weekBegin)))
      .returning({ id: hands.id })
      .all().length
    tx.delete(pays).where(and(eq(pays.userId, id), gte(pays.createdAt, c.weekBegin))).run()
    tx.delete(adjustments)
      .where(and(eq(adjustments.userId, id), eq(adjustments.tipo, 'saldo'), gte(adjustments.createdAt, c.weekBegin)))
      .run()
    tx.update(profiles)
      .set({ saldo: startBalance, saldoInicioDia: startBalance, ultimaPaga: null, semana: c.weekStart, dia: c.today })
      .where(eq(profiles.id, id))
      .run()
    return gone
  })
  notifyGroups([id])
  logAction(me, 'reset_week', `@${usernames([id]).get(id)}`, String(removed))
  return json({ ok: true, removed })
}

// POST /api/admin/users/avatar { userId }: takes the photo down (back to initials).
export async function removeAvatar(request: Request): Promise<Response> {
  const me = await requireAdmin(request, 'moderador')
  const id = playerId((await readBody(request)).userId)
  const row = db().select({ avatarUrl: profiles.avatarUrl }).from(profiles).where(eq(profiles.id, id)).get()
  if (!row?.avatarUrl) throw new HttpError(400, 'No tiene foto')
  db().update(profiles).set({ avatarUrl: null }).where(eq(profiles.id, id)).run()
  db().delete(reviews).where(and(eq(reviews.userId, id), eq(reviews.tipo, 'foto'))).run()
  const key = keyOf(row.avatarUrl)
  if (key) deleteObject(key)
  notifyGroups([id])
  logAction(me, 'remove_avatar', `@${usernames([id]).get(id)}`)
  return json({ ok: true })
}

/** For the file: tags, siblings, notes and everything that happened to the player, newest first. */
export function playerExtras(id: string) {
  const d = db()
  const marks = marksOf(id)
  const names = usernames(marks.hermanas)
  const notes = d
    .select({ id: adminNotes.id, admin: adminNotes.admin, texto: adminNotes.texto, createdAt: sql<number>`${adminNotes.createdAt}` })
    .from(adminNotes)
    .where(eq(adminNotes.userId, id))
    .orderBy(desc(adminNotes.id))
    .all()
  const username = usernames([id]).get(id) ?? '?'
  type Event = { kind: string; at: number; text?: string | null; value?: number | null; by?: string | null }
  const history: Event[] = []
  const created = d.select({ at: sql<number>`${user.createdAt}` }).from(user).where(eq(user.id, id)).get()
  if (created) history.push({ kind: 'signup', at: created.at })
  for (const row of d.select({ at: sql<number>`${userCosmetics.createdAt}`, estilo: userCosmetics.estilo, monedas: userCosmetics.monedas }).from(userCosmetics).where(eq(userCosmetics.userId, id)).all())
    history.push({ kind: 'purchase', at: row.at, text: row.estilo, value: row.monedas })
  for (const row of d.select({ at: sql<number>`${achievements.createdAt}`, logro: achievements.logro }).from(achievements).where(eq(achievements.userId, id)).all())
    history.push({ kind: 'achievement', at: row.at, text: row.logro })
  for (const row of d.select({ at: sql<number>`${groupMembers.createdAt}`, nombre: groups.nombre }).from(groupMembers).innerJoin(groups, eq(groups.id, groupMembers.groupId)).where(eq(groupMembers.userId, id)).all())
    history.push({ kind: 'group', at: row.at, text: row.nombre })
  for (const row of d
    .select({ at: sql<number>`${adminLog.createdAt}`, accion: adminLog.accion, detalle: adminLog.detalle, admin: adminLog.admin })
    .from(adminLog)
    .where(eq(adminLog.objetivo, `@${username}`))
    .orderBy(desc(adminLog.id))
    .limit(30)
    .all())
    history.push({ kind: 'admin', at: row.at, text: row.accion, by: row.admin, value: null, ...(row.detalle ? { detail: row.detalle } : {}) })
  history.sort((a, b) => b.at - a.at)
  return {
    marks: { ...marks, hermanas: marks.hermanas.map((h) => ({ id: h, username: names.get(h) ?? '?' })) },
    notes,
    history: history.slice(0, 40),
  }
}

// ── Scheduled events ────────────────────────────────────────────────────────

function eventRows(from: number, to: number) {
  return db()
    .select({
      id: adminEvents.id,
      tipo: adminEvents.tipo,
      titulo: adminEvents.titulo,
      inicio: sql<number>`${adminEvents.inicio}`,
      fin: sql<number | null>`${adminEvents.fin}`,
      valor: adminEvents.valor,
      detalle: adminEvents.detalle,
      por: adminEvents.por,
    })
    .from(adminEvents)
    .where(and(lte(adminEvents.inicio, new Date(to)), or(isNull(adminEvents.fin), gte(adminEvents.fin, new Date(from)))))
    .orderBy(adminEvents.inicio)
    .all()
}

// GET /api/admin/events: what's on and what's coming (and the last month's).
export async function getEvents(request: Request): Promise<Response> {
  await requireAdmin(request)
  const now = Date.now()
  return json(eventRows(now - 30 * DAY, now + 365 * DAY))
}

// POST /api/admin/events { tipo, titulo, inicio, fin?, valor?, detalle? }
export async function postEvent(request: Request): Promise<Response> {
  const me = await requireAdmin(request, 'dueno')
  const body = await readBody(request)
  if (!EVENT_KINDS.includes(body.tipo as EventKind)) throw new HttpError(400, 'Tipo no válido')
  const tipo = body.tipo as EventKind
  const titulo = typeof body.titulo === 'string' ? body.titulo.trim() : ''
  if (titulo.length < 2 || titulo.length > 80) throw new HttpError(400, 'Falta el título')
  if (typeof body.inicio !== 'number') throw new HttpError(400, 'Falta cuándo empieza')
  const inicio = body.inicio
  const fin = typeof body.fin === 'number' ? body.fin : null
  if (fin !== null && fin <= inicio) throw new HttpError(400, 'Termina antes de empezar')
  if (tipo !== 'precios' && tipo !== 'tematico' && fin === null) throw new HttpError(400, 'Falta cuándo termina')
  const ranges: Record<EventKind, [number, number] | null> = { doble_paga: [2, 5], rebajas: [1, 90], precios: [20, 500], tematico: null }
  const range = ranges[tipo]
  let valor: number | null = null
  if (range) {
    valor = typeof body.valor === 'number' && Number.isInteger(body.valor) ? body.valor : NaN
    if (!(valor >= range[0] && valor <= range[1])) throw new HttpError(400, 'Valor no válido')
  }
  const detalle = tipo === 'rebajas' && COSMETIC_KINDS.includes(body.detalle as CosmeticKind) ? (body.detalle as string) : null
  const row = db()
    .insert(adminEvents)
    .values({ tipo, titulo, inicio: new Date(inicio), fin: fin ? new Date(fin) : null, valor, detalle, por: me.name })
    .returning({ id: adminEvents.id })
    .get()
  forgetSchedule()
  logAction(me, 'event', titulo, `${tipo}${valor !== null ? ` · ${valor}` : ''}`, { kind: 'deleteEvent', id: row.id })
  return json({ ok: true, id: row.id })
}

// POST /api/admin/events/delete { id }
export async function deleteEvent(request: Request): Promise<Response> {
  const me = await requireAdmin(request, 'dueno')
  const id = numberId((await readBody(request)).id)
  const row = db().delete(adminEvents).where(eq(adminEvents.id, id)).returning({ titulo: adminEvents.titulo }).get()
  if (!row) throw new HttpError(404, 'No existe')
  forgetSchedule()
  logAction(me, 'event_delete', row.titulo)
  return json({ ok: true })
}

// ── Price tests ─────────────────────────────────────────────────────────────

// GET /api/admin/tests: every price test with how each half bought.
export async function getTests(request: Request): Promise<Response> {
  await requireAdmin(request)
  const d = db()
  const now = Date.now()
  const prices = new Map(catalogue().map((l) => [l.cosmetic.id, l.source.from === 'tienda' ? l.source.precio : null]))
  const tests = d.select().from(priceTests).orderBy(desc(priceTests.id)).limit(20).all()
  return json(
    tests.map((test) => {
      const from = test.inicio
      const to = test.fin ?? new Date(now)
      // Who could have seen it: everyone who played while it ran.
      const players = d
        .selectDistinct({ id: hands.userId })
        .from(hands)
        .where(and(gte(hands.createdAt, from), lte(hands.createdAt, to)))
        .all()
      const buyers = d
        .select({ userId: userCosmetics.userId, monedas: userCosmetics.monedas })
        .from(userCosmetics)
        .where(and(eq(userCosmetics.estilo, test.estilo), gte(userCosmetics.createdAt, from), lte(userCosmetics.createdAt, to)))
        .all()
      const groupOf = (id: string) => testGroup(id, test.id)
      const half = (g: 'A' | 'B') => {
        const seen = players.filter((p) => groupOf(p.id) === g).length
        const bought = buyers.filter((b) => groupOf(b.userId) === g)
        return { players: seen, buyers: bought.length, coins: bought.reduce((sum, b) => sum + b.monedas, 0) }
      }
      return {
        id: test.id,
        estilo: test.estilo,
        precioA: prices.get(test.estilo) ?? null,
        precioB: test.precioB,
        inicio: test.inicio.getTime(),
        fin: test.fin?.getTime() ?? null,
        por: test.por,
        a: half('A'),
        b: half('B'),
      }
    }),
  )
}

// POST /api/admin/tests { estilo, precioB }: half the players see precioB from now on.
export async function postTest(request: Request): Promise<Response> {
  const me = await requireAdmin(request, 'dueno')
  const body = await readBody(request)
  const cosmetic = COSMETICS.find((c) => c.id === body.estilo)
  if (!cosmetic || cosmetic.source.from !== 'tienda') throw new HttpError(400, 'Ese estilo no se vende')
  const precioB = body.precioB
  if (typeof precioB !== 'number' || !Number.isInteger(precioB) || precioB < 1 || precioB > 1_000_000) throw new HttpError(400, 'Precio no válido')
  const d = db()
  if (d.select({ id: priceTests.id }).from(priceTests).where(and(eq(priceTests.estilo, cosmetic.id), isNull(priceTests.fin))).get())
    throw new HttpError(409, 'Ese estilo ya tiene un test en marcha')
  const row = d.insert(priceTests).values({ estilo: cosmetic.id, precioB, inicio: new Date(), por: me.name }).returning({ id: priceTests.id }).get()
  forgetSchedule()
  logAction(me, 'price_test', cosmetic.id, `B: ${precioB}`, { kind: 'deleteTest', id: row.id })
  return json({ ok: true })
}

// POST /api/admin/tests/end { id }
export async function endTest(request: Request): Promise<Response> {
  const me = await requireAdmin(request, 'dueno')
  const id = numberId((await readBody(request)).id)
  const row = db().update(priceTests).set({ fin: new Date() }).where(and(eq(priceTests.id, id), isNull(priceTests.fin))).returning({ estilo: priceTests.estilo }).get()
  if (!row) throw new HttpError(404, 'No existe o ya terminó')
  forgetSchedule()
  logAction(me, 'price_test_end', row.estilo)
  return json({ ok: true })
}

// ── Team, automations, undo ─────────────────────────────────────────────────

// GET /api/admin/team: who runs the app and with what role.
export async function getTeam(request: Request): Promise<Response> {
  const me = await requireAdmin(request)
  const staff = staffRoles()
  return json({
    me: me.role,
    owners: ownerNames(),
    staff: Object.entries(staff).map(([username, role]) => ({ username, role })),
  })
}

// POST /api/admin/team { username, role }: null takes them off the team.
export async function postTeam(request: Request): Promise<Response> {
  const me = await requireAdmin(request, 'dueno')
  const body = await readBody(request)
  const username = typeof body.username === 'string' ? body.username.trim().replace(/^@/, '').toLowerCase() : ''
  if (!username) throw new HttpError(400, 'Falta el usuario')
  if (!db().select({ id: user.id }).from(user).where(eq(user.username, username)).get()) throw new HttpError(404, 'No existe ese usuario')
  if (roleOfName(username) === 'dueno') throw new HttpError(400, 'Los dueños se cambian en el servidor')
  const role = body.role === null ? null : (body.role as Role)
  if (role !== null && (!ROLES.includes(role) || role === 'dueno')) throw new HttpError(400, 'Rol no válido')
  const before = getSetting('roles') ?? null
  const next = { ...staffRoles() }
  if (role) next[username] = role
  else delete next[username]
  setSetting('roles', next)
  logAction(me, 'role', `@${username}`, role ?? 'fuera', { kind: 'setting', key: 'roles', value: before })
  return json({ ok: true })
}

// GET /api/admin/automations: the rules, whether each is on, and what they've done this week.
export async function getAutomations(request: Request): Promise<Response> {
  await requireAdmin(request)
  const on = automationSettings()
  const since = new Date(Date.now() - 7 * DAY)
  const runs = new Map(
    db()
      .select({ accion: adminLog.accion, n: sql<number>`count(*)`, last: sql<number>`max(${adminLog.createdAt})` })
      .from(adminLog)
      .where(and(eq(adminLog.admin, 'auto'), gte(adminLog.createdAt, since)))
      .groupBy(adminLog.accion)
      .all()
      .map((row) => [row.accion, row]),
  )
  return json({
    rules: AUTOMATIONS.map((id) => ({ id, on: on[id], runs: runs.get(`auto_${id}`)?.n ?? 0, last: runs.get(`auto_${id}`)?.last ?? null })),
    weeklyReport: weeklyReportSettings(),
  })
}

// POST /api/admin/automations { id, on } (id 'weeklyReport' for the Monday summary)
export async function postAutomation(request: Request): Promise<Response> {
  const me = await requireAdmin(request, 'dueno')
  const body = await readBody(request)
  if (typeof body.on !== 'boolean') throw new HttpError(400, 'Valor no válido')
  if (body.id === 'weeklyReport') {
    const before = getSetting('weeklyReport') ?? null
    setSetting('weeklyReport', { ...weeklyReportSettings(), on: body.on })
    logAction(me, body.on ? 'automation_on' : 'automation_off', 'weeklyReport', null, { kind: 'setting', key: 'weeklyReport', value: before })
    return json({ ok: true })
  }
  if (!AUTOMATIONS.includes(body.id as (typeof AUTOMATIONS)[number])) throw new HttpError(400, 'Regla no válida')
  const before = getSetting('automations') ?? null
  setSetting('automations', { ...automationSettings(), [body.id as string]: body.on })
  logAction(me, body.on ? 'automation_on' : 'automation_off', String(body.id), null, { kind: 'setting', key: 'automations', value: before })
  return json({ ok: true })
}

/** Puts back what a log entry changed. Throws if it can't any more. */
function applyUndo(undo: Undo) {
  const d = db()
  switch (undo.kind) {
    case 'adjust': {
      d.transaction((tx) => {
        rollover(tx, undo.userId)
        const row = tx.select({ saldo: profiles.saldo, monedas: profiles.monedas }).from(profiles).where(eq(profiles.id, undo.userId)).get()
        if (!row) throw new HttpError(404, 'El jugador ya no existe')
        const change = -undo.cantidad
        if (row[undo.tipo] + change < 0) throw new HttpError(409, 'Ya lo ha gastado: se quedaría en negativo')
        if (undo.tipo === 'saldo')
          tx.update(profiles)
            .set({ saldo: sql`${profiles.saldo} + ${change}`, saldoInicioDia: sql`max(0, ${profiles.saldoInicioDia} + ${change})` })
            .where(eq(profiles.id, undo.userId))
            .run()
        else tx.update(profiles).set({ monedas: sql`${profiles.monedas} + ${change}` }).where(eq(profiles.id, undo.userId)).run()
        tx.insert(adjustments).values({ userId: undo.userId, tipo: undo.tipo, cantidad: change, motivo: 'Deshecho desde el registro', por: 'deshacer' }).run()
      })
      notifyGroups([undo.userId])
      return
    }
    case 'unban':
      if (undo.ips.length) d.delete(ipBans).where(inArray(ipBans.ip, undo.ips)).run()
      forgetBans()
      return
    case 'setting':
      setSetting(undo.key, undo.value)
      forgetSchedule()
      return
    case 'marks':
      saveMarks(undo.userId, undo)
      return
    case 'deleteEvent':
      d.delete(adminEvents).where(eq(adminEvents.id, undo.id)).run()
      forgetSchedule()
      return
    case 'deleteTest':
      d.delete(priceTests).where(eq(priceTests.id, undo.id)).run()
      forgetSchedule()
      return
  }
}

// POST /api/admin/log/undo { id }: puts back what that entry changed, once.
export async function undoLog(request: Request): Promise<Response> {
  const me = await requireAdmin(request, 'moderador')
  const id = numberId((await readBody(request)).id)
  const row = db().select().from(adminLog).where(eq(adminLog.id, id)).get()
  if (!row?.deshacer) throw new HttpError(400, 'Eso no se puede deshacer')
  if (row.deshecho) throw new HttpError(409, 'Ya está deshecho')
  if (me.role !== 'dueno' && row.deshacer.kind === 'setting') throw new HttpError(403, 'Tu rol no puede deshacer eso')
  applyUndo(row.deshacer)
  db().update(adminLog).set({ deshecho: true }).where(eq(adminLog.id, id)).run()
  logAction(me, 'undo', row.objetivo, row.accion)
  return json({ ok: true })
}

// ── Calendar ────────────────────────────────────────────────────────────────

// GET /api/admin/calendar?from=&to= (ms): events, notices, polls, pushes, tests and the weeks closing.
export async function getCalendar(request: Request): Promise<Response> {
  await requireAdmin(request)
  const params = new URL(request.url).searchParams
  const from = Number(params.get('from'))
  const to = Number(params.get('to'))
  if (!Number.isFinite(from) || !Number.isFinite(to) || to <= from || to - from > 100 * DAY) throw new HttpError(400, 'Fechas no válidas')
  const d = db()
  const a = new Date(from)
  const b = new Date(to)
  type Item = { kind: string; at: number; end?: number | null; title: string; id?: number }
  const items: Item[] = eventRows(from, to).map((e) => ({ kind: `event:${e.tipo}`, at: e.inicio, end: e.fin, title: e.titulo, id: e.id }))
  for (const n of d
    .select({ id: notices.id, texto: notices.texto, at: sql<number>`${notices.startsAt}`, end: sql<number | null>`${notices.expiresAt}` })
    .from(notices)
    .where(and(lte(notices.startsAt, b), or(isNull(notices.expiresAt), gte(notices.expiresAt, a))))
    .all())
    items.push({ kind: 'notice', at: n.at, end: n.end, title: n.texto, id: n.id })
  for (const p of d
    .select({ id: polls.id, pregunta: polls.pregunta, at: sql<number>`${polls.endsAt}` })
    .from(polls)
    .where(and(gte(polls.endsAt, a), lte(polls.endsAt, b)))
    .all())
    items.push({ kind: 'pollEnd', at: p.at, title: p.pregunta, id: p.id })
  for (const c of d
    .select({ id: pushCampaigns.id, titulo: pushCampaigns.titulo, at: sql<number>`${pushCampaigns.sendAt}` })
    .from(pushCampaigns)
    .where(and(gte(pushCampaigns.sendAt, a), lte(pushCampaigns.sendAt, b)))
    .all())
    items.push({ kind: 'push', at: c.at, title: c.titulo, id: c.id })
  for (const t of d
    .select({ id: priceTests.id, estilo: priceTests.estilo, at: sql<number>`${priceTests.inicio}`, end: sql<number | null>`${priceTests.fin}` })
    .from(priceTests)
    .where(and(lte(priceTests.inicio, b), or(isNull(priceTests.fin), gte(priceTests.fin, a))))
    .all())
    items.push({ kind: 'test', at: t.at, end: t.end, title: t.estilo, id: t.id })
  // Every Monday at midnight the week closes; the weekly report goes at 9.
  const clock = leagueClock()
  for (let week = addDays(clock.weekStart, -35); madridMidnight(week).getTime() <= to; week = addDays(week, 7)) {
    const at = madridMidnight(week).getTime()
    if (at >= from) items.push({ kind: 'weekClose', at, title: week })
    const report = madridAt(week, 9).getTime()
    if (weeklyReportSettings().on && report >= from && report <= to) items.push({ kind: 'weeklyReport', at: report, title: week })
  }
  return json(items.sort((x, y) => x.at - y.at))
}

// ── View as player ──────────────────────────────────────────────────────────

// GET /api/admin/users/view?id=: what the player sees on their home screen, read-only.
export async function viewAsPlayer(request: Request): Promise<Response> {
  await requireAdmin(request)
  const id = playerId(new URL(request.url).searchParams.get('id'))
  const clock = leagueClock()
  const d = db()
  const profile = d
    .select({
      nombre: profiles.nombre,
      avatarUrl: profiles.avatarUrl,
      monedas: profiles.monedas,
      estilos: profiles.estilosEquipados,
      saldo: currentBalance(clock),
      ultimaPaga: profiles.ultimaPaga,
      username: handle,
    })
    .from(profiles)
    .innerJoin(user, eq(user.id, profiles.id))
    .where(eq(profiles.id, id))
    .get()
  if (!profile) throw new HttpError(404, 'Aún no ha abierto la app')
  const theirGroups = d
    .select({ id: groups.id, nombre: groups.nombre, members: sql<number>`(select count(*) from group_members m where m.group_id = ${groups.id})` })
    .from(groupMembers)
    .innerJoin(groups, eq(groups.id, groupMembers.groupId))
    .where(eq(groupMembers.userId, id))
    .all()
  const owned = d.transaction((tx) => ownedCosmetics(tx, id))
  const listed = catalogue(undefined, id).filter((l) => l.source.from === 'tienda' && !l.retirado)
  const unlocked = new Set(d.select({ logro: achievements.logro }).from(achievements).where(eq(achievements.userId, id)).all().map((r) => r.logro))
  const today = clock.today
  const daily = d.select({ fichas: dailyRuns.fichas, terminada: dailyRuns.terminada }).from(dailyRuns).where(and(eq(dailyRuns.userId, id), eq(dailyRuns.dia, today))).get()
  return json({
    ...profile,
    estilos: equipped(profile.estilos),
    payPending: profile.ultimaPaga !== today,
    groups: theirGroups,
    challenges: playerChallenges(id).challenges,
    shop: { owned: listed.filter((l) => owned.has(l.cosmetic.id)).length, total: listed.length },
    achievements: { unlocked: unlocked.size, total: ACHIEVEMENTS.length },
    daily: daily ? { fichas: daily.fichas, done: daily.terminada !== null } : null,
  })
}

// ── Coins: where they come from and where they go ───────────────────────────

// GET /api/admin/economy/flow: coins in and out this week and the one before, and what an active player earns.
export async function getCoinFlow(request: Request): Promise<Response> {
  await requireAdmin(request)
  const d = db()
  const clock = leagueClock()
  const weeks = [clock.weekStart, addDays(clock.weekStart, -7)]
  const flow = weeks.map((week) => {
    const a = madridMidnight(week)
    const b = madridMidnight(addDays(week, 7))
    const between = <T extends { createdAt: unknown }>(col: T['createdAt']) => and(gte(col as never, a), lte(col as never, b))
    const sum = (n: { n: number } | undefined) => n?.n ?? 0
    const challenges = sum(d.select({ n: sql<number>`coalesce(sum(${challengeCompletions.monedas}), 0)` }).from(challengeCompletions).where(between(challengeCompletions.createdAt)).get())
    const daily = sum(d.select({ n: sql<number>`coalesce(sum(${dailyRuns.premio}), 0)` }).from(dailyRuns).where(and(gte(dailyRuns.dia, week), lte(dailyRuns.dia, addDays(week, 6)))).get())
    const rewards = new Map(ACHIEVEMENTS.map((x) => [x.id as string, 'coins' in x.reward ? x.reward.coins : 0]))
    const achievementCoins = d
      .select({ logro: achievements.logro })
      .from(achievements)
      .where(between(achievements.createdAt))
      .all()
      .reduce((total, row) => total + (rewards.get(row.logro) ?? 0), 0)
    // Prizes for the week before, given out on this one's Monday.
    const season = sum(d.select({ n: sql<number>`coalesce(sum(${seasonResults.monedas}), 0)` }).from(seasonResults).where(eq(seasonResults.semana, addDays(week, -7))).get())
    const admin = sum(
      d.select({ n: sql<number>`coalesce(sum(${adjustments.cantidad}), 0)` }).from(adjustments).where(and(eq(adjustments.tipo, 'monedas'), between(adjustments.createdAt))).get(),
    )
    const shop = sum(d.select({ n: sql<number>`coalesce(sum(${userCosmetics.monedas}), 0)` }).from(userCosmetics).where(between(userCosmetics.createdAt)).get())
    return { week, in: { challenges, daily, achievements: achievementCoins, season, admin }, out: { shop } }
  })
  // What an active player earns a day: this week's coins in, over the days played by someone.
  const since = new Date(Date.now() - 7 * DAY)
  const activeDays =
    d.select({ n: sql<number>`count(distinct ${hands.userId} || '·' || date(${hands.createdAt} / 1000, 'unixepoch'))` }).from(hands).where(gte(hands.createdAt, since)).get()?.n ?? 0
  const active = d.select({ n: sql<number>`count(distinct ${hands.userId})` }).from(hands).where(gte(hands.createdAt, since)).get()?.n ?? 0
  const earnedWeek = Object.values(flow[0].in).reduce((s, n) => s + Math.max(0, n), 0)
  const shopStyles = catalogue().filter((l) => l.source.from === 'tienda')
  // The styles on sale; with none on sale yet, every shop style at the price it would have.
  const onSale = shopStyles.filter((l) => !l.retirado)
  const prices = (onSale.length ? onSale : shopStyles).map((l) => (l.source.from === 'tienda' ? l.source.precio : 0))
  const broke = d.select({ n: sql<number>`count(*)` }).from(profiles).where(and(eq(profiles.semana, clock.weekStart), eq(profiles.saldo, 0))).get()?.n ?? 0
  return json({
    flow,
    active,
    coinsPerActiveDay: activeDays ? Math.round(earnedWeek / activeDays) : 0,
    averagePrice: prices.length ? Math.round(prices.reduce((s, n) => s + n, 0) / prices.length) : 0,
    broke,
    nextWeek: addDays(clock.weekStart, 7),
    nextWeekAt: madridMidnight(addDays(clock.weekStart, 7)).getTime(),
  })
}

/** Silences that ran out stay in the row; this is just who is silenced now, for the lists. */
export function silencedNow(): Set<string> {
  return new Set(
    db()
      .select({ id: playerMarks.userId })
      .from(playerMarks)
      .where(gte(playerMarks.silenciadoHasta, new Date()))
      .all()
      .map((row) => row.id),
  )
}

/** The player's last chat messages, for context when moderating. */
export function lastMessages(userId: string, limit = 5) {
  return db()
    .select({ texto: messages.texto, at: sql<number>`${messages.createdAt}`, global: sql<boolean>`${messages.groupId} is null` })
    .from(messages)
    .where(and(eq(messages.userId, userId), isNotNull(messages.texto)))
    .orderBy(desc(messages.createdAt))
    .limit(limit)
    .all()
}

// ── Saved segments ──────────────────────────────────────────────────────────

interface SavedSegment {
  id: string
  name: string
  segment?: string | null
  tag?: string | null
  q?: string | null
}

// GET /api/admin/segments: the lists of players an admin saved.
export async function getSegments(request: Request): Promise<Response> {
  await requireAdmin(request)
  return json(getSetting<SavedSegment[]>('segments') ?? [])
}

// POST /api/admin/segments { name, segment?, tag?, q? } to save one, or { id, delete: true }.
export async function postSegment(request: Request): Promise<Response> {
  const me = await requireAdmin(request)
  const body = await readBody(request)
  const saved = getSetting<SavedSegment[]>('segments') ?? []
  if (body.delete === true) {
    setSetting('segments', saved.filter((s) => s.id !== body.id))
    return json({ ok: true })
  }
  const name = typeof body.name === 'string' ? body.name.trim() : ''
  if (name.length < 2 || name.length > 30) throw new HttpError(400, 'Falta el nombre')
  const text = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim().slice(0, 40) : null)
  const segment: SavedSegment = { id: `${Date.now().toString(36)}`, name, segment: text(body.segment), tag: text(body.tag)?.toUpperCase() ?? null, q: text(body.q) }
  if (!segment.segment && !segment.tag && !segment.q) throw new HttpError(400, 'Falta qué jugadores')
  setSetting('segments', [...saved, segment].slice(-20))
  logAction(me, 'segment', name)
  return json({ ok: true, id: segment.id })
}

// ── One player's phone ──────────────────────────────────────────────────────

// POST /api/admin/users/push { userId, titulo, cuerpo }: a notification to that player only.
export async function pushUser(request: Request): Promise<Response> {
  const me = await requireAdmin(request, 'moderador')
  const body = await readBody(request)
  const id = playerId(body.userId)
  const titulo = typeof body.titulo === 'string' ? body.titulo.trim() : ''
  const cuerpo = typeof body.cuerpo === 'string' ? body.cuerpo.trim() : ''
  if (titulo.length < 2 || titulo.length > 60 || cuerpo.length < 2 || cuerpo.length > 200) throw new HttpError(400, 'Falta el texto')
  await sendPush([id], 'news', () => ({ title: titulo, body: cuerpo, url: '/', tag: `admin-${Date.now()}` }))
  logAction(me, 'push_user', `@${usernames([id]).get(id) ?? '?'}`, titulo)
  return json({ ok: true })
}
