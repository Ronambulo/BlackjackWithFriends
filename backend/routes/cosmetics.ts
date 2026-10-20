import { requireUser } from '../lib/auth.js'
import { buyCosmetic, cosmeticsFor, equipCosmetic, eventId, openEventBox } from '../lib/cosmetics.js'
import { HttpError, json } from '../lib/http.js'

async function readBody(request: Request): Promise<{ id?: unknown; precio?: unknown }> {
  const body = (await request.json().catch(() => null)) as { id?: unknown; precio?: unknown } | null
  if (!body || typeof body !== 'object') throw new HttpError(400, 'Falta el estilo')
  return body
}

// GET /api/cosmetics: every style, which ones the player has and which they wear.
export async function getCosmetics(request: Request): Promise<Response> {
  const me = await requireUser(request)
  return json(cosmeticsFor(me.id))
}

// POST /api/cosmetics/equip { id }: puts on a style the player has.
export async function postEquip(request: Request): Promise<Response> {
  const me = await requireUser(request)
  equipCosmetic(me.id, (await readBody(request)).id)
  return json(cosmeticsFor(me.id))
}

// POST /api/cosmetics/buy { id, precio }: pays for a shop style with coins and puts it on.
// precio is what the player saw: if an admin changed it since, nothing is charged.
export async function postBuy(request: Request): Promise<Response> {
  const me = await requireUser(request)
  const body = await readBody(request)
  buyCosmetic(me.id, body.id, body.precio)
  return json(cosmeticsFor(me.id))
}

// POST /api/cosmetics/box { evento, precio }: the event box's price for one of its styles the player doesn't have, picked at random.
export async function postEventBox(request: Request): Promise<Response> {
  const me = await requireUser(request)
  const body = (await request.json().catch(() => null)) as { evento?: unknown; precio?: unknown } | null
  const won = openEventBox(me.id, eventId(body?.evento), body?.precio)
  return json({ ...cosmeticsFor(me.id), won })
}
