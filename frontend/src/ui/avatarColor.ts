const COLORS = ['#7dd3fc', '#f2c14e', '#c4b5fd', '#fdba74', '#86efac', '#fda4af']

/** A stable colour per player, so the same person looks the same everywhere. */
export function avatarColor(seed: string) {
  let hash = 0
  for (const char of seed) hash = (hash * 31 + char.charCodeAt(0)) | 0
  return COLORS[Math.abs(hash) % COLORS.length]
}
