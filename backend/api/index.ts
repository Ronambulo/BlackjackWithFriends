// The whole API in one fetch handler, routed by pathname. server.ts serves it.
import { DEFAULT_RULES } from '@bwf/engine'
import { auth, requireUser } from '../lib/auth.js'
import { sql } from 'drizzle-orm'
import { db } from '../lib/db.js'
import { HttpError, json } from '../lib/http.js'
import {
  createGroup,
  getGroup,
  getInvite,
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

type Route = (request: Request) => Promise<Response> | Response
type Routes = Record<string, Partial<Record<string, Route>>>

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
    PATCH: patchProfile,
  },
  '/api/play': {
    GET: getTable,
    POST: postPlay,
  },
  '/api/league': { GET: getLeague },
  '/api/league/pay': { POST: postPay },
  '/api/groups': { GET: listGroups, POST: createGroup },
  '/api/groups/join': { POST: joinGroup },
  '/api/group': { GET: getGroup, PATCH: patchGroup },
  '/api/group/leave': { POST: leaveGroup },
  '/api/group/renew': { POST: renewCode },
  '/api/group/kick': { POST: kickMember },
  '/api/invite': { GET: getInvite },
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
