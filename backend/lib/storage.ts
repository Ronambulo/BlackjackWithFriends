import { randomBytes } from 'node:crypto'
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { databasePath } from './db.js'

// A tiny object store for what players upload (profile photos): plain files in the
// data volume, next to the database, under keys like "avatars/abc123.webp". The API
// serves them at /api/media/<key>. Keys are never reused, so they can be cached forever.

const TYPES = { webp: 'image/webp', png: 'image/png', jpg: 'image/jpeg' } as const
export type MediaType = (typeof TYPES)[keyof typeof TYPES]

const KEY_RE = /^[a-z]+\/[A-Za-z0-9_-]{8,80}\.(webp|png|jpg)$/

/** MEDIA_PATH, or a media/ folder beside the database (so /data/media in the container). */
export function mediaPath(): string {
  return process.env.MEDIA_PATH ?? resolve(dirname(databasePath()), 'media')
}

/** Where a key lives on disk, or null for anything that isn't a well-formed key. */
function fileFor(key: string): string | null {
  return KEY_RE.test(key) ? join(mediaPath(), key) : null
}

/** What an image really is, from its first bytes, whatever the request claims. */
export function sniffImage(bytes: Uint8Array): MediaType | null {
  const ascii = (from: number, to: number) => String.fromCharCode(...bytes.subarray(from, to))
  if (bytes.length > 12 && ascii(0, 4) === 'RIFF' && ascii(8, 12) === 'WEBP') return TYPES.webp
  if (bytes.length > 8 && bytes[0] === 0x89 && ascii(1, 4) === 'PNG') return TYPES.png
  if (bytes.length > 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return TYPES.jpg
  return null
}

/** Stores the bytes under a new random key in `folder` and returns the key. */
export function putObject(folder: string, bytes: Uint8Array, type: MediaType): string {
  const extension = Object.entries(TYPES).find(([, value]) => value === type)![0]
  const key = `${folder}/${randomBytes(12).toString('base64url')}.${extension}`
  const file = fileFor(key)!
  mkdirSync(dirname(file), { recursive: true })
  writeFileSync(file, bytes)
  return key
}

export function getObject(key: string): { bytes: Buffer; type: MediaType } | null {
  const file = fileFor(key)
  if (!file) return null
  try {
    const extension = key.slice(key.lastIndexOf('.') + 1) as keyof typeof TYPES
    return { bytes: readFileSync(file), type: TYPES[extension] }
  } catch {
    return null
  }
}

export function deleteObject(key: string) {
  const file = fileFor(key)
  if (file) rmSync(file, { force: true })
}

const URL_PREFIX = '/api/media/'

export function mediaUrl(key: string) {
  return URL_PREFIX + key
}

/** The key behind one of our own media URLs, or null if it points elsewhere. */
export function keyOf(url: string | null): string | null {
  return url?.startsWith(URL_PREFIX) ? url.slice(URL_PREFIX.length) : null
}

// GET /api/media/<key>
export function serveMedia(path: string): Response {
  const object = getObject(path.slice(URL_PREFIX.length))
  if (!object) return Response.json({ error: 'No existe' }, { status: 404 })
  return new Response(new Uint8Array(object.bytes), {
    headers: {
      'content-type': object.type,
      'cache-control': 'public, max-age=31536000, immutable',
      'x-content-type-options': 'nosniff',
    },
  })
}
