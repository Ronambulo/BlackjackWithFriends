// Styles (docs/DISENO.md, "Estilos y tienda"): what the table, the cards, the
// chips and the avatar look like. Bought with coins, never chips, so spending
// in the shop never moves anyone in the ranking. The looks live in the app
// (frontend/src/cosmetics/themes.ts); here is only who owns what and what it costs.
import { and, eq, sql } from 'drizzle-orm'
import type { AchievementId } from './achievements.js'
import { db, type Tx } from './db.js'
import { HttpError } from './http.js'
import { priceFactor, scheduledSale, testFor, testGroup } from './schedule.js'
import { getSetting, setSetting } from './settings.js'
import { achievements, COSMETIC_KINDS, profiles, seasonStandings, userCosmetics, type CosmeticKind } from './schema.js'

/** How a style is had: everyone's, an achievement's, for winning weeks, or bought. */
export type Source = { from: 'gratis' } | { from: 'logro'; logro: AchievementId } | { from: 'trofeo'; trofeos: number } | { from: 'tienda'; precio: number }

export interface Cosmetic {
  id: string
  tipo: CosmeticKind
  source: Source
}

// Prices go up with how much the style changes: a colour, a print, a whole
// design, a special one, a legend, a myth. What a player makes a week:
// challenges 10 + 20 + 40 a day (up to 490), the week's close 10 for playing
// plus 100 / 60 / 30 for the podium, and 50 for each daily deck won in a group
// (shared among its players, ~70 in a group of 5). An active player makes
// some 400 a week, one who does everything up to ~950, plus ~750 once from
// achievements. So a colour is a couple of days, a design a week, a legend
// two and a half and a myth, the hardest, about a month.
const COLOUR = 100
const PRINT = 200
const DESIGN = 400
const SPECIAL = 600
const LEGEND = 1000
const MYTH = 1600

const free = { from: 'gratis' } as const
const shop = (precio: number) => ({ from: 'tienda', precio }) as const

