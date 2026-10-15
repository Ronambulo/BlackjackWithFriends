import { and, eq, inArray, isNull, lt, lte, or, sql } from 'drizzle-orm'
import webpush from 'web-push'
import { db } from './db.js'
import { groupmates } from './events.js'
import { addDays, currentBalance, leagueClock, madridAt, rulesFor } from './league.js'
import { getSetting, setSetting } from './settings.js'
import {
  groupMembers,
  groups,
  profiles,
  pushCampaigns,
  pushSubscriptions,
  user,
  type Audience,
  type Language,
  type Platform,
  type PushKind,
  type PushPrefs,
} from './schema.js'

// Push notifications (Web Push with VAPID keys): the server sends them to every
// device the player switched them on in, for the kinds they haven't switched off.
// The keys come from VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY, or are made once and
// kept in the settings table. Texts go in the player's language.

interface Keys {
  publicKey: string
  privateKey: string
}

let keys: Keys | null = null

function vapid(): Keys {
  if (keys) return keys
  const { VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY } = process.env
  if (VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY) keys = { publicKey: VAPID_PUBLIC_KEY, privateKey: VAPID_PRIVATE_KEY }
  else {
    keys = getSetting<Keys>('push.vapid') ?? webpush.generateVAPIDKeys()
    if (!getSetting('push.vapid')) setSetting('push.vapid', keys)
  }
  // Who to tell if something goes wrong: Apple wants an https address or an email.
  const site = process.env.BETTER_AUTH_URL ?? ''
  const subject = process.env.VAPID_SUBJECT ?? (site.startsWith('https://') ? site : 'mailto:admin@blackjack.local')
  webpush.setVapidDetails(subject, keys.publicKey, keys.privateKey)
  return keys
}

export function publicKey() {
  return vapid().publicKey
}

/** Kinds missing from the prefs are on. */
export function prefsOf(prefs: PushPrefs | null | undefined, kind: PushKind) {
  return prefs?.[kind] !== false
}

export interface Subscription {
  endpoint: string
  keys: { p256dh: string; auth: string }
}

// A player rarely has more devices than this; the oldest goes.
const MAX_DEVICES = 10

/** What the device says it is, when it says. */
export interface DeviceKind {
  plataforma: Platform
  pwa: boolean
}

export function subscribe(userId: string, sub: Subscription, kind?: DeviceKind) {
  const d = db()
  d.insert(pushSubscriptions)
    .values({ endpoint: sub.endpoint, userId, p256dh: sub.keys.p256dh, auth: sub.keys.auth, ...kind })
    // The same device signed in as someone else is now theirs.
    .onConflictDoUpdate({
      target: pushSubscriptions.endpoint,
      set: { userId, p256dh: sub.keys.p256dh, auth: sub.keys.auth, createdAt: new Date(), ...kind },
    })
    .run()
  const old = d
    .select({ endpoint: pushSubscriptions.endpoint })
    .from(pushSubscriptions)
    .where(eq(pushSubscriptions.userId, userId))
    .orderBy(sql`${pushSubscriptions.createdAt} desc`)
    .all()
    // Not .offset(): SQLite only takes one after a limit.
    .slice(MAX_DEVICES)
  if (old.length) d.delete(pushSubscriptions).where(inArray(pushSubscriptions.endpoint, old.map((row) => row.endpoint))).run()
}

export function unsubscribe(userId: string, endpoint: string) {
  db()
    .delete(pushSubscriptions)
    .where(and(eq(pushSubscriptions.endpoint, endpoint), eq(pushSubscriptions.userId, userId)))
    .run()
}

export interface PushMessage {
  title: string
  body: string
  /** Where tapping it opens the app. */
  url: string
  /** A newer one with the same tag replaces it on the device. */
  tag?: string
  /** Not shown while the app is open and in front (chat ones: the chat is right there). */
  quiet?: boolean
}

/**
 * Sends a notification of this kind to these players, worded in each one's
 * language. Never throws: a notification that doesn't arrive is no reason to fail.
 */
