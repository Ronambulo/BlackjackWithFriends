import { mkdirSync, renameSync, rmSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import Database from 'better-sqlite3'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import { migrate as runMigrations } from 'drizzle-orm/better-sqlite3/migrator'
import * as schema from './schema.js'

// backend/, both from lib/ (tsx) and dist/lib/ (built)
const backendDir = resolve(dirname(fileURLToPath(import.meta.url)), import.meta.url.includes('/dist/') ? '../..' : '..')

/** Where the database lives: DATABASE_PATH, or backend/data/blackjack.db in development. */
export function databasePath(): string {
  return process.env.DATABASE_PATH ?? resolve(backendDir, 'data/blackjack.db')
}

function connect() {
  const path = databasePath()
  mkdirSync(dirname(path), { recursive: true })
  const sqlite = new Database(path)
  // WAL lets reads go on while a write happens; without foreign_keys SQLite ignores the cascades.
  sqlite.pragma('journal_mode = WAL')
  sqlite.pragma('foreign_keys = ON')
  sqlite.pragma('busy_timeout = 5000')
  sqlite.pragma('synchronous = NORMAL')
  return drizzle(sqlite, { schema })
}

let instance: ReturnType<typeof connect> | undefined

/** Drizzle over a local SQLite file. One process, so queries run one after another. */
export function db() {
  return (instance ??= connect())
}

export type Db = ReturnType<typeof db>
/** The database or a transaction inside it: what helpers that may run in either take. */
export type Tx = Parameters<Parameters<Db['transaction']>[0]>[0] | Db

/** Applies the pending migrations in backend/drizzle. */
export function migrate() {
  runMigrations(db(), { migrationsFolder: resolve(backendDir, 'drizzle') })
}

/**
 * Puts a copy in place of the database: closes it, swaps the files and opens it
 * again, migrated. Everything runs in one process and SQLite calls are synchronous,
 * so no query sees it half done; whoever keeps data in memory must forget it after.
 */
export function replaceDatabase(copy: string) {
  instance?.$client.close()
  instance = undefined
  const path = databasePath()
  for (const suffix of ['-wal', '-shm']) rmSync(path + suffix, { force: true })
  renameSync(copy, path)
  migrate()
}

/** SQLite error code (SQLITE_CONSTRAINT_UNIQUE, SQLITE_CONSTRAINT_CHECK...), also when Drizzle wraps the driver's error. */
export function sqliteCode(err: unknown): string | undefined {
  const e = err as { code?: string; cause?: { code?: string } }
  return e?.code ?? e?.cause?.code
}
