import { and, eq, gte, inArray, isNotNull, lt, sql } from 'drizzle-orm'
import { logAction, ownerNames } from './admin.js'
import { db } from './db.js'
import { notifyGroups } from './events.js'
import { addDays, leagueClock, madridAt, madridMidnight, rollover } from './league.js'
import { sendPush } from './push.js'
import { getSetting, setSetting } from './settings.js'
import { adjustments, hands, messages, playerMarks, profiles, session, user, userCosmetics } from './schema.js'

// Rules the owners switch on from the panel ("When… → …"). A tick every few minutes
// applies the ones on; everything they do goes to the log as admin 'auto', so it shows
// in the inbox and can be undone. And the summary for the owners on Mondays at 9.

export const AUTOMATIONS = ['spamSilence', 'brokeGift', 'inactivePush', 'sharedIpWatch'] as const
export type Automation = (typeof AUTOMATIONS)[number]

const MINUTE = 60 * 1000
const DAY = 24 * 60 * MINUTE
const TICK = 5 * MINUTE

// When someone writes this many messages in a minute, an hour without chat.
const SPAM_MESSAGES = 8
const SPAM_SILENCE = 60 * MINUTE
// Out of chips and not back for this long: a little help, once a week.
const BROKE_AFTER = 3 * DAY
const BROKE_GIFT = 200
// Not seen for a week: one reminder (and not again until they come back).
const INACTIVE_AFTER = 7 * DAY
// This many accounts on one connection: tag them all to keep an eye on.
const SHARED_ACCOUNTS = 3
const WATCH_TAG = 'VIGILAR'
const REPORT_HOUR = 9

const AUTO = { name: 'auto' }

export function automationSettings(): Record<Automation, boolean> {
  const saved = getSetting<Partial<Record<Automation, boolean>>>('automations') ?? {}
  return Object.fromEntries(AUTOMATIONS.map((id) => [id, saved[id] ?? false])) as Record<Automation, boolean>
}

export function weeklyReportSettings(): { on: boolean } {
  return { on: getSetting<{ on?: boolean }>('weeklyReport')?.on ?? true }
}

function usernameOf(id: string) {
  return db().select({ n: user.username }).from(user).where(eq(user.id, id)).get()?.n ?? '?'
}

function marksOf(id: string) {
  const row = db().select().from(playerMarks).where(eq(playerMarks.userId, id)).get()
  return { etiquetas: row?.etiquetas ?? [], hermanas: row?.hermanas ?? [], silenciadoHasta: row?.silenciadoHasta?.getTime() ?? null }
}

function saveMarks(id: string, next: ReturnType<typeof marksOf>) {
  const values = { etiquetas: next.etiquetas, hermanas: next.hermanas, silenciadoHasta: next.silenciadoHasta ? new Date(next.silenciadoHasta) : null }
  db()
    .insert(playerMarks)
    .values({ userId: id, ...values })
    .onConflictDoUpdate({ target: playerMarks.userId, set: { ...values, updatedAt: new Date() } })
    .run()
}

function spamSilence(now: number) {
  const since = new Date(now - TICK - MINUTE)
  // Messages by player and minute, in the stretch since the last tick.
  const rows = db()
    .select({ userId: messages.userId, minute: sql<number>`${messages.createdAt} / 60000`, n: sql<number>`count(*)` })
    .from(messages)
    .where(and(gte(messages.createdAt, since), isNotNull(messages.texto)))
    .groupBy(messages.userId, sql`${messages.createdAt} / 60000`)
    .having(sql`count(*) >= ${SPAM_MESSAGES}`)
    .all()
  for (const id of new Set(rows.map((r) => r.userId))) {
    const before = marksOf(id)
    if (before.silenciadoHasta && before.silenciadoHasta > now) continue
    saveMarks(id, { ...before, silenciadoHasta: now + SPAM_SILENCE })
    logAction(AUTO, 'auto_spamSilence', `@${usernameOf(id)}`, '1 h', { kind: 'marks', userId: id, ...before })
  }
}

function brokeGift(now: number) {
  const clock = leagueClock()
  const d = db()
  const broke = d
    .select({ id: profiles.id, last: sql<number | null>`(select max(h.created_at) from hands h where h.user_id = ${profiles.id})` })
    .from(profiles)
    .where(and(eq(profiles.semana, clock.weekStart), eq(profiles.saldo, 0)))
    .all()
    .filter((p) => p.last !== null && now - p.last >= BROKE_AFTER)
  if (!broke.length) return
  const helped = new Set(
    d
      .select({ id: adjustments.userId })
      .from(adjustments)
      .where(and(eq(adjustments.por, 'auto'), eq(adjustments.tipo, 'saldo'), gte(adjustments.createdAt, clock.weekBegin)))
      .all()
      .map((r) => r.id),
  )
  for (const { id } of broke) {
    if (helped.has(id)) continue
    d.transaction((tx) => {
      rollover(tx, id, clock)
      tx.update(profiles)
        .set({ saldo: sql`${profiles.saldo} + ${BROKE_GIFT}`, saldoInicioDia: sql`${profiles.saldoInicioDia} + ${BROKE_GIFT}` })
        .where(eq(profiles.id, id))
        .run()
      tx.insert(adjustments).values({ userId: id, tipo: 'saldo', cantidad: BROKE_GIFT, motivo: 'Sin fichas 3 días', por: 'auto' }).run()
    })
    notifyGroups([id])
    logAction(AUTO, 'auto_brokeGift', `@${usernameOf(id)}`, `+${BROKE_GIFT}`, { kind: 'adjust', userId: id, tipo: 'saldo', cantidad: BROKE_GIFT })
  }
}