export async function sendPush(userIds: Iterable<string>, kind: PushKind, message: (lang: Language) => PushMessage) {
  const ids = [...new Set(userIds)]
  if (ids.length === 0) return
  try {
    vapid()
    const rows = db()
      .select({
        endpoint: pushSubscriptions.endpoint,
        p256dh: pushSubscriptions.p256dh,
        auth: pushSubscriptions.auth,
        idioma: profiles.idioma,
        avisos: profiles.avisos,
      })
      .from(pushSubscriptions)
      .innerJoin(profiles, eq(profiles.id, pushSubscriptions.userId))
      .where(inArray(pushSubscriptions.userId, ids))
      .all()
      .filter((row) => prefsOf(row.avisos, kind))
    await Promise.all(rows.map((row) => deliver(row, message(row.idioma))))
  } catch (err) {
    console.error('Push fallido', err)
  }
}

type Device = { endpoint: string; p256dh: string; auth: string }

/** Sends one; null if the push service took it, else why not. */
async function deliver(device: Device, message: PushMessage): Promise<string | null> {
  try {
    await webpush.sendNotification(
      { endpoint: device.endpoint, keys: { p256dh: device.p256dh, auth: device.auth } },
      JSON.stringify(message),
      // An hour late is still news; later it isn't.
      { TTL: 60 * 60, urgency: 'normal' },
    )
    return null
  } catch (err) {
    // Gone (uninstalled, permission taken back): forget the device.
    const status = (err as { statusCode?: number }).statusCode
    if (status === 404 || status === 410) db().delete(pushSubscriptions).where(eq(pushSubscriptions.endpoint, device.endpoint)).run()
    else console.error('Push fallido', status ?? err)
    return status ? String(status) : err instanceof Error ? err.message : 'error'
  }
}

/** One to each of the player's devices, whatever their settings, to check they arrive. */
export async function testPush(userId: string, lang: Language) {
  vapid()
  const devices = db()
    .select({ endpoint: pushSubscriptions.endpoint, p256dh: pushSubscriptions.p256dh, auth: pushSubscriptions.auth })
    .from(pushSubscriptions)
    .where(eq(pushSubscriptions.userId, userId))
    .all()
  const failed = (
    await Promise.all(
      devices.map((device) =>
        deliver(device, {
          title: t(lang, 'Notificación de prueba', 'Test notification'),
          body: t(lang, 'Si ves esto, las notificaciones funcionan.', 'If you can see this, notifications work.'),
          url: '/ajustes',
          tag: 'test',
        }),
      ),
    )
  ).filter((why): why is string => why !== null)
  return { devices: devices.length, failed }
}

// ── Campaigns ───────────────────────────────────────────────────────────────

/** Apple's push service only serves iPhones and iPads (Macs use it too, but rarely as an app). */
const appleEndpoint = (endpoint: string) => endpoint.startsWith('https://web.push.apple.com/')

/** Whether a subscribed device is in an audience. Ones that never said what they are only go to everyone, or by their push service. */
export function inAudience(device: { endpoint: string; plataforma: Platform | null; pwa: boolean | null }, audience: Audience) {
  const plataforma = device.plataforma ?? (appleEndpoint(device.endpoint) ? 'ios' : null)
  // An iPhone only gets notifications from the home screen app.
  const pwa = device.pwa ?? (plataforma === 'ios' ? true : null)
  switch (audience) {
    case 'all':
    case 'push':
      return true
    case 'ios':
    case 'android':
    case 'desktop':
      return plataforma === audience
    case 'pwa':
      return pwa === true
    case 'browser':
      return pwa === false
    case 'noPush':
      return false
  }
}

/** The devices a campaign to this audience would reach now. */
export function campaignDevices(audience: Audience) {
  return db()
    .select({
      endpoint: pushSubscriptions.endpoint,
      p256dh: pushSubscriptions.p256dh,
      auth: pushSubscriptions.auth,
      plataforma: pushSubscriptions.plataforma,
      pwa: pushSubscriptions.pwa,
      avisos: profiles.avisos,
    })
    .from(pushSubscriptions)
    .innerJoin(profiles, eq(profiles.id, pushSubscriptions.userId))
    .all()
    .filter((row) => prefsOf(row.avisos, 'news') && inAudience(row, audience))
}

