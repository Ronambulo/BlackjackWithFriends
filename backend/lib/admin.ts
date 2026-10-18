import { and, eq, gt, isNull, ne, or } from 'drizzle-orm'
import { requireUser, type SessionUser } from './auth.js'
import { db } from './db.js'
import { HttpError } from './http.js'
import { adminLog, ipBans, reviews, user, type Undo } from './schema.js'
import { getSetting } from './settings.js'

// The app's own admins, by username (ADMIN_USERNAMES, comma separated), and the
// banned addresses every request is checked against.

function adminNames(): Set<string> {
  return new Set(
    (process.env.ADMIN_USERNAMES ?? '')
      .split(',')
      .map((name) => name.trim().toLowerCase())
      .filter(Boolean),
  )
}

// Owners (ADMIN_USERNAMES) can do everything and hand out the other roles from the panel
// (settings 'roles', by username): moderators look after players and give up to
// MOD_LIMIT at a time; support only looks, writes notes and closes reports.
export const ROLES = ['dueno', 'moderador', 'soporte'] as const
export type Role = (typeof ROLES)[number]
export const MOD_LIMIT = 500

export function staffRoles(): Record<string, Exclude<Role, 'dueno'>> {
  return getSetting<Record<string, Exclude<Role, 'dueno'>>>('roles') ?? {}
}

export function roleOfName(username: string | null | undefined): Role | null {
  if (!username) return null
  const lower = username.toLowerCase()
  if (adminNames().has(lower)) return 'dueno'
  return staffRoles()[lower] ?? null
}

export function ownerNames(): string[] {
  return [...adminNames()]
}

export function roleOf(userId: string): Role | null {
  const row = db().select({ username: user.username }).from(user).where(eq(user.id, userId)).get()
  return roleOfName(row?.username)
}

export function isAdmin(userId: string): boolean {
  return roleOf(userId) !== null
}

/** Whether `role` may do what needs `min`: owner > moderator > support. */
export function allows(role: Role | null, min: Role): boolean {
  return role !== null && ROLES.indexOf(role) <= ROLES.indexOf(min)
}

export type AdminUser = SessionUser & { role: Role }

/**
 * The signed-in user, if they're on the team with at least `min`; a 404 for anyone else, as if
 * there were nothing here, and a 403 for someone on the team without enough.
 */
export async function requireAdmin(request: Request, min: Role = 'soporte'): Promise<AdminUser> {
  const me = await requireUser(request)
  const role = roleOf(me.id)
  if (!role) throw new HttpError(404, 'No existe')
  if (!allows(role, min)) throw new HttpError(403, 'Tu rol no puede hacer eso')
  return { ...me, role }
}

/** The player's address: Cloudflare's header first, then the first hop of x-forwarded-for. */
export function clientIp(request: Request): string | null {
  const header = request.headers.get('cf-connecting-ip') ?? request.headers.get('x-forwarded-for')?.split(',')[0]
  return header?.trim() || null
}

// Every request asks, so the list is kept in memory (the API is one process) and
// reloaded after a change. A ban that ran out just stops counting; it stays listed until removed.
let banned: Map<string, number | null> | null = null

export function isBanned(ip: string | null, now = Date.now()): boolean {
  if (!ip) return false
  banned ??= new Map(
    db()
      .select({ ip: ipBans.ip, expiresAt: ipBans.expiresAt })
      .from(ipBans)
      .all()
      .map((row) => [row.ip, row.expiresAt?.getTime() ?? null]),
  )
  if (!banned.has(ip)) return false
  const until = banned.get(ip)
  return until === null || until === undefined || until > now
}

/** The bans that still apply, as a condition on ip_bans. */
export function activeBan(now = new Date()) {
  return or(isNull(ipBans.expiresAt), gt(ipBans.expiresAt, now))
}

export function forgetBans() {
  banned = null
}

/** Puts a new name or photo in the review queue, replacing the player's previous one of the same kind. */
export function queueReview(userId: string, tipo: 'foto' | 'nombre', valor: string) {
  db()
    .insert(reviews)
    .values({ userId, tipo, valor })
    .onConflictDoUpdate({ target: [reviews.userId, reviews.tipo], set: { valor, createdAt: new Date() } })
    .run()
}

export function dropReview(userId: string, tipo: 'foto' | 'nombre') {
  db().delete(reviews).where(and(eq(reviews.userId, userId), eq(reviews.tipo, tipo))).run()
}

/** Writes down what an admin did, for the log in the panel. */
export function logAction(
  admin: SessionUser | { name: string },
  accion: string,
  objetivo: string | null = null,
  detalle: string | null = null,
  deshacer: Undo | null = null,
) {
  db()
    .insert(adminLog)
    .values({ admin: admin.name, accion, objetivo, detalle, deshacer })
    .run()
}

// Usernames: what the username plugin accepts at sign up.
const USERNAME = /^[a-zA-Z0-9_.]{3,20}$/

/**
 * Gives the player a new username (sign in, @handle) as typed. The made-up email
 * follows it, so the old one is free for someone else to sign up with. An admin
 * name can't be taken, and an admin can't rename themselves out of the list.
 */
export function setUsername(userId: string, typed: string) {
  const display = typed.trim().replace(/^@/, '')
  if (!USERNAME.test(display)) throw new HttpError(400, 'Usuario no válido')
  const lower = display.toLowerCase()
  const d = db()
  const current = d.select({ username: user.username }).from(user).where(eq(user.id, userId)).get()
  if (!current) throw new HttpError(404, 'No existe')
  const names = adminNames()
  if (current.username !== lower && (names.has(lower) || names.has(current.username ?? ''))) throw new HttpError(403, 'Ese usuario no se puede cambiar')
  const taken = d.select({ id: user.id }).from(user).where(and(eq(user.username, lower), ne(user.id, userId))).get()
  if (taken) throw new HttpError(409, 'Ese usuario ya existe')
  d.update(user)
    .set({ username: lower, displayUsername: display, name: display, email: `${lower}@jugadores.blackjack.invalid`, updatedAt: new Date() })
    .where(eq(user.id, userId))
    .run()
  return { old: current.username, username: display }
}
