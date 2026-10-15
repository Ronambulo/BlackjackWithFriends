import { handValue, type RoundState } from '@bwf/engine'
import { and, desc, eq, gte, inArray, isNull, sql } from 'drizzle-orm'
import { isAdmin } from '../lib/admin.js'
import { requireUser } from '../lib/auth.js'
import { db } from '../lib/db.js'
import { notifyChat } from '../lib/events.js'
import { HttpError, json } from '../lib/http.js'
import { groupMembers, hands, messages, profiles, REACTIONS, reactions, user, type SharedHand } from '../lib/schema.js'

// The chats: one global, open to every player, and one per group. Players write text
// and publish hands from the table (never on their own); everyone can react. Changes
// reach the open apps as a 'chat' live event (lib/events.ts), so the chat refetches
// instead of polling. A chat only shows its last week; older messages stay in the
// database but nobody sees them any more.

/** The global chat's id in the API; groups use theirs. */
export const GLOBAL = 'global'

const TEXT_MAX = 500
/** How far back a chat shows. */
const SHOWN_MS = 7 * 24 * 60 * 60 * 1000
/** At most the newest ones of that week. */
const PAGE = 300

const shownSince = () => new Date(Date.now() - SHOWN_MS)
/** At most this many messages per player in a minute, so nobody floods a chat. */
const RATE = 20
const RATE_WINDOW = 60_000

const sent = new Map<string, number[]>()

function throttle(userId: string) {
  const now = Date.now()
  const recent = (sent.get(userId) ?? []).filter((at) => now - at < RATE_WINDOW)
  if (recent.length >= RATE) throw new HttpError(429, 'Demasiados mensajes, espera un momento')
  recent.push(now)
  sent.set(userId, recent)
}

async function readBody(request: Request): Promise<Record<string, unknown>> {
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null
  if (!body || typeof body !== 'object') throw new HttpError(400, 'Cuerpo no válido')
  return body
}

function id(value: unknown, what: string): string {
  if (typeof value !== 'string' || value.length === 0 || value.length > 64) throw new HttpError(400, `Falta ${what}`)
  return value
}

interface Room {
  /** null: the global chat */
  groupId: string | null
  /** May delete others' messages: the group's admin, or an app admin in the global chat. */
  moderator: boolean
}

/** A chat the player can use; a 404 for a group they're not in. */
function room(chatId: string, userId: string): Room {
  if (chatId === GLOBAL) return { groupId: null, moderator: isAdmin(userId) }
  const row = db()
    .select({ rol: groupMembers.rol })
    .from(groupMembers)
    .where(and(eq(groupMembers.groupId, chatId), eq(groupMembers.userId, userId)))
    .get()
  if (!row) throw new HttpError(404, 'No existe el grupo')
  return { groupId: chatId, moderator: row.rol === 'admin' }
}

const inRoom = (groupId: string | null) => (groupId === null ? isNull(messages.groupId) : eq(messages.groupId, groupId))

/** A settled hand, everything face up. */
function sharedHand(state: RoundState): SharedHand {
  const settlement = state.settlement!
  return {
    dealer: state.dealer,
    dealerTotal: handValue(state.dealer).total,
    dealerBlackjack: settlement.dealerBlackjack,
    hands: state.hands.map((h, i) => ({
      cards: h.cards,
      bet: h.bet,
      total: handValue(h.cards).total,
      outcome: settlement.hands[i].outcome,
    })),
    insurance: state.insuranceBet,
    net: settlement.net,
  }
}

// ── Reading ─────────────────────────────────────────────────────────────────

export interface ChatMessage {
  id: string
  userId: string
  nombre: string
  avatarUrl: string | null
  texto: string | null
  mano: SharedHand | null
  createdAt: string
  reactions: { emoji: string; count: number; mine: boolean }[]
  /** The message it answers, as a quote (null too if that one was deleted). */
  reply: { id: string; userId: string; nombre: string; texto: string | null; mano: boolean } | null
}