/** Sends the campaigns whose time has come, each once. */
async function sendDueCampaigns() {
  const d = db()
  const due = d
    .select()
    .from(pushCampaigns)
    .where(and(isNull(pushCampaigns.sentAt), lte(pushCampaigns.sendAt, new Date())))
    .all()
  for (const campaign of due) {
    // Marked first, so a slow send isn't picked up again by the next tick.
    d.update(pushCampaigns).set({ sentAt: new Date() }).where(eq(pushCampaigns.id, campaign.id)).run()
    vapid()
    const targets = campaignDevices(campaign.audiencia)
    const message = { title: campaign.titulo, body: campaign.cuerpo, url: campaign.url, tag: `campaign-${campaign.id}` }
    const failed = (await Promise.all(targets.map((device) => deliver(device, message)))).filter((why) => why !== null).length
    d.update(pushCampaigns).set({ dispositivos: targets.length, fallidos: failed }).where(eq(pushCampaigns.id, campaign.id)).run()
  }
}

/** Sends it now if it's due, without waiting for the minute's tick. */
export function sendCampaignsNow() {
  sendDueCampaigns().catch((err) => console.error('Campaña fallida', err))
}

// ── Texts ───────────────────────────────────────────────────────────────────

const t = (lang: Language, es: string, en: string) => (lang === 'en' ? en : es)

/** `nombre`, or the username if they never picked one. */
const nameOf = sql<string>`coalesce(${profiles.nombre}, ${user.displayUsername}, ${user.name})`

function nameFor(userId: string) {
  return (
    db().select({ nombre: nameOf }).from(user).leftJoin(profiles, eq(profiles.id, user.id)).where(eq(user.id, userId)).get()
      ?.nombre ?? '?'
  )
}

// ── Triggers ────────────────────────────────────────────────────────────────

/** The @handles in a text, lower-cased; a dot or dash ending it is punctuation. */
export function mentionedHandles(texto: string) {
  return [...new Set([...texto.matchAll(/@([\p{L}\p{N}_.-]{2,30})/gu)].map((m) => m[1].replace(/[.-]+$/, '').toLowerCase()))].filter(
    (handle) => handle.length >= 2,
  )
}

const snippet = (texto: string) => (texto.length > 120 ? `${texto.slice(0, 119)}…` : texto)

/** Mentions (@username or a one-word name) in a chat message, to those who can read that chat. Returns who got one. */
export function pushMentions(senderId: string, groupId: string | null, texto: string): string[] {
  const handles = mentionedHandles(texto)
  if (handles.length === 0) return []
  const d = db()
  const found = d
    .select({ id: user.id })
    .from(user)
    .leftJoin(profiles, eq(profiles.id, user.id))
    .where(or(inArray(user.username, handles), inArray(sql`lower(${profiles.nombre})`, handles)))
    .limit(10)
    .all()
    .map((row) => row.id)
    .filter((id) => id !== senderId)
  // In a group's chat, only its members.
  const readers =
    groupId === null || found.length === 0
      ? found
      : d
          .select({ userId: groupMembers.userId })
          .from(groupMembers)
          .where(and(eq(groupMembers.groupId, groupId), inArray(groupMembers.userId, found)))
          .all()
          .map((row) => row.userId)
  if (readers.length === 0) return []
  const sender = nameFor(senderId)
  const where = groupId === null ? null : groupName(groupId)
  const body = snippet(texto)
  void sendPush(readers, 'mention', (lang) => ({
    title: where
      ? t(lang, `${sender} te ha mencionado en ${where}`, `${sender} mentioned you in ${where}`)
      : t(lang, `${sender} te ha mencionado en el chat global`, `${sender} mentioned you in the global chat`),
    body,
    url: '/social',
    tag: `mention-${groupId ?? 'global'}`,
    quiet: true,
  }))
  return readers
}

