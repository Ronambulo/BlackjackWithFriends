/** Error that becomes a JSON response with the given status. */
export class HttpError extends Error {
  readonly status: number
  constructor(status: number, message: string) {
    super(message)
    this.name = 'HttpError'
    this.status = status
  }
}

export function json(body: unknown, status = 200): Response {
  return Response.json(body, { status })
}

/** Wraps a handler so thrown HttpErrors (and anything unexpected) become JSON responses. */
export function handler(fn: (request: Request) => Promise<Response> | Response) {
  return async (request: Request): Promise<Response> => {
    try {
      return await fn(request)
    } catch (err) {
      if (err instanceof HttpError) return json({ error: err.message }, err.status)
      console.error(err)
      return json({ error: 'Error interno' }, 500)
    }
  }
}
