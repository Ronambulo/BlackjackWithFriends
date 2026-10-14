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
