import { requireUser } from '../lib/auth.js'
import { handler, json } from '../lib/http.js'

// GET /api/me: who the bearer token belongs to.
export const GET = handler(async (request) => {
  const user = await requireUser(request)
  return json({ id: user.id, email: user.email ?? null })
})