/** In the order the shop shows them; each kind's first one is the free default. */
export const COSMETICS: readonly Cosmetic[] = [
  { id: 'tapete.verde', tipo: 'tapete', source: free },
  { id: 'tapete.azul', tipo: 'tapete', source: shop(COLOUR) },
  { id: 'tapete.burdeos', tipo: 'tapete', source: shop(COLOUR) },
  { id: 'tapete.morado', tipo: 'tapete', source: shop(COLOUR) },
  { id: 'tapete.grafito', tipo: 'tapete', source: shop(COLOUR) },
  { id: 'tapete.turquesa', tipo: 'tapete', source: shop(COLOUR) },
  { id: 'tapete.coral', tipo: 'tapete', source: shop(COLOUR) },
  { id: 'tapete.oliva', tipo: 'tapete', source: shop(COLOUR) },
  { id: 'tapete.abismo', tipo: 'tapete', source: shop(COLOUR) },
  { id: 'tapete.musgo', tipo: 'tapete', source: shop(COLOUR) },
  { id: 'tapete.madera', tipo: 'tapete', source: shop(PRINT) },
  { id: 'tapete.escoces', tipo: 'tapete', source: shop(PRINT) },
  { id: 'tapete.riviera', tipo: 'tapete', source: shop(PRINT) },
  { id: 'tapete.marmol', tipo: 'tapete', source: shop(PRINT) },
  { id: 'tapete.vichy', tipo: 'tapete', source: shop(PRINT) },
  { id: 'tapete.pixel', tipo: 'tapete', source: shop(DESIGN) },
  { id: 'tapete.obsidiana', tipo: 'tapete', source: shop(DESIGN) },
  { id: 'tapete.ondas', tipo: 'tapete', source: shop(DESIGN) },
  { id: 'tapete.cosmos', tipo: 'tapete', source: shop(SPECIAL) },
  { id: 'tapete.montecarlo', tipo: 'tapete', source: shop(LEGEND) },
  { id: 'tapete.holografico', tipo: 'tapete', source: shop(MYTH) },
  { id: 'tapete.medianoche', tipo: 'tapete', source: { from: 'logro', logro: 'blackjack100' } },
  { id: 'tapete.campeon', tipo: 'tapete', source: { from: 'trofeo', trofeos: 1 } },

  { id: 'dorso.rojo', tipo: 'dorso', source: free },
  { id: 'dorso.azul', tipo: 'dorso', source: shop(COLOUR) },
  { id: 'dorso.verde', tipo: 'dorso', source: shop(COLOUR) },
  { id: 'dorso.negro', tipo: 'dorso', source: shop(COLOUR) },
  { id: 'dorso.morado', tipo: 'dorso', source: shop(COLOUR) },
  { id: 'dorso.abismo', tipo: 'dorso', source: shop(COLOUR) },
  { id: 'dorso.musgo', tipo: 'dorso', source: shop(COLOUR) },
  { id: 'dorso.rombos', tipo: 'dorso', source: shop(PRINT) },
  { id: 'dorso.retro', tipo: 'dorso', source: shop(PRINT) },
  { id: 'dorso.carbono', tipo: 'dorso', source: shop(PRINT) },
  { id: 'dorso.artdeco', tipo: 'dorso', source: shop(DESIGN) },
  { id: 'dorso.pixel', tipo: 'dorso', source: shop(DESIGN) },
  { id: 'dorso.obsidiana', tipo: 'dorso', source: shop(DESIGN) },
  { id: 'dorso.cristal', tipo: 'dorso', source: shop(SPECIAL) },
  { id: 'dorso.kamikaze', tipo: 'dorso', source: { from: 'logro', logro: 'allIn' } },

  { id: 'cartas.clasicas', tipo: 'cartas', source: free },
  { id: 'cartas.pastel', tipo: 'cartas', source: shop(COLOUR) },
  { id: 'cartas.cuatro', tipo: 'cartas', source: shop(PRINT) },
  { id: 'cartas.vintage', tipo: 'cartas', source: shop(PRINT) },
  { id: 'cartas.noir', tipo: 'cartas', source: shop(DESIGN) },
  { id: 'cartas.neon', tipo: 'cartas', source: shop(DESIGN) },
  { id: 'cartas.sakura', tipo: 'cartas', source: shop(DESIGN) },
  { id: 'cartas.sangre', tipo: 'cartas', source: shop(DESIGN) },
  { id: 'cartas.acero', tipo: 'cartas', source: shop(DESIGN) },
  { id: 'cartas.cristal', tipo: 'cartas', source: shop(SPECIAL) },

  { id: 'fichas.casino', tipo: 'fichas', source: free },
  { id: 'fichas.retro', tipo: 'fichas', source: shop(COLOUR) },
  { id: 'fichas.pastel', tipo: 'fichas', source: shop(PRINT) },
  { id: 'fichas.mono', tipo: 'fichas', source: shop(PRINT) },
  { id: 'fichas.obsidiana', tipo: 'fichas', source: shop(PRINT) },
  { id: 'fichas.bosque', tipo: 'fichas', source: shop(PRINT) },
  { id: 'fichas.oceano', tipo: 'fichas', source: shop(PRINT) },
  { id: 'fichas.neon', tipo: 'fichas', source: shop(DESIGN) },
  { id: 'fichas.acero', tipo: 'fichas', source: shop(DESIGN) },
  { id: 'fichas.pixel', tipo: 'fichas', source: shop(SPECIAL) },
  { id: 'fichas.joyas', tipo: 'fichas', source: shop(LEGEND) },

  { id: 'marco.ninguno', tipo: 'marco', source: free },
  { id: 'marco.bronce', tipo: 'marco', source: shop(COLOUR) },
  { id: 'marco.plata', tipo: 'marco', source: shop(COLOUR) },
  { id: 'marco.hierro', tipo: 'marco', source: shop(COLOUR) },
  { id: 'marco.cobre', tipo: 'marco', source: shop(COLOUR) },
  { id: 'marco.oro', tipo: 'marco', source: shop(PRINT) },
  { id: 'marco.rosa', tipo: 'marco', source: shop(PRINT) },
  { id: 'marco.cromo', tipo: 'marco', source: shop(PRINT) },
  { id: 'marco.oceano', tipo: 'marco', source: shop(PRINT) },
  { id: 'marco.neon', tipo: 'marco', source: shop(DESIGN) },
  { id: 'marco.fuego', tipo: 'marco', source: shop(DESIGN) },
  { id: 'marco.hielo', tipo: 'marco', source: shop(DESIGN) },
  { id: 'marco.hiedra', tipo: 'marco', source: shop(DESIGN) },
  { id: 'marco.sombra', tipo: 'marco', source: shop(DESIGN) },
  { id: 'marco.arcoiris', tipo: 'marco', source: shop(SPECIAL) },
  { id: 'marco.diablo', tipo: 'marco', source: shop(SPECIAL) },
  { id: 'marco.flores', tipo: 'marco', source: shop(SPECIAL) },
  { id: 'marco.angel', tipo: 'marco', source: shop(SPECIAL) },
  { id: 'marco.orbita', tipo: 'marco', source: shop(SPECIAL) },
  { id: 'marco.diamante', tipo: 'marco', source: shop(LEGEND) },
  { id: 'marco.corona', tipo: 'marco', source: shop(MYTH) },
  { id: 'marco.laurel', tipo: 'marco', source: { from: 'trofeo', trofeos: 5 } },
]

