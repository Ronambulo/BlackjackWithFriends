import { achievementsSeen, playerAchievements, syncAchievements } from '../lib/achievements.js'
import { requireUser } from '../lib/auth.js'
import { db } from '../lib/db.js'
import { HttpError, json } from '../lib/http.js'

// GET /api/achievements: every achievement, unlocked or not, after checking for new ones.
export async function getAchievements(request: Request): Promise<Response> {
  const me = await requireUser(request)
  db().transaction((tx) => syncAchievements(tx, me.id))
  return json(playerAchievements(me.id))
}

// POST /api/achievements/seen { ids }: the player has seen these, so they're no longer new.
export async function postAchievementsSeen(request: Request): Promise<Response> {
  const me = await requireUser(request)
  const body = (await request.json().catch(() => null)) as { ids?: unknown } | null
  const ids = body?.ids
  if (!Array.isArray(ids) || !ids.every((id) => typeof id === 'string')) throw new HttpError(400, 'Faltan los logros')
  achievementsSeen(me.id, ids)
  return json({ ok: true })
}