// GET /api/chat?id=: a chat's last week of messages, oldest first. Opening it counts as reading it.
export async function getChat(request: Request): Promise<Response> {
  const me = await requireUser(request)
  const { groupId, moderator } = room(id(new URL(request.url).searchParams.get('id'), 'el chat'), me.id)

  const rows = db()
    .select({
      id: messages.id,
      userId: messages.userId,
      nombre: sql<string>`coalesce(${profiles.nombre}, ${user.displayUsername}, ${user.name})`,
      avatarUrl: profiles.avatarUrl,
      texto: messages.texto,
      mano: messages.mano,
      replyTo: messages.replyTo,
      createdAt: messages.createdAt,
    })
    .from(messages)
    .innerJoin(user, eq(user.id, messages.userId))
    .leftJoin(profiles, eq(profiles.id, messages.userId))
    .where(and(inRoom(groupId), gte(messages.createdAt, shownSince())))
    .orderBy(desc(messages.createdAt), desc(messages.id))
    .limit(PAGE)
    .all()
    .reverse()
  markRead(groupId, me.id)

  const all = rows.length
    ? db()
        .select({ messageId: reactions.messageId, userId: reactions.userId, emoji: reactions.emoji })
        .from(reactions)
        .where(inArray(reactions.messageId, rows.map((row) => row.id)))
        .all()
    : []

  // The quoted ones, which may be older than what the chat shows.
  const quotedIds = [...new Set(rows.flatMap((row) => (row.replyTo ? [row.replyTo] : [])))]
  const quoted = new Map(
    (quotedIds.length
      ? db()
          .select({
            id: messages.id,
            userId: messages.userId,
            nombre: sql<string>`coalesce(${profiles.nombre}, ${user.displayUsername}, ${user.name})`,
            texto: messages.texto,
            mano: sql<boolean>`${messages.mano} is not null`.mapWith(Boolean),
          })
          .from(messages)
          .innerJoin(user, eq(user.id, messages.userId))
          .leftJoin(profiles, eq(profiles.id, messages.userId))
          .where(inArray(messages.id, quotedIds))
          .all()
      : []
    ).map((q) => [q.id, q]),
  )

  const list: ChatMessage[] = rows.map(({ replyTo, ...row }) => {
    const own = all.filter((r) => r.messageId === row.id)
    return {
      ...row,
      reply: (replyTo && quoted.get(replyTo)) || null,
      createdAt: row.createdAt.toISOString(),
      // In the fixed order of the picker, the ones nobody used left out.
      reactions: REACTIONS.map((emoji) => ({
        emoji,
        count: own.filter((r) => r.emoji === emoji).length,
        mine: own.some((r) => r.emoji === emoji && r.userId === me.id),
      })).filter((r) => r.count > 0),
    }
  })
  return json({ messages: list, more: rows.length === PAGE, moderator })
}

// ── Writing ─────────────────────────────────────────────────────────────────

// POST /api/chat { id, texto, replyTo? }: writes in a chat ('global' or a group's).
export async function postMessage(request: Request): Promise<Response> {
  const me = await requireUser(request)
  const body = await readBody(request)
  const chatId = id(body.id, 'el chat')
  // Runs of blank lines squeezed, so a message can't be a wall of nothing.
  const texto = typeof body.texto === 'string' ? body.texto.trim().replace(/\n{3,}/g, '\n\n') : ''
  if (texto.length === 0 || texto.length > TEXT_MAX) throw new HttpError(400, 'Mensaje no válido')
  const { groupId } = room(chatId, me.id)
  // Only to a message of the same chat.
  const replyTo =
    typeof body.replyTo === 'string'
      ? (db()
          .select({ id: messages.id })
          .from(messages)
          .where(and(eq(messages.id, body.replyTo), inRoom(groupId)))
          .get()?.id ?? null)
      : null
  throttle(me.id)

  db().insert(messages).values({ id: crypto.randomUUID(), groupId, userId: me.id, texto, replyTo }).run()
  markRead(groupId, me.id)
  notifyChat(groupId)
  return json({ ok: true }, 201)
}

// POST /api/chat/share { handId, chats }: publishes a finished hand of the player's in
// the chats they pick ('global' and/or their groups). Each chat gets it once.
export async function shareHand(request: Request): Promise<Response> {
  const me = await requireUser(request)
  const body = await readBody(request)
  const handId = id(body.handId, 'la mano')
  const wanted = Array.isArray(body.chats) ? body.chats.filter((c): c is string => typeof c === 'string') : []
  if (wanted.length === 0 || wanted.length > 21) throw new HttpError(400, 'Falta el chat')
  throttle(me.id)

  const hand = db()
    .select({ ronda: hands.ronda, fase: hands.fase })
    .from(hands)
    .where(and(eq(hands.id, handId), eq(hands.userId, me.id)))
    .get()
  if (!hand || hand.fase !== 'settled') throw new HttpError(404, 'No existe la mano')
  const groupIds = wanted.filter((c) => c !== GLOBAL)
  const targets: (string | null)[] = groupIds.length
    ? db()
        .select({ groupId: groupMembers.groupId })
        .from(groupMembers)
        .where(and(eq(groupMembers.userId, me.id), inArray(groupMembers.groupId, groupIds)))
        .all()
        .map((row) => row.groupId)
    : []
  if (wanted.includes(GLOBAL)) targets.push(null)
  if (targets.length === 0) throw new HttpError(404, 'No existe el grupo')

  const mano = sharedHand(hand.ronda)
  db().transaction((tx) => {
    for (const groupId of targets) {
      tx.insert(messages)
        .values({ id: crypto.randomUUID(), groupId, userId: me.id, mano, handId })
        .onConflictDoNothing()
        .run()
    }
  })
  for (const groupId of targets) {
    markRead(groupId, me.id)
    notifyChat(groupId)
  }
  return json({ chats: targets.map((g) => g ?? GLOBAL) })
}