function inactivePush(now: number) {
  // The players who played last between 7 and 8 days ago; each gets it once per absence.
  const rows = db()
    .select({ id: hands.userId, last: sql<number>`max(${hands.createdAt})` })
    .from(hands)
    .groupBy(hands.userId)
    .having(and(lt(sql`max(${hands.createdAt})`, now - INACTIVE_AFTER), gte(sql`max(${hands.createdAt})`, now - INACTIVE_AFTER - DAY)))
    .all()
  const sent = getSetting<Record<string, number>>('auto.inactive') ?? {}
  const fresh = rows.filter((r) => sent[r.id] !== r.last)
  if (!fresh.length) return
  void sendPush(
    fresh.map((r) => r.id),
    'news',
    (lang) =>
      lang === 'en'
        ? { title: 'Your table is waiting', body: 'A week without blackjack. Your friends are still playing.', url: '/', tag: 'inactive' }
        : { title: 'Tu mesa te espera', body: 'Una semana sin blackjack. Tus amigos siguen jugando.', url: '/', tag: 'inactive' },
  )
  for (const r of fresh) sent[r.id] = r.last
  setSetting('auto.inactive', sent)
  for (const r of fresh) logAction(AUTO, 'auto_inactivePush', `@${usernameOf(r.id)}`)
}

function sharedIpWatch() {
  const rows = db()
    .select({ ip: session.ipAddress, ids: sql<string>`group_concat(distinct ${session.userId})` })
    .from(session)
    .where(isNotNull(session.ipAddress))
    .groupBy(session.ipAddress)
    .having(sql`count(distinct ${session.userId}) >= ${SHARED_ACCOUNTS}`)
    .all()
  for (const row of rows) {
    const ids = row.ids.split(',')
    for (const id of ids) {
      const before = marksOf(id)
      if (before.etiquetas.includes(WATCH_TAG)) continue
      // Accounts already marked as the same person don't count against each other.
      if (ids.every((o) => o === id || before.hermanas.includes(o))) continue
      saveMarks(id, { ...before, etiquetas: [...before.etiquetas, WATCH_TAG] })
      logAction(AUTO, 'auto_sharedIpWatch', `@${usernameOf(id)}`, row.ip, { kind: 'marks', userId: id, ...before })
    }
  }
}

/** Last week in four numbers, to the owners' phones. */
function weeklyReport() {
  const clock = leagueClock()
  const from = madridMidnight(addDays(clock.weekStart, -7))
  const to = clock.weekBegin
  const d = db()
  const between = (col: Parameters<typeof gte>[0]) => and(gte(col, from), lt(col, to))
  const handsPlayed = d.select({ n: sql<number>`count(*)` }).from(hands).where(between(hands.createdAt)).get()?.n ?? 0
  const players = d.select({ n: sql<number>`count(distinct ${hands.userId})` }).from(hands).where(between(hands.createdAt)).get()?.n ?? 0
  const signups = d.select({ n: sql<number>`count(*)` }).from(user).where(between(user.createdAt)).get()?.n ?? 0
  const spent = d.select({ n: sql<number>`coalesce(sum(${userCosmetics.monedas}), 0)` }).from(userCosmetics).where(between(userCosmetics.createdAt)).get()?.n ?? 0
  const owners = d
    .select({ id: user.id })
    .from(user)
    .where(inArray(user.username, ownerNames()))
    .all()
    .map((r) => r.id)
  void sendPush(owners, 'news', (lang) =>
    lang === 'en'
      ? { title: 'Your week in Blackjack', body: `${players} players · ${handsPlayed} hands · ${signups} new · ${spent} coins spent`, url: '/admin', tag: 'weekly-report' }
      : { title: 'Tu semana en Blackjack', body: `${players} jugadores · ${handsPlayed} manos · ${signups} nuevos · ${spent} monedas gastadas`, url: '/admin', tag: 'weekly-report' },
  )
}

const RULES: Record<Automation, (now: number) => void> = { spamSilence, brokeGift, inactivePush, sharedIpWatch }

export function scheduleAutomations() {
  const tick = () => {
    const now = Date.now()
    const on = automationSettings()
    for (const id of AUTOMATIONS) {
      if (!on[id]) continue
      try {
        RULES[id](now)
      } catch (err) {
        console.error(`Automatización ${id} fallida`, err)
      }
    }
    try {
      const c = leagueClock()
      if (weeklyReportSettings().on && getSetting('auto.report') !== c.weekStart && now >= madridAt(c.weekStart, REPORT_HOUR).getTime()) {
        setSetting('auto.report', c.weekStart)
        if (c.today === c.weekStart) weeklyReport()
      }
    } catch (err) {
      console.error('Informe semanal fallido', err)
    }
  }
  setInterval(tick, TICK).unref()
  setTimeout(tick, 10 * 1000).unref()
}