const groupName = (groupId: string) => db().select({ nombre: groups.nombre }).from(groups).where(eq(groups.id, groupId)).get()?.nombre ?? '?'

/** What a message is, for a notification: its text, or what was shared. */
export type ChatContent = { texto: string } | { mano: true } | { estadisticas: true }

function describe(lang: Language, content: ChatContent) {
  if ('texto' in content) return snippet(content.texto)
  return 'mano' in content ? t(lang, 'Ha compartido una mano', 'Shared a hand') : t(lang, 'Ha compartido sus estadísticas', 'Shared their stats')
}

/**
 * A new message in a group's chat, to its other members (not those it already
 * mentioned). The global chat has too many people: only mentions go from there.
 * One per chat on the device: the newest replaces the one before.
 */
export function pushMessage(senderId: string, groupId: string | null, content: ChatContent, skip: string[] = []) {
  if (groupId === null) return
  const members = db()
    .select({ userId: groupMembers.userId })
    .from(groupMembers)
    .where(eq(groupMembers.groupId, groupId))
    .all()
    .map((row) => row.userId)
    .filter((id) => id !== senderId && !skip.includes(id))
  if (members.length === 0) return
  const sender = nameFor(senderId)
  const where = groupName(groupId)
  void sendPush(members, 'message', (lang) => ({
    title: where,
    body: `${sender}: ${describe(lang, content)}`,
    url: '/social',
    tag: `chat-${groupId}`,
    quiet: true,
  }))
}

/** Someone reacted to a player's message. */
export function pushReaction(reactorId: string, authorId: string, messageId: string, emoji: string, content: ChatContent) {
  if (reactorId === authorId) return
  const name = nameFor(reactorId)
  void sendPush([authorId], 'reaction', (lang) => ({
    title: t(lang, `${name} ha reaccionado ${emoji} a tu mensaje`, `${name} reacted ${emoji} to your message`),
    body: 'texto' in content ? snippet(content.texto) : 'mano' in content ? t(lang, 'Tu mano', 'Your hand') : t(lang, 'Tus estadísticas', 'Your stats'),
    url: '/social',
    tag: `reaction-${messageId}`,
    quiet: true,
  }))
}

/** Players who were ahead of `userId` and aren't any more get told, at most once an hour per pair. */
const OVERTAKE_EVERY = 60 * 60 * 1000
const lastOvertake = new Map<string, number>()

function balances(userIds: string[]): Map<string, number> {
  if (userIds.length === 0) return new Map()
  return new Map(
    db()
      .select({ id: profiles.id, balance: currentBalance(leagueClock()) })
      .from(profiles)
      .where(inArray(profiles.id, userIds))
      .all()
      .map((row) => [row.id, row.balance]),
  )
}

/** Runs `change` (a hand or a pay) and tells the groupmates the player went past. */
export async function watchOvertakes(userId: string, change: () => Promise<Response>): Promise<Response> {
  const before = balances([userId]).get(userId)
  const response = await change()
  if (!response.ok || before === undefined) return response
  try {
    const after = balances([userId]).get(userId) ?? before
    if (after <= before) return response
    const mates = groupmates(userId).filter((id) => id !== userId)
    const now = Date.now()
    const passed = [...balances(mates)]
      .filter(([, balance]) => balance >= before && balance < after)
      .map(([id]) => id)
      .filter((id) => now - (lastOvertake.get(`${userId}:${id}`) ?? 0) > OVERTAKE_EVERY)
    if (passed.length === 0) return response
    for (const id of passed) lastOvertake.set(`${userId}:${id}`, now)
    const name = nameFor(userId)
    void sendPush(passed, 'overtaken', (lang) => ({
      title: t(lang, `${name} te ha adelantado`, `${name} just passed you`),
      body: t(lang, 'Te ha pasado en el ranking. ¿Vas a dejarlo así?', 'They overtook you in the ranking. Going to let that slide?'),
      url: '/ranking',
      tag: `overtaken-${userId}`,
    }))
  } catch (err) {
    console.error('Push fallido', err)
  }
  return response
}

