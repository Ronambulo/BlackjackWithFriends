// The whole API is one Vercel Function: vercel.json rewrites /api/* here and
// this file routes by pathname. Fewer cold starts, one shared DB/auth setup.
import { DEFAULT_RULES } from '@bwf/engine'
import { auth, requireUser } from '../lib/auth.js'
import { isDatabaseConfigured } from '../lib/db.js'
import { HttpError, json } from '../lib/http.js'
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
        database: isDatabaseConfigured(),
        email: Boolean(process.env.RESEND_API_KEY),
        // Proves the shared engine is bundled with the function.
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
