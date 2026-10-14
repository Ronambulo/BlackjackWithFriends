/** Error from our own /api, with the HTTP status. */
export class ApiError extends Error {
  readonly status: number
  constructor(status: number, message: string) {
    super(message)
    this.name = 'ApiError'
    this.status = status
  }
}

/** JSON request to the backend (same origin, so the session cookie goes along). */
export async function api<T>(path: string, init?: { method?: string; body?: unknown }): Promise<T> {
  const response = await fetch(`/api${path}`, {
    method: init?.method ?? 'GET',
    headers: init?.body === undefined ? undefined : { 'content-type': 'application/json' },
    body: init?.body === undefined ? undefined : JSON.stringify(init.body),
    credentials: 'same-origin',
  })
  const data = (await response.json().catch(() => null)) as { error?: string } | null
  if (!response.ok) throw new ApiError(response.status, data?.error ?? response.statusText)
  return data as T
}
