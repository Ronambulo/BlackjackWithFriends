import { eq } from 'drizzle-orm'
import { requireUser, type SessionUser } from '../lib/auth.js'
import { db } from '../lib/db.js'
import { HttpError, json } from '../lib/http.js'
import { leagueClock } from '../lib/league.js'
import { LANGUAGES, profiles, type Language } from '../lib/schema.js'

const NAME_MIN = 2
const NAME_MAX = 20

type ProfileRow = typeof profiles.$inferSelect

function toJson(row: ProfileRow) {
  return {
    id: row.id,
    nombre: row.nombre,
    avatar_url: row.avatarUrl,
    idioma: row.idioma,
    monedas: row.monedas,
  }
}

/** The player's profile, created on first use with their username as the name. */
function loadProfile(user: SessionUser): ProfileRow {
  const name = user.name.trim()
  const nombre = name.length >= NAME_MIN && name.length <= NAME_MAX ? name : null
  const { today, weekStart } = leagueClock()
  const created = db()
    .insert(profiles)
    .values({ id: user.id, nombre, semana: weekStart, dia: today })
    .onConflictDoNothing()
    .returning()
    .get()
  if (created) return created
  const existing = db().select().from(profiles).where(eq(profiles.id, user.id)).get()
  if (!existing) throw new HttpError(404, 'No existe el perfil')
  return existing
}

// GET /api/profile
export async function getProfile(request: Request): Promise<Response> {
  const user = await requireUser(request)
  return json(toJson(loadProfile(user)))
}

// PATCH /api/profile: the player can only change their name, avatar and language.
export async function patchProfile(request: Request): Promise<Response> {
  const user = await requireUser(request)
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null
  if (!body || typeof body !== 'object') throw new HttpError(400, 'Cuerpo no válido')

  const patch: Partial<Pick<ProfileRow, 'nombre' | 'avatarUrl' | 'idioma'>> = {}
  if ('nombre' in body) {
    const nombre = typeof body.nombre === 'string' ? body.nombre.trim() : ''
    if (nombre.length < NAME_MIN || nombre.length > NAME_MAX) throw new HttpError(400, 'Nombre no válido')
    patch.nombre = nombre
  }
  if ('idioma' in body) {
    if (!LANGUAGES.includes(body.idioma as Language)) throw new HttpError(400, 'Idioma no válido')
    patch.idioma = body.idioma as Language
  }
  if ('avatar_url' in body) {
    const url = body.avatar_url
    if (url !== null && (typeof url !== 'string' || !/^https:\/\/\S{1,500}$/.test(url))) {
      throw new HttpError(400, 'Avatar no válido')
    }
    patch.avatarUrl = url
  }

  const current = loadProfile(user)
  if (Object.keys(patch).length === 0) return json(toJson(current))
  const updated = db().update(profiles).set(patch).where(eq(profiles.id, user.id)).returning().get()
  return json(toJson(updated))
}
