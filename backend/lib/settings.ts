import { eq } from 'drizzle-orm'
import { db } from './db.js'
import { settings } from './schema.js'

// Switches and values the admins change from the panel, kept in the settings
// table and in memory (the API is one process): every request may ask.

/** The feature flags and what they're on by default. */
export const FLAGS = {
  // New accounts can be created.
  signups: true,
  // The table deals new hands; off, a hand in progress can still finish.
  play: true,
  // Groups can be joined with an invite link.
  invites: true,
} as const
export type Flag = keyof typeof FLAGS

/** A notice every player sees on top of the app until it expires or an admin removes it. */
export interface Announcement {
  text: string
  /** ms; null: until removed */
  expiresAt: number | null
  createdAt: number
  by: string
}

let cache: Map<string, unknown> | null = null

function all(): Map<string, unknown> {
  cache ??= new Map(db().select().from(settings).all().map((row) => [row.clave, row.valor]))
  return cache
}

export function getSetting<T>(key: string): T | undefined {
  return all().get(key) as T | undefined
}

export function setSetting(key: string, value: unknown) {
  if (value === null || value === undefined) db().delete(settings).where(eq(settings.clave, key)).run()
  else
    db()
      .insert(settings)
      .values({ clave: key, valor: value })
      .onConflictDoUpdate({ target: settings.clave, set: { valor: value, updatedAt: new Date() } })
      .run()
  cache = null
}

export function flags(): Record<Flag, boolean> {
  return Object.fromEntries(
    (Object.keys(FLAGS) as Flag[]).map((key) => [key, getSetting<boolean>(`flag.${key}`) ?? FLAGS[key]]),
  ) as Record<Flag, boolean>
}

export function isOn(flag: Flag): boolean {
  return flags()[flag]
}

export function announcement(now = Date.now()): Announcement | null {
  const value = getSetting<Announcement>('announcement')
  return value && (value.expiresAt === null || value.expiresAt > now) ? value : null
}
