import { and, desc, gt, isNull, lte, or } from 'drizzle-orm'
import { db } from './db.js'
import { adminEvents, priceTests, type CosmeticKind, type EventKind } from './schema.js'

// What the admins scheduled (admin_events) and the price tests running (price_tests).
// The pay and the shop ask on every request, so both are kept in memory and reloaded
// after a change, or a minute later so one starting or ending is picked up.

interface ScheduledEvent {
  id: number
  tipo: EventKind
  inicio: number
  fin: number | null
  valor: number | null
  detalle: string | null
}

interface RunningTest {
  id: number
  estilo: string
  precioB: number
}

let cached: { at: number; events: ScheduledEvent[]; tests: RunningTest[] } | null = null
const FRESH = 60 * 1000

function load(now: number) {
  if (cached && now - cached.at < FRESH) return cached
  const d = db()
  const at = new Date(now)
  const events = d
    .select({ id: adminEvents.id, tipo: adminEvents.tipo, inicio: adminEvents.inicio, fin: adminEvents.fin, valor: adminEvents.valor, detalle: adminEvents.detalle })
    .from(adminEvents)
    .where(and(lte(adminEvents.inicio, at), or(isNull(adminEvents.fin), gt(adminEvents.fin, at))))
    .orderBy(desc(adminEvents.inicio))
    .all()
    .map((row) => ({ ...row, inicio: row.inicio.getTime(), fin: row.fin?.getTime() ?? null }))
  const tests = d
    .select({ id: priceTests.id, estilo: priceTests.estilo, precioB: priceTests.precioB })
    .from(priceTests)
    .where(isNull(priceTests.fin))
    .all()
  cached = { at: now, events, tests }
  return cached
}

export function forgetSchedule() {
  cached = null
}

/** The events on right now, newest first. */
export function activeEvents(now = Date.now()): ScheduledEvent[] {
  return load(now).events
}

/** What the daily pay is multiplied by now (a "hora feliz"), 1 if nothing's on. */
export function payMultiplier(now = Date.now()): number {
  return Math.max(1, ...activeEvents(now).filter((e) => e.tipo === 'doble_paga').map((e) => e.valor ?? 2))
}

/** The biggest scheduled sale on a kind of style now, in percent off. */
export function scheduledSale(kind: CosmeticKind, now = Date.now()): number {
  return Math.max(0, ...activeEvents(now).filter((e) => e.tipo === 'rebajas' && (!e.detalle || e.detalle === kind)).map((e) => e.valor ?? 0))
}

/** The shop's prices as a percent of their own (the newest "precios" event that has started), 100 if none. */
export function priceFactor(now = Date.now()): number {
  return activeEvents(now).find((e) => e.tipo === 'precios')?.valor ?? 100
}

/** The test running on a style, if any. */
export function testFor(estilo: string, now = Date.now()): RunningTest | undefined {
  return load(now).tests.find((t) => t.estilo === estilo)
}

/** Which half of the players someone is in for a test: the same every time. */
export function testGroup(userId: string, testId: number): 'A' | 'B' {
  let h = testId * 2654435761
  for (const char of userId) h = (Math.imul(h, 31) + char.charCodeAt(0)) | 0
  return (h >>> 0) % 2 === 0 ? 'A' : 'B'
}
