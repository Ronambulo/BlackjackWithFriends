import { neon } from '@neondatabase/serverless'
import { drizzle } from 'drizzle-orm/neon-http'
import { HttpError } from './http.js'
import * as schema from './schema.js'

function connect() {
  const url = process.env.DATABASE_URL
  if (!url) throw new HttpError(503, 'Falta DATABASE_URL (la base de datos de Neon)')
  return drizzle(neon(url), { schema })
}

let instance: ReturnType<typeof connect> | undefined

/** Drizzle over Neon's HTTP driver: one query per request, fine for serverless. */
export function db() {
  return (instance ??= connect())
}

export function isDatabaseConfigured(): boolean {
  return Boolean(process.env.DATABASE_URL)
}
