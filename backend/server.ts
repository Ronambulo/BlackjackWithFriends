// The API server: applies pending migrations, then serves api/index.ts on
// http://127.0.0.1:3001. In the container only Next is public and reaches it
// through its /api rewrite.
import { existsSync } from 'node:fs'
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http'
import { join } from 'node:path'
import { Readable } from 'node:stream'
import { pipeline } from 'node:stream/promises'
import type { ReadableStream as WebReadableStream } from 'node:stream/web'

const envFile = join(import.meta.dirname, '.env.local')
if (existsSync(envFile)) process.loadEnvFile(envFile)

const HOST = process.env.HOST ?? '127.0.0.1'
const PORT = Number(process.env.PORT ?? 3001)

// Imported after loading .env.local so the env is ready when modules initialise.
const { databasePath, migrate } = await import('./lib/db.js')
const { default: api } = await import('./api/index.js')

migrate()
// A copy of the database a day, in backups/ next to it (lib/backup.ts).
const { scheduleBackups } = await import('./lib/backup.js')
scheduleBackups()
// Closes the week on Monday 00:00 in Madrid: podiums, prizes and the ceremony (lib/season.ts).
const { scheduleSeasons } = await import('./lib/season.js')
scheduleSeasons()
// Gives the daily deck's prizes at midnight in Madrid and deals the new one (lib/daily.ts).
const { scheduleDaily } = await import('./lib/daily.js')
scheduleDaily()
// Achievements earned before they existed, or while the server was off (lib/achievements.ts).
const { syncAllAchievements } = await import('./lib/achievements.js')
syncAllAchievements()
// Reminders at set times: the daily pay, the week about to close (lib/push.ts).
const { schedulePush } = await import('./lib/push.js')
schedulePush()
console.log(`Base de datos en ${databasePath()}`)

async function toRequest(req: IncomingMessage, url: URL): Promise<Request> {
  const headers = new Headers()
  for (const [key, value] of Object.entries(req.headers)) {
    if (Array.isArray(value)) value.forEach((v) => headers.append(key, v))
    else if (value !== undefined) headers.set(key, value)
  }
  let body: Uint8Array<ArrayBuffer> | undefined
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    const chunks: Buffer[] = []
    for await (const chunk of req) chunks.push(chunk as Buffer)
    body = new Uint8Array(Buffer.concat(chunks))
  }
  return new Request(url, { method: req.method, headers, body })
}

async function send(res: ServerResponse, response: Response): Promise<void> {
  // Set-Cookie can repeat, so it can't go through a plain object.
  const headers: Record<string, string | string[]> = Object.fromEntries(response.headers)
  const cookies = response.headers.getSetCookie()
  if (cookies.length > 0) headers['set-cookie'] = cookies
  res.writeHead(response.status, headers)
  if (!response.body) return void res.end()
  // Streamed, not buffered: /api/events stays open. If the player goes away,
  // pipeline cancels the stream, which unsubscribes it.
  try {
    await pipeline(Readable.fromWeb(response.body as WebReadableStream), res)
  } catch {
    // The connection closed before the end: nothing left to send.
  }
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url ?? '/', `http://${req.headers.host ?? 'localhost'}`)
  const started = performance.now()
  let response: Response
  try {
    response = url.pathname.startsWith('/api')
      ? await api.fetch(await toRequest(req, url))
      : Response.json({ error: 'No existe' }, { status: 404 })
  } catch (err) {
    console.error(err)
    response = Response.json({ error: 'Error interno' }, { status: 500 })
  }
  await send(res, response)
  if (url.pathname !== '/api/health' && url.pathname !== '/api/events') {
    console.log(`${req.method} ${url.pathname} → ${response.status} (${Math.round(performance.now() - started)} ms)`)
  }
})

server.listen(PORT, HOST, () => {
  console.log(`API en http://${HOST}:${PORT}/api`)
})

// supervisord and docker stop send SIGTERM: finish what's in flight and close.
for (const signal of ['SIGTERM', 'SIGINT'] as const) {
  process.once(signal, () => server.close(() => process.exit(0)))
}