const byId = new Map(COSMETICS.map((c) => [c.id, c]))
const DEFAULTS = Object.fromEntries(COSMETIC_KINDS.map((k) => [k, COSMETICS.find((c) => c.tipo === k)!.id])) as Record<CosmeticKind, string>

// ── What the admins change (settings 'shop') ────────────────────────────────

/** One style's changes: its own price, a sale price, and whether it's sold (a shop style starts retired until an admin puts it on sale). */
export interface ShopItem {
  precio?: number
  oferta?: number
  retirado?: boolean
}

/** On top of the catalogue above, so a new style in the code just shows up. */
export interface ShopSettings {
  items: Record<string, ShopItem>
  /** Each kind's styles in the order the admins put them (the free one stays first). */
  order: Partial<Record<CosmeticKind, string[]>>
  /** A percentage off everything sold, 0 for none. */
  rebaja: number
}

export function shopSettings(): ShopSettings {
  const saved = getSetting<Partial<ShopSettings>>('shop')
  return { items: saved?.items ?? {}, order: saved?.order ?? {}, rebaja: saved?.rebaja ?? 0 }
}

function saveShopSettings(next: ShopSettings) {
  const items = Object.fromEntries(Object.entries(next.items).filter(([, item]) => Object.keys(item).length > 0))
  setSetting('shop', { items, order: next.order, rebaja: next.rebaja })
}

/** A style as the shop has it now: its source with today's price, and the price before a sale. */
export interface Listed {
  cosmetic: Cosmetic
  source: Source
  /** The price without the sale, when there is one. */
  antes?: number
  retirado: boolean
}

/** One kind in the admins' order: the saved ones first, and one they haven't placed after the one it follows in the code. */
function ordered(kind: CosmeticKind, saved: string[] | undefined): Cosmetic[] {
  const [free, ...rest] = COSMETICS.filter((c) => c.tipo === kind)
  const list = (saved ?? []).map((id) => byId.get(id)).filter((c): c is Cosmetic => !!c && c.tipo === kind && c !== free)
  const placed = new Set(list)
  rest.forEach((c, i) => {
    if (placed.has(c)) return
    list.splice(i === 0 ? 0 : list.indexOf(rest[i - 1]) + 1, 0, c)
    placed.add(c)
  })
  return [free, ...list]
}

/**
 * Every style in the shop's order with today's prices: the admins' own, scaled by a scheduled
 * price change, then the best sale. For a player in group B of a price test, that test's price.
 */
export function catalogue(settings = shopSettings(), userId?: string): Listed[] {
  const factor = priceFactor()
  return COSMETIC_KINDS.flatMap((kind) => ordered(kind, settings.order[kind])).map((cosmetic): Listed => {
    if (cosmetic.source.from !== 'tienda') return { cosmetic, source: cosmetic.source, retirado: false }
    const own = settings.items[cosmetic.id] ?? {}
    const test = userId ? testFor(cosmetic.id) : undefined
    const base =
      test && testGroup(userId!, test.id) === 'B'
        ? test.precioB
        : Math.max(1, Math.round(((own.precio ?? cosmetic.source.precio) * factor) / 100))
    const rebaja = Math.max(settings.rebaja, scheduledSale(cosmetic.tipo))
    const sale = Math.max(1, Math.round((base * (100 - rebaja)) / 100))
    const precio = Math.min(base, own.oferta ?? base, sale)
    return {
      cosmetic,
      source: { from: 'tienda', precio },
      antes: precio < base ? base : undefined,
      retirado: own.retirado !== false,
    }
  })
}

