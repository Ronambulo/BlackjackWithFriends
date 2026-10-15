/**
 * A stable colour per player, so the same person looks the same everywhere: the
 * hue comes from a hash of their id, so two friends rarely get the same one.
 */
export function avatarColor(seed: string) {
  let hash = 0
  for (const char of seed) hash = (hash * 31 + char.charCodeAt(0)) | 0
  const hue = Math.abs(hash) % 360
  // A little lighter and greyer in some, so neighbouring hues still look different.
  const lightness = 62 + (Math.abs(hash >> 9) % 3) * 6
  return `hsl(${hue} 72% ${lightness}%)`
}

/** Up to two initials: "Los del Curro" → "LC", "Familia" → "F". */
export function initials(name: string) {
  const words = name.split(/\s+/).filter((word) => word.length > 2 || /^\p{Lu}/u.test(word))
  return (words.length > 1 ? words[0][0] + words[words.length - 1][0] : name.charAt(0)).toUpperCase()
}
