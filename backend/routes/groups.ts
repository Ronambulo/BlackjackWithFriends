import { and, asc, count, eq, inArray, sql, type SQL } from 'drizzle-orm'
import { requireUser } from '../lib/auth.js'
import { db, sqliteCode, type Tx } from '../lib/db.js'
import { HttpError, json } from '../lib/http.js'
import { currentBalance, dayStartBalance, leagueClock, rollover } from '../lib/league.js'
import { groupMembers, groups, profiles, user, type GroupRole, type GroupSettings } from '../lib/schema.js'

// Groups are rankings: each one orders its members by their league balance, which
// is the same in every group. Only members see a group; only its admin changes it.

const NAME_MIN = 2
const NAME_MAX = 30
const MAX_GROUPS_PER_USER = 10
const MAX_MEMBERS = 50
const CODE_LENGTH = 10
// No 0/O, 1/l/I: the code may be read out loud or typed from a screenshot.
const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789'

/** A long random invite code (about 58 bits), unbiased. */
function newCode(): string {
  let code = ''
  const limit = 256 - (256 % CODE_ALPHABET.length)
  while (code.length < CODE_LENGTH) {
    for (const byte of crypto.getRandomValues(new Uint8Array(16))) {
      if (byte < limit && code.length < CODE_LENGTH) code += CODE_ALPHABET[byte % CODE_ALPHABET.length]
    }
  }
  return code
}

async function readBody(request: Request): Promise<Record<string, unknown>> {
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null
  if (!body || typeof body !== 'object') throw new HttpError(400, 'Cuerpo no válido')
  return body
}

function groupName(value: unknown): string {
  const nombre = typeof value === 'string' ? value.trim() : ''
  if (nombre.length < NAME_MIN || nombre.length > NAME_MAX) throw new HttpError(400, 'Nombre no válido')
  return nombre
}

function groupId(value: unknown): string {
  if (typeof value !== 'string' || value.length === 0 || value.length > 64) throw new HttpError(400, 'Falta el grupo')
  return value
}

function countMembers(tx: Tx, where: SQL | undefined): number {
  return tx.select({ n: count() }).from(groupMembers).where(where).get()?.n ?? 0
}

// ── Ranking ─────────────────────────────────────────────────────────────────

interface MemberRow {
  groupId: string
  userId: string
  rol: GroupRole
  nombre: string
  avatarUrl: string | null
  balance: number
  dayStart: number
}

export interface RankedMember {
  userId: string
  nombre: string
  avatarUrl: string | null
  rol: GroupRole
  balance: number
  /** Chips won or lost today (pay included). */
  dayChange: number
  /** 1 is the leader; ties share the place. */
  rank: number
  /** Places gained today (negative if lost). */
  rankChange: number
}

/** Standard competition ranking (1, 2, 2, 4) by balance, plus today's change. */
function rank(members: MemberRow[]): RankedMember[] {
  const place = (value: number, all: number[]) => 1 + all.filter((other) => other > value).length
  const now = members.map((m) => m.balance)
  const before = members.map((m) => m.dayStart)
  return members
    .map((m) => {
      const current = place(m.balance, now)
      return {
        userId: m.userId,
        nombre: m.nombre,
        avatarUrl: m.avatarUrl,
        rol: m.rol,
        balance: m.balance,
        dayChange: m.balance - m.dayStart,
        rank: current,
        rankChange: place(m.dayStart, before) - current,
      }
    })
    .sort((a, b) => a.rank - b.rank || a.nombre.localeCompare(b.nombre))
}

/** Members of the given groups, with their balance as of now. */
function selectMembers(tx: Tx, groupIds: string[] | SQL): MemberRow[] {
  const clock = leagueClock()
  return tx
    .select({
      groupId: groupMembers.groupId,
      userId: groupMembers.userId,
      rol: groupMembers.rol,
      nombre: sql<string>`coalesce(${profiles.nombre}, ${user.displayUsername}, ${user.name})`,
      avatarUrl: profiles.avatarUrl,
      balance: currentBalance(clock),
      dayStart: dayStartBalance(clock),
    })
    .from(groupMembers)
    .innerJoin(profiles, eq(profiles.id, groupMembers.userId))
    .innerJoin(user, eq(user.id, groupMembers.userId))
    .where(inArray(groupMembers.groupId, groupIds))
    .all()
}

/** Groups the player belongs to, as a subquery. */
function myGroupIds(userId: string) {
  return sql`(select ${groupMembers.groupId} from ${groupMembers} where ${groupMembers.userId} = ${userId})`
}

// ── Reading ─────────────────────────────────────────────────────────────────

