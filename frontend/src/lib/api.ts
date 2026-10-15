/** Error from our own /api, with the HTTP status. */
export class ApiError extends Error {
  readonly status: number
  constructor(status: number, message: string) {
    super(message)
    this.name = 'ApiError'
    this.status = status
  }
}

/** Fired on a 503 from the API. */
export const UNAVAILABLE = 'bwf:unavailable'

/** JSON request to the backend (same origin, so the session cookie goes along). A Blob body goes as is. */
export async function api<T>(path: string, init?: { method?: string; body?: unknown }): Promise<T> {
  const body = init?.body
  const raw = body instanceof Blob
  const response = await fetch(`/api${path}`, {
    method: init?.method ?? 'GET',
    headers: body === undefined ? undefined : { 'content-type': raw ? body.type : 'application/json' },
    body: body === undefined ? undefined : raw ? body : JSON.stringify(body),
    credentials: 'same-origin',
  })
  const data = (await response.json().catch(() => null)) as { error?: string } | null
  // The server may have gone into maintenance: the app checks (maintenance/useMaintenance.ts).
  if (response.status === 503 && typeof window !== 'undefined') window.dispatchEvent(new Event(UNAVAILABLE))
  if (!response.ok) throw new ApiError(response.status, data?.error ?? response.statusText)
  return data as T
}
