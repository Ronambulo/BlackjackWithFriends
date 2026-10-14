'use client'

// The invite a player arrived with. Someone who opens a friend's link usually has
// to sign up (and pick a name) first; this keeps the code on the device meanwhile,
// so once they're in, the app takes them back to that invite.

const STORAGE_KEY = 'bwf.pendingInvite'
/** An invite left unopened for longer than this is forgotten. */
const KEEP_MS = 24 * 60 * 60 * 1000

export function rememberInvite(codigo: string) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ codigo, at: Date.now() }))
  } catch {
    // Private mode: the link itself still works if they come back to it.
  }
}

export function pendingInvite(): string | null {
  try {
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null') as { codigo?: unknown; at?: unknown } | null
    if (typeof stored?.codigo !== 'string' || typeof stored.at !== 'number') return null
    return Date.now() - stored.at < KEEP_MS ? stored.codigo : null
  } catch {
    return null
  }
}

export function forgetInvite() {
  try {
    localStorage.removeItem(STORAGE_KEY)
  } catch {
    // Nothing stored.
  }
}

/** Where an invite opens inside the app. */
export function joinPath(codigo: string) {
  return `/grupos/unirse?codigo=${encodeURIComponent(codigo)}`
}

/** The link that's shared: a page of its own, so chat apps can show a preview of it. */
export function inviteLink(codigo: string) {
  return `${window.location.origin}/i/${encodeURIComponent(codigo)}`
}
