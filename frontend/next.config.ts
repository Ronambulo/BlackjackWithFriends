import { join } from 'node:path'
import type { NextConfig } from 'next'

// /api goes to the backend (backend/server.ts), so the browser only ever talks to one
// origin (no CORS). It listens on 127.0.0.1:3001 both locally and in the container.
// Rewrites are fixed at build time, so API_ORIGIN must be set when building.
const apiOrigin = process.env.API_ORIGIN ?? 'http://127.0.0.1:3001'
const root = join(import.meta.dirname, '..')

const nextConfig: NextConfig = {
  devIndicators: false,
  // A self-contained server (.next/standalone) for the Docker image.
  output: 'standalone',
  // npm workspaces hoist the dependencies to the repo root.
  outputFileTracingRoot: root,
  turbopack: { root },
  env: {
    // Lets an open app notice that a newer version is live (src/pwa/RegisterServiceWorker.tsx).
    // The Docker build passes the commit.
    NEXT_PUBLIC_BUILD_ID: process.env.BUILD_ID ?? 'dev',
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
