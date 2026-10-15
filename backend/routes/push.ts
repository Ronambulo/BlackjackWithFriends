import { eq } from 'drizzle-orm'
import { requireUser } from '../lib/auth.js'
import { db } from '../lib/db.js'
import { HttpError, json } from '../lib/http.js'
import { prefsOf, publicKey, subscribe, testPush, unsubscribe } from '../lib/push.js'
import { profiles, PUSH_KINDS, type PushKind, type PushPrefs } from '../lib/schema.js'

async function readBody(request: Request): Promise<Record<string, unknown>> {
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null
  if (!body || typeof body !== 'object') throw new HttpError(400, 'Cuerpo no válido')
  return body
}

const text = (value: unknown, max: number) => typeof value === 'string' && value.length > 0 && value.length <= max

// GET /api/push/key: the public VAPID key the app subscribes with.
export async function getPushKey(request: Request): Promise<Response> {
  await requireUser(request)
  return json({ key: publicKey() })
}

// POST /api/push/subscribe { endpoint, keys: { p256dh, auth } }: this device gets the player's notifications.
export async function postSubscribe(request: Request): Promise<Response> {
  const me = await requireUser(request)
  const body = await readBody(request)
  const keys = body.keys as Record<string, unknown> | undefined
  if (!text(body.endpoint, 1000) || !(body.endpoint as string).startsWith('https://') || !text(keys?.p256dh, 200) || !text(keys?.auth, 100)) {
    throw new HttpError(400, 'Suscripción no válida')
  }
  subscribe(me.id, { endpoint: body.endpoint as string, keys: { p256dh: keys!.p256dh as string, auth: keys!.auth as string } })
  return json({ ok: true }, 201)
}

// POST /api/push/unsubscribe { endpoint }: this device no longer does.
export async function postUnsubscribe(request: Request): Promise<Response> {
  const me = await requireUser(request)
  const body = await readBody(request)
  if (!text(body.endpoint, 1000)) throw new HttpError(400, 'Suscripción no válida')
  unsubscribe(me.id, body.endpoint as string)
  return json({ ok: true })
}

function prefsJson(prefs: PushPrefs | undefined) {
  return Object.fromEntries(PUSH_KINDS.map((kind) => [kind, prefsOf(prefs, kind)])) as Record<PushKind, boolean>
}

// GET /api/push/prefs: which kinds of notification the player wants.
export async function getPushPrefs(request: Request): Promise<Response> {
  const me = await requireUser(request)
  const row = db().select({ avisos: profiles.avisos }).from(profiles).where(eq(profiles.id, me.id)).get()
  return json(prefsJson(row?.avisos))
}

// PATCH /api/push/prefs { [kind]: boolean }: switches some on or off.
export async function patchPushPrefs(request: Request): Promise<Response> {
  const me = await requireUser(request)
  const body = await readBody(request)
  const prefs = db().transaction((tx) => {
    const row = tx.select({ avisos: profiles.avisos }).from(profiles).where(eq(profiles.id, me.id)).get()
    if (!row) throw new HttpError(404, 'No existe el perfil')
    const next: PushPrefs = { ...row.avisos }
    for (const kind of PUSH_KINDS) {
      const value = body[kind]
      if (value === undefined) continue
      if (typeof value !== 'boolean') throw new HttpError(400, 'Ajuste no válido')
      // Only what's off is kept: a new kind starts on.
      if (value) delete next[kind]
      else next[kind] = false
    }
    tx.update(profiles).set({ avisos: next }).where(eq(profiles.id, me.id)).run()
    return next
  })
  return json(prefsJson(prefs))
}

// POST /api/push/test: a notification to each of the player's devices, and how it went.
export async function postPushTest(request: Request): Promise<Response> {
  const me = await requireUser(request)
  const row = db().select({ idioma: profiles.idioma }).from(profiles).where(eq(profiles.id, me.id)).get()
  return json(await testPush(me.id, row?.idioma ?? 'es'))
}
