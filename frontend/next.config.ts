import { join } from 'node:path'
import type { NextConfig } from 'next'

// /api goes to the backend project, so the browser only ever talks to one origin (no CORS).
// Locally that is backend/dev-server.ts (npm run dev at the repo root).
const apiOrigin =
  process.env.API_ORIGIN ??
  (process.env.VERCEL ? 'https://blackjackwithfriends-backend.vercel.app' : 'http://localhost:3001')

const nextConfig: NextConfig = {
  devIndicators: false,
  // npm workspaces hoist the dependencies to the repo root.
  turbopack: { root: join(import.meta.dirname, '..') },
  env: {
    // VITE_* fallbacks keep deployments working with the env vars from the Vite days.
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.VITE_SUPABASE_URL ?? '',
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.VITE_SUPABASE_PUBLISHABLE_KEY ?? '',
    // Lets an open app notice that a newer deployment is live (src/pwa/autoUpdate.ts).
    NEXT_PUBLIC_BUILD_ID: process.env.VERCEL_DEPLOYMENT_ID ?? process.env.VERCEL_GIT_COMMIT_SHA ?? 'dev',
  },
  async rewrites() {
    return [{ source: '/api/:path*', destination: `${apiOrigin}/api/:path*` }]
  },
  async headers() {
    return [
      {
        // Otherwise the browser may keep using an old copy of the service worker script.
        source: '/sw.js',
        headers: [{ key: 'Cache-Control', value: 'no-cache, no-store, must-revalidate' }],
      },
    ]
  },
}

export default nextConfig