export type Equipped = Record<CosmeticKind, string>

/** The ids of every style the player has: free ones, earned ones and bought ones. */
export function ownedCosmetics(tx: Tx, userId: string): Set<string> {
  const bought = tx.select({ id: userCosmetics.estilo }).from(userCosmetics).where(eq(userCosmetics.userId, userId)).all()
  const unlocked = new Set(
    tx
      .select({ logro: achievements.logro })
      .from(achievements)
      .where(eq(achievements.userId, userId))
      .all()
      .map((row) => row.logro),
  )
  const trophies =
    tx
      .select({ n: sql<number>`count(*)` })
      .from(seasonStandings)
      .where(and(eq(seasonStandings.userId, userId), eq(seasonStandings.trofeo, true)))
      .get()?.n ?? 0
  const owned = new Set(bought.map((row) => row.id))
  for (const c of COSMETICS) {
    const s = c.source
    if (s.from === 'gratis' || (s.from === 'logro' && unlocked.has(s.logro)) || (s.from === 'trofeo' && trophies >= s.trofeos)) owned.add(c.id)
  }
  return owned
}

/** The avatar frame a player wears, for lists of other players (null: none). */
export const frameColumn = () =>
  sql<string | null>`nullif(json_extract(${profiles.estilosEquipados}, '$.marco'), 'marco.ninguno')`

/** What the player has on, each kind filled in with its free style. */
export function equipped(saved: Partial<Record<CosmeticKind, string>> | null | undefined): Equipped {
  const result = { ...DEFAULTS }
  for (const kind of COSMETIC_KINDS) {
    const id = saved?.[kind]
    if (id && byId.get(id)?.tipo === kind) result[kind] = id
  }
  return result
}

/** GET /api/cosmetics: the catalogue, what the player has and what they wear. */
export function cosmeticsFor(userId: string) {
  return db().transaction((tx) => {
    const owned = ownedCosmetics(tx, userId)
    const profile = tx.select({ monedas: profiles.monedas, estilos: profiles.estilosEquipados }).from(profiles).where(eq(profiles.id, userId)).get()
    return {
      monedas: profile?.monedas ?? 0,
      equipped: equipped(profile?.estilos),
      // Out of the shop, a style is still there for whoever has it.
      items: catalogue(undefined, userId)
        .filter((l) => !l.retirado || owned.has(l.cosmetic.id))
        .map((l) => ({ id: l.cosmetic.id, tipo: l.cosmetic.tipo, ...l.source, antes: l.antes, owned: owned.has(l.cosmetic.id) })),
    }
  })
}

function wear(tx: Tx, userId: string, cosmetic: Cosmetic) {
  const row = tx.select({ estilos: profiles.estilosEquipados }).from(profiles).where(eq(profiles.id, userId)).get()
  tx.update(profiles)
    .set({ estilosEquipados: { ...row?.estilos, [cosmetic.tipo]: cosmetic.id } })
    .where(eq(profiles.id, userId))
    .run()
}

function find(id: unknown): Cosmetic {
  const cosmetic = typeof id === 'string' ? byId.get(id) : undefined
  if (!cosmetic) throw new HttpError(404, 'No existe ese estilo')
  return cosmetic
}

/** Puts on a style the player has. */
export function equipCosmetic(userId: string, id: unknown) {
  const cosmetic = find(id)
  db().transaction((tx) => {
    if (!ownedCosmetics(tx, userId).has(cosmetic.id)) throw new HttpError(403, 'Todavía no tienes ese estilo')
    wear(tx, userId, cosmetic)
  })
}

/** Buys a shop style with coins and puts it on, at the price the player saw. */
export function buyCosmetic(userId: string, id: unknown, seen: unknown) {
  const cosmetic = find(id)
  const listed = catalogue(undefined, userId).find((l) => l.cosmetic === cosmetic)!
  const source = listed.source
  if (source.from !== 'tienda') throw new HttpError(400, 'Ese estilo no se vende')
  if (listed.retirado) throw new HttpError(410, 'Ese estilo ya no está a la venta')
  if (typeof seen === 'number' && seen !== source.precio) throw new HttpError(409, 'El precio ha cambiado')
  db().transaction((tx) => {
    if (ownedCosmetics(tx, userId).has(cosmetic.id)) throw new HttpError(409, 'Ya tienes ese estilo')
    const paid = tx
      .update(profiles)
      .set({ monedas: sql`${profiles.monedas} - ${source.precio}` })
      .where(and(eq(profiles.id, userId), sql`${profiles.monedas} >= ${source.precio}`))
      .returning({ monedas: profiles.monedas })
      .get()
    if (!paid) throw new HttpError(402, 'No tienes monedas suficientes')
    tx.insert(userCosmetics).values({ userId, estilo: cosmetic.id, monedas: source.precio }).run()
    wear(tx, userId, cosmetic)
  })
}

