import type { ColumnKey } from '@retromode/shared'

/** Happy emoji for things that went well, gloomy ones for things to improve. */
const EMOJIS: Partial<Record<ColumnKey, string[]>> = {
  well: ['🎉', '🥳', '🌟', '💖', '🙌', '🔥', '👏', '😍', '💯', '🦄', '🍾', '🌈'],
  improve: ['😩', '💩', '😤', '🌧️', '👎', '😬', '🙈', '💔', '🐌', '🤦', '🥲', '⛈️'],
}

/** Deterministic hash, so every client picks the same emoji for the same moment. */
export function hash(s: string): number {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619)
  return h >>> 0
}

export function hasEmojis(column: ColumnKey): boolean {
  return !!EMOJIS[column]
}

/** The column's emoji for `key`, or null for columns without a set. */
export function pickEmoji(column: ColumnKey, key: string): string | null {
  const set = EMOJIS[column]
  return set ? set[hash(key) % set.length]! : null
}
