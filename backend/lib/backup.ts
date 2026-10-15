import { copyFileSync, mkdirSync, readdirSync, rmSync, statSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { databasePath, db, replaceDatabase } from './db.js'

// Copies of the database next to it, in backups/: one a day on its own and any
// the admins ask for. Only the newest KEEP stay. An admin can put one back from
// the panel; a copy of how things were is taken first.

const KEEP = 14
const DAY = 24 * 60 * 60 * 1000
const NAME = /^blackjack-\d{8}-\d{6}\.db$/

export function backupDir() {
  return join(dirname(databasePath()), 'backups')
}

export function listBackups() {
  try {
    return readdirSync(backupDir())
      .filter((name) => NAME.test(name))
      .map((name) => {
        const stat = statSync(join(backupDir(), name))
        return { name, bytes: stat.size, createdAt: stat.mtimeMs }
      })
      .sort((a, b) => b.createdAt - a.createdAt)
  } catch {
    return []
  }
}

/** A consistent copy taken while the app keeps running (SQLite's online backup). */
export async function createBackup() {
  mkdirSync(backupDir(), { recursive: true })
  const stamp = new Date().toISOString().replace(/[-:]/g, '').replace('T', '-').slice(0, 15)
  const name = `blackjack-${stamp}.db`
  await db().$client.backup(join(backupDir(), name))
  for (const old of listBackups().slice(KEEP)) rmSync(join(backupDir(), old.name), { force: true })
  return name
}

/**
 * Puts a copy back in place of the database, after taking one of how things are
 * now (so a restore can be undone too). Returns that copy's name, or null if
 * there's no copy called `name`. Whatever lives in memory must be forgotten after.
 */
export async function restoreBackup(name: string): Promise<string | null> {
  if (!listBackups().some((backup) => backup.name === name)) return null
  // Out of backups/ first: the new copy could push the oldest out of the newest KEEP.
  const staged = `${databasePath()}.restore`
  copyFileSync(join(backupDir(), name), staged)
  const before = await createBackup()
  replaceDatabase(staged)
  return before
}

/** Takes the day's copy if the newest is older than a day; checks every hour. */
export function scheduleBackups() {
  const check = () => {
    const newest = listBackups()[0]
    if (!newest || Date.now() - newest.createdAt > DAY) createBackup().catch((err) => console.error('Copia fallida', err))
  }
  check()
  setInterval(check, 60 * 60 * 1000).unref()
}
