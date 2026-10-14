// Local stand-in for Vercel: serves the API function (api/index.ts) on
// http://localhost:3001. Not deployed; Vercel ignores this file.
import { existsSync } from 'node:fs'
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http'
import { join } from 'node:path'

const PORT = Number(process.env.PORT ?? 3001)

if (existsSync(join(import.meta.dirname, '.env.local'))) process.loadEnvFile(join(import.meta.dirname, '.env.local'))

// Imported after loading .env.local so the env is ready when modules initialise.
const { default: api } = await import('./api/index.js')

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
  res.end(Buffer.from(await response.arrayBuffer()))
}

createServer(async (req, res) => {
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
  console.log(`${req.method} ${url.pathname} → ${response.status} (${Math.round(performance.now() - started)} ms)`)
}).listen(PORT, () => {
  console.log(`API local en http://localhost:${PORT}/api`)
})