// GET /api/groups: the player's groups with their place in each.
export async function listGroups(request: Request): Promise<Response> {
  const me = await requireUser(request)
  const { mine, members } = db().transaction((tx) => {
    rollover(tx, me.id)
    const mine = tx
      .select({ id: groups.id, nombre: groups.nombre, rol: groupMembers.rol })
      .from(groupMembers)
      .innerJoin(groups, eq(groups.id, groupMembers.groupId))
      .where(eq(groupMembers.userId, me.id))
      .orderBy(asc(groupMembers.createdAt))
      .all()
    return { mine, members: selectMembers(tx, myGroupIds(me.id)) }
  })
  return json(
    mine.map((group) => {
      const ranking = rank(members.filter((m) => m.groupId === group.id))
      const self = ranking.find((m) => m.userId === me.id)
      return {
        id: group.id,
        nombre: group.nombre,
        rol: group.rol,
        members: ranking.length,
        rank: self?.rank ?? ranking.length,
        rankChange: self?.rankChange ?? 0,
        top: ranking.slice(0, 3),
      }
    }),
  )
}

// GET /api/group?id=: a group's live ranking (members only).
export async function getGroup(request: Request): Promise<Response> {
  const me = await requireUser(request)
  return json(loadGroup(me.id, groupId(new URL(request.url).searchParams.get('id'))))
}

function loadGroup(userId: string, id: string) {
  const { group, members } = db().transaction((tx) => {
    rollover(tx, userId)
    const group = tx
      .select({ id: groups.id, nombre: groups.nombre, codigo: groups.codigoInvitacion, ajustes: groups.ajustes })
      .from(groups)
      .where(eq(groups.id, id))
      .get()
    return { group, members: selectMembers(tx, [id]) }
  })
  const self = members.find((m) => m.userId === userId)
  // Same answer whether the group doesn't exist or the player isn't in it.
  if (!group || !self) throw new HttpError(404, 'No existe el grupo')
  return groupJson(group, self.rol, members)
}

function groupJson(
  group: { id: string; nombre: string; codigo: string; ajustes: GroupSettings },
  rol: GroupRole,
  members: MemberRow[],
) {
  return {
    id: group.id,
    nombre: group.nombre,
    rol,
    codigo: group.codigo,
    ajustes: { ocultarRanking: group.ajustes.ocultarRanking === true },
    ranking: rank(members),
  }
}

// GET /api/invite?codigo=: what joining a group would look like, before joining.
export async function getInvite(request: Request): Promise<Response> {
  const me = await requireUser(request)
  const codigo = new URL(request.url).searchParams.get('codigo')?.trim() ?? ''
  if (codigo.length !== CODE_LENGTH) throw new HttpError(404, 'Invitación caducada')
  const group = db()
    .select({ id: groups.id, nombre: groups.nombre, ajustes: groups.ajustes })
    .from(groups)
    .where(eq(groups.codigoInvitacion, codigo))
    .get()
  if (!group) throw new HttpError(404, 'Invitación caducada')
  const ranking = rank(selectMembers(db(), [group.id]))
  return json({
    id: group.id,
    nombre: group.nombre,
    members: ranking.length,
    member: ranking.some((m) => m.userId === me.id),
    top: group.ajustes.ocultarRanking ? [] : ranking.slice(0, 3).map(({ nombre, balance }) => ({ nombre, balance })),
  })
}

// ── Joining and leaving ─────────────────────────────────────────────────────

// POST /api/groups { nombre }: creates a group with the player as its admin.
export async function createGroup(request: Request): Promise<Response> {
  const me = await requireUser(request)
  const nombre = groupName((await readBody(request)).nombre)
  const id = crypto.randomUUID()
  const created = db().transaction((tx) => {
    rollover(tx, me.id)
    if (countMembers(tx, eq(groupMembers.userId, me.id)) >= MAX_GROUPS_PER_USER) return false
    tx.insert(groups).values({ id, nombre, codigoInvitacion: newCode() }).run()
    tx.insert(groupMembers).values({ groupId: id, userId: me.id, rol: 'admin' }).run()
    return true
  })
  if (!created) throw new HttpError(409, `Como mucho ${MAX_GROUPS_PER_USER} grupos`)
  return json({ id }, 201)
}

// POST /api/groups/join { codigo }: joins a group by its invite code. The balance doesn't change.
export async function joinGroup(request: Request): Promise<Response> {
  const me = await requireUser(request)
  const body = await readBody(request)
  const codigo = typeof body.codigo === 'string' ? body.codigo.trim() : ''
  if (codigo.length !== CODE_LENGTH) throw new HttpError(404, 'Invitación caducada')

  const id = db().transaction((tx) => {
    rollover(tx, me.id)
    const group = tx.select({ id: groups.id }).from(groups).where(eq(groups.codigoInvitacion, codigo)).get()
    if (!group) throw new HttpError(404, 'Invitación caducada')
    const already = tx
      .select({ id: groupMembers.groupId })
      .from(groupMembers)
      .where(and(eq(groupMembers.groupId, group.id), eq(groupMembers.userId, me.id)))
      .get()
    if (already) return group.id
    if (
      countMembers(tx, eq(groupMembers.groupId, group.id)) >= MAX_MEMBERS ||
      countMembers(tx, eq(groupMembers.userId, me.id)) >= MAX_GROUPS_PER_USER
    ) {
      throw new HttpError(409, 'El grupo está lleno o ya estás en demasiados grupos')
    }
    tx.insert(groupMembers).values({ groupId: group.id, userId: me.id }).run()
    return group.id
  })
  return json({ id })
}

