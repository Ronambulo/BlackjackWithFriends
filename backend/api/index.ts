// The whole API in one fetch handler, routed by pathname. server.ts serves it.
import { DEFAULT_RULES } from '@bwf/engine'
import { auth, requireUser } from '../lib/auth.js'
import { sql } from 'drizzle-orm'
import { db } from '../lib/db.js'
import { eventStream, groupmates, notifyGroups } from '../lib/events.js'
import { HttpError, json } from '../lib/http.js'
import {
  createGroup,
  getGroup,
  getGroupHistory,
  getInvite,
  getInvitePreview,
  joinGroup,
  kickMember,
  leaveGroup,
  listGroups,
  patchGroup,
  renewCode,
} from '../routes/groups.js'
import { getLeague, postPay } from '../routes/league.js'
import { getTable, postPlay } from '../routes/play.js'
import { getProfile, patchProfile } from '../routes/profile.js'
import { getStats } from '../routes/stats.js'

type Route = (request: Request) => Promise<Response> | Response
type Routes = Record<string, Partial<Record<string, Route>>>

/**
 * A change other players see in their rankings: once it succeeds, everyone who shared
 * a group with the player before or after it (so joins, leaves and kicks count) is told.
 */
function live(fn: Route): Route {
  return async (request) => {
    const me = await requireUser(request)
    const before = groupmates(me.id)
    const response = await fn(request)
    if (response.ok) {
      const others = new Set([...before, ...groupmates(me.id)])
      // The player's own app already refreshes after its own change.
      others.delete(me.id)
      notifyGroups(others)
    }
    return response
  }
}

const routes: Routes = {
  // Quick check that the API is up and wired correctly.
  '/api/health': {
    GET: () =>
      json({
        ok: true,
        time: new Date().toISOString(),
        // The container's healthcheck: fails if the database can't be read.
        database: db().get<{ ok: number }>(sql`select 1 as ok`)?.ok === 1,
        // Proves the shared engine is wired in.
        rules: DEFAULT_RULES,
      }),
  },
  '/api/me': {
    GET: async (request) => json(await requireUser(request)),
  },
  '/api/profile': {
    GET: getProfile,
    PATCH: live(patchProfile),
  },
  '/api/profile/stats': { GET: getStats },
  '/api/play': {
    GET: getTable,
    POST: live(postPlay),
  },
  '/api/league': { GET: getLeague },
  '/api/league/pay': { POST: live(postPay) },
  '/api/groups': { GET: listGroups, POST: createGroup },
  '/api/groups/join': { POST: live(joinGroup) },
  '/api/group': { GET: getGroup, PATCH: live(patchGroup) },
  '/api/group/history': { GET: getGroupHistory },
  '/api/group/leave': { POST: live(leaveGroup) },
  '/api/group/renew': { POST: live(renewCode) },
  '/api/group/kick': { POST: live(kickMember) },
  '/api/invite': { GET: getInvite },
  '/api/invite/preview': { GET: getInvitePreview },
  // Live updates (lib/events.ts).
  '/api/events': {
    GET: async (request) => eventStream((await requireUser(request)).id),
  },
}

async function route(request: Request): Promise<Response> {
  const { pathname } = new URL(request.url)
  const path = pathname.replace(/\/+$/, '') || '/'

  if (path === '/api/auth' || path.startsWith('/api/auth/')) return auth().handler(request)

  const methods = routes[path]
  if (!methods) throw new HttpError(404, 'No existe')
  const fn = methods[request.method]
  if (!fn) throw new HttpError(405, 'Método no permitido')
  return fn(request)
}

export default {
  async fetch(request: Request): Promise<Response> {
    try {
      return await route(request)
    } catch (err) {
      if (err instanceof HttpError) return json({ error: err.message }, err.status)
      console.error(err)
      return json({ error: 'Error interno' }, 500)
    }
  },
}