/** For the admin panel: how many bought and wear each style. */
export function cosmeticStats() {
  const bought = db()
    .select({ id: userCosmetics.estilo, n: sql<number>`count(*)`, monedas: sql<number>`sum(${userCosmetics.monedas})` })
    .from(userCosmetics)
    .groupBy(userCosmetics.estilo)
    .all()
  const wearing = db()
    .select({ estilos: profiles.estilosEquipados })
    .from(profiles)
    .all()
  const worn = new Map<string, number>()
  for (const row of wearing) for (const id of Object.values(equipped(row.estilos))) worn.set(id, (worn.get(id) ?? 0) + 1)
  const boughtBy = new Map(bought.map((row) => [row.id, row]))
  const settings = shopSettings()
  return {
    rebaja: settings.rebaja,
    items: catalogue(settings).map(({ cosmetic: c, source, antes, retirado }) => ({
      id: c.id,
      tipo: c.tipo,
      ...source,
      antes,
      retirado,
      // The price in the code, and what the admins set instead.
      serie: c.source.from === 'tienda' ? c.source.precio : null,
      propio: settings.items[c.id]?.precio ?? null,
      oferta: settings.items[c.id]?.oferta ?? null,
      bought: boughtBy.get(c.id)?.n ?? 0,
      coins: boughtBy.get(c.id)?.monedas ?? 0,
      wearing: worn.get(c.id) ?? 0,
    })),
  }
}

function price(value: unknown, max = 1_000_000): number {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 1 || value > max) throw new HttpError(400, 'Precio no válido')
  return value
}

/** An admin sets a shop style's price, its sale price and whether it's sold; null puts a price back. Returns it for the log. */
export function setShopItem(id: unknown, body: { precio?: unknown; oferta?: unknown; retirado?: unknown }): string {
  const cosmetic = find(id)
  if (cosmetic.source.from !== 'tienda') throw new HttpError(400, 'Ese estilo no se vende')
  const item: ShopItem = {}
  if (body.precio != null) {
    const n = price(body.precio)
    if (n !== cosmetic.source.precio) item.precio = n
  }
  const base = item.precio ?? cosmetic.source.precio
  if (body.oferta != null) item.oferta = price(body.oferta, base - 1)
  // Retired is how a shop style starts, so only being on sale is stored.
  if (body.retirado === false) item.retirado = false
  else if (body.retirado != null && body.retirado !== true) throw new HttpError(400, 'Valor no válido')
  const settings = shopSettings()
  saveShopSettings({ ...settings, items: { ...settings.items, [cosmetic.id]: item } })
  return [String(base), item.oferta && `oferta ${item.oferta}`, item.retirado !== false && 'retirado'].filter(Boolean).join(' · ')
}

/** An admin puts one kind's styles in a new order. */
export function setShopOrder(tipo: unknown, ids: unknown): CosmeticKind {
  if (!COSMETIC_KINDS.includes(tipo as CosmeticKind)) throw new HttpError(400, 'Tipo no válido')
  if (!Array.isArray(ids) || ids.some((id) => byId.get(id)?.tipo !== tipo)) throw new HttpError(400, 'Orden no válido')
  const kind = tipo as CosmeticKind
  const settings = shopSettings()
  saveShopSettings({ ...settings, order: { ...settings.order, [kind]: [...new Set(ids as string[])] } })
  return kind
}

/** An admin puts everything sold on sale (0 ends it). */
export function setShopSale(rebaja: unknown): number {
  if (typeof rebaja !== 'number' || !Number.isInteger(rebaja) || rebaja < 0 || rebaja > 90) throw new HttpError(400, 'Rebaja no válida')
  saveShopSettings({ ...shopSettings(), rebaja })
  return rebaja
}
