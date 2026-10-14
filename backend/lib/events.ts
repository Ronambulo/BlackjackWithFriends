// Live updates: each open app keeps GET /api/events open (server-sent events) and,
// when something another player sees changes, the API pushes a short event so the
// app refetches just that data. Everything lives in memory: the API is one process.
import { eq, sql } from 'drizzle-orm'
import { db } from './db.js'
import { groupMembers } from './schema.js'

type Listener = () => void

const listeners = new Map<string, Set<Listener>>()

function subscribe(userId: string, listener: Listener): () => void {
  let set = listeners.get(userId)
  if (!set) listeners.set(userId, (set = new Set()))
  set.add(listener)
  return () => {
    set.delete(listener)
    if (set.size === 0) listeners.delete(userId)
  }
}

/** Everyone who shares a group with the player, the player included. */
export function groupmates(userId: string): string[] {
  return db()
    .selectDistinct({ userId: groupMembers.userId })
    .from(groupMembers)
    .where(
      sql`${groupMembers.groupId} in (select ${groupMembers.groupId} from ${groupMembers} where ${eq(groupMembers.userId, userId)})`,
    )
    .all()
    .map((row) => row.userId)
}

/** Tells these players' open apps that their groups changed. */
export function notifyGroups(userIds: Iterable<string>) {
  for (const userId of userIds) listeners.get(userId)?.forEach((listener) => listener())
}

const encoder = new TextEncoder()

/** The event stream for one open app. */
export function eventStream(userId: string): Response {
  let close = () => {}
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      const write = (text: string) => controller.enqueue(encoder.encode(text))
      // Reconnect quickly if the connection drops.
      write('retry: 3000\n\n')
      const unsubscribe = subscribe(userId, () => write('event: groups\ndata: {}\n\n'))
      // Proxies (Cloudflare drops idle connections after 100 s) must see traffic.
      const ping = setInterval(() => write(': ping\n\n'), 25_000)
      close = () => {
        clearInterval(ping)
        unsubscribe()
      }
    },
    cancel() {
      close()
    },
  })
  return new Response(body, {
    headers: {
      'content-type': 'text/event-stream',
      // no-transform: neither Next's compression nor Cloudflare may buffer it.
      'cache-control': 'no-cache, no-transform',
      'x-accel-buffering': 'no',
    },
  })
}
