// Local stand-in for Vercel Functions: serves api/**/*.ts on http://localhost:3001
// the way Vercel does (file = route, exported GET/POST/... = method, [param]
// segments arrive as query parameters). Not deployed; Vercel ignores this file.
import { existsSync, readdirSync } from 'node:fs'
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http'
import { join, relative } from 'node:path'
import { pathToFileURL } from 'node:url'

const PORT = Number(process.env.PORT ?? 3001)
const API_DIR = join(import.meta.dirname, 'api')

if (existsSync(join(import.meta.dirname, '.env.local'))) process.loadEnvFile(join(import.meta.dirname, '.env.local'))

type Handler = (request: Request) => Response | Promise<Response>

/** Every function file as route segments, e.g. api/og/invite/[code].ts → ['og', 'invite', '[code]']. */
function listRoutes(dir = API_DIR): string[][] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name)
    if (entry.isDirectory()) return listRoutes(path)
    if (!entry.name.endsWith('.ts')) return []
    const segments = relative(API_DIR, path).replace(/\.ts$/, '').split(/[\\/]/)
    return [segments.at(-1) === 'index' ? segments.slice(0, -1) : segments]
  })
}

function matchRoute(pathSegments: string[]): { file: string; params: Record<string, string> } | null {
  // Static routes win over dynamic ones, like on Vercel.
  const routes = listRoutes().sort((a, b) => a.filter(isDynamic).length - b.filter(isDynamic).length)
  for (const route of routes) {
    if (route.length !== pathSegments.length) continue
    const params: Record<string, string> = {}
    const matches = route.every((segment, i) => {
      if (isDynamic(segment)) {
        params[segment.slice(1, -1)] = decodeURIComponent(pathSegments[i])
        return true
      }
      return segment === pathSegments[i]
    })
    if (!matches) continue
    const fileSegments = existsSync(join(API_DIR, ...route) + '.ts') ? route : [...route, 'index']
    return { file: join(API_DIR, ...fileSegments) + '.ts', params }
  }
  return null
}

function isDynamic(segment: string): boolean {
  return segment.startsWith('[') && segment.endsWith(']')
}

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
  res.writeHead(response.status, Object.fromEntries(response.headers))
  res.end(Buffer.from(await response.arrayBuffer()))
}

createServer(async (req, res) => {
  const url = new URL(req.url ?? '/', `http://${req.headers.host ?? 'localhost'}`)
  const started = performance.now()
  let response: Response
  try {
    const segments = url.pathname.split('/').filter(Boolean)
    const route = segments[0] === 'api' ? matchRoute(segments.slice(1)) : null
    if (!route) {
      response = Response.json({ error: 'No existe' }, { status: 404 })
    } else {
      for (const [key, value] of Object.entries(route.params)) url.searchParams.set(key, value)
      // tsx watch restarts the server when a file changes, so a plain import is enough.
      const mod = (await import(pathToFileURL(route.file).href)) as Record<string, Handler | undefined>
      const fn = mod[req.method ?? 'GET'] ?? mod.default
      response = fn
        ? await fn(await toRequest(req, url))
        : Response.json({ error: 'Método no permitido' }, { status: 405 })
    }
  } catch (err) {
    console.error(err)
    response = Response.json({ error: 'Error interno' }, { status: 500 })
  }
  await send(res, response)
  console.log(`${req.method} ${url.pathname} → ${response.status} (${Math.round(performance.now() - started)} ms)`)
}).listen(PORT, () => {
  console.log(`API local en http://localhost:${PORT}/api`)
})
