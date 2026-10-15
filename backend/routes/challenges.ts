import { logAction, requireAdmin } from '../lib/admin.js'
import { requireUser } from '../lib/auth.js'
import {
  CHALLENGES,
  challengesFor,
  completionCounts,
  isCustomDay,
  pickChallenges,
  playerChallenges,
  syncChallenges,
} from '../lib/challenges.js'
import { db } from '../lib/db.js'
import { HttpError, json } from '../lib/http.js'
import { addDays, leagueClock } from '../lib/league.js'

// GET /api/challenges: today's three with the player's progress, after checking for completed ones.
export async function getChallenges(request: Request): Promise<Response> {
  const me = await requireUser(request)
  db().transaction((tx) => syncChallenges(tx, me.id))
  return json(playerChallenges(me.id))
}

// GET /api/admin/challenges: today's with how many completed them, tomorrow's and the catalogue to pick from.
export async function getAdminChallenges(request: Request): Promise<Response> {
  await requireAdmin(request)
  const { today } = leagueClock()
  const tomorrow = addDays(today, 1)
  const counts = completionCounts(today)
  return json({
    today: {
      day: today,
      custom: isCustomDay(today),
      challenges: challengesFor(today).map((c) => ({ id: c.id, tier: c.tier, target: c.target, coins: c.coins, completed: counts[c.id] ?? 0 })),
    },
    tomorrow: { day: tomorrow, custom: isCustomDay(tomorrow), ids: challengesFor(tomorrow).map((c) => c.id) },
    catalogue: CHALLENGES.map((c) => ({ id: c.id, tier: c.tier, target: c.target, coins: c.coins })),
  })
}

// POST /api/admin/challenges { ids: [easy, medium, hard] | null }: picks tomorrow's (null: back to the date's).
export async function postAdminChallenges(request: Request): Promise<Response> {
  const me = await requireAdmin(request)
  const body = (await request.json().catch(() => null)) as { ids?: unknown } | null
  const ids = body?.ids
  if (ids !== null && !(Array.isArray(ids) && ids.every((id) => typeof id === 'string'))) throw new HttpError(400, 'Faltan los retos')
  const day = addDays(leagueClock().today, 1)
  try {
    pickChallenges(day, ids)
  } catch {
    throw new HttpError(400, 'Retos no válidos')
  }
  logAction(me, 'challenges', day, ids ? ids.join(', ') : null)
  return json({ ok: true, day })
}
