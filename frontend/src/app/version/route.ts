// The build the server is running. The client compares it with the one it was
// built with and reloads when they differ (see RegisterServiceWorker).
export const dynamic = 'force-dynamic'

export function GET() {
  return Response.json(
    { buildId: process.env.NEXT_PUBLIC_BUILD_ID },
    { headers: { 'Cache-Control': 'no-store' } },
  )
}
