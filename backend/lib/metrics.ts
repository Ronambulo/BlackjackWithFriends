// Errors and response times since the API started, in memory: enough to see
// whether something is slow or failing without an outside service.

const KEEP = 500
const RECENT_ERRORS = 20

interface RouteStats {
  count: number
  errors: number
  // the last KEEP response times, in ms
  times: number[]
}

const routes = new Map<string, RouteStats>()
const errors: { at: number; route: string; status: number; message: string }[] = []

/** Paths with an id or a file name in them count as one route. */
function routeOf(path: string) {
  return path.startsWith('/api/media/') ? '/api/media/*' : path.replace(/\/+$/, '')
}

export function record(path: string, status: number, ms: number) {
  const route = routeOf(path)
  const stats = routes.get(route) ?? { count: 0, errors: 0, times: [] }
  stats.count++
  if (status >= 500) stats.errors++
  stats.times.push(ms)
  if (stats.times.length > KEEP) stats.times.shift()
  routes.set(route, stats)
}

export function recordError(path: string, status: number, err: unknown) {
  errors.push({ at: Date.now(), route: routeOf(path), status, message: err instanceof Error ? err.message : String(err) })
  if (errors.length > RECENT_ERRORS) errors.shift()
}

function percentile(sorted: number[], p: number) {
  return sorted.length ? sorted[Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length))] : 0
}

export function snapshot() {
  const list = [...routes].map(([route, stats]) => {
    const sorted = [...stats.times].sort((a, b) => a - b)
    return {
      route,
      count: stats.count,
      errors: stats.errors,
      p50: Math.round(percentile(sorted, 50)),
      p95: Math.round(percentile(sorted, 95)),
    }
  })
  const count = list.reduce((sum, route) => sum + route.count, 0)
  return {
    count,
    errors: list.reduce((sum, route) => sum + route.errors, 0),
    routes: list.sort((a, b) => b.p95 - a.p95).slice(0, 12),
    recent: [...errors].reverse(),
  }
}
