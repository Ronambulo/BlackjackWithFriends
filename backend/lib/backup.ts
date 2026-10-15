import { mkdirSync, readdirSync, rmSync, statSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { databasePath, db } from './db.js'

// Copies of the database next to it, in backups/: one a day on its own and any
// the admins ask for. Only the newest KEEP stay. Restoring is done by hand
// (stop the app, put the copy in place of the database), never from the panel.

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

/** Takes the day's copy if the newest is older than a day; checks every hour. */
export function scheduleBackups() {
  const check = () => {
    const newest = listBackups()[0]
    if (!newest || Date.now() - newest.createdAt > DAY) createBackup().catch((err) => console.error('Copia fallida', err))
  }
  check()
  setInterval(check, 60 * 60 * 1000).unref()
}
