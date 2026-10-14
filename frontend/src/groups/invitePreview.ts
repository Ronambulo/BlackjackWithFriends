// What a shared invite link shows before anyone signs in (docs/DISENO.md, "Invitar"):
// read on the server by the /i/[codigo] page and its preview image.

const apiOrigin = process.env.API_ORIGIN ?? 'http://127.0.0.1:3001'

export interface InvitePreview {
  nombre: string
  members: number
  /** Empty when the group hides its ranking from invites. */
  top: { nombre: string; balance: number }[]
}

/** The invite behind a code, or null if it doesn't exist (anymore). */
export async function invitePreview(codigo: string): Promise<InvitePreview | null> {
  try {
    const res = await fetch(`${apiOrigin}/api/invite/preview?codigo=${encodeURIComponent(codigo)}`, {
      // Chat apps fetch a pasted link several times: a few minutes old is fine.
      next: { revalidate: 300 },
    })
    return res.ok ? ((await res.json()) as InvitePreview) : null
  } catch {
    return null
  }
}