function findMessage(messageId: string, userId: string) {
  const message = db()
    .select({ groupId: messages.groupId, userId: messages.userId })
    .from(messages)
    .where(eq(messages.id, messageId))
    .get()
  if (!message) throw new HttpError(404, 'No existe el mensaje')
  return { ...message, ...room(message.groupId ?? GLOBAL, userId) }
}

// POST /api/chat/react { messageId, emoji }: reacts, changes the reaction, or (emoji null) takes it back.
export async function postReaction(request: Request): Promise<Response> {
  const me = await requireUser(request)
  const body = await readBody(request)
  const messageId = id(body.messageId, 'el mensaje')
  const emoji = body.emoji === null ? null : (REACTIONS as readonly unknown[]).includes(body.emoji) ? String(body.emoji) : undefined
  if (emoji === undefined) throw new HttpError(400, 'Reacción no válida')
  const message = findMessage(messageId, me.id)

  if (emoji === null) {
    db()
      .delete(reactions)
      .where(and(eq(reactions.messageId, messageId), eq(reactions.userId, me.id)))
      .run()
  } else {
    db()
      .insert(reactions)
      .values({ messageId, userId: me.id, emoji })
      .onConflictDoUpdate({ target: [reactions.messageId, reactions.userId], set: { emoji, createdAt: new Date() } })
      .run()
  }
  notifyChat(message.groupId)
  return json({ ok: true })
}

// POST /api/chat/delete { messageId }: deletes one of your own messages; a moderator (see Room) can delete any.
export async function deleteMessage(request: Request): Promise<Response> {
  const me = await requireUser(request)
  const messageId = id((await readBody(request)).messageId, 'el mensaje')
  const message = findMessage(messageId, me.id)
  if (message.userId !== me.id && !message.moderator) throw new HttpError(403, 'Solo puedes borrar tus mensajes')
  db().delete(messages).where(eq(messages.id, messageId)).run()
  notifyChat(message.groupId)
  return json({ ok: true })
}

// ── Unread ──────────────────────────────────────────────────────────────────

function markRead(groupId: string | null, userId: string) {
  if (groupId === null) {
    db().update(profiles).set({ chatLeido: new Date() }).where(eq(profiles.id, userId)).run()
    return
  }
  db()
    .update(groupMembers)
    .set({ chatLeido: new Date() })
    .where(and(eq(groupMembers.groupId, groupId), eq(groupMembers.userId, userId)))
    .run()
}

/** Others' messages each of the player's groups has since they last read it. */
export function unreadCounts(userId: string): Map<string, number> {
  const rows = db()
    .select({ groupId: groupMembers.groupId, n: sql<number>`count(${messages.id})` })
    .from(groupMembers)
    .innerJoin(
      messages,
      and(
        eq(messages.groupId, groupMembers.groupId),
        sql`${messages.userId} <> ${userId}`,
        sql`${messages.createdAt} > coalesce(${groupMembers.chatLeido}, ${groupMembers.createdAt})`,
        gte(messages.createdAt, shownSince()),
      ),
    )
    .where(eq(groupMembers.userId, userId))
    .groupBy(groupMembers.groupId)
    .all()
  return new Map(rows.map((row) => [row.groupId, row.n]))
}

/** Others' messages in the global chat since the player last read it (or signed up, if never). */
function unreadGlobal(userId: string): number {
  const row = db()
    .select({ n: sql<number>`count(${messages.id})` })
    .from(messages)
    .innerJoin(profiles, eq(profiles.id, userId))
    .where(
      and(
        isNull(messages.groupId),
        sql`${messages.userId} <> ${userId}`,
        sql`${messages.createdAt} > coalesce(${profiles.chatLeido}, ${profiles.createdAt})`,
        gte(messages.createdAt, shownSince()),
      ),
    )
    .get()
  return row?.n ?? 0
}

// GET /api/chat/unread: what the player hasn't read, per chat ('global' and each group's id).
export async function getUnread(request: Request): Promise<Response> {
  const me = await requireUser(request)
  return json({ [GLOBAL]: unreadGlobal(me.id), ...Object.fromEntries(unreadCounts(me.id)) })
}