/** The week closed: its ceremony is waiting for everyone who played it. */
export function pushCeremony(userIds: string[]) {
  void sendPush(userIds, 'ceremony', (lang) => ({
    title: t(lang, 'La semana ha terminado', 'The week is over'),
    body: t(lang, 'Mira cómo habéis quedado y recoge tus monedas.', 'See how everyone finished and collect your coins.'),
    url: '/',
    tag: 'ceremony',
  }))
}

/** An admin took down the player's photo or name. */
export function pushReviewRejected(userId: string, tipo: 'foto' | 'nombre') {
  void sendPush([userId], 'review', (lang) =>
    tipo === 'foto'
      ? {
          title: t(lang, 'Hemos quitado tu foto', 'Your photo was removed'),
          body: t(lang, 'No cumplía las normas. Puedes subir otra desde tu perfil.', "It broke the rules. You can upload another from your profile."),
          url: '/perfil',
        }
      : {
          title: t(lang, 'Hemos cambiado tu nombre', 'Your name was changed'),
          body: t(lang, 'No cumplía las normas. Puedes elegir otro desde tu perfil.', 'It broke the rules. You can pick another from your profile.'),
          url: '/perfil',
        },
  )
}

// ── Scheduled ───────────────────────────────────────────────────────────────

// Today's pay reminder at this hour, for whoever hasn't claimed it.
const PAY_HOUR = 18
// The league closes on Monday 00:00; the warning goes this many hours before.
const CLOSING_HOUR = 21
// Too late in the evening to remind anyone of anything.
const QUIET_HOUR = 23

function remindPay() {
  const c = leagueClock()
  if (rulesFor(c.weekStart).dailyPay === 0) return
  const due = db()
    .selectDistinct({ id: profiles.id })
    .from(profiles)
    .innerJoin(pushSubscriptions, eq(pushSubscriptions.userId, profiles.id))
    .where(or(isNull(profiles.ultimaPaga), lt(profiles.ultimaPaga, c.today), lt(profiles.semana, c.weekStart)))
    .all()
    .map((row) => row.id)
  void sendPush(due, 'pay', (lang) => ({
    title: t(lang, 'Tu paga está lista', 'Your pay is ready'),
    body: t(lang, 'Cóbrala y vuelve a la mesa.', 'Claim it and get back to the table.'),
    url: '/',
    tag: 'pay',
  }))
}

function warnClosing() {
  const c = leagueClock()
  // Whoever has opened the app this week.
  const playing = db()
    .selectDistinct({ id: profiles.id })
    .from(profiles)
    .innerJoin(pushSubscriptions, eq(pushSubscriptions.userId, profiles.id))
    .where(eq(profiles.semana, c.weekStart))
    .all()
    .map((row) => row.id)
  void sendPush(playing, 'closing', (lang) => ({
    title: t(lang, 'Quedan 3 horas de liga', '3 hours of league left'),
    body: t(lang, 'A medianoche se cierra la semana. Última oportunidad para subir.', 'The week closes at midnight. Last chance to climb.'),
    url: '/ranking',
    tag: 'closing',
  }))
}

/** Checks the clock every minute; each reminder goes once (the marker is kept in settings). */
export function schedulePush() {
  const tick = () => {
    try {
      const c = leagueClock()
      const now = Date.now()
      if (getSetting('push.pay') !== c.today && now >= madridAt(c.today, PAY_HOUR).getTime()) {
        setSetting('push.pay', c.today)
        if (now < madridAt(c.today, QUIET_HOUR).getTime()) remindPay()
      }
      const sunday = addDays(c.weekStart, 6)
      if (c.today === sunday && getSetting('push.closing') !== c.weekStart && now >= madridAt(sunday, CLOSING_HOUR).getTime()) {
        setSetting('push.closing', c.weekStart)
        warnClosing()
      }
      sendCampaignsNow()
    } catch (err) {
      console.error('Push programado fallido', err)
    }
  }
  tick()
  setInterval(tick, 60 * 1000).unref()
}