// POST /api/group/leave { id }: leaves a group. If the admin leaves, the
// longest-standing member takes over; the last one out deletes the group.
export async function leaveGroup(request: Request): Promise<Response> {
  const me = await requireUser(request)
  const id = groupId((await readBody(request)).id)
  db().transaction((tx) => {
    const left = tx
      .delete(groupMembers)
      .where(and(eq(groupMembers.groupId, id), eq(groupMembers.userId, me.id)))
      .returning({ rol: groupMembers.rol })
      .get()
    if (!left) throw new HttpError(404, 'No existe el grupo')
    const next = tx
      .select({ userId: groupMembers.userId, rol: groupMembers.rol })
      .from(groupMembers)
      .where(eq(groupMembers.groupId, id))
      .orderBy(asc(groupMembers.createdAt), asc(groupMembers.userId))
      .all()
    if (next.length === 0) {
      tx.delete(groups).where(eq(groups.id, id)).run()
    } else if (!next.some((m) => m.rol === 'admin')) {
      tx.update(groupMembers)
        .set({ rol: 'admin' })
        .where(and(eq(groupMembers.groupId, id), eq(groupMembers.userId, next[0].userId)))
        .run()
    }
  })
  return json({ ok: true })
}

// ── Admin ───────────────────────────────────────────────────────────────────

/** Throws unless the player is the group's admin. */
function requireAdmin(groupId: string, userId: string) {
  const membership = db()
    .select({ rol: groupMembers.rol })
    .from(groupMembers)
    .where(and(eq(groupMembers.groupId, groupId), eq(groupMembers.userId, userId)))
    .get()
  if (!membership) throw new HttpError(404, 'No existe el grupo')
  if (membership.rol !== 'admin') throw new HttpError(403, 'Solo el admin del grupo puede hacer eso')
}

// PATCH /api/group { id, nombre?, ocultarRanking? }: the group's name and settings.
export async function patchGroup(request: Request): Promise<Response> {
  const me = await requireUser(request)
  const body = await readBody(request)
  const id = groupId(body.id)
  requireAdmin(id, me.id)

  const patch: { nombre?: string; ajustes?: SQL } = {}
  if ('nombre' in body) patch.nombre = groupName(body.nombre)
  if ('ocultarRanking' in body) {
    if (typeof body.ocultarRanking !== 'boolean') throw new HttpError(400, 'Ajuste no válido')
    patch.ajustes = sql`json_patch(${groups.ajustes}, ${JSON.stringify({ ocultarRanking: body.ocultarRanking })})`
  }
  if (Object.keys(patch).length > 0) db().update(groups).set(patch).where(eq(groups.id, id)).run()
  return json(loadGroup(me.id, id))
}

// POST /api/group/renew { id }: a new invite code; the old one (and its links) stop working.
export async function renewCode(request: Request): Promise<Response> {
  const me = await requireUser(request)
  const id = groupId((await readBody(request)).id)
  requireAdmin(id, me.id)
  for (let attempt = 0; ; attempt++) {
    try {
      const updated = db()
        .update(groups)
        .set({ codigoInvitacion: newCode() })
        .where(eq(groups.id, id))
        .returning({ codigo: groups.codigoInvitacion })
        .get()
      return json(updated)
    } catch (err) {
      // A clash is next to impossible, but costs nothing to retry.
      if (sqliteCode(err) !== 'SQLITE_CONSTRAINT_UNIQUE' || attempt >= 2) throw err
    }
  }
}

// POST /api/group/kick { id, userId }: removes a member (not the admin).
export async function kickMember(request: Request): Promise<Response> {
  const me = await requireUser(request)
  const body = await readBody(request)
  const id = groupId(body.id)
  if (typeof body.userId !== 'string' || body.userId === me.id) throw new HttpError(400, 'Jugador no válido')
  requireAdmin(id, me.id)
  const kicked = db()
    .delete(groupMembers)
    .where(and(eq(groupMembers.groupId, id), eq(groupMembers.userId, body.userId)))
    .returning({ userId: groupMembers.userId })
    .get()
  if (!kicked) throw new HttpError(404, 'No está en el grupo')
  return json({ ok: true })
}
