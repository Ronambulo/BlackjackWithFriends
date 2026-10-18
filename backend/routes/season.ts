import { and, eq } from 'drizzle-orm'
import { requireUser } from '../lib/auth.js'
import { db } from '../lib/db.js'
import { HttpError, json } from '../lib/http.js'
import { groupMembers } from '../lib/schema.js'
import { ceremonySeen, groupWeeks, pendingCeremony, recentCeremony } from '../lib/season.js'

// How many past weeks a group's history shows.
const HISTORY_WEEKS = 12
const WEEK = /^\d{4}-\d{2}-\d{2}$/

// GET /api/ceremony: the last closed week's ceremony, until the player has watched it; null otherwise.
export async function getCeremony(request: Request): Promise<Response> {
  const me = await requireUser(request)
  return json(pendingCeremony(me.id))
}

// GET /api/ceremony/replay: the ceremony watched in the last hour, to watch again; null otherwise.
export async function getCeremonyReplay(request: Request): Promise<Response> {
  const me = await requireUser(request)
  return json(recentCeremony(me.id))
}

// POST /api/ceremony/seen { semana }: watched (or skipped), so it doesn't show again.
export async function postCeremonySeen(request: Request): Promise<Response> {
  const me = await requireUser(request)
  const body = (await request.json().catch(() => null)) as { semana?: unknown } | null
  if (typeof body?.semana !== 'string' || !WEEK.test(body.semana)) throw new HttpError(400, 'Falta la semana')
  ceremonySeen(me.id, body.semana)
  return json({ ok: true })
}

// GET /api/group/seasons?id=: a group's closed weeks, newest first (members only).
export async function getGroupSeasons(request: Request): Promise<Response> {
  const me = await requireUser(request)
  const id = new URL(request.url).searchParams.get('id') ?? ''
  const member = db()
    .select({ rol: groupMembers.rol })
    .from(groupMembers)
    .where(and(eq(groupMembers.groupId, id), eq(groupMembers.userId, me.id)))
    .get()
  if (!member) throw new HttpError(404, 'No existe el grupo')
  return json(groupWeeks(db(), id).slice(0, HISTORY_WEEKS))
}
