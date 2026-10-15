import { and, count, eq, gt } from 'drizzle-orm'
import { requireUser } from '../lib/auth.js'
import { db } from '../lib/db.js'
import { HttpError, json } from '../lib/http.js'
import { reports } from '../lib/schema.js'

const TEXT_MIN = 5
const TEXT_MAX = 1000
// Enough to report everything that broke in a day, not enough to flood the admins.
const PER_DAY = 5
const DAY_MS = 24 * 60 * 60 * 1000

// POST /api/reports { texto, ruta? }: a player tells the admins something went wrong.
export async function postReport(request: Request): Promise<Response> {
  const me = await requireUser(request)
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null
  if (!body || typeof body !== 'object') throw new HttpError(400, 'Cuerpo no válido')
  const texto = typeof body.texto === 'string' ? body.texto.trim() : ''
  if (texto.length < TEXT_MIN || texto.length > TEXT_MAX) throw new HttpError(400, 'Cuéntanos un poco más')
  const ruta = typeof body.ruta === 'string' ? body.ruta.slice(0, 200) : null
  const d = db()
  const recent = d
    .select({ n: count() })
    .from(reports)
    .where(and(eq(reports.userId, me.id), gt(reports.createdAt, new Date(Date.now() - DAY_MS))))
    .get()!.n
  if (recent >= PER_DAY) throw new HttpError(429, 'Ya has enviado muchos avisos hoy')
  d.insert(reports)
    .values({ userId: me.id, texto, ruta, dispositivo: request.headers.get('user-agent')?.slice(0, 300) ?? null })
    .run()
  return json({ ok: true }, 201)
}
