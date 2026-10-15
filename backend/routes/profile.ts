import { and, eq } from 'drizzle-orm'
import { requireUser, type SessionUser } from '../lib/auth.js'
import { db } from '../lib/db.js'
import { HttpError, json } from '../lib/http.js'
import { queueReview, setUsername } from '../lib/admin.js'
import { leagueClock, rulesFor } from '../lib/league.js'
import { LANGUAGES, profiles, reviews, type Language } from '../lib/schema.js'
import { deleteObject, keyOf, mediaUrl, putObject, sniffImage } from '../lib/storage.js'

const NAME_MIN = 2
const NAME_MAX = 20
// The app sends a 256 px photo; this leaves room for a PNG from a browser without WebP.
const AVATAR_MAX_BYTES = 400 * 1024
// So a player can't hop between usernames (and leave a trail of freed ones for others).
const USERNAME_WAIT_MS = 30 * 24 * 60 * 60 * 1000

type ProfileRow = typeof profiles.$inferSelect

function toJson(row: ProfileRow) {
  return {
    id: row.id,
    nombre: row.nombre,
    avatar_url: row.avatarUrl,
    idioma: row.idioma,
    monedas: row.monedas,
    // When the player can change their username again; null if they can now.
    usuario_cambiable_desde: usernameFreeAt(row),
  }
}

function usernameFreeAt(row: ProfileRow): number | null {
  if (!row.usuarioCambiado) return null
  const at = row.usuarioCambiado.getTime() + USERNAME_WAIT_MS
  return at > Date.now() ? at : null
}

/** The player's profile, created on first use with their username as the name. */
function loadProfile(user: SessionUser): ProfileRow {
  const name = user.name.trim()
  const nombre = name.length >= NAME_MIN && name.length <= NAME_MAX ? name : null
  const { today, weekStart } = leagueClock()
  const { startBalance } = rulesFor(weekStart)
  const created = db()
    .insert(profiles)
    .values({ id: user.id, nombre, semana: weekStart, dia: today, saldo: startBalance, saldoInicioDia: startBalance })
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

// PATCH /api/profile: the player can only change their name, username, avatar and language.
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
  // Photos are uploaded to POST /api/profile/avatar; here they can only be removed.
  if ('avatar_url' in body) {
    if (body.avatar_url !== null) throw new HttpError(400, 'Avatar no válido')
    patch.avatarUrl = null
  }

  const current = loadProfile(user)
  // The username lives with the account, not the profile.
  if ('username' in body) {
    const typed = typeof body.username === 'string' ? body.username : ''
    const sameName = typed.trim().replace(/^@/, '').toLowerCase() === user.name.toLowerCase()
    // Fixing the capitals of the same name doesn't count as a change.
    if (!sameName && usernameFreeAt(current)) throw new HttpError(429, 'Todavía no puedes volver a cambiar el usuario')
    const { old, username } = setUsername(user.id, typed)
    if (old !== username.toLowerCase()) {
      const at = new Date()
      db().update(profiles).set({ usuarioCambiado: at }).where(eq(profiles.id, user.id)).run()
      current.usuarioCambiado = at
    }
  }

  if (Object.keys(patch).length === 0) return json(toJson(current))
  const updated = db().update(profiles).set(patch).where(eq(profiles.id, user.id)).returning().get()
  if (patch.avatarUrl === null) {
    removePhoto(current.avatarUrl)
    db().delete(reviews).where(and(eq(reviews.userId, user.id), eq(reviews.tipo, 'foto'))).run()
  }
  // A new name goes to the admins' review queue; it shows straight away meanwhile.
  if (patch.nombre && patch.nombre !== current.nombre) queueReview(user.id, 'nombre', patch.nombre)
  return json(toJson(updated))
}

/** Deletes an old photo from the store, if it was one of ours. */
function removePhoto(url: string | null) {
  const key = keyOf(url)
  if (key) deleteObject(key)
}

// POST /api/profile/avatar: the new profile photo as the raw body (WebP, PNG or JPEG).
export async function postAvatar(request: Request): Promise<Response> {
  const user = await requireUser(request)
  const bytes = new Uint8Array(await request.arrayBuffer())
  if (bytes.length === 0 || bytes.length > AVATAR_MAX_BYTES) throw new HttpError(413, 'Imagen demasiado grande')
  const type = sniffImage(bytes)
  if (!type) throw new HttpError(415, 'Formato de imagen no válido')

  const current = loadProfile(user)
  const avatarUrl = mediaUrl(putObject('avatars', bytes, type))
  const updated = db().update(profiles).set({ avatarUrl }).where(eq(profiles.id, user.id)).returning().get()
  removePhoto(current.avatarUrl)
  queueReview(user.id, 'foto', avatarUrl)
  return json(toJson(updated))
}
